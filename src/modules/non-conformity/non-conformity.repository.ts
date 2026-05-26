import { prisma } from "../../shared/infra/database/prisma.js";

export class NonConformityRepository {
  async findById(id: number) {
    return prisma.nonConformity.findUnique({
      where: { id },
      select: { id: true, visitItemId: true },
    });
  }

  async findPhoto(ncId: number, photoId: number) {
    return prisma.photo.findFirst({
      where: { id: photoId, nonConformityId: ncId },
      select: { id: true, publicId: true },
    });
  }

  async addPhoto(ncId: number, url: string, publicId: string) {
    return prisma.photo.create({
      data: { nonConformityId: ncId, url, publicId },
      select: { id: true, url: true, uploadedAt: true },
    });
  }

  async deletePhoto(photoId: number) {
    return prisma.photo.delete({ where: { id: photoId }, select: { id: true } });
  }
}
