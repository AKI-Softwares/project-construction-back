import { HttpError } from "../../shared/errors/http-error.js";
import { deleteCloudinaryPhoto, uploadSignature } from "../../shared/storage/cloudinary.js";
import { logAudit } from "../../shared/audit/audit-log.js";
import { sendPushToUsers, sendPushToCompanyInspectors } from "../../shared/push/push-notification.js";
import { generateVisitReport, type VisitReportData } from "../../shared/pdf/visit-report.js";
import type { VisitRepository } from "./visit.repository.js";
import type {
  FinalizeVisitInput,
  UpdateVisitItemInput,
  AddNonConformityInput,
  VisitMineQuery,
  VisitListQuery,
  CreateReinspectionInput,
} from "./visit.schema.js";

type GroupedItem = {
  id: number;
  serviceId: number;
  serviceName: string;
  status: "OK" | "NOK" | null;
  nonConformity: {
    id: number;
    description: string;
    resolvedAt: Date | null;
    resolvedById: number | null;
    createdAt: Date;
    photos: { id: number; url: string; uploadedAt: Date }[];
  } | null;
};

type GroupedRoom = {
  id: number;
  name: string;
  isComplete: boolean;
  items: GroupedItem[];
};

type VisitRaw = NonNullable<Awaited<ReturnType<VisitRepository["findById"]>>>;
type VisitItemRaw = VisitRaw["items"][number];

function groupByRoom(items: VisitItemRaw[]): GroupedRoom[] {
  const map = new Map<number, GroupedRoom>();

  for (const item of items) {
    const room = item.checklistItem.apartmentRoomService.apartmentRoom;
    if (!map.has(room.id)) {
      map.set(room.id, {
        id: room.id,
        name: room.name,
        isComplete: true,
        items: [],
      });
    }
    const group = map.get(room.id);
    if (!group) continue;

    group.isComplete = group.isComplete && item.status !== null;
    group.items.push({
      id: item.id,
      serviceId: item.checklistItem.apartmentRoomService.service.id,
      serviceName: item.checklistItem.apartmentRoomService.service.name,
      status: item.status,
      nonConformity: item.nonConformity
        ? {
            id: item.nonConformity.id,
            description: item.nonConformity.description,
            resolvedAt: item.nonConformity.resolvedAt,
            resolvedById: item.nonConformity.resolvedById,
            createdAt: item.nonConformity.createdAt,
            photos: item.nonConformity.photos,
          }
        : null,
    });
  }

  return Array.from(map.values());
}

export class VisitService {
  constructor(private repo: VisitRepository) {}

  private async cleanupNcPhotos(ncId: number) {
    const photos = await this.repo.findNcPhotos(ncId);
    for (const photo of photos) {
      try {
        await deleteCloudinaryPhoto(photo.publicId);
      } catch (err) {
        console.error(
          `[cleanupNcPhotos] Cloudinary cleanup failed for ${photo.publicId}:`,
          err,
        );
      }
    }
  }

  async getVisitGrouped(id: number, companyId: number) {
    const visit = await this.repo.findById(id, companyId);
    if (!visit) throw new HttpError(404, "Vistoria não encontrada.");
    const { items, checklist, ...rest } = visit;
    return {
      ...rest,
      apartment: checklist.apartment,
      rooms: groupByRoom(items),
    };
  }

  async listAll(companyId: number, filters: VisitListQuery) {
    const visits = await this.repo.findAllByCompany(companyId, filters);
    return visits.map(({ checklist, ...rest }) => ({
      ...rest,
      apartment: checklist.apartment,
    }));
  }

  async getMyVisits(inspectorId: number, companyId: number, status?: VisitMineQuery["status"]) {
    const visits = await this.repo.findByInspectorId(inspectorId, companyId, status);
    return visits.map(({ checklist, ...rest }) => ({
      ...rest,
      apartment: checklist.apartment,
    }));
  }

