import { fileTypeFromBuffer } from "file-type";
import { HttpError } from "../../shared/errors/http-error.js";
import { uploadPhoto, deleteCloudinaryPhoto } from "../../shared/storage/cloudinary.js";
import { logAudit } from "../../shared/audit/audit-log.js";
import { sendPushToUsers } from "../../shared/push/push-notification.js";
import type { NonConformityRepository } from "./non-conformity.repository.js";
import type { ListNcQuery } from "./non-conformity.schema.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export class NonConformityService {
  constructor(private repo: NonConformityRepository) {}

  async listNcs(companyId: number, filters: ListNcQuery) {
    return this.repo.findAll(companyId, filters);
  }

  async addPhoto(ncId: number, buffer: Buffer, companyId: number) {
    const nc = await this.repo.findById(ncId, companyId);
    if (!nc) throw new HttpError(404, "Não conformidade não encontrada.");
    if (nc.visitItem.visit.status === "FINALIZED") {
      throw new HttpError(403, "Não é possível adicionar fotos a uma vistoria finalizada.");
    }
    const photoCount = await this.repo.countPhotos(ncId);
    if (photoCount >= 5) {
      throw new HttpError(422, "Máximo de 5 fotos por não conformidade.");
    }
    if (buffer.length === 0) {
      throw new HttpError(400, "O arquivo enviado está vazio.");
    }
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      throw new HttpError(
        415,
        "Tipo de arquivo não suportado. Permitidos: JPEG, PNG, WebP, HEIC, HEIF.",
      );
    }
    let secureUrl: string;
    let publicId: string;
    try {
      ({ secureUrl, publicId } = await uploadPhoto(buffer));
    } catch (err) {
      console.error("[addPhoto] Cloudinary upload failed:", err);
      throw new HttpError(502, "Falha ao enviar foto. Tente novamente.");
    }
    return this.repo.addPhoto(ncId, secureUrl, publicId, companyId);
  }

  async deletePhoto(ncId: number, photoId: number, companyId: number) {
    const nc = await this.repo.findById(ncId, companyId);
    if (!nc) throw new HttpError(404, "Não conformidade não encontrada.");
    if (nc.visitItem.visit.status === "FINALIZED") {
      throw new HttpError(403, "Não é possível remover fotos de uma vistoria finalizada.");
    }
    const photo = await this.repo.findPhoto(ncId, photoId);
    if (!photo) throw new HttpError(404, "Photo not found.");
    try {
      await deleteCloudinaryPhoto(photo.publicId);
    } catch (err) {
      console.error("[deletePhoto] Cloudinary delete failed:", err);
      throw new HttpError(502, "Falha ao remover foto do armazenamento. Tente novamente.");
    }
    await this.repo.deletePhoto(photoId);
  }

  async createNc(visitItemId: number, description: string, companyId: number, userId: number) {
    const item = await this.repo.findVisitItemForNc(visitItemId, companyId);
    if (!item) throw new HttpError(404, "Item de vistoria não encontrado.");
    if (item.visit.status === "FINALIZED") {
      throw new HttpError(400, "A vistoria já foi finalizada.");
    }
    if (item.visit.status === "NOT_STARTED") {
      throw new HttpError(400, "A vistoria ainda não foi iniciada.");
    }
    if (item.status !== "NOK") {
      throw new HttpError(409, "Não conformidade só pode ser registrada em itens NOK.");
    }
    if (item.nonConformity) {
      throw new HttpError(409, "Este item já possui uma não conformidade registrada.");
    }
    const nc = await this.repo.create(visitItemId, description, companyId);
    void logAudit({ companyId, userId, entityType: "NonConformity", entityId: nc.id, action: "CREATED", after: { visitItemId, description } });
    return nc;
  }

  async patchNc(ncId: number, description: string, companyId: number) {
    const nc = await this.repo.findById(ncId, companyId);
    if (!nc) throw new HttpError(404, "Não conformidade não encontrada.");
    if (nc.visitItem.visit.status === "FINALIZED") {
      throw new HttpError(400, "A vistoria já foi finalizada.");
    }
    return this.repo.patch(ncId, description);
  }

  async deleteNc(ncId: number, companyId: number, userId: number) {
    const nc = await this.repo.findById(ncId, companyId);
    if (!nc) throw new HttpError(404, "Não conformidade não encontrada.");
    if (nc.visitItem.visit.status === "FINALIZED") {
      throw new HttpError(400, "A vistoria já foi finalizada.");
    }
    const photos = await this.repo.findPhotosByNcId(ncId);
    for (const photo of photos) {
      try {
        await deleteCloudinaryPhoto(photo.publicId);
      } catch (err) {
        console.error(`[deleteNc] Cloudinary cleanup failed for ${photo.publicId}:`, err);
      }
    }
    const result = await this.repo.deleteById(ncId);
    void logAudit({ companyId, userId, entityType: "NonConformity", entityId: ncId, action: "DELETED" });
    return result;
  }

  async resolveNc(ncId: number, companyId: number, resolvedById: number) {
    const nc = await this.repo.findByIdWithInspector(ncId, companyId);
    if (!nc) throw new HttpError(404, "Não conformidade não encontrada.");
    const result = await this.repo.resolve(ncId, resolvedById);
    void logAudit({ companyId, userId: resolvedById, entityType: "NonConformity", entityId: ncId, action: "RESOLVED", after: { resolvedById } });
    if (nc.visitItem.visit.inspectorId) {
      void sendPushToUsers([nc.visitItem.visit.inspectorId], { title: "NC resolvida", body: "O gestor aprovou a correção de uma não conformidade.", data: { ncId } });
    }
    return result;
  }
}
