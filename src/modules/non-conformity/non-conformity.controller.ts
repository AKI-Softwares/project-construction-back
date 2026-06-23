import { HttpError } from "../../shared/errors/http-error.js";
import type { FastifyRequest, FastifyReply } from "fastify";
import { getTenantId } from "../../shared/tenant/tenant-context.js";
import type { NonConformityService } from "./non-conformity.service.js";
import type { CreateNcInput, ListNcQuery, NcParams, PatchNcInput, PhotoParams } from "./non-conformity.schema.js";

export class NonConformityController {
  constructor(private service: NonConformityService) {}

  async list(
    request: FastifyRequest<{ Querystring: ListNcQuery }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    const ncs = await this.service.listNcs(companyId, request.query);
    return reply.status(200).send(ncs);
  }

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

  async create(
    request: FastifyRequest<{ Body: CreateNcInput }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    const userId = Number(request.user.sub);
    const nc = await this.service.createNc(
      request.body.visitItemId,
      request.body.description,
      companyId,
      userId,
    );
    return reply.status(201).send(nc);
  }

  async patch(
    request: FastifyRequest<{ Params: NcParams; Body: PatchNcInput }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    const nc = await this.service.patchNc(
      request.params.id,
      request.body.description,
      companyId,
    );
    return reply.status(200).send(nc);
  }

  async delete(
    request: FastifyRequest<{ Params: NcParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    const userId = Number(request.user.sub);
    await this.service.deleteNc(request.params.id, companyId, userId);
    return reply.status(204).send();
  }

  async resolve(
    request: FastifyRequest<{ Params: NcParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    const resolvedById = Number(request.user.sub);
    const nc = await this.service.resolveNc(request.params.id, companyId, resolvedById);
    return reply.status(200).send(nc);
  }
}
