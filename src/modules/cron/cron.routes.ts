import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { CronService } from "./cron.service.js";
import { CronController } from "./cron.controller.js";

export const cronRoutes: FastifyPluginAsyncZod = async (app) => {
  const service    = new CronService();
  const controller = new CronController(service);

  app.get("/metrics-snapshot", controller.runSnapshot.bind(controller));
  app.get("/sla-alerts", controller.runSlaAlerts.bind(controller));
};
