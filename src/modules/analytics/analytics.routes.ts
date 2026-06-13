import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireCompanyAdmin } from "../../shared/rbac/require-company-admin.js";
import { AnalyticsRepository } from "./analytics.repository.js";
import { SnapshotRepository } from "./snapshot.repository.js";
import { AnalyticsService } from "./analytics.service.js";
import { AnalyticsController } from "./analytics.controller.js";
import { analyticsQuerySchema } from "./analytics.schema.js";

export const analyticsRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo       = new AnalyticsRepository();
  const snapRepo   = new SnapshotRepository();
  const service    = new AnalyticsService(repo, snapRepo);
  const controller = new AnalyticsController(service);

  const preHandler = [app.authenticate, requireCompanyAdmin];
  const schema     = { querystring: analyticsQuerySchema };

  app.get("/overview",   { preHandler, schema }, controller.overview.bind(controller));
  app.get("/progress",   { preHandler, schema }, controller.progress.bind(controller));
  app.get("/quality",    { preHandler, schema }, controller.quality.bind(controller));
  app.get("/inspectors", { preHandler, schema }, controller.inspectors.bind(controller));
};
