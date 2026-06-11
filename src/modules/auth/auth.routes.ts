import type { FastifyInstance, RouteHandlerMethod } from 'fastify';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import {
  loginSchema,
  registerCompanySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.schema.js';

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

  app.post(
    '/forgot-password',
    { schema: { body: forgotPasswordSchema } },
    controller.forgotPassword.bind(controller),
  );

  app.post(
    '/reset-password',
    { schema: { body: resetPasswordSchema } },
    controller.resetPassword.bind(controller),
  );

  app.post(
    '/change-password',
    {
      schema: { body: changePasswordSchema },
      preHandler: [app.authenticate],
    },
    controller.changePassword.bind(controller) as RouteHandlerMethod,
  );
}
