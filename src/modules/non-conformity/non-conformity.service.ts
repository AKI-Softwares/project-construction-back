import { HttpError } from "../../shared/errors/http-error.js";
import type { NonConformityRepository } from "./non-conformity.repository.js";
import type { AddPhotoInput } from "./non-conformity.schema.js";

export class NonConformityService {
  constructor(private repo: NonConformityRepository) {}

  async addPhoto(ncId: number, input: AddPhotoInput) {
    const nc = await this.repo.findById(ncId);
    if (!nc) throw new HttpError(404, "Non-conformity not found.");
    return this.repo.addPhoto(ncId, input);
  }

  async deletePhoto(ncId: number, photoId: number) {
    const nc = await this.repo.findById(ncId);
    if (!nc) throw new HttpError(404, "Non-conformity not found.");
    const photo = await this.repo.findPhoto(ncId, photoId);
    if (!photo) throw new HttpError(404, "Photo not found.");
    return this.repo.deletePhoto(photoId);
  }
}
