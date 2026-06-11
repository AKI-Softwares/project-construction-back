import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthService } from './auth.service.js';
import type { LoginInput, RegisterCompanyInput, ForgotPasswordInput, ResetPasswordInput } from './auth.schema.js';

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
    const token = this.app.jwt.sign(payload, { expiresIn: '1d' });
    return reply.send({ token });
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const userId = Number(request.user.sub);
    const user = await this.service.getMe(userId);
    return reply.send(user);
  }

  async registerCompany(
    request: FastifyRequest<{ Body: RegisterCompanyInput }>,
    reply: FastifyReply,
  ) {
    const result = await this.service.registerCompany(request.body);
    return reply.status(201).send(result);
  }

  async forgotPassword(
    request: FastifyRequest<{ Body: ForgotPasswordInput }>,
    reply: FastifyReply,
  ) {
    await this.service.forgotPassword(request.body);
    return reply.send({ message: 'If this email is registered, a reset link will be sent.' });
  }

  async resetPassword(
    request: FastifyRequest<{ Body: ResetPasswordInput }>,
    reply: FastifyReply,
  ) {
    await this.service.resetPassword(request.body);
    return reply.send({ message: 'Password updated successfully.' });
  }
}
