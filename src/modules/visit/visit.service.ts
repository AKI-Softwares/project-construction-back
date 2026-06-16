import { HttpError } from "../../shared/errors/http-error.js";
import { deleteCloudinaryPhoto } from "../../shared/storage/cloudinary.js";
import type { VisitRepository } from "./visit.repository.js";
import type {
  FinalizeVisitInput,
  UpdateVisitItemInput,
  AddNonConformityInput,
  VisitMineQuery,
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
    if (!visit) throw new HttpError(404, "Visit not found.");
    const { items, checklist, ...rest } = visit;
    return {
      ...rest,
      apartment: checklist.apartment,
      rooms: groupByRoom(items),
    };
  }

  async getMyVisits(inspectorId: number, companyId: number, status?: VisitMineQuery["status"]) {
    const visits = await this.repo.findByInspectorId(inspectorId, companyId, status);
    return visits.map(({ checklist, ...rest }) => ({
      ...rest,
      apartment: checklist.apartment,
    }));
  }

  async startVisit(visitId: number, companyId: number) {
    const visit = await this.repo.findById(visitId, companyId);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.status !== "NOT_STARTED") {
      throw new HttpError(409, "Visit has already been started or finalized.");
    }
    const updated = await this.repo.updateStatus(visitId, "ONGOING");
    const { checklist, ...rest } = updated;
    return { ...rest, apartment: checklist.apartment };
  }

  async finalizeVisit(id: number, input: FinalizeVisitInput, userId: number, companyId: number) {
    const visit = await this.repo.findById(id, companyId);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.status === "FINALIZED")
      throw new HttpError(400, "Visit is already finalized.");
    if (visit.status === "NOT_STARTED")
      throw new HttpError(400, "Visit has not been started yet.");

    const unevaluatedItems = visit.items.filter((i) => i.status === null);
    if (unevaluatedItems.length > 0) {
      throw new HttpError(
        400,
        "All items must be evaluated before finalizing.",
      );
    }

    const nokWithoutNc = visit.items.filter(
      (i) => i.status === "NOK" && !i.nonConformity,
    );
    if (nokWithoutNc.length > 0) {
      throw new HttpError(
        400,
        "All NOK items must have a non-conformity recorded.",
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
    return this.getVisitGrouped(visit.id, companyId);
  }

  async updateVisitItem(
    visitId: number,
    itemId: number,
    input: UpdateVisitItemInput,
    companyId: number,
  ) {
    const visit = await this.repo.findById(visitId, companyId);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.status === "FINALIZED")
      throw new HttpError(400, "Visit is already finalized.");
    if (visit.status === "NOT_STARTED")
      throw new HttpError(400, "Visit has not been started yet.");

    const item = visit.items.find((i) => i.id === itemId);
    if (!item) throw new HttpError(404, "Visit item not found.");

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
        throw new HttpError(409, "Finish current room before switching.");
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
        "Record non-conformity for all NOK items before proceeding.",
      );
    }

    // VF-8: cleanup Cloudinary when transitioning NOK → OK (NC cascade-deleted in repo)
    if (item.status === "NOK" && input.status !== "NOK" && item.nonConformity) {
      await this.cleanupNcPhotos(item.nonConformity.id);
    }

    return this.repo.updateVisitItemWithNcCleanup(
      itemId,
      input.status,
      item.status,
      item.nonConformity?.id ?? null,
    );
  }

  async addNonConformity(
    visitId: number,
    itemId: number,
    input: AddNonConformityInput,
    companyId: number,
  ) {
    const visit = await this.repo.findById(visitId, companyId);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.status === "FINALIZED")
      throw new HttpError(400, "Visit is already finalized.");
    if (visit.status === "NOT_STARTED")
      throw new HttpError(400, "Visit has not been started yet.");

    const item = visit.items.find((i) => i.id === itemId);
    if (!item) throw new HttpError(404, "Visit item not found.");
    if (item.status !== "NOK") {
      throw new HttpError(
        409,
        "Non-conformity can only be added to NOK items.",
      );
    }
    if (item.nonConformity) {
      throw new HttpError(409, "This item already has a non-conformity.");
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
      throw new HttpError(400, "Cannot create a reinspection of a reinspection.");
    }
    if (parent.status !== "FINALIZED") {
      throw new HttpError(400, "Parent visit must be finalized before creating a reinspection.");
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
    const { checklist, ...rest } = visit;
    return { ...rest, apartment: checklist.apartment };
  }

  async getAvailableReinspections(companyId: number) {
    const visits = await this.repo.findAvailableReinspections(companyId);
    return visits.map(({ checklist, ...rest }) => ({ ...rest, apartment: checklist.apartment }));
  }

  async claimReinspection(visitId: number, companyId: number, inspectorId: number) {
    const visit = await this.repo.findById(visitId, companyId);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.type !== "REINSPECTION") {
      throw new HttpError(400, "Only reinspection visits can be claimed.");
    }
    if (visit.inspector !== null) {
      throw new HttpError(409, "This reinspection is already assigned to an inspector.");
    }
    const updated = await this.repo.claimReinspection(visitId, companyId, inspectorId);
    const { checklist, ...rest } = updated;
    return { ...rest, apartment: checklist.apartment };
  }

  async deleteNonConformity(visitId: number, itemId: number, companyId: number) {
    const visit = await this.repo.findById(visitId, companyId);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.status === "FINALIZED")
      throw new HttpError(400, "Visit is already finalized.");
    if (visit.status === "NOT_STARTED")
      throw new HttpError(400, "Visit has not been started yet.");

    const item = visit.items.find((i) => i.id === itemId);
    if (!item) throw new HttpError(404, "Visit item not found.");
    if (!item.nonConformity)
      throw new HttpError(404, "No non-conformity found for this item.");

    await this.cleanupNcPhotos(item.nonConformity.id); // VF-8
    return this.repo.deleteNonConformity(item.nonConformity.id);
  }
}
