import { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../shared/errors/http-error.js";
import type { ServiceRepository } from "./service.repository.js";
import type { CreateServiceInput, UpdateServiceInput } from "./service.schema.js";

export class ServiceService {
  constructor(private readonly repo: ServiceRepository) {}

  async listServices(category?: string) {
    return this.repo.findAll(category);
  }

  async getService(id: number) {
    const service = await this.repo.findById(id);
    if (!service) throw new HttpError(404, "Service not found.");
    return service;
  }

  async createService(input: CreateServiceInput) {
    const existing = await this.repo.findByName(input.name);
    if (existing) throw new HttpError(409, "Service name already exists.");
    try {
      return await this.repo.create(input);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpError(409, "Service name already exists.");
      }
      throw e;
    }
  }

  async updateService(id: number, input: UpdateServiceInput) {
    const service = await this.repo.findById(id);
    if (!service) throw new HttpError(404, "Service not found.");
    if (input.name !== undefined && input.name !== service.name) {
      const existing = await this.repo.findByName(input.name);
      if (existing) throw new HttpError(409, "Service name already exists.");
    }
    try {
      return await this.repo.update(id, input);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpError(409, "Service name already exists.");
      }
      throw e;
    }
  }

  async deleteService(id: number) {
    const service = await this.repo.findById(id);
    if (!service) throw new HttpError(404, "Service not found.");
    const [instanceCount, defaultCount] = await Promise.all([
      this.repo.countApartmentRoomServices(id),
      this.repo.countRoomDefaultServices(id),
    ]);
    if (instanceCount > 0) {
      throw new HttpError(409, "Service is in use by apartment instances and cannot be deleted.");
    }
    if (defaultCount > 0) {
      throw new HttpError(409, "Service is set as a room default and cannot be deleted.");
    }
    await this.repo.delete(id);
  }
}
