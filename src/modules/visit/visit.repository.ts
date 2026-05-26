import { prisma } from "../../shared/infra/database/prisma.js";
import type { FinalizeVisitInput } from "./visit.schema.js";

const VISIT_DETAIL_SELECT = {
  id: true,
  checklistId: true,
  observations: true,
  status: true,
  finalizedAt: true,
  createdAt: true,
  updatedAt: true,
  inspector: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
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
          createdAt: true,
          photos: { select: { id: true, url: true, uploadedAt: true } },
        },
      },
    },
    orderBy: { id: "asc" as const },
  },
} as const;

export class VisitRepository {
  async findById(id: number) {
    return prisma.visit.findUnique({ where: { id }, select: VISIT_DETAIL_SELECT });
  }

  async applyFinalization(
    visitId: number,
    checklistId: number,
    items: Array<{ checklistItemId: number; status: "PENDING" | "OK" | "NOK" }>,
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
          ...(input.observations !== undefined && { observations: input.observations }),
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

      return tx.visit.findUnique({ where: { id: visitId }, select: VISIT_DETAIL_SELECT });
    });
  }

  async updateVisitItemWithNcCleanup(
    itemId: number,
    newStatus: "PENDING" | "OK" | "NOK",
    currentStatus: string,
    ncId: number | null,
  ) {
    if (currentStatus === "NOK" && newStatus !== "NOK" && ncId !== null) {
      return prisma.$transaction(async (tx) => {
        await tx.nonConformity.delete({ where: { id: ncId } });
        return tx.visitItem.update({
          where: { id: itemId },
          data: { status: newStatus },
          select: { id: true, status: true, visitId: true, checklistItemId: true },
        });
      });
    }
    return prisma.visitItem.update({
      where: { id: itemId },
      data: { status: newStatus },
      select: { id: true, status: true, visitId: true, checklistItemId: true },
    });
  }

  async createNonConformity(visitItemId: number, description: string) {
    return prisma.nonConformity.create({
      data: { visitItemId, description },
      select: {
        id: true,
        description: true,
        createdAt: true,
        photos: { select: { id: true, url: true, uploadedAt: true } },
      },
    });
  }

  async deleteNonConformity(ncId: number) {
    return prisma.nonConformity.delete({ where: { id: ncId }, select: { id: true } });
  }
}
