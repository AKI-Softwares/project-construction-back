import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ServiceRepository } from "./service.repository.js";
import { ServiceService } from "./service.service.js";
import { ServiceController } from "./service.controller.js";
import {
  createServiceSchema,
  serviceParamsSchema,
  serviceQuerySchema,
  updateServiceSchema,
} from "./service.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const serviceRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new ServiceRepository();
  const service = new ServiceService(repo);
  const controller = new ServiceController(service);

  app.get(
    "/",
    {
      schema: { querystring: serviceQuerySchema },
      preHandler: [app.authenticate, checkPermission("services:read")],
    },
    controller.list.bind(controller),
  );

  app.get(
    "/:id",
    {
      schema: { params: serviceParamsSchema },
      preHandler: [app.authenticate, checkPermission("services:read")],
    },
    controller.getOne.bind(controller),
  );

  app.post(
    "/",
    {
      schema: { body: createServiceSchema },
      preHandler: [app.authenticate, checkPermission("services:create")],
    },
    controller.create.bind(controller),
  );

  app.patch(
    "/:id",
    {
      schema: { params: serviceParamsSchema, body: updateServiceSchema },
      preHandler: [app.authenticate, checkPermission("services:update")],
    },
    controller.update.bind(controller),
  );

  app.delete(
    "/:id",
    {
      schema: { params: serviceParamsSchema },
      preHandler: [app.authenticate, checkPermission("services:delete")],
    },
    controller.remove.bind(controller),
  );
};
