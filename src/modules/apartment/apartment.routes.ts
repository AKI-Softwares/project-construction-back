import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ApartmentRepository } from "./apartment.repository.js";
import { ApartmentService } from "./apartment.service.js";
import { ApartmentController } from "./apartment.controller.js";
import {
  addRoomServiceSchema,
  apartmentParamsSchema,
  apartmentQuerySchema,
  apartmentRoomParamsSchema,
  apartmentRoomServiceParamsSchema,
  createApartmentSchema,
  updateApartmentRoomSchema,
  updateApartmentSchema,
} from "./apartment.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const apartmentRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new ApartmentRepository();
  const service = new ApartmentService(repo);
  const controller = new ApartmentController(service);

  app.get(
    "/",
    {
      schema: { querystring: apartmentQuerySchema },
      preHandler: [app.authenticate, checkPermission("apartments:read")],
    },
    controller.list.bind(controller),
  );

  app.get(
    "/:id",
    {
      schema: { params: apartmentParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartments:read")],
    },
    controller.getOne.bind(controller),
  );

  app.post(
    "/",
    {
      schema: { body: createApartmentSchema },
      preHandler: [app.authenticate, checkPermission("apartments:create")],
    },
    controller.create.bind(controller),
  );

  app.patch(
    "/:id",
    {
      schema: { params: apartmentParamsSchema, body: updateApartmentSchema },
      preHandler: [app.authenticate, checkPermission("apartments:update")],
    },
    controller.update.bind(controller),
  );

  app.delete(
    "/:id",
    {
      schema: { params: apartmentParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartments:delete")],
    },
    controller.remove.bind(controller),
  );

  app.patch(
    "/:id/rooms/:roomId",
    {
      schema: { params: apartmentRoomParamsSchema, body: updateApartmentRoomSchema },
      preHandler: [app.authenticate, checkPermission("apartments:update")],
    },
    controller.updateRoom.bind(controller),
  );

  app.post(
    "/:id/rooms/:roomId/services",
    {
      schema: { params: apartmentRoomParamsSchema, body: addRoomServiceSchema },
      preHandler: [app.authenticate, checkPermission("apartments:update")],
    },
    controller.addService.bind(controller),
  );

  app.delete(
    "/:id/rooms/:roomId/services/:serviceId",
    {
      schema: { params: apartmentRoomServiceParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartments:update")],
    },
    controller.removeService.bind(controller),
  );
};
