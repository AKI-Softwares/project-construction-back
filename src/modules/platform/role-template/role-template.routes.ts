import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { RoleTemplateRepository } from './role-template.repository.js';
import { RoleTemplateService } from './role-template.service.js';
import { RoleTemplateController } from './role-template.controller.js';
import { templateParamsSchema, createRoleTemplateSchema, updateRoleTemplateSchema } from './role-template.schema.js';

export const roleTemplatePlatformRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new RoleTemplateRepository();
  const service = new RoleTemplateService(repo);
  const c = new RoleTemplateController(service);

  app.get('/', c.list.bind(c));
  app.post('/', { schema: { body: createRoleTemplateSchema } }, c.create.bind(c));
  app.get('/:id', { schema: { params: templateParamsSchema } }, c.get.bind(c));
  app.patch('/:id', { schema: { params: templateParamsSchema, body: updateRoleTemplateSchema } }, c.update.bind(c));
  app.delete('/:id', { schema: { params: templateParamsSchema } }, c.delete.bind(c));
};
