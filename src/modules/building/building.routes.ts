import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { BuildingRepository } from "./building.repository.js";
import { BuildingService } from "./building.service.js";
import { BuildingController } from "./building.controller.js";
import {
  buildingParamsSchema,
  createBuildingSchema,
  updateBuildingSchema,
} from "./building.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const buildingRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new BuildingRepository();
  const service = new BuildingService(repo);
  const controller = new BuildingController(service);

  app.get(
    "/",
    { preHandler: [app.authenticate, checkPermission("buildings:read")] },
    controller.list.bind(controller),
  );

  app.get(
    "/:id",
    {
      schema: { params: buildingParamsSchema },
      preHandler: [app.authenticate, checkPermission("buildings:read")],
    },
    controller.getOne.bind(controller),
  );

  app.post(
    "/",
    {
      schema: { body: createBuildingSchema },
      preHandler: [app.authenticate, checkPermission("buildings:create")],
    },
    controller.create.bind(controller),
  );

  app.patch(
    "/:id",
    {
      schema: { params: buildingParamsSchema, body: updateBuildingSchema },
      preHandler: [app.authenticate, checkPermission("buildings:update")],
    },
    controller.update.bind(controller),
  );

  app.delete(
    "/:id",
    {
      schema: { params: buildingParamsSchema },
      preHandler: [app.authenticate, checkPermission("buildings:delete")],
    },
    controller.remove.bind(controller),
  );
};
