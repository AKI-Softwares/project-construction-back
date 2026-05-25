import type { FastifyReply, FastifyRequest } from "fastify";
import type { ServiceService } from "./service.service.js";
import type {
  CreateServiceInput,
  ServiceParams,
  ServiceQuery,
  UpdateServiceInput,
} from "./service.schema.js";

export class ServiceController {
  constructor(private readonly service: ServiceService) {}

  async list(request: FastifyRequest<{ Querystring: ServiceQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.listServices(request.query.category));
  }

  async getOne(request: FastifyRequest<{ Params: ServiceParams }>, reply: FastifyReply) {
    return reply.send(await this.service.getService(request.params.id));
  }

  async create(request: FastifyRequest<{ Body: CreateServiceInput }>, reply: FastifyReply) {
    return reply.status(201).send(await this.service.createService(request.body));
  }

  async update(
    request: FastifyRequest<{ Params: ServiceParams; Body: UpdateServiceInput }>,
    reply: FastifyReply,
  ) {
    return reply.send(await this.service.updateService(request.params.id, request.body));
  }

  async remove(request: FastifyRequest<{ Params: ServiceParams }>, reply: FastifyReply) {
    await this.service.deleteService(request.params.id);
    return reply.status(204).send();
  }
}
