import type { FastifyReply, FastifyRequest } from "fastify";
import { getTenantId } from "../../shared/tenant/tenant-context.js";
import type { ServiceService } from "./service.service.js";
import type {
  CreateServiceInput,
  ServiceParams,
  ServiceQuery,
  UpdateServiceInput,
} from "./service.schema.js";

export class ServiceController {
  constructor(private readonly service: ServiceService) {}

  async list(
    request: FastifyRequest<{ Querystring: ServiceQuery }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply.send(await this.service.listServices(companyId, request.query.category));
  }

  async getOne(
    request: FastifyRequest<{ Params: ServiceParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply.send(await this.service.getService(request.params.id, companyId));
  }

  async create(
    request: FastifyRequest<{ Body: CreateServiceInput }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply
      .status(201)
      .send(await this.service.createService(request.body, companyId));
  }

  async update(
    request: FastifyRequest<{
      Params: ServiceParams;
      Body: UpdateServiceInput;
    }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply.send(
      await this.service.updateService(request.params.id, companyId, request.body),
    );
  }

  async remove(
    request: FastifyRequest<{ Params: ServiceParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    await this.service.deleteService(request.params.id, companyId);
    return reply.status(204).send();
  }
}
