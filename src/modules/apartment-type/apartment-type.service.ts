import { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../shared/errors/http-error.js";
import type { ApartmentTypeRepository } from "./apartment-type.repository.js";
import type {
  AddRoomDefaultServiceInput,
  CreateApartmentTypeInput,
  CreateRoomInput,
  UpdateApartmentTypeInput,
} from "./apartment-type.schema.js";

export class ApartmentTypeService {
  constructor(private readonly repo: ApartmentTypeRepository) {}

  async listApartmentTypes() {
    return this.repo.findAll();
  }

  async getApartmentType(id: number) {
    const type = await this.repo.findById(id);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    return type;
  }

  async createApartmentType(input: CreateApartmentTypeInput) {
    const existing = await this.repo.findByName(input.name);
    if (existing) throw new HttpError(409, "Apartment type name already exists.");
    try {
      return await this.repo.create(input);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpError(409, "Apartment type name already exists.");
      }
      throw e;
    }
  }

  async updateApartmentType(id: number, input: UpdateApartmentTypeInput) {
    const type = await this.repo.findById(id);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    if (input.name !== undefined && input.name !== type.name) {
      const existing = await this.repo.findByName(input.name);
      if (existing) throw new HttpError(409, "Apartment type name already exists.");
    }
    try {
      return await this.repo.update(id, input);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpError(409, "Apartment type name already exists.");
      }
      throw e;
    }
  }

  async deleteApartmentType(id: number) {
    const type = await this.repo.findById(id);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    const count = await this.repo.countApartments(id);
    if (count > 0) {
      throw new HttpError(409, "Apartment type has apartment instances and cannot be deleted.");
    }
    await this.repo.delete(id);
  }

  async addRoom(apartmentTypeId: number, input: CreateRoomInput) {
    const type = await this.repo.findById(apartmentTypeId);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    const existing = await this.repo.findRoomByName(apartmentTypeId, input.name);
    if (existing) throw new HttpError(409, "Room name already exists in this apartment type.");
    try {
      return await this.repo.addRoom(apartmentTypeId, input);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpError(409, "Room name already exists in this apartment type.");
      }
      throw e;
    }
  }

  async removeRoom(apartmentTypeId: number, roomId: number) {
    const type = await this.repo.findById(apartmentTypeId);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    const room = await this.repo.findRoom(apartmentTypeId, roomId);
    if (!room) throw new HttpError(404, "Room not found in this apartment type.");
    await this.repo.deleteRoom(roomId);
  }

  async listRoomDefaultServices(apartmentTypeId: number, roomId: number) {
    const type = await this.repo.findById(apartmentTypeId);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    const room = await this.repo.findRoom(apartmentTypeId, roomId);
    if (!room) throw new HttpError(404, "Room not found in this apartment type.");
    return this.repo.listRoomDefaultServices(roomId);
  }

  async addRoomDefaultService(
    apartmentTypeId: number,
    roomId: number,
    input: AddRoomDefaultServiceInput,
  ) {
    const type = await this.repo.findById(apartmentTypeId);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    const room = await this.repo.findRoom(apartmentTypeId, roomId);
    if (!room) throw new HttpError(404, "Room not found in this apartment type.");
    const service = await this.repo.findService(input.serviceId);
    if (!service) throw new HttpError(404, "Service not found.");
    const existing = await this.repo.findRoomDefaultService(roomId, input.serviceId);
    if (existing) throw new HttpError(409, "Service already set as default for this room.");
    try {
      return await this.repo.addRoomDefaultService(roomId, input.serviceId);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpError(409, "Service already set as default for this room.");
      }
      throw e;
    }
  }

  async removeRoomDefaultService(apartmentTypeId: number, roomId: number, serviceId: number) {
    const type = await this.repo.findById(apartmentTypeId);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    const room = await this.repo.findRoom(apartmentTypeId, roomId);
    if (!room) throw new HttpError(404, "Room not found in this apartment type.");
    const link = await this.repo.findRoomDefaultService(roomId, serviceId);
    if (!link) throw new HttpError(404, "Service not set as default for this room.");
    await this.repo.deleteRoomDefaultService(roomId, serviceId);
  }
}
