import type { FastifyReply, FastifyRequest } from "fastify";
import type { AnalyticsService } from "./analytics.service.js";
import type { AnalyticsQuery } from "./analytics.schema.js";

export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  async overview(
    request: FastifyRequest<{ Querystring: AnalyticsQuery }>,
    reply: FastifyReply,
  ) {
    const companyId = request.user.companyId!;
    return reply.send(await this.service.getOverview(companyId, request.query));
  }

  async progress(
    request: FastifyRequest<{ Querystring: AnalyticsQuery }>,
    reply: FastifyReply,
  ) {
    const companyId = request.user.companyId!;
    return reply.send(await this.service.getProgress(companyId, request.query));
  }

  async quality(
    request: FastifyRequest<{ Querystring: AnalyticsQuery }>,
    reply: FastifyReply,
  ) {
    const companyId = request.user.companyId!;
    return reply.send(await this.service.getQuality(companyId, request.query));
  }

  async inspectors(
    request: FastifyRequest<{ Querystring: AnalyticsQuery }>,
    reply: FastifyReply,
  ) {
    const companyId = request.user.companyId!;
    return reply.send(await this.service.getInspectors(companyId, request.query));
  }
}
