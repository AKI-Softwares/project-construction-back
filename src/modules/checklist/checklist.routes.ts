import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ChecklistRepository } from "./checklist.repository.js";
import { ChecklistService } from "./checklist.service.js";
import { ChecklistController } from "./checklist.controller.js";
import {
  checklistParamsSchema,
  checklistQuerySchema,
  updateChecklistSchema,
  createVisitSchema,
  checklistItemParamsSchema,
  resolveChecklistItemSchema,
} from "./checklist.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";
import { requireCompanyAdmin } from "../../shared/rbac/require-company-admin.js";

export const checklistRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new ChecklistRepository();
  const service = new ChecklistService(repo);
  const controller = new ChecklistController(service);

  app.get(
    "/",
    {
      schema: { querystring: checklistQuerySchema },
      preHandler: [app.authenticate, checkPermission("checklists:read")],
    },
    controller.list.bind(controller),
  );

  app.get(
    "/:id",
    {
      schema: { params: checklistParamsSchema },
      preHandler: [app.authenticate, checkPermission("checklists:read")],
    },
    controller.getOne.bind(controller),
  );

  app.patch(
    "/:id",
    {
      schema: { params: checklistParamsSchema, body: updateChecklistSchema },
      preHandler: [app.authenticate, checkPermission("checklists:update")],
    },
    controller.update.bind(controller),
  );

  app.post(
    "/:id/visits",
    {
      schema: { params: checklistParamsSchema, body: createVisitSchema },
      preHandler: [app.authenticate, checkPermission("visits:create")],
    },
    controller.createVisit.bind(controller),
  );

  app.get(
    "/:id/visits",
    {
      schema: { params: checklistParamsSchema },
      preHandler: [app.authenticate, checkPermission("visits:read")],
    },
    controller.listVisits.bind(controller),
  );

  app.patch(
    "/:id/items/:itemId",
    {
      schema: { params: checklistItemParamsSchema, body: resolveChecklistItemSchema },
      preHandler: [app.authenticate, requireCompanyAdmin],
    },
    controller.resolveItem.bind(controller),
  );
};
