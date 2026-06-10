import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requirePlatformAdmin } from '../../shared/rbac/require-platform-admin.js';
import { companyPlatformRoutes } from './company/company.routes.js';
import { catalogPlatformRoutes } from './catalog/catalog.routes.js';
import { roleTemplatePlatformRoutes } from './role-template/role-template.routes.js';

export const platformRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', requirePlatformAdmin);

  await app.register(companyPlatformRoutes, { prefix: '/companies' });
  await app.register(catalogPlatformRoutes, { prefix: '/catalog' });
  await app.register(roleTemplatePlatformRoutes, { prefix: '/role-templates' });
};
