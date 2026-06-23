import { prisma } from "../../shared/infra/database/prisma.js";
import type { ListNcQuery } from "./non-conformity.schema.js";

const NC_LIST_SELECT = {
  id: true,
  description: true,
  resolvedAt: true,
  resolvedById: true,
  createdAt: true,
  photos: { select: { id: true, url: true, uploadedAt: true } },
  visitItem: {
    select: {
      id: true,
      visitId: true,
      checklistItem: {
        select: {
          apartmentRoomService: {
            select: {
              service: { select: { id: true, name: true } },
              apartmentRoom: { select: { id: true, name: true } },
            },
          },
        },
      },
      visit: {
        select: {
          id: true,
          type: true,
          inspector: { select: { id: true, name: true } },
          checklist: {
            select: {
              apartment: {
                select: {
                  id: true,
                  identifier: true,
                  floor: true,
                  block: true,
                  building: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export class NonConformityRepository {
  async findAll(companyId: number, filters: ListNcQuery) {
    const { buildingId, inspectorId, status, from, to } = filters;
    return prisma.nonConformity.findMany({
      where: {
        companyId,
        ...(status === "open" && { resolvedAt: null }),
        ...(status === "resolved" && { resolvedAt: { not: null } }),
        ...(inspectorId !== undefined && {
          visitItem: { visit: { inspectorId } },
        }),
        ...(buildingId !== undefined && {
          visitItem: {
            visit: { checklist: { apartment: { buildingId } } },
          },
        }),
        ...(from !== undefined || to !== undefined
          ? {
              createdAt: {
                ...(from !== undefined && { gte: new Date(from) }),
                ...(to !== undefined && { lte: new Date(to) }),
              },
            }
          : {}),
      },
      select: NC_LIST_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }
  async findById(id: number, companyId: number) {
    return prisma.nonConformity.findUnique({
      where: { id, companyId },
      select: {
        id: true,
        visitItemId: true,
        visitItem: {
          select: {
            visit: { select: { status: true } },
          },
        },
      },
    });
  }

  async findByIdWithInspector(id: number, companyId: number) {
    return prisma.nonConformity.findUnique({
      where: { id, companyId },
      select: {
        id: true,
        visitItemId: true,
        visitItem: {
          select: {
            visit: { select: { status: true, inspectorId: true } },
          },
        },
      },
    });
  }

  async findPhoto(ncId: number, photoId: number) {
    return prisma.photo.findFirst({
      where: { id: photoId, nonConformityId: ncId },
      select: { id: true, publicId: true },
    });
  }

  async addPhoto(ncId: number, url: string, publicId: string, companyId: number) {
    return prisma.photo.create({
      data: { nonConformityId: ncId, url, publicId, companyId },
      select: { id: true, url: true, uploadedAt: true },
    });
  }

  async deletePhoto(photoId: number) {
    await prisma.photo.delete({ where: { id: photoId } });
  }

  async findVisitItemForNc(visitItemId: number, companyId: number) {
    return prisma.visitItem.findFirst({
      where: { id: visitItemId, visit: { companyId } },
      select: {
        id: true,
        status: true,
        nonConformity: { select: { id: true } },
        visit: { select: { status: true } },
      },
    });
  }

  async create(visitItemId: number, description: string, companyId: number) {
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

  async patch(id: number, description: string) {
    return prisma.nonConformity.update({
      where: { id },
      data: { description },
      select: { id: true, description: true },
    });
  }

  async deleteById(id: number) {
    return prisma.nonConformity.delete({
      where: { id },
      select: { id: true },
    });
  }

  async findPhotosByNcId(ncId: number): Promise<{ publicId: string }[]> {
    return prisma.photo.findMany({
      where: { nonConformityId: ncId },
      select: { publicId: true },
    });
  }

  async countPhotos(ncId: number): Promise<number> {
    return prisma.photo.count({ where: { nonConformityId: ncId } });
  }

  async resolve(ncId: number, resolvedById: number) {
    return prisma.nonConformity.update({
      where: { id: ncId },
      data: { resolvedAt: new Date(), resolvedById },
      select: { id: true, resolvedAt: true, resolvedById: true },
    });
  }
}
