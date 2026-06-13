import type { FastifyReply, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { HttpError } from "../../shared/errors/http-error.js";
import { env } from "../../shared/config/env.js";
import type { CronService } from "./cron.service.js";

export class CronController {
  constructor(private readonly service: CronService) {}

  async runSnapshot(request: FastifyRequest, reply: FastifyReply) {
    const auth = request.headers.authorization ?? "";
    const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
    const actual = Buffer.from(auth);
    const valid = actual.length === expected.length && timingSafeEqual(actual, expected);
    if (!valid) {
      throw new HttpError(401, "Unauthorized.");
    }
    return reply.send(await this.service.runDailySnapshot());
  }
}
