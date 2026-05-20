import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AuthService } from "./auth.service.js";
import type { LoginInput } from "./auth.schema.js";

export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly app: FastifyInstance,
  ) {}

  async login(
    request: FastifyRequest<{ Body: LoginInput }>,
    reply: FastifyReply,
  ) {
    const payload = await this.service.login(request.body);
    const token = this.app.jwt.sign(payload, { expiresIn: "7d" });
    return reply.send({ token });
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ user: request.user });
  }
}
