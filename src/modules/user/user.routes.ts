import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { UserRepository } from "./user.repository.js";
import { UserService } from "./user.service.js";
import { UserController } from "./user.controller.js";
import { createUserSchema, updateUserSchema, userParamsSchema } from "./user.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const userRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new UserRepository();
  const service = new UserService(repo);
  const controller = new UserController(service);

  app.get(
    "/",
    { preHandler: [app.authenticate, checkPermission("users:read")] },
    controller.list.bind(controller),
  );

  // GET /:id — authenticated only; service enforces self-or-permission rule
  app.get(
    "/:id",
    {
      schema: { params: userParamsSchema },
      preHandler: [app.authenticate],
    },
    controller.getOne.bind(controller),
  );

  app.post(
    "/",
    {
      schema: { body: createUserSchema },
      preHandler: [app.authenticate, checkPermission("users:create")],
    },
    controller.create.bind(controller),
  );

  // PATCH /:id — authenticated only; service enforces "self OR users:update"
  app.patch(
    "/:id",
    {
      schema: { params: userParamsSchema, body: updateUserSchema },
      preHandler: [app.authenticate],
    },
    controller.update.bind(controller),
  );

  app.delete(
    "/:id",
    {
      schema: { params: userParamsSchema },
      preHandler: [app.authenticate, checkPermission("users:delete")],
    },
    controller.remove.bind(controller),
  );
};
