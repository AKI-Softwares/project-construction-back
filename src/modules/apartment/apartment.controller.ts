import type { FastifyReply, FastifyRequest } from "fastify";
import { getTenantId } from "../../shared/tenant/tenant-context.js";
import type { ApartmentService } from "./apartment.service.js";
import type {
  AddRoomServiceInput,
  ApartmentParams,
  ApartmentQuery,
  ApartmentRoomParams,
  ApartmentRoomServiceParams,
  CreateApartmentInput,
  UpdateApartmentInput,
  UpdateApartmentRoomInput,
} from "./apartment.schema.js";

export class ApartmentController {
  constructor(private readonly service: ApartmentService) {}

  async list(
    request: FastifyRequest<{ Querystring: ApartmentQuery }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply.send(
      await this.service.listApartments(companyId, request.query.buildingId),
    );
  }

  async getOne(
    request: FastifyRequest<{ Params: ApartmentParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply.send(await this.service.getApartment(request.params.id, companyId));
  }

  async create(
    request: FastifyRequest<{ Body: CreateApartmentInput }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply
      .status(201)
      .send(await this.service.createApartment(request.body, companyId));
  }

  async update(
    request: FastifyRequest<{
      Params: ApartmentParams;
      Body: UpdateApartmentInput;
    }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply.send(
      await this.service.updateApartment(request.params.id, companyId, request.body),
    );
  }

  async remove(
    request: FastifyRequest<{ Params: ApartmentParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    await this.service.deleteApartment(request.params.id, companyId);
    return reply.status(204).send();
  }

  async updateRoom(
    request: FastifyRequest<{
      Params: ApartmentRoomParams;
      Body: UpdateApartmentRoomInput;
    }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply.send(
      await this.service.updateRoomName(
        request.params.id,
        companyId,
        request.params.roomId,
        request.body,
      ),
    );
  }

  async addService(
    request: FastifyRequest<{
      Params: ApartmentRoomParams;
      Body: AddRoomServiceInput;
    }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply
      .status(201)
      .send(
        await this.service.addServiceToRoom(
          request.params.id,
          companyId,
          request.params.roomId,
          request.body,
        ),
      );
  }

  async removeService(
    request: FastifyRequest<{ Params: ApartmentRoomServiceParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    await this.service.removeServiceFromRoom(
      request.params.id,
      companyId,
      request.params.roomId,
      request.params.serviceId,
    );
    return reply.status(204).send();
  }
}
