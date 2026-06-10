import { prisma } from '../../../shared/infra/database/prisma.js';
import type {
  CreateServiceInput, UpdateServiceInput,
  CreateApartmentTypeInput, UpdateApartmentTypeInput,
} from './catalog.schema.js';

const SERVICE_SELECT = { id: true, name: true, description: true, category: true, createdAt: true } as const;
const APT_TYPE_SELECT = { id: true, name: true, description: true, createdAt: true } as const;

export class CatalogRepository {
  async findAllServices() {
    return prisma.service.findMany({ where: { companyId: null }, select: SERVICE_SELECT, orderBy: { name: 'asc' } });
  }

  async findServiceById(id: number) {
    return prisma.service.findFirst({ where: { id, companyId: null }, select: SERVICE_SELECT });
  }

  async createService(data: CreateServiceInput) {
    return prisma.service.create({
      data: {
        name: data.name,
        companyId: null,
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
      },
      select: SERVICE_SELECT,
    });
  }

  async updateService(id: number, data: UpdateServiceInput) {
    return prisma.service.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
      },
      select: SERVICE_SELECT,
    });
  }

  async deleteService(id: number) {
    return prisma.service.deleteMany({ where: { id, companyId: null } });
  }

  async findAllApartmentTypes() {
    return prisma.apartmentType.findMany({ where: { companyId: null }, select: APT_TYPE_SELECT, orderBy: { name: 'asc' } });
  }

  async findApartmentTypeById(id: number) {
    return prisma.apartmentType.findFirst({ where: { id, companyId: null }, select: APT_TYPE_SELECT });
  }

  async createApartmentType(data: CreateApartmentTypeInput) {
    return prisma.apartmentType.create({
      data: {
        name: data.name,
        companyId: null,
        ...(data.description !== undefined && { description: data.description }),
      },
      select: APT_TYPE_SELECT,
    });
  }

  async updateApartmentType(id: number, data: UpdateApartmentTypeInput) {
    return prisma.apartmentType.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
      },
      select: APT_TYPE_SELECT,
    });
  }

  async deleteApartmentType(id: number) {
    return prisma.apartmentType.deleteMany({ where: { id, companyId: null } });
  }
}
