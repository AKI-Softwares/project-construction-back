import { prisma } from "../../shared/infra/database/prisma.js";
import type {
  CreateBuildingInput,
  UpdateBuildingInput,
} from "./building.schema.js";

const BUILDING_LIST_SELECT = {
  id: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { apartments: true } },
} as const;

const BUILDING_DETAIL_SELECT = {
  id: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  updatedAt: true,
  apartments: {
    select: { id: true, identifier: true, floor: true, block: true },
    orderBy: { identifier: "asc" as const },
  },
} as const;

export class BuildingRepository {
  async findAll() {
    return prisma.building.findMany({
      select: BUILDING_LIST_SELECT,
      orderBy: { name: "asc" as const },
    });
  }

  async findById(id: number) {
    return prisma.building.findUnique({
      where: { id },
      select: BUILDING_DETAIL_SELECT,
    });
  }

  async create(data: CreateBuildingInput, companyId: number) {
    return prisma.building.create({
      data: {
        name: data.name,
        address: data.address,
        companyId,
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
      },
      select: BUILDING_DETAIL_SELECT,
    });
  }

  async update(id: number, data: UpdateBuildingInput) {
    return prisma.building.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
      },
      select: BUILDING_DETAIL_SELECT,
    });
  }

  async delete(id: number) {
    return prisma.building.delete({ where: { id } });
  }

  async countApartments(id: number) {
    return prisma.apartment.count({ where: { buildingId: id } });
  }
}
