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

  async ncResolution(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getNcResolution(request.user.companyId!, request.query));
  }

  async sla(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getSla(request.user.companyId!, request.query));
  }

  async reinspectionRate(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getReinspectionRate(request.user.companyId!, request.query));
  }

  async timeline(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getTimeline(request.user.companyId!, request.query));
  }

  async inspectorRanking(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getInspectorRanking(request.user.companyId!, request.query));
  }

  async buildingRanking(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getBuildingRanking(request.user.companyId!, request.query));
  }
}
