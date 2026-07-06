import { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../shared/errors/http-error.js";
import type { ServiceRepository } from "./service.repository.js";
import type {
  CreateServiceInput,
  UpdateServiceInput,
} from "./service.schema.js";

export class ServiceService {
  constructor(private readonly repo: ServiceRepository) {}

  async listServices(companyId: number, category?: string) {
    return this.repo.findAll(companyId, category);
  }

  async getService(id: number, companyId: number) {
    const service = await this.repo.findById(id, companyId);
    if (!service) throw new HttpError(404, "Service not found.");
    return service;
  }

  async createService(input: CreateServiceInput, companyId: number) {
    const existing = await this.repo.findByName(input.name, companyId);
    if (existing) throw new HttpError(409, "Service name already exists.");
    try {
      return await this.repo.create(input, companyId);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new HttpError(409, "Service name already exists.");
      }
      throw e;
    }
  }

  async updateService(id: number, companyId: number, input: UpdateServiceInput) {
    const service = await this.repo.findById(id, companyId);
    if (!service) throw new HttpError(404, "Service not found.");
    if (input.name !== undefined && input.name !== service.name) {
      const existing = await this.repo.findByName(input.name, companyId);
      if (existing) throw new HttpError(409, "Service name already exists.");
    }
    try {
      return await this.repo.update(id, input);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new HttpError(409, "Service name already exists.");
      }
      throw e;
    }
  }

  async deleteService(id: number, companyId: number) {
    const service = await this.repo.findById(id, companyId);
    if (!service) throw new HttpError(404, "Service not found.");
    const [instanceCount, defaultCount] = await Promise.all([
      this.repo.countApartmentRoomServices(id),
      this.repo.countRoomDefaultServices(id),
    ]);
    if (instanceCount > 0) {
      throw new HttpError(
        409,
        "Service is in use by apartment instances and cannot be deleted.",
      );
    }
    if (defaultCount > 0) {
      throw new HttpError(
        409,
        "Service is set as a room default and cannot be deleted.",
      );
    }
    try {
      await this.repo.delete(id);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2003"
      ) {
        throw new HttpError(409, "Service is in use and cannot be deleted.");
      }
      throw e;
    }
  }
}
