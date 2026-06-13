import type { FastifyReply, FastifyRequest } from "fastify";
import type { PlatformAnalyticsService } from "./platform-analytics.service.js";
import type { AnalyticsQuery } from "../../analytics/analytics.schema.js";

export class PlatformAnalyticsController {
  constructor(private readonly service: PlatformAnalyticsService) {}

  async overview(
    request: FastifyRequest<{ Querystring: AnalyticsQuery }>,
    reply: FastifyReply,
  ) {
    return reply.send(await this.service.getOverview(request.query));
  }

  async usage(
    request: FastifyRequest<{ Querystring: AnalyticsQuery }>,
    reply: FastifyReply,
  ) {
    return reply.send(await this.service.getUsage(request.query));
  }

  async growth(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await this.service.getGrowth());
  }
}
