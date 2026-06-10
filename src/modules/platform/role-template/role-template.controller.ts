import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RoleTemplateService } from './role-template.service.js';
import type { TemplateParams, CreateRoleTemplateInput, UpdateRoleTemplateInput } from './role-template.schema.js';

export class RoleTemplateController {
  constructor(private service: RoleTemplateService) {}
  list(_r: FastifyRequest, reply: FastifyReply)  { return reply.send(this.service.list()); }
  async get(r: FastifyRequest<{ Params: TemplateParams }>, reply: FastifyReply) {
    return reply.send(await this.service.get(r.params.id));
  }
  async create(r: FastifyRequest<{ Body: CreateRoleTemplateInput }>, reply: FastifyReply) {
    return reply.status(201).send(await this.service.create(r.body));
  }
  async update(r: FastifyRequest<{ Params: TemplateParams; Body: UpdateRoleTemplateInput }>, reply: FastifyReply) {
    return reply.send(await this.service.update(r.params.id, r.body));
  }
  async delete(r: FastifyRequest<{ Params: TemplateParams }>, reply: FastifyReply) {
    await this.service.delete(r.params.id);
    return reply.status(204).send();
  }
}
