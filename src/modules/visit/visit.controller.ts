import type { FastifyRequest, FastifyReply } from "fastify";
import type { VisitService } from "./visit.service.js";
import type {
  VisitParams,
  VisitItemParams,
  FinalizeVisitInput,
  UpdateVisitItemInput,
  AddNonConformityInput,
} from "./visit.schema.js";

export class VisitController {
  constructor(private service: VisitService) {}

  async getOne(
    request: FastifyRequest<{ Params: VisitParams }>,
    reply: FastifyReply,
  ) {
    const visit = await this.service.getVisit(request.params.id);
    return reply.status(200).send(visit);
  }

  async finalize(
    request: FastifyRequest<{ Params: VisitParams; Body: FinalizeVisitInput }>,
    reply: FastifyReply,
  ) {
    const visit = await this.service.finalizeVisit(request.params.id, request.body);
    return reply.status(200).send(visit);
  }

  async updateItem(
    request: FastifyRequest<{ Params: VisitItemParams; Body: UpdateVisitItemInput }>,
    reply: FastifyReply,
  ) {
    const item = await this.service.updateVisitItem(
      request.params.id,
      request.params.itemId,
      request.body,
    );
    return reply.status(200).send(item);
  }

  async addNonConformity(
    request: FastifyRequest<{ Params: VisitItemParams; Body: AddNonConformityInput }>,
    reply: FastifyReply,
  ) {
    const nc = await this.service.addNonConformity(
      request.params.id,
      request.params.itemId,
      request.body,
    );
    return reply.status(201).send(nc);
  }

  async deleteNonConformity(
    request: FastifyRequest<{ Params: VisitItemParams }>,
    reply: FastifyReply,
  ) {
    await this.service.deleteNonConformity(request.params.id, request.params.itemId);
    return reply.status(204).send();
  }
}
