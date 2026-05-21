import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { UserRepository } from "./user.repository.js";
import { UserService } from "./user.service.js";
import { UserController } from "./user.controller.js";
import { createUserSchema, updateUserSchema, userParamsSchema } from "./user.schema.js";
import { checkRole } from "../../shared/rbac/check-role.js";
import { Role } from "../../shared/rbac/roles.js";

export const userRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new UserRepository();
  const service = new UserService(repo);
  const controller = new UserController(service);

  // GET /users — somente ADMIN e MANAGER podem listar usuários
  app.get(
    "/",
    { preHandler: [app.authenticate, checkRole(Role.ADMIN, Role.MANAGER)] },
    controller.list.bind(controller),
  );

  // GET /users/:id — autenticado (service valida se é o próprio ou admin)
  app.get(
    "/:id",
    {
      schema: { params: userParamsSchema },
      preHandler: [app.authenticate],
    },
    controller.getOne.bind(controller),
  );

  // POST /users — somente ADMIN cria usuários
  app.post(
    "/",
    {
      schema: { body: createUserSchema },
      preHandler: [app.authenticate, checkRole(Role.ADMIN)],
    },
    controller.create.bind(controller),
  );

  // PATCH /users/:id — autenticado (service valida permissão)
  app.patch(
    "/:id",
    {
      schema: { params: userParamsSchema, body: updateUserSchema },
      preHandler: [app.authenticate],
    },
    controller.update.bind(controller),
  );

  // DELETE /users/:id — somente ADMIN pode deletar
  app.delete(
    "/:id",
    {
      schema: { params: userParamsSchema },
      preHandler: [app.authenticate, checkRole(Role.ADMIN)],
    },
    controller.remove.bind(controller),
  );
};
