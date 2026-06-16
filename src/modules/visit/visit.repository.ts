import { prisma } from "../../shared/infra/database/prisma.js";
import type { FinalizeVisitInput, CreateReinspectionInput } from "./visit.schema.js";

const VISIT_MINE_SELECT = {
  id: true,
  type: true,
  status: true,
  inspectorId: true,
  parentVisitId: true,
  scheduledFor: true,
  createdAt: true,
  checklist: {
    select: {
      apartment: {
        select: {
          identifier: true,
          floor: true,
          block: true,
          building: { select: { name: true } },
        },
      },
    },
  },
} as const;

const VISIT_DETAIL_SELECT = {
  id: true,
  type: true,
  parentVisitId: true,
  checklistId: true,
  observations: true,
  status: true,
  scheduledFor: true,
  finalizedAt: true,
  createdAt: true,
  updatedAt: true,
  inspector: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  checklist: {
    select: {
      apartment: {
        select: {
          identifier: true,
          floor: true,
          block: true,
          building: { select: { name: true } },
        },
      },
    },
  },
  items: {
    select: {
      id: true,
      status: true,
      checklistItemId: true,
      checklistItem: {
        select: {
          id: true,
          apartmentRoomService: {
            select: {
              id: true,
              service: { select: { id: true, name: true, category: true } },
              apartmentRoom: { select: { id: true, name: true } },
            },
          },
        },
      },
      nonConformity: {
        select: {
          id: true,
          description: true,
          resolvedAt: true,
          resolvedById: true,
          createdAt: true,
          photos: { select: { id: true, url: true, uploadedAt: true } },
        },
      },
    },
    orderBy: { id: "asc" as const },
  },
} as const;

export class VisitRepository {
  async findById(id: number, companyId: number) {
    return prisma.visit.findUnique({
      where: { id, companyId },
      select: VISIT_DETAIL_SELECT,
    });
  }

  async applyFinalization(
    visitId: number,
    checklistId: number,
    items: Array<{ checklistItemId: number; status: "OK" | "NOK" }>,
    input: FinalizeVisitInput,
    finalizedById: number,
  ) {
    return prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.checklistItem.update({
          where: { id: item.checklistItemId },
          data: { status: item.status },
        });
      }

      await tx.visit.update({
        where: { id: visitId },
        data: {
          status: "FINALIZED",
          finalizedAt: new Date(),
          ...(input.observations !== undefined && {
            observations: input.observations,
          }),
        },
      });

      const notOkCount = await tx.checklistItem.count({
        where: { checklistId, status: { not: "OK" } },
      });

      if (notOkCount === 0) {
        await tx.checklist.update({
          where: { id: checklistId },
          data: { status: "FINALIZED", finalizedById, finalizedAt: new Date() },
        });
      }

      return tx.visit.findUnique({
        where: { id: visitId },
        select: VISIT_DETAIL_SELECT,
      });
    });
  }

  async updateVisitItemWithNcCleanup(
    itemId: number,
    newStatus: "OK" | "NOK",
    currentStatus: "OK" | "NOK" | null,
    ncId: number | null,
  ) {
    if (currentStatus === "NOK" && newStatus !== "NOK" && ncId !== null) {
      return prisma.$transaction(async (tx) => {
        await tx.nonConformity.delete({ where: { id: ncId } });
        return tx.visitItem.update({
          where: { id: itemId },
          data: { status: newStatus },
          select: {
            id: true,
            status: true,
            visitId: true,
            checklistItemId: true,
          },
        });
      });
    }
    return prisma.visitItem.update({
      where: { id: itemId },
      data: { status: newStatus },
      select: { id: true, status: true, visitId: true, checklistItemId: true },
    });
  }

  async createNonConformity(visitItemId: number, description: string, companyId: number) {
    return prisma.nonConformity.create({
      data: { visitItemId, description, companyId },
      select: {
        id: true,
        description: true,
        createdAt: true,
        photos: { select: { id: true, url: true, uploadedAt: true } },
      },
    });
  }

  async deleteNonConformity(ncId: number) {
    return prisma.nonConformity.delete({
      where: { id: ncId },
      select: { id: true },
    });
  }

  async findByInspectorId(
    inspectorId: number,
    companyId: number,
    status?: Array<"NOT_STARTED" | "ONGOING" | "FINALIZED">,
  ) {
    return prisma.visit.findMany({
      where: {
        inspectorId,
        companyId,
        ...(status !== undefined &&
          status.length > 0 && { status: { in: status } }),
      },
      select: VISIT_MINE_SELECT,
      orderBy: { createdAt: "desc" as const },
    });
  }

  async updateStatus(visitId: number, status: "ONGOING") {
    return prisma.visit.update({
      where: { id: visitId },
      data: { status },
      select: VISIT_MINE_SELECT,
    });
  }

  async findNcPhotos(ncId: number): Promise<{ publicId: string }[]> {
    return prisma.photo.findMany({
      where: { nonConformityId: ncId },
      select: { publicId: true },
    });
  }

  async findNcItemIdsByVisitId(visitId: number): Promise<number[]> {
    const items = await prisma.visitItem.findMany({
      where: { visitId, nonConformity: { isNot: null } },
      select: { checklistItemId: true },
    });
    return items.map((i) => i.checklistItemId);
  }

  async createReinspection(
    parentVisit: { id: number; checklistId: number; companyId: number },
    createdById: number,
    ncChecklistItemIds: number[],
    input: CreateReinspectionInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const visit = await tx.visit.create({
        data: {
          checklistId: parentVisit.checklistId,
          companyId: parentVisit.companyId,
          createdById,
          type: "REINSPECTION",
          parentVisitId: parentVisit.id,
          ...(input.inspectorId !== undefined && { inspectorId: input.inspectorId }),
          ...(input.scheduledFor !== undefined && { scheduledFor: new Date(input.scheduledFor) }),
        },
        select: VISIT_MINE_SELECT,
      });
      await tx.visitItem.createMany({
        data: ncChecklistItemIds.map((checklistItemId) => ({
          visitId: visit.id,
          checklistItemId,
        })),
      });
      return visit;
    });
  }

  async findAvailableReinspections(companyId: number) {
    return prisma.visit.findMany({
      where: {
        companyId,
        type: "REINSPECTION",
        inspectorId: null,
        status: { in: ["NOT_STARTED", "ONGOING"] },
      },
      select: VISIT_MINE_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  async claimReinspection(visitId: number, companyId: number, inspectorId: number) {
    return prisma.visit.update({
      where: { id: visitId, companyId },
      data: { inspectorId },
      select: VISIT_MINE_SELECT,
    });
  }

  async revertVisitItem(itemId: number, ncId: number | null) {
    if (ncId !== null) {
      return prisma.$transaction(async (tx) => {
        await tx.nonConformity.delete({ where: { id: ncId } });
        return tx.visitItem.update({
          where: { id: itemId },
          data: { status: null },
          select: { id: true, status: true, visitId: true, checklistItemId: true },
        });
      });
    }
    return prisma.visitItem.update({
      where: { id: itemId },
      data: { status: null },
      select: { id: true, status: true, visitId: true, checklistItemId: true },
    });
  }
}