  async startVisit(visitId: number, companyId: number, userId: number) {
    const visit = await this.repo.findById(visitId, companyId);
    if (!visit) throw new HttpError(404, "Vistoria não encontrada.");
    if (visit.status !== "NOT_STARTED") {
      throw new HttpError(409, "A vistoria já foi iniciada ou finalizada.");
    }
    const updated = await this.repo.updateStatus(visitId, "ONGOING");
    void logAudit({ companyId, userId, entityType: "Visit", entityId: visitId, action: "STARTED", after: { status: "ONGOING" } });
    const { checklist, ...rest } = updated;
    return { ...rest, apartment: checklist.apartment };
  }

  async finalizeVisit(id: number, input: FinalizeVisitInput, userId: number, companyId: number) {
    const visit = await this.repo.findById(id, companyId);
    if (!visit) throw new HttpError(404, "Vistoria não encontrada.");
    if (visit.status === "FINALIZED")
      throw new HttpError(400, "A vistoria já foi finalizada.");
    if (visit.status === "NOT_STARTED")
      throw new HttpError(400, "A vistoria ainda não foi iniciada.");

    const unevaluatedItems = visit.items.filter((i) => i.status === null);
    if (unevaluatedItems.length > 0) {
      throw new HttpError(
        400,
        "Todos os itens devem ser avaliados antes de finalizar.",
      );
    }

    const nokWithoutNc = visit.items.filter(
      (i) => i.status === "NOK" && !i.nonConformity,
    );
    if (nokWithoutNc.length > 0) {
      throw new HttpError(
        400,
        "Todos os itens NOK devem ter uma não conformidade registrada.",
      );
    }

    const evaluatedItems = visit.items
      .filter(
        (i): i is typeof i & { status: "OK" | "NOK" } => i.status !== null,
      )
      .map((i) => ({ checklistItemId: i.checklistItemId, status: i.status }));

    const result = await this.repo.applyFinalization(
      visit.id,
      visit.checklistId,
      evaluatedItems,
      input,
      userId,
    );
    if (!result) throw new Error("Visit not found after finalization.");
    void logAudit({ companyId, userId, entityType: "Visit", entityId: id, action: "FINALIZED", after: { status: "FINALIZED", observations: input.observations } });
    return this.getVisitGrouped(visit.id, companyId);
  }

  async updateVisitItem(
    visitId: number,
    itemId: number,
    input: UpdateVisitItemInput,
    companyId: number,
    userId: number,
  ) {
    const visit = await this.repo.findById(visitId, companyId);
    if (!visit) throw new HttpError(404, "Vistoria não encontrada.");
    if (visit.status === "FINALIZED")
      throw new HttpError(400, "A vistoria já foi finalizada.");
    if (visit.status === "NOT_STARTED")
      throw new HttpError(400, "A vistoria ainda não foi iniciada.");

    const item = visit.items.find((i) => i.id === itemId);
    if (!item) throw new HttpError(404, "Item de vistoria não encontrado.");

    // VF-7/VF-14: revert always allowed — bypasses all room guards
    if (input.status === null) {
      if (item.nonConformity) {
        await this.cleanupNcPhotos(item.nonConformity.id); // VF-8
      }
      return this.repo.revertVisitItem(itemId, item.nonConformity?.id ?? null);
    }

    const targetRoomId =
      item.checklistItem.apartmentRoomService.apartmentRoom.id;

    // Build room map: roomId → items
    const roomMap = new Map<number, typeof visit.items>();
    for (const vi of visit.items) {
      const roomId = vi.checklistItem.apartmentRoomService.apartmentRoom.id;
      if (!roomMap.has(roomId)) roomMap.set(roomId, []);
      roomMap.get(roomId)!.push(vi);
    }

    // Guard 1: only one room may be in progress at a time.
    // A room is "in progress" if it has ≥1 evaluated AND ≥1 unevaluated item.
    // Inspector is free to start any untouched room, but cannot switch away from a partially-evaluated room.
    for (const [roomId, roomItems] of roomMap) {
      if (roomId === targetRoomId) continue;
      const hasEvaluated = roomItems.some((i) => i.status !== null);
      const hasUnevaluated = roomItems.some((i) => i.status === null);
      if (hasEvaluated && hasUnevaluated) {
        throw new HttpError(409, "Finalize o cômodo atual antes de mudar para outro.");
      }
    }

    // Guard 2 (visit-wide): block any evaluation while any visit item is NOK without NC.
    // Covers cross-room scenarios — not just within the current room.
    // Exemption: the item being evaluated itself (NOK → OK always allowed).
    const anyNokWithoutNc = visit.items.filter(
      (i) => i.id !== itemId && i.status === "NOK" && !i.nonConformity,
    );
    if (anyNokWithoutNc.length > 0) {
      throw new HttpError(
        409,
        "Registre a NC de todos os itens NOK antes de continuar.",
      );
    }

    // VF-8: cleanup Cloudinary when transitioning NOK → OK (NC cascade-deleted in repo)
    if (item.status === "NOK" && input.status !== "NOK" && item.nonConformity) {
      await this.cleanupNcPhotos(item.nonConformity.id);
    }

    const result = await this.repo.updateVisitItemWithNcCleanup(
      itemId,
      input.status,
      item.status,
      item.nonConformity?.id ?? null,
    );

    if (visit.type === "REINSPECTION" && visit.parentVisitId !== null && input.status === "OK") {
      const ncId = await this.repo.resolveParentNc(visit.parentVisitId, item.checklistItemId, userId);
      if (ncId !== null) {
        void logAudit({ companyId, userId, entityType: "NonConformity", entityId: ncId, action: "NC_RESOLVED", after: { resolvedViaReinspection: visitId } });
      }
    }

    return result;
  }

