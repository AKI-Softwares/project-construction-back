import { fileTypeFromBuffer } from "file-type";
import { HttpError } from "../../shared/errors/http-error.js";
import {
  uploadPhoto,
  deleteCloudinaryPhoto,
} from "../../shared/storage/cloudinary.js";
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

  async addPhoto(ncId: number, buffer: Buffer, companyId: number) {
    const nc = await this.repo.findById(ncId, companyId);
    if (!nc) throw new HttpError(404, "Non-conformity not found.");
    if (nc.visitItem.visit.status === "FINALIZED") {
      throw new HttpError(403, "Cannot add photos to a finalized visit.");
    }
    const photoCount = await this.repo.countPhotos(ncId);
    if (photoCount >= 5) {
      throw new HttpError(422, "Maximum of 5 photos per non-conformity.");
    }
    if (buffer.length === 0) {
      throw new HttpError(400, "Uploaded file is empty.");
    }
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      throw new HttpError(
        415,
        "Unsupported file type. Allowed: JPEG, PNG, WebP, HEIC, HEIF.",
      );
    }
    let secureUrl: string;
    let publicId: string;
    try {
      ({ secureUrl, publicId } = await uploadPhoto(buffer));
    } catch (err) {
      console.error("[addPhoto] Cloudinary upload failed:", err);
      throw new HttpError(502, "Photo upload failed. Please try again.");
    }
    return this.repo.addPhoto(ncId, secureUrl, publicId, companyId);
  }

  async deletePhoto(ncId: number, photoId: number, companyId: number) {
    const nc = await this.repo.findById(ncId, companyId);
    if (!nc) throw new HttpError(404, "Non-conformity not found.");
    if (nc.visitItem.visit.status === "FINALIZED") {
      throw new HttpError(403, "Cannot delete photos from a finalized visit.");
    }
    const photo = await this.repo.findPhoto(ncId, photoId);
    if (!photo) throw new HttpError(404, "Photo not found.");
    try {
      await deleteCloudinaryPhoto(photo.publicId);
    } catch (err) {
      console.error("[deletePhoto] Cloudinary delete failed:", err);
      throw new HttpError(
        502,
        "Failed to delete photo from storage. Please try again.",
      );
    }
    await this.repo.deletePhoto(photoId);
  }

  async createNc(visitItemId: number, description: string, companyId: number) {
    const item = await this.repo.findVisitItemForNc(visitItemId, companyId);
    if (!item) throw new HttpError(404, "Visit item not found.");
    if (item.visit.status === "FINALIZED") {
      throw new HttpError(400, "Visit is already finalized.");
    }
    if (item.visit.status === "NOT_STARTED") {
      throw new HttpError(400, "Visit has not been started yet.");
    }
    if (item.status !== "NOK") {
      throw new HttpError(409, "Non-conformity can only be added to NOK items.");
    }
    if (item.nonConformity) {
      throw new HttpError(409, "This item already has a non-conformity.");
    }
    return this.repo.create(visitItemId, description, companyId);
  }

  async patchNc(ncId: number, description: string, companyId: number) {
    const nc = await this.repo.findById(ncId, companyId);
    if (!nc) throw new HttpError(404, "Non-conformity not found.");
    if (nc.visitItem.visit.status === "FINALIZED") {
      throw new HttpError(400, "Visit is already finalized.");
    }
    return this.repo.patch(ncId, description);
  }

  async deleteNc(ncId: number, companyId: number) {
    const nc = await this.repo.findById(ncId, companyId);
    if (!nc) throw new HttpError(404, "Non-conformity not found.");
    if (nc.visitItem.visit.status === "FINALIZED") {
      throw new HttpError(400, "Visit is already finalized.");
    }
    const photos = await this.repo.findPhotosByNcId(ncId);
    for (const photo of photos) {
      try {
        await deleteCloudinaryPhoto(photo.publicId);
      } catch (err) {
        console.error(`[deleteNc] Cloudinary cleanup failed for ${photo.publicId}:`, err);
      }
    }
    return this.repo.deleteById(ncId);
  }

  async resolveNc(ncId: number, companyId: number, resolvedById: number) {
    const nc = await this.repo.findById(ncId, companyId);
    if (!nc) throw new HttpError(404, "Non-conformity not found.");
    return this.repo.resolve(ncId, resolvedById);
  }
}
