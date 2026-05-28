import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { NonConformityRepository } from "./non-conformity.repository.js";
import { NonConformityService } from "./non-conformity.service.js";
import { NonConformityController } from "./non-conformity.controller.js";
import { ncParamsSchema, photoParamsSchema } from "./non-conformity.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const nonConformityRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new NonConformityRepository();
  const service = new NonConformityService(repo);
  const controller = new NonConformityController(service);

  app.post(
    "/:id/photos",
    {
      schema: { params: ncParamsSchema },
      preHandler: [app.authenticate, checkPermission("photos:create")],
    },
    controller.addPhoto.bind(controller),
  );

  app.delete(
    "/:id/photos/:photoId",
    {
      schema: { params: photoParamsSchema },
      preHandler: [app.authenticate, checkPermission("photos:delete")],
    },
    controller.deletePhoto.bind(controller),
  );
};
