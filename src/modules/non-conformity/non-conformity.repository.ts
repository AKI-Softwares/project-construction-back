import { prisma } from "../../shared/infra/database/prisma.js";
import type { AddPhotoInput } from "./non-conformity.schema.js";

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
      select: { id: true },
    });
  }

  async addPhoto(ncId: number, data: AddPhotoInput) {
    return prisma.photo.create({
      data: { nonConformityId: ncId, url: data.url },
      select: { id: true, url: true, uploadedAt: true },
    });
  }

  async deletePhoto(photoId: number) {
    return prisma.photo.delete({ where: { id: photoId }, select: { id: true } });
  }
}
