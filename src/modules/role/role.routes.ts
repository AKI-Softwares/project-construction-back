import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { RoleRepository } from "./role.repository.js";
import { RoleService } from "./role.service.js";
import { RoleController } from "./role.controller.js";
import {
  createRoleSchema,
  updateRoleSchema,
  roleParamsSchema,
} from "./role.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const roleRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new RoleRepository();
  const service = new RoleService(repo);
  const controller = new RoleController(service);

  app.get(
    "/",
    { preHandler: [app.authenticate, checkPermission("roles:read")] },
    controller.list.bind(controller),
  );

  app.get(
    "/:id",
    {
      schema: { params: roleParamsSchema },
      preHandler: [app.authenticate, checkPermission("roles:read")],
    },
    controller.getOne.bind(controller),
  );

  app.post(
    "/",
    {
      schema: { body: createRoleSchema },
      preHandler: [app.authenticate, checkPermission("roles:create")],
    },
    controller.create.bind(controller),
  );

  app.patch(
    "/:id",
    {
      schema: { params: roleParamsSchema, body: updateRoleSchema },
      preHandler: [app.authenticate, checkPermission("roles:update")],
    },
    controller.update.bind(controller),
  );

  app.delete(
    "/:id",
    {
      schema: { params: roleParamsSchema },
      preHandler: [app.authenticate, checkPermission("roles:delete")],
    },
    controller.remove.bind(controller),
  );
};
