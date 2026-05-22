import type { FastifyReply, FastifyRequest } from "fastify";
import type { PermissionService } from "./permission.service.js";

export class PermissionController {
  constructor(private readonly service: PermissionService) {}

  async list(_request: FastifyRequest, reply: FastifyReply) {
    const groups = await this.service.listGrouped();
    return reply.send(groups);
  }
}
