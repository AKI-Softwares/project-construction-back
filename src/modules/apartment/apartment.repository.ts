import { prisma } from "../../shared/infra/database/prisma.js";
import type {
  CreateApartmentInput,
  UpdateApartmentInput,
} from "./apartment.schema.js";

const APARTMENT_ROOM_SERVICE_SELECT = {
  id: true,
  serviceId: true,
  service: { select: { id: true, name: true } },
} as const;

const APARTMENT_ROOM_SELECT = {
  id: true,
  roomId: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  services: { select: APARTMENT_ROOM_SERVICE_SELECT },
} as const;

const APARTMENT_LIST_SELECT = {
  id: true,
  buildingId: true,
  apartmentTypeId: true,
  identifier: true,
  floor: true,
  block: true,
  createdAt: true,
  updatedAt: true,
  building: { select: { id: true, name: true } },
  apartmentType: { select: { id: true, name: true } },
} as const;

const APARTMENT_DETAIL_SELECT = {
  id: true,
  buildingId: true,
  apartmentTypeId: true,
  identifier: true,
  floor: true,
  block: true,
  createdAt: true,
  updatedAt: true,
  building: { select: { id: true, name: true } },
  apartmentType: { select: { id: true, name: true } },
  rooms: {
    select: APARTMENT_ROOM_SELECT,
    orderBy: { name: "asc" as const },
  },
} as const;

export class ApartmentRepository {
  async findAll(companyId: number, buildingId?: number) {
    return prisma.apartment.findMany({
      where: { companyId, ...(buildingId !== undefined && { buildingId }) },
      select: APARTMENT_LIST_SELECT,
      orderBy: [{ buildingId: "asc" as const }, { identifier: "asc" as const }],
    });
  }

  async findById(id: number, companyId: number) {
    return prisma.apartment.findUnique({
      where: { id, companyId },
      select: APARTMENT_DETAIL_SELECT,
    });
  }

  async findByBuildingAndIdentifier(buildingId: number, identifier: string) {
    return prisma.apartment.findUnique({
      where: { buildingId_identifier: { buildingId, identifier } },
      select: { id: true },
    });
  }

  async findBuildingById(id: number, companyId: number) {
    return prisma.building.findUnique({ where: { id, companyId }, select: { id: true } });
  }

  async findApartmentTypeWithRooms(id: number, companyId: number) {
    return prisma.apartmentType.findUnique({
      where: { id, companyId },
      select: {
        id: true,
        rooms: {
          select: {
            id: true,
            name: true,
            defaultServices: { select: { serviceId: true } },
          },
        },
      },
    });
  }

  async createWithRooms(
    input: CreateApartmentInput,
    rooms: {
      id: number;
      name: string;
      defaultServices: { serviceId: number }[];
    }[],
    companyId: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const apartment = await tx.apartment.create({
        data: {
          buildingId: input.buildingId,
          apartmentTypeId: input.apartmentTypeId,
          identifier: input.identifier,
          companyId,
          ...(input.floor !== undefined && { floor: input.floor }),
          ...(input.block !== undefined && { block: input.block }),
        },
      });

      const serviceData: { apartmentRoomId: number; serviceId: number }[] = [];
      const createdRoomIds: number[] = [];

      // createMany does not return IDs; sequential create required to link services
      for (const room of rooms) {
        const created = await tx.apartmentRoom.create({
          data: { apartmentId: apartment.id, roomId: room.id, name: room.name },
          select: { id: true },
        });
        createdRoomIds.push(created.id);
        for (const ds of room.defaultServices) {
          serviceData.push({
            apartmentRoomId: created.id,
            serviceId: ds.serviceId,
          });
        }
      }

      if (serviceData.length > 0) {
        await tx.apartmentRoomService.createMany({ data: serviceData });
      }

      // Step 4: Create Checklist (always — 1:1 with apartment)
      const checklist = await tx.checklist.create({
        data: { apartmentId: apartment.id, companyId },
        select: { id: true },
      });

      // Step 5: Create ChecklistItem for each ApartmentRoomService
      // createMany doesn't return IDs, so query them back using the created room IDs
      if (createdRoomIds.length > 0) {
        const createdServices = await tx.apartmentRoomService.findMany({
          where: { apartmentRoomId: { in: createdRoomIds } },
          select: { id: true },
        });
        if (createdServices.length > 0) {
          await tx.checklistItem.createMany({
            data: createdServices.map((s) => ({
              checklistId: checklist.id,
              apartmentRoomServiceId: s.id,
            })),
          });
        }
      }

      const result = await tx.apartment.findUnique({
        where: { id: apartment.id },
        select: APARTMENT_DETAIL_SELECT,
      });

      return result!;
    });
  }

  async update(id: number, data: UpdateApartmentInput) {
    return prisma.apartment.update({
      where: { id },
      data: {
        ...(data.identifier !== undefined && { identifier: data.identifier }),
        ...(data.floor !== undefined && { floor: data.floor }),
        ...(data.block !== undefined && { block: data.block }),
      },
      select: APARTMENT_DETAIL_SELECT,
    });
  }

  async delete(id: number) {
    return prisma.apartment.delete({ where: { id }, select: { id: true } });
  }

  async findApartmentRoom(apartmentId: number, roomId: number) {
    return prisma.apartmentRoom.findFirst({
      where: { id: roomId, apartmentId },
      select: { id: true, name: true },
    });
  }

  async findChecklistByApartmentId(apartmentId: number) {
    return prisma.checklist.findUnique({
      where: { apartmentId },
      select: { id: true },
    });
  }

  async updateApartmentRoomName(roomId: number, name: string) {
    return prisma.apartmentRoom.update({
      where: { id: roomId },
      data: { name },
      select: APARTMENT_ROOM_SELECT,
    });
  }

  async findService(id: number, companyId: number) {
    return prisma.service.findUnique({ where: { id, companyId }, select: { id: true } });
  }

  async findApartmentRoomService(apartmentRoomId: number, serviceId: number) {
    return prisma.apartmentRoomService.findUnique({
      where: { apartmentRoomId_serviceId: { apartmentRoomId, serviceId } },
      select: { id: true },
    });
  }

  async addRoomService(apartmentRoomId: number, serviceId: number) {
    return prisma.apartmentRoomService.create({
      data: { apartmentRoomId, serviceId },
      select: APARTMENT_ROOM_SERVICE_SELECT,
    });
  }

  async deleteRoomService(apartmentRoomId: number, serviceId: number) {
    return prisma.apartmentRoomService.delete({
      where: { apartmentRoomId_serviceId: { apartmentRoomId, serviceId } },
      select: { id: true },
    });
  }
}
