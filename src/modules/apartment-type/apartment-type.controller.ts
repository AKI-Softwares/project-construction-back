import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApartmentTypeService } from "./apartment-type.service.js";
import type {
  ApartmentTypeParams,
  CreateApartmentTypeInput,
  CreateRoomInput,
  RoomParams,
  UpdateApartmentTypeInput,
} from "./apartment-type.schema.js";

export class ApartmentTypeController {
  constructor(private readonly service: ApartmentTypeService) {}

  async list(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await this.service.listApartmentTypes());
  }

  async getOne(request: FastifyRequest<{ Params: ApartmentTypeParams }>, reply: FastifyReply) {
    return reply.send(await this.service.getApartmentType(request.params.id));
  }

  async create(
    request: FastifyRequest<{ Body: CreateApartmentTypeInput }>,
    reply: FastifyReply,
  ) {
    return reply.status(201).send(await this.service.createApartmentType(request.body));
  }

  async update(
    request: FastifyRequest<{ Params: ApartmentTypeParams; Body: UpdateApartmentTypeInput }>,
    reply: FastifyReply,
  ) {
    return reply.send(
      await this.service.updateApartmentType(request.params.id, request.body),
    );
  }

  async remove(request: FastifyRequest<{ Params: ApartmentTypeParams }>, reply: FastifyReply) {
    await this.service.deleteApartmentType(request.params.id);
    return reply.status(204).send();
  }

  async addRoom(
    request: FastifyRequest<{ Params: ApartmentTypeParams; Body: CreateRoomInput }>,
    reply: FastifyReply,
  ) {
    return reply.status(201).send(
      await this.service.addRoom(request.params.id, request.body),
    );
  }

  async removeRoom(request: FastifyRequest<{ Params: RoomParams }>, reply: FastifyReply) {
    await this.service.removeRoom(request.params.id, request.params.roomId);
    return reply.status(204).send();
  }
}
