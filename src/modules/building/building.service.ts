import { HttpError } from "../../shared/errors/http-error.js";
import type { BuildingRepository } from "./building.repository.js";
import type {
  CreateBuildingInput,
  UpdateBuildingInput,
} from "./building.schema.js";

export class BuildingService {
  constructor(private readonly repo: BuildingRepository) {}

  async listBuildings(companyId: number) {
    return this.repo.findAll(companyId);
  }

  async getBuilding(id: number, companyId: number) {
    const building = await this.repo.findById(id, companyId);
    if (!building) throw new HttpError(404, "Building not found.");
    return building;
  }

  async createBuilding(input: CreateBuildingInput, companyId: number) {
    return this.repo.create(input, companyId);
  }

  async updateBuilding(id: number, companyId: number, input: UpdateBuildingInput) {
    const building = await this.repo.findById(id, companyId);
    if (!building) throw new HttpError(404, "Building not found.");
    return this.repo.update(id, input);
  }

  async deleteBuilding(id: number, companyId: number) {
    const building = await this.repo.findById(id, companyId);
    if (!building) throw new HttpError(404, "Building not found.");
    const apartmentCount = await this.repo.countApartments(id);
    if (apartmentCount > 0) {
      throw new HttpError(
        409,
        "Building has apartments and cannot be deleted.",
      );
    }
    await this.repo.delete(id);
  }
}
