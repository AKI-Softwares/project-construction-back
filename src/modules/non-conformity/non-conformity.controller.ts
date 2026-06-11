import { HttpError } from "../../shared/errors/http-error.js";
import type { FastifyRequest, FastifyReply } from "fastify";
import { getTenantId } from "../../shared/tenant/tenant-context.js";
import type { NonConformityService } from "./non-conformity.service.js";
import type { NcParams, PhotoParams } from "./non-conformity.schema.js";

export class NonConformityController {
  constructor(private service: NonConformityService) {}

  async addPhoto(
    request: FastifyRequest<{ Params: NcParams }>,
    reply: FastifyReply,
  ) {
    const data = await request.file();
    if (!data) throw new HttpError(400, "No file uploaded.");
    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
        throw new HttpError(413, "File too large. Maximum size is 10 MB.");
      }
      throw err;
    }
    const companyId = getTenantId(request);
    const photo = await this.service.addPhoto(request.params.id, buffer, companyId);
    return reply.status(201).send(photo);
  }

  async deletePhoto(
    request: FastifyRequest<{ Params: PhotoParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    await this.service.deletePhoto(request.params.id, request.params.photoId, companyId);
    return reply.status(204).send();
  }
}
