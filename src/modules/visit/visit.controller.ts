import type { FastifyRequest, FastifyReply } from "fastify";
import { getTenantId } from "../../shared/tenant/tenant-context.js";
import type { VisitService } from "./visit.service.js";
import type {
  VisitParams,
  VisitItemParams,
  VisitMineQuery,
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
    const companyId = getTenantId(request);
    const visit = await this.service.getVisitGrouped(request.params.id, companyId);
    return reply.status(200).send(visit);
  }

  async listMine(
    request: FastifyRequest<{ Querystring: VisitMineQuery }>,
    reply: FastifyReply,
  ) {
    const inspectorId = Number(request.user.sub);
    const companyId = getTenantId(request);
    const visits = await this.service.getMyVisits(
      inspectorId,
      companyId,
      request.query.status,
    );
    return reply.status(200).send(visits);
  }

  async start(
    request: FastifyRequest<{ Params: VisitParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    const visit = await this.service.startVisit(request.params.id, companyId);
    return reply.status(200).send(visit);
  }

  async finalize(
    request: FastifyRequest<{ Params: VisitParams; Body: FinalizeVisitInput }>,
    reply: FastifyReply,
  ) {
    const userId = Number(request.user.sub);
    const companyId = getTenantId(request);
    const visit = await this.service.finalizeVisit(
      request.params.id,
      request.body,
      userId,
      companyId,
    );
    return reply.status(200).send(visit);
  }

  async updateItem(
    request: FastifyRequest<{
      Params: VisitItemParams;
      Body: UpdateVisitItemInput;
    }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    const item = await this.service.updateVisitItem(
      request.params.id,
      request.params.itemId,
      request.body,
      companyId,
    );
    return reply.status(200).send(item);
  }

  async addNonConformity(
    request: FastifyRequest<{
      Params: VisitItemParams;
      Body: AddNonConformityInput;
    }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    const nc = await this.service.addNonConformity(
      request.params.id,
      request.params.itemId,
      request.body,
      companyId,
    );
    return reply.status(201).send(nc);
  }

  async deleteNonConformity(
    request: FastifyRequest<{ Params: VisitItemParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    await this.service.deleteNonConformity(
      request.params.id,
      request.params.itemId,
      companyId,
    );
    return reply.status(204).send();
  }
}
