import type { FastifyReply, FastifyRequest } from "fastify";
import { getTenantId } from "../../shared/tenant/tenant-context.js";
import type { BuildingService } from "./building.service.js";
import type {
  BuildingParams,
  CreateBuildingInput,
  UpdateBuildingInput,
} from "./building.schema.js";

export class BuildingController {
  constructor(private readonly service: BuildingService) {}

  async list(request: FastifyRequest, reply: FastifyReply) {
    const companyId = getTenantId(request);
    return reply.send(await this.service.listBuildings(companyId));
  }

  async getOne(
    request: FastifyRequest<{ Params: BuildingParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply.send(await this.service.getBuilding(request.params.id, companyId));
  }

  async create(
    request: FastifyRequest<{ Body: CreateBuildingInput }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply
      .status(201)
      .send(await this.service.createBuilding(request.body, companyId));
  }

  async update(
    request: FastifyRequest<{
      Params: BuildingParams;
      Body: UpdateBuildingInput;
    }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply.send(
      await this.service.updateBuilding(request.params.id, companyId, request.body),
    );
  }

  async remove(
    request: FastifyRequest<{ Params: BuildingParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    await this.service.deleteBuilding(request.params.id, companyId);
    return reply.status(204).send();
  }
}
