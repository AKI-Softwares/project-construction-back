import { fileTypeFromBuffer } from "file-type";
import { HttpError } from "../../shared/errors/http-error.js";
import { uploadPhoto, deleteCloudinaryPhoto } from "../../shared/storage/cloudinary.js";
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

  async addPhoto(ncId: number, buffer: Buffer) {
    const nc = await this.repo.findById(ncId);
    if (!nc) throw new HttpError(404, "Non-conformity not found.");
    if (buffer.length === 0) {
      throw new HttpError(400, "Uploaded file is empty.");
    }
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      throw new HttpError(415, "Unsupported file type. Allowed: JPEG, PNG, WebP, HEIC, HEIF.");
    }
    let secureUrl: string;
    let publicId: string;
    try {
      ({ secureUrl, publicId } = await uploadPhoto(buffer));
    } catch (err) {
      console.error("[addPhoto] Cloudinary upload failed:", err);
      throw new HttpError(502, "Photo upload failed. Please try again.");
    }
    return this.repo.addPhoto(ncId, secureUrl, publicId);
  }

  async deletePhoto(ncId: number, photoId: number) {
    const nc = await this.repo.findById(ncId);
    if (!nc) throw new HttpError(404, "Non-conformity not found.");
    const photo = await this.repo.findPhoto(ncId, photoId);
    if (!photo) throw new HttpError(404, "Photo not found.");
    // Cloudinary first: if DB delete fails after this, the file is orphaned in storage
    // but the record stays intact and the client can retry. Accepted trade-off.
    try {
      await deleteCloudinaryPhoto(photo.publicId);
    } catch (err) {
      console.error("[deletePhoto] Cloudinary delete failed:", err);
      throw new HttpError(502, "Failed to delete photo from storage. Please try again.");
    }
    await this.repo.deletePhoto(photoId);
  }
}
