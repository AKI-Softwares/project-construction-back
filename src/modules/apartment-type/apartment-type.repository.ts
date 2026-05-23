import { prisma } from "../../shared/infra/database/prisma.js";
import type {
  CreateApartmentTypeInput,
  CreateRoomInput,
  UpdateApartmentTypeInput,
} from "./apartment-type.schema.js";

const ROOM_SELECT = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

const APARTMENT_TYPE_SELECT = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  rooms: { select: ROOM_SELECT, orderBy: { name: "asc" as const } },
  _count: { select: { apartments: true } },
} as const;

export class ApartmentTypeRepository {
  async findAll() {
    return prisma.apartmentType.findMany({
      select: APARTMENT_TYPE_SELECT,
      orderBy: { name: "asc" as const },
    });
  }

  async findById(id: number) {
    return prisma.apartmentType.findUnique({
      where: { id },
      select: APARTMENT_TYPE_SELECT,
    });
  }

  async findByName(name: string) {
    return prisma.apartmentType.findUnique({ where: { name }, select: { id: true } });
  }

  async create(data: CreateApartmentTypeInput) {
    return prisma.apartmentType.create({
      data: {
        name: data.name,
        ...(data.description !== undefined && { description: data.description }),
      },
      select: APARTMENT_TYPE_SELECT,
    });
  }

  async update(id: number, data: UpdateApartmentTypeInput) {
    return prisma.apartmentType.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
      },
      select: APARTMENT_TYPE_SELECT,
    });
  }

  async delete(id: number) {
    return prisma.apartmentType.delete({ where: { id }, select: { id: true } });
  }

  async countApartments(id: number) {
    return prisma.apartment.count({ where: { apartmentTypeId: id } });
  }

  async addRoom(apartmentTypeId: number, data: CreateRoomInput) {
    return prisma.room.create({
      data: { apartmentTypeId, name: data.name },
      select: ROOM_SELECT,
    });
  }

  async findRoomByName(apartmentTypeId: number, name: string) {
    return prisma.room.findUnique({
      where: { apartmentTypeId_name: { apartmentTypeId, name } },
      select: { id: true },
    });
  }

  async findRoom(apartmentTypeId: number, roomId: number) {
    return prisma.room.findFirst({
      where: { id: roomId, apartmentTypeId },
      select: { id: true },
    });
  }

  async deleteRoom(roomId: number) {
    return prisma.room.delete({ where: { id: roomId }, select: { id: true } });
  }
}
