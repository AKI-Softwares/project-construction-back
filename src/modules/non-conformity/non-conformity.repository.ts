import { prisma } from "../../shared/infra/database/prisma.js";

export class NonConformityRepository {
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
}
