import type { FastifyReply, FastifyRequest } from "fastify";
import { HttpError } from "../../shared/errors/http-error.js";
import { env } from "../../shared/config/env.js";
import type { CronService } from "./cron.service.js";

export class CronController {
  constructor(private readonly service: CronService) {}

  async runSnapshot(request: FastifyRequest, reply: FastifyReply) {
    const auth = request.headers.authorization;
    if (!auth || auth !== `Bearer ${env.CRON_SECRET}`) {
      throw new HttpError(401, "Unauthorized.");
    }
    return reply.send(await this.service.runDailySnapshot());
  }
}
