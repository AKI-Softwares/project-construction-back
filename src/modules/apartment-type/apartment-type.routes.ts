import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ApartmentTypeRepository } from "./apartment-type.repository.js";
import { ApartmentTypeService } from "./apartment-type.service.js";
import { ApartmentTypeController } from "./apartment-type.controller.js";
import {
  addRoomDefaultServiceSchema,
  apartmentTypeParamsSchema,
  createApartmentTypeSchema,
  createRoomSchema,
  roomParamsSchema,
  roomServiceParamsSchema,
  updateApartmentTypeSchema,
} from "./apartment-type.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const apartmentTypeRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new ApartmentTypeRepository();
  const service = new ApartmentTypeService(repo);
  const controller = new ApartmentTypeController(service);

  app.get(
    "/",
    { preHandler: [app.authenticate, checkPermission("apartment-types:read")] },
    controller.list.bind(controller),
  );

  app.get(
    "/:id",
    {
      schema: { params: apartmentTypeParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:read")],
    },
    controller.getOne.bind(controller),
  );

  app.post(
    "/",
    {
      schema: { body: createApartmentTypeSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:create")],
    },
    controller.create.bind(controller),
  );

  app.patch(
    "/:id",
    {
      schema: { params: apartmentTypeParamsSchema, body: updateApartmentTypeSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:update")],
    },
    controller.update.bind(controller),
  );

  app.delete(
    "/:id",
    {
      schema: { params: apartmentTypeParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:delete")],
    },
    controller.remove.bind(controller),
  );

  app.post(
    "/:id/rooms",
    {
      schema: { params: apartmentTypeParamsSchema, body: createRoomSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:update")],
    },
    controller.addRoom.bind(controller),
  );

  app.delete(
    "/:id/rooms/:roomId",
    {
      schema: { params: roomParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:update")],
    },
    controller.removeRoom.bind(controller),
  );

  app.get(
    "/:id/rooms/:roomId/services",
    {
      schema: { params: roomParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:read")],
    },
    controller.listRoomDefaultServices.bind(controller),
  );

  app.post(
    "/:id/rooms/:roomId/services",
    {
      schema: { params: roomParamsSchema, body: addRoomDefaultServiceSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:update")],
    },
    controller.addRoomDefaultService.bind(controller),
  );

  app.delete(
    "/:id/rooms/:roomId/services/:serviceId",
    {
      schema: { params: roomServiceParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:update")],
    },
    controller.removeRoomDefaultService.bind(controller),
  );
};
