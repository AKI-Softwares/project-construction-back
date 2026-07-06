import type { FastifyReply, FastifyRequest } from "fastify";
import { getTenantId } from "../../shared/tenant/tenant-context.js";
import type { RoleService } from "./role.service.js";
import type {
  CreateRoleInput,
  UpdateRoleInput,
  RoleParams,
} from "./role.schema.js";

export class RoleController {
  constructor(private readonly service: RoleService) {}

  async list(request: FastifyRequest, reply: FastifyReply) {
    const companyId = getTenantId(request);
    const roles = await this.service.listRoles(companyId);
    return reply.send(roles);
  }

  async getOne(
    request: FastifyRequest<{ Params: RoleParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    const role = await this.service.getRole(request.params.id, companyId);
    return reply.send(role);
  }

  async create(
    request: FastifyRequest<{ Body: CreateRoleInput }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    const role = await this.service.createRole(request.body, companyId);
    return reply.status(201).send(role);
  }

  async update(
    request: FastifyRequest<{ Params: RoleParams; Body: UpdateRoleInput }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    const role = await this.service.updateRole(request.params.id, companyId, request.body);
    return reply.send(role);
  }

  async remove(
    request: FastifyRequest<{ Params: RoleParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    await this.service.deleteRole(request.params.id, companyId);
    return reply.status(204).send();
  }
}
