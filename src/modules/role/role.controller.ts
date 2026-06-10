import type { FastifyReply, FastifyRequest } from "fastify";
import type { RoleService } from "./role.service.js";
import type {
  CreateRoleInput,
  UpdateRoleInput,
  RoleParams,
} from "./role.schema.js";

export class RoleController {
  constructor(private readonly service: RoleService) {}

  async list(_request: FastifyRequest, reply: FastifyReply) {
    const roles = await this.service.listRoles();
    return reply.send(roles);
  }

  async getOne(
    request: FastifyRequest<{ Params: RoleParams }>,
    reply: FastifyReply,
  ) {
    const role = await this.service.getRole(request.params.id);
    return reply.send(role);
  }

  async create(
    request: FastifyRequest<{ Body: CreateRoleInput }>,
    reply: FastifyReply,
  ) {
    const role = await this.service.createRole(request.body);
    return reply.status(201).send(role);
  }

  async update(
    request: FastifyRequest<{ Params: RoleParams; Body: UpdateRoleInput }>,
    reply: FastifyReply,
  ) {
    const role = await this.service.updateRole(request.params.id, request.body);
    return reply.send(role);
  }

  async remove(
    request: FastifyRequest<{ Params: RoleParams }>,
    reply: FastifyReply,
  ) {
    await this.service.deleteRole(request.params.id);
    return reply.status(204).send();
  }
}
