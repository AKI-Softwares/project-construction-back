import type { FastifyRequest, FastifyReply } from "fastify";
import type { NonConformityService } from "./non-conformity.service.js";
import type { NcParams, PhotoParams, AddPhotoInput } from "./non-conformity.schema.js";

export class NonConformityController {
  constructor(private service: NonConformityService) {}

  async addPhoto(
    request: FastifyRequest<{ Params: NcParams; Body: AddPhotoInput }>,
    reply: FastifyReply,
  ) {
    const photo = await this.service.addPhoto(request.params.id, request.body);
    return reply.status(201).send(photo);
  }

  async deletePhoto(
    request: FastifyRequest<{ Params: PhotoParams }>,
    reply: FastifyReply,
  ) {
    await this.service.deletePhoto(request.params.id, request.params.photoId);
    return reply.status(204).send();
  }
}