  async addNonConformity(
    visitId: number,
    itemId: number,
    input: AddNonConformityInput,
    companyId: number,
  ) {
    const visit = await this.repo.findById(visitId, companyId);
    if (!visit) throw new HttpError(404, "Vistoria não encontrada.");
    if (visit.status === "FINALIZED")
      throw new HttpError(400, "A vistoria já foi finalizada.");
    if (visit.status === "NOT_STARTED")
      throw new HttpError(400, "A vistoria ainda não foi iniciada.");

    const item = visit.items.find((i) => i.id === itemId);
    if (!item) throw new HttpError(404, "Item de vistoria não encontrado.");
    if (item.status !== "NOK") {
      throw new HttpError(
        409,
        "Não conformidade só pode ser registrada em itens NOK.",
      );
    }
    if (item.nonConformity) {
      throw new HttpError(409, "Este item já possui uma não conformidade registrada.");
    }

    return this.repo.createNonConformity(itemId, input.description, companyId);
  }

  async createReinspection(
    parentVisitId: number,
    companyId: number,
    input: CreateReinspectionInput,
    createdById: number,
  ) {
    const parent = await this.repo.findById(parentVisitId, companyId);
    if (!parent) throw new HttpError(404, "Visit not found.");
    if (parent.type !== "INITIAL") {
      throw new HttpError(400, "Não é possível criar uma re-inspeção de outra re-inspeção.");
    }
    if (parent.status !== "FINALIZED") {
      throw new HttpError(400, "A vistoria original deve estar finalizada para criar uma re-inspeção.");
    }
    const ncItemIds = await this.repo.findNcItemIdsByVisitId(parentVisitId);
    if (ncItemIds.length === 0) {
      throw new HttpError(400, "Parent visit has no open non-conformities to reinspect.");
    }
    const visit = await this.repo.createReinspection(
      { id: parent.id, checklistId: parent.checklistId, companyId },
      createdById,
      ncItemIds,
      input,
    );
    void logAudit({ companyId, userId: createdById, entityType: "Visit", entityId: visit.id, action: "REINSPECTION_CREATED", after: { parentVisitId, inspectorId: input.inspectorId ?? null } });
    if (input.inspectorId !== undefined) {
      void sendPushToUsers([input.inspectorId], { title: "Nova re-inspeção atribuída", body: `Apt ${visit.checklist.apartment.identifier} — ${visit.checklist.apartment.building.name}`, data: { visitId: visit.id } });
    } else {
      void sendPushToCompanyInspectors(companyId, { title: "Re-inspeção disponível", body: `Apt ${visit.checklist.apartment.identifier} — ${visit.checklist.apartment.building.name}`, data: { visitId: visit.id } });
    }
    const { checklist, ...rest } = visit;
    return { ...rest, apartment: checklist.apartment };
  }

