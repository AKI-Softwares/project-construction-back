import type { FastifyReply, FastifyRequest } from "fastify";
import { getOptionalTenantId } from "../../shared/tenant/tenant-context.js";
import type { AnalyticsService } from "./analytics.service.js";
import type { AnalyticsQuery } from "./analytics.schema.js";

export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  async overview(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getOverview(getOptionalTenantId(request), request.query));
  }

  async progress(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getProgress(getOptionalTenantId(request), request.query));
  }

  async quality(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getQuality(getOptionalTenantId(request), request.query));
  }

  async inspectors(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getInspectors(getOptionalTenantId(request), request.query));
  }

  async ncResolution(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getNcResolution(getOptionalTenantId(request), request.query));
  }

  async sla(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getSla(getOptionalTenantId(request), request.query));
  }

  async reinspectionRate(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getReinspectionRate(getOptionalTenantId(request), request.query));
  }

  async timeline(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getTimeline(getOptionalTenantId(request), request.query));
  }

  async inspectorRanking(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getInspectorRanking(getOptionalTenantId(request), request.query));
  }

  async buildingRanking(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.getBuildingRanking(getOptionalTenantId(request), request.query));
  }
}
