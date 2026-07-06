import type { FastifyReply, FastifyRequest } from "fastify";
import { getTenantId } from "../../shared/tenant/tenant-context.js";
import type { ApartmentTypeService } from "./apartment-type.service.js";
import type {
  AddRoomDefaultServiceInput,
  ApartmentTypeParams,
  CreateApartmentTypeInput,
  CreateRoomInput,
  RoomParams,
  RoomServiceParams,
  UpdateApartmentTypeInput,
} from "./apartment-type.schema.js";

export class ApartmentTypeController {
  constructor(private readonly service: ApartmentTypeService) {}

  async list(request: FastifyRequest, reply: FastifyReply) {
    const companyId = getTenantId(request);
    return reply.send(await this.service.listApartmentTypes(companyId));
  }

  async getOne(
    request: FastifyRequest<{ Params: ApartmentTypeParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply.send(await this.service.getApartmentType(request.params.id, companyId));
  }

  async create(
    request: FastifyRequest<{ Body: CreateApartmentTypeInput }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply
      .status(201)
      .send(await this.service.createApartmentType(request.body, companyId));
  }

  async update(
    request: FastifyRequest<{
      Params: ApartmentTypeParams;
      Body: UpdateApartmentTypeInput;
    }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply.send(
      await this.service.updateApartmentType(request.params.id, companyId, request.body),
    );
  }

  async remove(
    request: FastifyRequest<{ Params: ApartmentTypeParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    await this.service.deleteApartmentType(request.params.id, companyId);
    return reply.status(204).send();
  }

  async addRoom(
    request: FastifyRequest<{
      Params: ApartmentTypeParams;
      Body: CreateRoomInput;
    }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply
      .status(201)
      .send(await this.service.addRoom(request.params.id, companyId, request.body));
  }

  async removeRoom(
    request: FastifyRequest<{ Params: RoomParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    await this.service.removeRoom(request.params.id, companyId, request.params.roomId);
    return reply.status(204).send();
  }

  async listRoomDefaultServices(
    request: FastifyRequest<{ Params: RoomParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply.send(
      await this.service.listRoomDefaultServices(
        request.params.id,
        companyId,
        request.params.roomId,
      ),
    );
  }

  async addRoomDefaultService(
    request: FastifyRequest<{
      Params: RoomParams;
      Body: AddRoomDefaultServiceInput;
    }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    return reply
      .status(201)
      .send(
        await this.service.addRoomDefaultService(
          request.params.id,
          companyId,
          request.params.roomId,
          request.body,
        ),
      );
  }

  async removeRoomDefaultService(
    request: FastifyRequest<{ Params: RoomServiceParams }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    await this.service.removeRoomDefaultService(
      request.params.id,
      companyId,
      request.params.roomId,
      request.params.serviceId,
    );
    return reply.status(204).send();
  }
}
