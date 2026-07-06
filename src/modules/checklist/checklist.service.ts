import { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../shared/errors/http-error.js";
import type { ChecklistRepository } from "./checklist.repository.js";
import type {
  UpdateChecklistInput,
  CreateVisitInput,
} from "./checklist.schema.js";

export class ChecklistService {
  constructor(private repo: ChecklistRepository) {}

  async listChecklists(apartmentId?: number) {
    return this.repo.findAll(apartmentId);
  }

  async getChecklist(id: number) {
    const checklist = await this.repo.findById(id);
    if (!checklist) throw new HttpError(404, "Checklist not found.");
    return checklist;
  }

  async updateChecklist(
    id: number,
    input: UpdateChecklistInput,
    userId: number,
  ) {
    const checklist = await this.repo.findById(id);
    if (!checklist) throw new HttpError(404, "Checklist not found.");

    const updateData: {
      title?: string;
      status?: "PENDING" | "FINALIZED";
      finalizedById?: number | null;
      finalizedAt?: Date | null;
    } = {};

    if (input.title !== undefined) updateData.title = input.title;

    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === "FINALIZED") {
        updateData.finalizedById = userId;
        updateData.finalizedAt = new Date();
      } else {
        updateData.finalizedById = null;
        updateData.finalizedAt = null;
      }
    }

    return this.repo.update(id, updateData);
  }

  async createVisit(
    checklistId: number,
    input: CreateVisitInput,
    createdById: number,
    companyId: number,
  ) {
    const checklist = await this.repo.findById(checklistId);
    if (!checklist) throw new HttpError(404, "Checklist not found.");
    if (checklist.status === "FINALIZED") {
      throw new HttpError(409, "Checklist is already finalized.");
    }

    const activeVisit = checklist.visits.find(
      (v) => v.status === "NOT_STARTED" || v.status === "ONGOING",
    );
    if (activeVisit) {
      throw new HttpError(
        409,
        "A visit is already in progress for this checklist.",
      );
    }

    const items = await this.repo.findPendingOrNokItems(checklistId);
    if (items.length === 0) {
      throw new HttpError(409, "No items to inspect in this checklist.");
    }

    try {
      return await this.repo.createVisitWithItems(
        checklistId,
        input.inspectorId,
        createdById,
        items.map((i) => i.id),
        companyId,
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2003"
      ) {
        throw new HttpError(422, "Inspector not found.");
      }
      throw e;
    }
  }

  async listVisits(checklistId: number) {
    const checklist = await this.repo.findById(checklistId);
    if (!checklist) throw new HttpError(404, "Checklist not found.");
    return this.repo.findVisits(checklistId);
  }

  async resolveItem(
    checklistId: number,
    itemId: number,
    companyId: number,
    userId: number,
  ) {
    const result = await this.repo.resolveItem(checklistId, itemId, companyId, userId);
    if (!result) throw new HttpError(404, "Checklist item not found or access denied.");
    return result;
  }
}
