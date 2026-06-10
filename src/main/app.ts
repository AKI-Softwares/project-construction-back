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
import { roleRoutes } from "../modules/role/role.routes.js";
import { permissionRoutes } from "../modules/permission/permission.routes.js";
import { buildingRoutes } from "../modules/building/building.routes.js";
import { apartmentTypeRoutes } from "../modules/apartment-type/apartment-type.routes.js";
import { apartmentRoutes } from "../modules/apartment/apartment.routes.js";
import { serviceRoutes } from "../modules/service/service.routes.js";
import { checklistRoutes } from "../modules/checklist/checklist.routes.js";
import { visitRoutes } from "../modules/visit/visit.routes.js";
import { nonConformityRoutes } from "../modules/non-conformity/non-conformity.routes.js";

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
  await app.register(roleRoutes, { prefix: "/roles" });
  await app.register(permissionRoutes, { prefix: "/permissions" });
  await app.register(buildingRoutes, { prefix: "/buildings" });
  await app.register(apartmentTypeRoutes, { prefix: "/apartment-types" });
  await app.register(apartmentRoutes, { prefix: "/apartments" });
  await app.register(serviceRoutes, { prefix: "/services" });
  await app.register(checklistRoutes, { prefix: "/checklists" });
  await app.register(visitRoutes, { prefix: "/visits" });
  await app.register(nonConformityRoutes, { prefix: "/non-conformities" });

  // Error handler global
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
      return reply
        .status(413)
        .send({ message: "File too large. Maximum size is 10 MB." });
    }

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
          : error instanceof Error
            ? error.message
            : String(error),
    });
  });

  return app;
}