  async getAvailableReinspections(companyId: number) {
    const visits = await this.repo.findAvailableReinspections(companyId);
    return visits.map(({ checklist, ...rest }) => ({ ...rest, apartment: checklist.apartment }));
  }

  async claimReinspection(visitId: number, companyId: number, inspectorId: number) {
    const visit = await this.repo.findById(visitId, companyId);
    if (!visit) throw new HttpError(404, "Vistoria não encontrada.");
    if (visit.type !== "REINSPECTION") {
      throw new HttpError(400, "Apenas re-inspeções podem ser assumidas.");
    }
    if (visit.inspector !== null) {
      throw new HttpError(409, "Esta re-inspeção já está atribuída a outro inspetor.");
    }
    const updated = await this.repo.claimReinspection(visitId, companyId, inspectorId);
    void logAudit({ companyId, userId: inspectorId, entityType: "Visit", entityId: visitId, action: "CLAIMED", after: { inspectorId } });
    const { checklist, ...rest } = updated;
    return { ...rest, apartment: checklist.apartment };
  }

  async generateReport(visitId: number, companyId: number): Promise<Buffer> {
    const visit = await this.repo.getReportData(visitId, companyId);
    if (!visit) throw new HttpError(404, "Vistoria não encontrada.");
    if (visit.status !== "FINALIZED")
      throw new HttpError(400, "O relatório só está disponível para vistorias finalizadas.");

    // Group items by room
    const roomMap = new Map<string, VisitReportData["rooms"][number]>();
    for (const item of visit.items) {
      const roomName = item.checklistItem.apartmentRoomService.apartmentRoom.name;
      if (!roomMap.has(roomName)) roomMap.set(roomName, { name: roomName, items: [] });
      roomMap.get(roomName)!.items.push({
        serviceName: item.checklistItem.apartmentRoomService.service.name,
        status: item.status,
        nonConformity: item.nonConformity ? { description: item.nonConformity.description } : null,
      });
    }

    return generateVisitReport({
      id: visit.id,
      type: visit.type,
      buildingName: visit.checklist.apartment.building.name,
      apartmentIdentifier: visit.checklist.apartment.identifier,
      floor: visit.checklist.apartment.floor,
      block: visit.checklist.apartment.block,
      inspectorName: visit.inspector?.name ?? null,
      finalizedAt: visit.finalizedAt,
      signatureUrl: visit.signatureUrl,
      rooms: Array.from(roomMap.values()),
    });
  }

  async saveSignature(visitId: number, companyId: number, imageBase64: string, userId: number) {
    const visit = await this.repo.findById(visitId, companyId);
    if (!visit) throw new HttpError(404, "Vistoria não encontrada.");
    if (visit.status !== "FINALIZED")
      throw new HttpError(400, "A assinatura só é permitida em vistorias finalizadas.");

    const buffer = Buffer.from(imageBase64, "base64");
    if (!buffer.length) throw new HttpError(400, "Imagem de assinatura inválida.");
    const { secureUrl } = await uploadSignature(buffer);
    const result = await this.repo.saveSignatureUrl(visitId, companyId, secureUrl);
    void logAudit({ companyId, userId, entityType: "Visit", entityId: visitId, action: "SIGNED", after: { signatureUrl: secureUrl } });
    return result;
  }

  async deleteNonConformity(visitId: number, itemId: number, companyId: number) {
    const visit = await this.repo.findById(visitId, companyId);
    if (!visit) throw new HttpError(404, "Vistoria não encontrada.");
    if (visit.status === "FINALIZED")
      throw new HttpError(400, "A vistoria já foi finalizada.");
    if (visit.status === "NOT_STARTED")
      throw new HttpError(400, "A vistoria ainda não foi iniciada.");

    const item = visit.items.find((i) => i.id === itemId);
    if (!item) throw new HttpError(404, "Item de vistoria não encontrado.");
    if (!item.nonConformity)
      throw new HttpError(404, "Nenhuma não conformidade encontrada para este item.");

    await this.cleanupNcPhotos(item.nonConformity.id); // VF-8
    return this.repo.deleteNonConformity(item.nonConformity.id);
  }
}
