import { HttpError } from "../../shared/errors/http-error.js";
import type { VisitRepository } from "./visit.repository.js";
import type {
  FinalizeVisitInput,
  UpdateVisitItemInput,
  AddNonConformityInput,
} from "./visit.schema.js";

type GroupedItem = {
  id: number;
  serviceId: number;
  serviceName: string;
  status: string | null;
  nonConformity: {
    id: number;
    description: string;
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
      map.set(room.id, { id: room.id, name: room.name, isComplete: true, items: [] });
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

  async getVisit(id: number) {
    const visit = await this.repo.findById(id);
    if (!visit) throw new HttpError(404, "Visit not found.");
    return visit;
  }

  async getVisitGrouped(id: number) {
    const visit = await this.repo.findById(id);
    if (!visit) throw new HttpError(404, "Visit not found.");
    const { items, ...rest } = visit;
    return { ...rest, rooms: groupByRoom(items) };
  }

  async finalizeVisit(id: number, input: FinalizeVisitInput, userId: number) {
    const visit = await this.repo.findById(id);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.status === "FINALIZED") throw new HttpError(400, "Visit is already finalized.");

    const unevaluatedItems = visit.items.filter((i) => i.status === null);
    if (unevaluatedItems.length > 0) {
      throw new HttpError(400, "All items must be evaluated before finalizing.");
    }

    const nokWithoutNc = visit.items.filter(
      (i) => i.status === "NOK" && !i.nonConformity,
    );
    if (nokWithoutNc.length > 0) {
      throw new HttpError(400, "All NOK items must have a non-conformity recorded.");
    }

    const evaluatedItems = visit.items
      .filter((i): i is typeof i & { status: "OK" | "NOK" } => i.status !== null)
      .map((i) => ({ checklistItemId: i.checklistItemId, status: i.status }));

    const result = await this.repo.applyFinalization(visit.id, visit.checklistId, evaluatedItems, input, userId);
    if (!result) throw new Error("Visit not found after finalization.");
    return result;
  }

  async updateVisitItem(visitId: number, itemId: number, input: UpdateVisitItemInput) {
    const visit = await this.repo.findById(visitId);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.status === "FINALIZED") throw new HttpError(400, "Visit is already finalized.");

    const item = visit.items.find((i) => i.id === itemId);
    if (!item) throw new HttpError(404, "Visit item not found.");

    const targetRoomId = item.checklistItem.apartmentRoomService.apartmentRoom.id;

    // Build room map: roomId → items
    const roomMap = new Map<number, typeof visit.items>();
    for (const vi of visit.items) {
      const roomId = vi.checklistItem.apartmentRoomService.apartmentRoom.id;
      if (!roomMap.has(roomId)) roomMap.set(roomId, []);
      roomMap.get(roomId)!.push(vi);
    }

    // Guard 1: block switching to a different room while another room is in progress
    for (const [roomId, roomItems] of roomMap) {
      if (roomId === targetRoomId) continue;
      const hasEvaluated = roomItems.some((i) => i.status !== null);
      const hasUnevaluated = roomItems.some((i) => i.status === null);
      if (hasEvaluated && hasUnevaluated) {
        throw new HttpError(409, "Finish current room before switching.");
      }
    }

    // Guard 2: block evaluating next item while current room has NOK items without NC
    const roomItems = roomMap.get(targetRoomId) ?? [];
    // i.id !== itemId: re-evaluating the current NOK item (e.g., NOK → OK) is always allowed
    const nokWithoutNc = roomItems.filter(
      (i) => i.id !== itemId && i.status === "NOK" && !i.nonConformity,
    );
    if (nokWithoutNc.length > 0) {
      throw new HttpError(409, "Record non-conformity for all NOK items before proceeding.");
    }

    return this.repo.updateVisitItemWithNcCleanup(
      itemId,
      input.status,
      item.status,
      item.nonConformity?.id ?? null,
    );
  }

  async addNonConformity(visitId: number, itemId: number, input: AddNonConformityInput) {
    const visit = await this.repo.findById(visitId);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.status === "FINALIZED") throw new HttpError(400, "Visit is already finalized.");

    const item = visit.items.find((i) => i.id === itemId);
    if (!item) throw new HttpError(404, "Visit item not found.");
    if (item.status !== "NOK") {
      throw new HttpError(409, "Non-conformity can only be added to NOK items.");
    }
    if (item.nonConformity) {
      throw new HttpError(409, "This item already has a non-conformity.");
    }

    return this.repo.createNonConformity(itemId, input.description);
  }

  async deleteNonConformity(visitId: number, itemId: number) {
    const visit = await this.repo.findById(visitId);
    if (!visit) throw new HttpError(404, "Visit not found.");

    const item = visit.items.find((i) => i.id === itemId);
    if (!item) throw new HttpError(404, "Visit item not found.");
    if (!item.nonConformity) throw new HttpError(404, "No non-conformity found for this item.");

    return this.repo.deleteNonConformity(item.nonConformity.id);
  }
}
