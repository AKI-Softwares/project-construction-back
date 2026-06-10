import type { FastifyInstance } from 'fastify';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { loginSchema, registerCompanySchema } from './auth.schema.js';

export async function authRoutes(app: FastifyInstance) {
  const repo = new AuthRepository();
  const service = new AuthService(repo);
  const controller = new AuthController(service, app);

  app.post(
    '/login',
    { schema: { body: loginSchema } },
    controller.login.bind(controller),
  );

  app.get(
    '/me',
    { preHandler: [app.authenticate] },
    controller.me.bind(controller),
  );

  app.post(
    '/register-company',
    { schema: { body: registerCompanySchema } },
    controller.registerCompany.bind(controller),
  );
}
