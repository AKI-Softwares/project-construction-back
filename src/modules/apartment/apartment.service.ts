import { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../shared/errors/http-error.js";
import type { ApartmentRepository } from "./apartment.repository.js";
import type {
  AddRoomServiceInput,
  CreateApartmentInput,
  UpdateApartmentInput,
  UpdateApartmentRoomInput,
} from "./apartment.schema.js";

export class ApartmentService {
  constructor(private readonly repo: ApartmentRepository) {}

  async listApartments(buildingId?: number) {
    return this.repo.findAll(buildingId);
  }

  async getApartment(id: number) {
    const apartment = await this.repo.findById(id);
    if (!apartment) throw new HttpError(404, "Apartment not found.");
    return apartment;
  }

  async createApartment(input: CreateApartmentInput, companyId: number) {
    const building = await this.repo.findBuildingById(input.buildingId);
    if (!building) throw new HttpError(404, "Building not found.");

    const type = await this.repo.findApartmentTypeWithRooms(
      input.apartmentTypeId,
    );
    if (!type) throw new HttpError(404, "Apartment type not found.");

    const existing = await this.repo.findByBuildingAndIdentifier(
      input.buildingId,
      input.identifier,
    );
    if (existing) {
      throw new HttpError(
        409,
        "Apartment identifier already exists in this building.",
      );
    }

    try {
      return await this.repo.createWithRooms(input, type.rooms, companyId);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new HttpError(
          409,
          "Apartment identifier already exists in this building.",
        );
      }
      throw e;
    }
  }

  async updateApartment(id: number, input: UpdateApartmentInput) {
    const apartment = await this.repo.findById(id);
    if (!apartment) throw new HttpError(404, "Apartment not found.");

    if (
      input.identifier !== undefined &&
      input.identifier !== apartment.identifier
    ) {
      const existing = await this.repo.findByBuildingAndIdentifier(
        apartment.buildingId,
        input.identifier,
      );
      if (existing) {
        throw new HttpError(
          409,
          "Apartment identifier already exists in this building.",
        );
      }
    }

    try {
      return await this.repo.update(id, input);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new HttpError(
          409,
          "Apartment identifier already exists in this building.",
        );
      }
      throw e;
    }
  }

  async deleteApartment(id: number) {
    const apartment = await this.repo.findById(id);
    if (!apartment) throw new HttpError(404, "Apartment not found.");
    const checklist = await this.repo.findChecklistByApartmentId(id);
    if (checklist)
      throw new HttpError(
        409,
        "Apartment has a checklist and cannot be deleted.",
      );
    await this.repo.delete(id);
  }

  async updateRoomName(
    apartmentId: number,
    roomId: number,
    input: UpdateApartmentRoomInput,
  ) {
    const apartment = await this.repo.findById(apartmentId);
    if (!apartment) throw new HttpError(404, "Apartment not found.");
    const room = await this.repo.findApartmentRoom(apartmentId, roomId);
    if (!room) throw new HttpError(404, "Room not found in this apartment.");
    return this.repo.updateApartmentRoomName(roomId, input.name);
  }

  async addServiceToRoom(
    apartmentId: number,
    roomId: number,
    input: AddRoomServiceInput,
  ) {
    const apartment = await this.repo.findById(apartmentId);
    if (!apartment) throw new HttpError(404, "Apartment not found.");
    const room = await this.repo.findApartmentRoom(apartmentId, roomId);
    if (!room) throw new HttpError(404, "Room not found in this apartment.");
    const service = await this.repo.findService(input.serviceId);
    if (!service) throw new HttpError(404, "Service not found.");
    const existing = await this.repo.findApartmentRoomService(
      roomId,
      input.serviceId,
    );
    if (existing)
      throw new HttpError(409, "Service already added to this room.");
    try {
      return await this.repo.addRoomService(roomId, input.serviceId);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new HttpError(409, "Service already added to this room.");
      }
      throw e;
    }
  }

  async removeServiceFromRoom(
    apartmentId: number,
    roomId: number,
    serviceId: number,
  ) {
    const apartment = await this.repo.findById(apartmentId);
    if (!apartment) throw new HttpError(404, "Apartment not found.");
    const room = await this.repo.findApartmentRoom(apartmentId, roomId);
    if (!room) throw new HttpError(404, "Room not found in this apartment.");
    const link = await this.repo.findApartmentRoomService(roomId, serviceId);
    if (!link) throw new HttpError(404, "Service not linked to this room.");
    await this.repo.deleteRoomService(roomId, serviceId);
  }
}
