import { HttpError } from "../../shared/errors/http-error.js";
import type { BuildingRepository } from "./building.repository.js";
import type { CreateBuildingInput, UpdateBuildingInput } from "./building.schema.js";

export class BuildingService {
  constructor(private readonly repo: BuildingRepository) {}

  async listBuildings() {
    return this.repo.findAll();
  }

  async getBuilding(id: number) {
    const building = await this.repo.findById(id);
    if (!building) throw new HttpError(404, "Building not found.");
    return building;
  }

  async createBuilding(input: CreateBuildingInput) {
    return this.repo.create(input);
  }

  async updateBuilding(id: number, input: UpdateBuildingInput) {
    const building = await this.repo.findById(id);
    if (!building) throw new HttpError(404, "Building not found.");
    return this.repo.update(id, input);
  }

  async deleteBuilding(id: number) {
    const building = await this.repo.findById(id);
    if (!building) throw new HttpError(404, "Building not found.");
    const apartmentCount = await this.repo.countApartments(id);
    if (apartmentCount > 0) {
      throw new HttpError(409, "Building has apartments and cannot be deleted.");
    }
    await this.repo.delete(id);
  }
}
