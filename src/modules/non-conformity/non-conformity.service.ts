import { HttpError } from "../../shared/errors/http-error.js";
import { uploadPhoto } from "../../shared/storage/cloudinary.js";
import type { NonConformityRepository } from "./non-conformity.repository.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export class NonConformityService {
  constructor(private repo: NonConformityRepository) {}

  async addPhoto(ncId: number, buffer: Buffer, mimeType: string) {
    const nc = await this.repo.findById(ncId);
    if (!nc) throw new HttpError(404, "Non-conformity not found.");
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new HttpError(415, "Unsupported file type. Allowed: JPEG, PNG, WebP, HEIC, HEIF.");
    }
    if (buffer.length === 0) {
      throw new HttpError(400, "Uploaded file is empty.");
    }
    let url: string;
    try {
      url = await uploadPhoto(buffer);
    } catch {
      throw new HttpError(502, "Photo upload failed. Please try again.");
    }
    return this.repo.addPhoto(ncId, url);
  }

  async deletePhoto(ncId: number, photoId: number) {
    const nc = await this.repo.findById(ncId);
    if (!nc) throw new HttpError(404, "Non-conformity not found.");
    const photo = await this.repo.findPhoto(ncId, photoId);
    if (!photo) throw new HttpError(404, "Photo not found.");
    return this.repo.deletePhoto(photoId);
  }
}
