import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserService } from "./user.service.js";
import type {
  CreateUserInput,
  UpdateUserInput,
  UserParams,
} from "./user.schema.js";

export class UserController {
  constructor(private readonly service: UserService) {}

  async list(_request: FastifyRequest, reply: FastifyReply) {
    const users = await this.service.listUsers();
    return reply.send(users);
  }

  async getOne(
    request: FastifyRequest<{ Params: UserParams }>,
    reply: FastifyReply,
  ) {
    const user = await this.service.getUser(request.params.id);
    return reply.send(user);
  }

  async create(
    request: FastifyRequest<{ Body: CreateUserInput }>,
    reply: FastifyReply,
  ) {
    const user = await this.service.createUser(request.body);
    return reply.status(201).send(user);
  }

  async update(
    request: FastifyRequest<{ Params: UserParams; Body: UpdateUserInput }>,
    reply: FastifyReply,
  ) {
    const requesterId = Number(request.user.sub);
    const requesterPerms = request.user.permissions;

    const user = await this.service.updateUser(
      request.params.id,
      request.body,
      requesterId,
      requesterPerms,
    );
    return reply.send(user);
  }

  async remove(
    request: FastifyRequest<{ Params: UserParams }>,
    reply: FastifyReply,
  ) {
    await this.service.deleteUser(request.params.id);
    return reply.status(204).send();
  }

  async adminResetPassword(
    request: FastifyRequest<{ Params: UserParams }>,
    reply: FastifyReply,
  ) {
    const requesterCompanyId = request.user.companyId;
    await this.service.resetPasswordByAdmin(request.params.id, requesterCompanyId);
    return reply.send({ message: "Temporary password sent to user's email." });
  }
}
