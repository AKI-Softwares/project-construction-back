import { prisma } from "../../shared/infra/database/prisma.js";

const CHECKLIST_LIST_SELECT = {
  id: true,
  apartmentId: true,
  title: true,
  status: true,
  finalizedAt: true,
  createdAt: true,
  updatedAt: true,
  apartment: {
    select: {
      id: true,
      identifier: true,
      building: { select: { id: true, name: true } },
    },
  },
  finalizedBy: { select: { id: true, name: true } },
} as const;

const CHECKLIST_DETAIL_SELECT = {
  id: true,
  apartmentId: true,
  title: true,
  status: true,
  finalizedAt: true,
  createdAt: true,
  updatedAt: true,
  apartment: {
    select: {
      id: true,
      identifier: true,
      building: { select: { id: true, name: true } },
    },
  },
  finalizedBy: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      status: true,
      apartmentRoomServiceId: true,
      createdAt: true,
      updatedAt: true,
      apartmentRoomService: {
        select: {
          id: true,
          service: { select: { id: true, name: true, category: true } },
          apartmentRoom: { select: { id: true, name: true } },
        },
      },
      visitItems: {
        where: { nonConformity: { isNot: null } },
        select: {
          nonConformity: {
            select: {
              id: true,
              description: true,
              resolvedAt: true,
            },
          },
        },
      },
    },
    orderBy: { id: "asc" as const },
  },
  visits: {
    select: {
      id: true,
      status: true,
      finalizedAt: true,
      createdAt: true,
      inspector: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

const VISIT_SUMMARY_SELECT = {
  id: true,
  status: true,
  observations: true,
  finalizedAt: true,
  createdAt: true,
  updatedAt: true,
  inspector: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

export class ChecklistRepository {
  async findAll(apartmentId?: number) {
    return prisma.checklist.findMany({
      ...(apartmentId !== undefined && { where: { apartmentId } }),
      select: CHECKLIST_LIST_SELECT,
      orderBy: { createdAt: "desc" as const },
    });
  }

  async findById(id: number) {
    return prisma.checklist.findUnique({
      where: { id },
      select: CHECKLIST_DETAIL_SELECT,
    });
  }

  async update(
    id: number,
    data: {
      title?: string;
      status?: "PENDING" | "FINALIZED";
      finalizedById?: number | null;
      finalizedAt?: Date | null;
    },
  ) {
    return prisma.checklist.update({
      where: { id },
      data,
      select: CHECKLIST_LIST_SELECT,
    });
  }

  async findPendingOrNokItems(checklistId: number) {
    return prisma.checklistItem.findMany({
      where: { checklistId, status: { in: ["PENDING", "NOK"] } },
      select: { id: true },
    });
  }

  async createVisitWithItems(
    checklistId: number,
    inspectorId: number,
    createdById: number,
    itemIds: number[],
    companyId: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const visit = await tx.visit.create({
        data: { checklistId, inspectorId, createdById, companyId },
        select: { id: true },
      });

      await tx.visitItem.createMany({
        data: itemIds.map((checklistItemId) => ({
          visitId: visit.id,
          checklistItemId,
        })),
      });

      const full = await tx.visit.findUnique({
        where: { id: visit.id },
        select: VISIT_SUMMARY_SELECT,
      });
      if (!full) throw new Error("Visit not found immediately after creation.");
      return full;
    });
  }

  async findVisits(checklistId: number) {
    return prisma.visit.findMany({
      where: { checklistId },
      select: VISIT_SUMMARY_SELECT,
      orderBy: { createdAt: "desc" as const },
    });
  }
}
