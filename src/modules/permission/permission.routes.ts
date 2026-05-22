import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { PermissionRepository } from "./permission.repository.js";
import { PermissionService } from "./permission.service.js";
import { PermissionController } from "./permission.controller.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const permissionRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new PermissionRepository();
  const service = new PermissionService(repo);
  const controller = new PermissionController(service);

  app.get(
    "/",
    { preHandler: [app.authenticate, checkPermission("permissions:read")] },
    controller.list.bind(controller),
  );
};
