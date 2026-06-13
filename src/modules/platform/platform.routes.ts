import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requirePlatformAdmin } from '../../shared/rbac/require-platform-admin.js';
import { companyPlatformRoutes } from './company/company.routes.js';
import { catalogPlatformRoutes } from './catalog/catalog.routes.js';
import { roleTemplatePlatformRoutes } from './role-template/role-template.routes.js';
import { PlatformAnalyticsRepository } from './analytics/platform-analytics.repository.js';
import { PlatformAnalyticsService } from './analytics/platform-analytics.service.js';
import { PlatformAnalyticsController } from './analytics/platform-analytics.controller.js';
import { SnapshotRepository } from '../analytics/snapshot.repository.js';
import { analyticsQuerySchema } from '../analytics/analytics.schema.js';

export const platformRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', requirePlatformAdmin);

  await app.register(companyPlatformRoutes, { prefix: '/companies' });
  await app.register(catalogPlatformRoutes, { prefix: '/catalog' });
  await app.register(roleTemplatePlatformRoutes, { prefix: '/role-templates' });

  const platformAnalyticsRepo    = new PlatformAnalyticsRepository();
  const snapshotRepo             = new SnapshotRepository();
  const platformAnalyticsService = new PlatformAnalyticsService(platformAnalyticsRepo, snapshotRepo);
  const platformAnalyticsCtrl    = new PlatformAnalyticsController(platformAnalyticsService);

  const analyticsSchema = { querystring: analyticsQuerySchema };
  app.get('/analytics/overview', { schema: analyticsSchema }, platformAnalyticsCtrl.overview.bind(platformAnalyticsCtrl));
  app.get('/analytics/usage',    { schema: analyticsSchema }, platformAnalyticsCtrl.usage.bind(platformAnalyticsCtrl));
  app.get('/analytics/growth',   {},                          platformAnalyticsCtrl.growth.bind(platformAnalyticsCtrl));
};
