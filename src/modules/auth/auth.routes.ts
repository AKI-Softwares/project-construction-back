import type { FastifyInstance } from "fastify";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";
import { loginSchema } from "./auth.schema.js";

export async function authRoutes(app: FastifyInstance) {
  const repo = new AuthRepository();
  const service = new AuthService(repo);
  const controller = new AuthController(service, app);

  // POST /auth/login — público
  app.post(
    "/login",
    { schema: { body: loginSchema } },
    controller.login.bind(controller),
  );

  // GET /auth/me — requer token válido
  app.get(
    "/me",
    { preHandler: [app.authenticate] },
    controller.me.bind(controller),
  );
}
