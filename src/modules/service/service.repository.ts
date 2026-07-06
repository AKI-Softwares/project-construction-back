import { prisma } from "../../shared/infra/database/prisma.js";
import type {
  CreateServiceInput,
  UpdateServiceInput,
} from "./service.schema.js";

const SERVICE_SELECT = {
  id: true,
  name: true,
  description: true,
  category: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class ServiceRepository {
  async findAll(companyId: number, category?: string) {
    return prisma.service.findMany({
      where: {
        companyId,
        ...(category !== undefined && {
          category: { equals: category, mode: "insensitive" },
        }),
      },
      select: SERVICE_SELECT,
      orderBy: { name: "asc" as const },
    });
  }

  async findById(id: number, companyId: number) {
    return prisma.service.findUnique({ where: { id, companyId }, select: SERVICE_SELECT });
  }

  async findByName(name: string, companyId: number) {
    return prisma.service.findFirst({
      where: { name, companyId },
      select: { id: true },
    });
  }

  async create(data: CreateServiceInput, companyId: number) {
    return prisma.service.create({
      data: {
        name: data.name,
        companyId,
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.category !== undefined && { category: data.category }),
      },
      select: SERVICE_SELECT,
    });
  }

  async update(id: number, data: UpdateServiceInput) {
    return prisma.service.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.category !== undefined && { category: data.category }),
      },
      select: SERVICE_SELECT,
    });
  }

  async delete(id: number) {
    return prisma.service.delete({ where: { id }, select: { id: true } });
  }

  async countApartmentRoomServices(id: number) {
    return prisma.apartmentRoomService.count({ where: { serviceId: id } });
  }

  async countRoomDefaultServices(id: number) {
    return prisma.roomDefaultService.count({ where: { serviceId: id } });
  }
}
