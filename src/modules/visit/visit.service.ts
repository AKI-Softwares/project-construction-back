import { HttpError } from "../../shared/errors/http-error.js";
import type { VisitRepository } from "./visit.repository.js";
import type {
  FinalizeVisitInput,
  UpdateVisitItemInput,
  AddNonConformityInput,
} from "./visit.schema.js";

export class VisitService {
  constructor(private repo: VisitRepository) {}

  async getVisit(id: number) {
    const visit = await this.repo.findById(id);
    if (!visit) throw new HttpError(404, "Visit not found.");
    return visit;
  }

  async finalizeVisit(id: number, input: FinalizeVisitInput, userId: number) {
    const visit = await this.repo.findById(id);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.status === "FINALIZED") throw new HttpError(400, "Visit is already finalized.");

    const pendingItems = visit.items.filter((i) => i.status === "PENDING");
    if (pendingItems.length > 0) {
      throw new HttpError(400, "All items must be evaluated before finalizing.");
    }

    const nokWithoutNc = visit.items.filter(
      (i) => i.status === "NOK" && !i.nonConformity,
    );
    if (nokWithoutNc.length > 0) {
      throw new HttpError(400, "All NOK items must have a non-conformity recorded.");
    }

    const result = await this.repo.applyFinalization(visit.id, visit.checklistId, visit.items, input, userId);
    if (!result) throw new Error("Visit not found after finalization.");
    return result;
  }

  async updateVisitItem(visitId: number, itemId: number, input: UpdateVisitItemInput) {
    const visit = await this.repo.findById(visitId);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.status === "FINALIZED") throw new HttpError(400, "Visit is already finalized.");

    const item = visit.items.find((i) => i.id === itemId);
    if (!item) throw new HttpError(404, "Visit item not found.");

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
