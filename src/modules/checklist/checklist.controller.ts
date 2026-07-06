import type { FastifyRequest, FastifyReply } from "fastify";
import { getTenantId } from "../../shared/tenant/tenant-context.js";
import type { ChecklistService } from "./checklist.service.js";
import type {
  ChecklistParams,
  ChecklistQuery,
  UpdateChecklistInput,
  CreateVisitInput,
  ChecklistItemParams,
  ResolveChecklistItemInput,
} from "./checklist.schema.js";

export class ChecklistController {
  constructor(private service: ChecklistService) {}

  async list(
    request: FastifyRequest<{ Querystring: ChecklistQuery }>,
    reply: FastifyReply,
  ) {
    const checklists = await this.service.listChecklists(
      request.query.apartmentId,
    );
    return reply.status(200).send(checklists);
  }

  async getOne(
    request: FastifyRequest<{ Params: ChecklistParams }>,
    reply: FastifyReply,
  ) {
    const checklist = await this.service.getChecklist(request.params.id);
    return reply.status(200).send(checklist);
  }

  async update(
    request: FastifyRequest<{
      Params: ChecklistParams;
      Body: UpdateChecklistInput;
    }>,
    reply: FastifyReply,
  ) {
    const userId = Number(request.user.sub);
    const checklist = await this.service.updateChecklist(
      request.params.id,
      request.body,
      userId,
    );
    return reply.status(200).send(checklist);
  }

  async createVisit(
    request: FastifyRequest<{
      Params: ChecklistParams;
      Body: CreateVisitInput;
    }>,
    reply: FastifyReply,
  ) {
    const createdById = Number(request.user.sub);
    const companyId = getTenantId(request);
    const visit = await this.service.createVisit(
      request.params.id,
      request.body,
      createdById,
      companyId,
    );
    return reply.status(201).send(visit);
  }

  async listVisits(
    request: FastifyRequest<{ Params: ChecklistParams }>,
    reply: FastifyReply,
  ) {
    const visits = await this.service.listVisits(request.params.id);
    return reply.status(200).send(visits);
  }

  async resolveItem(
    request: FastifyRequest<{
      Params: ChecklistItemParams;
      Body: ResolveChecklistItemInput;
    }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    const userId = Number(request.user.sub);
    const item = await this.service.resolveItem(
      request.params.id,
      request.params.itemId,
      companyId,
      userId,
      request.body,
    );
    return reply.status(200).send(item);
  }
}
