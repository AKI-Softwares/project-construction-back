import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { VisitRepository } from "./visit.repository.js";
import { VisitService } from "./visit.service.js";
import { VisitController } from "./visit.controller.js";
import {
  visitParamsSchema,
  visitItemParamsSchema,
  finalizeVisitSchema,
  updateVisitItemSchema,
  addNonConformitySchema,
} from "./visit.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const visitRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new VisitRepository();
  const service = new VisitService(repo);
  const controller = new VisitController(service);

  app.get(
    "/:id",
    {
      schema: { params: visitParamsSchema },
      preHandler: [app.authenticate, checkPermission("visits:read")],
    },
    controller.getOne.bind(controller),
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
      preHandler: [app.authenticate, checkPermission("non-conformities:create")],
    },
    controller.addNonConformity.bind(controller),
  );

  app.delete(
    "/:id/items/:itemId/non-conformities",
    {
      schema: { params: visitItemParamsSchema },
      preHandler: [app.authenticate, checkPermission("non-conformities:delete")],
    },
    controller.deleteNonConformity.bind(controller),
  );
};
