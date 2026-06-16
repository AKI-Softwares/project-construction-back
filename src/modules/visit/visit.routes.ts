import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { VisitRepository } from "./visit.repository.js";
import { VisitService } from "./visit.service.js";
import { VisitController } from "./visit.controller.js";
import {
  visitParamsSchema,
  visitItemParamsSchema,
  visitMineQuerySchema,
  finalizeVisitSchema,
  updateVisitItemSchema,
  addNonConformitySchema,
  createReinspectionSchema,
} from "./visit.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";
import { requireCompanyAdmin } from "../../shared/rbac/require-company-admin.js";

export const visitRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new VisitRepository();
  const service = new VisitService(repo);
  const controller = new VisitController(service);

  // GET /mine must be registered before GET /:id to prevent Fastify
  // from capturing "mine" as an :id parameter value.
  app.get(
    "/mine",
    {
      schema: { querystring: visitMineQuerySchema },
      preHandler: [app.authenticate, checkPermission("visits:read")],
    },
    controller.listMine.bind(controller),
  );

  app.get(
    "/:id",
    {
      schema: { params: visitParamsSchema },
      preHandler: [app.authenticate, checkPermission("visits:read")],
    },
    controller.getOne.bind(controller),
  );

  app.patch(
    "/:id/start",
    {
      schema: { params: visitParamsSchema },
      preHandler: [app.authenticate, checkPermission("visits:update")],
    },
    controller.start.bind(controller),
  );

  app.patch(
    "/:id",
    {
      schema: { params: visitParamsSchema, body: finalizeVisitSchema },
      preHandler: [app.authenticate, checkPermission("visits:update")],
    },
    controller.finalize.bind(controller),
  );

  app.patch(
    "/:id/items/:itemId",
    {
      schema: { params: visitItemParamsSchema, body: updateVisitItemSchema },
      preHandler: [app.authenticate, checkPermission("visits:update")],
    },
    controller.updateItem.bind(controller),
  );

  app.post(
    "/:id/items/:itemId/non-conformities",
    {
      schema: { params: visitItemParamsSchema, body: addNonConformitySchema },
      preHandler: [
        app.authenticate,
        checkPermission("non-conformities:create"),
      ],
    },
    controller.addNonConformity.bind(controller),
  );

  app.delete(
    "/:id/items/:itemId/non-conformities",
    {
      schema: { params: visitItemParamsSchema },
      preHandler: [
        app.authenticate,
        checkPermission("non-conformities:delete"),
      ],
    },
    controller.deleteNonConformity.bind(controller),
  );

  app.get(
    "/available-reinspections",
    {
      preHandler: [app.authenticate, checkPermission("visits:read")],
    },
    controller.listAvailableReinspections.bind(controller),
  );

  app.post(
    "/:id/reinspection",
    {
      schema: { params: visitParamsSchema, body: createReinspectionSchema },
      preHandler: [app.authenticate, requireCompanyAdmin],
    },
    controller.createReinspection.bind(controller),
  );

  app.patch(
    "/:id/claim",
    {
      schema: { params: visitParamsSchema },
      preHandler: [app.authenticate, checkPermission("visits:update")],
    },
    controller.claimReinspection.bind(controller),
  );
};
