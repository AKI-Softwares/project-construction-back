import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { NonConformityRepository } from "./non-conformity.repository.js";
import { NonConformityService } from "./non-conformity.service.js";
import { NonConformityController } from "./non-conformity.controller.js";
import { confirmPhotoSchema, createNcSchema, listNcQuerySchema, ncParamsSchema, patchNcSchema, photoParamsSchema } from "./non-conformity.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";
import { requireCompanyAdmin } from "../../shared/rbac/require-company-admin.js";

export const nonConformityRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new NonConformityRepository();
  const service = new NonConformityService(repo);
  const controller = new NonConformityController(service);

  app.get(
    "/",
    {
      schema: { querystring: listNcQuerySchema },
      preHandler: [app.authenticate, checkPermission("non-conformities:read")],
    },
    controller.list.bind(controller),
  );

  app.post(
    "/",
    {
      schema: { body: createNcSchema },
      preHandler: [app.authenticate, checkPermission("non-conformities:create")],
    },
    controller.create.bind(controller),
  );

  app.patch(
    "/:id",
    {
      schema: { params: ncParamsSchema, body: patchNcSchema },
      preHandler: [app.authenticate, checkPermission("non-conformities:update")],
    },
    controller.patch.bind(controller),
  );

  app.delete(
    "/:id",
    {
      schema: { params: ncParamsSchema },
      preHandler: [app.authenticate, checkPermission("non-conformities:delete")],
    },
    controller.delete.bind(controller),
  );

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

  app.get(
    "/:id/photos/upload-params",
    {
      schema: { params: ncParamsSchema },
      preHandler: [app.authenticate, checkPermission("photos:create")],
    },
    controller.getUploadParams.bind(controller),
  );

  app.post(
    "/:id/photos/confirm",
    {
      schema: { params: ncParamsSchema, body: confirmPhotoSchema },
      preHandler: [app.authenticate, checkPermission("photos:create")],
    },
    controller.confirmPhoto.bind(controller),
  );

  app.patch(
    "/:id/resolve",
    {
      schema: { params: ncParamsSchema },
      preHandler: [app.authenticate, requireCompanyAdmin],
    },
    controller.resolve.bind(controller),
  );
};
