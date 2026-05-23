import type { FastifyReply, FastifyRequest } from "fastify";
import type { BuildingService } from "./building.service.js";
import type { BuildingParams, CreateBuildingInput, UpdateBuildingInput } from "./building.schema.js";

export class BuildingController {
  constructor(private readonly service: BuildingService) {}

  async list(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await this.service.listBuildings());
  }

  async getOne(request: FastifyRequest<{ Params: BuildingParams }>, reply: FastifyReply) {
    return reply.send(await this.service.getBuilding(request.params.id));
  }

  async create(request: FastifyRequest<{ Body: CreateBuildingInput }>, reply: FastifyReply) {
    return reply.status(201).send(await this.service.createBuilding(request.body));
  }

  async update(
    request: FastifyRequest<{ Params: BuildingParams; Body: UpdateBuildingInput }>,
    reply: FastifyReply,
  ) {
    return reply.send(await this.service.updateBuilding(request.params.id, request.body));
  }

  async remove(request: FastifyRequest<{ Params: BuildingParams }>, reply: FastifyReply) {
    await this.service.deleteBuilding(request.params.id);
    return reply.status(204).send();
  }
}
