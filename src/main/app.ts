import "dotenv/config";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { env } from "../shared/config/env.js";
import { registerCors } from "../shared/plugins/cors.js";
import { registerJwt } from "../shared/plugins/jwt.js";
import { registerMultipart } from "../shared/plugins/multipart.js";
import { HttpError } from "../shared/errors/http-error.js";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { userRoutes } from "../modules/user/user.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      ...(env.NODE_ENV === "development" && {
        transport: {
          target: "pino-pretty",
          options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
        },
      }),
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Plugins
  await registerCors(app);
  await registerJwt(app);
  await registerMultipart(app);

  // Rotas globais
  app.get("/health", async () => ({ status: "ok" }));

  // Módulos
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(userRoutes, { prefix: "/users" });

  // Error handler global
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({ message: error.message });
    }

    if ((error as { validation?: unknown }).validation) {
      return reply.status(400).send({
        message: "Validation error",
        issues: (error as { validation: unknown }).validation,
      });
    }

    return reply.status(500).send({
      message:
        env.NODE_ENV === "production"
          ? "Internal server error"
          : error.message,
    });
  });

  return app;
}
