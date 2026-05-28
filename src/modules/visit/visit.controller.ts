import type { FastifyRequest, FastifyReply } from "fastify";
import type { VisitService } from "./visit.service.js";
import type {
  VisitParams,
  VisitItemParams,
  FinalizeVisitInput,
  UpdateVisitItemInput,
  AddNonConformityInput,
} from "./visit.schema.js";

type VisitDetail = NonNullable<Awaited<ReturnType<VisitService["getVisit"]>>>;
type VisitItemRaw = VisitDetail["items"][number];

function groupByRoom(items: VisitItemRaw[]) {
  const map = new Map<number, {
    id: number;
    name: string;
    isComplete: boolean;
    items: object[];
  }>();

  for (const item of items) {
    const room = item.checklistItem.apartmentRoomService.apartmentRoom;
    if (!map.has(room.id)) {
      map.set(room.id, { id: room.id, name: room.name, isComplete: true, items: [] });
    }
    const group = map.get(room.id)!;
    if (item.status === null) group.isComplete = false;
    group.items.push({
      id: item.id,
      serviceId: item.checklistItem.apartmentRoomService.service.id,
      serviceName: item.checklistItem.apartmentRoomService.service.name,
      status: item.status,
      nonConformity: item.nonConformity
        ? {
            id: item.nonConformity.id,
            description: item.nonConformity.description,
            createdAt: item.nonConformity.createdAt,
            photos: item.nonConformity.photos,
          }
        : null,
    });
  }

  return Array.from(map.values());
}

export class VisitController {
  constructor(private service: VisitService) {}

  async getOne(
    request: FastifyRequest<{ Params: VisitParams }>,
    reply: FastifyReply,
  ) {
    const visit = await this.service.getVisit(request.params.id);
    const { items, ...rest } = visit;
    return reply.status(200).send({ ...rest, rooms: groupByRoom(items) });
  }

  async finalize(
    request: FastifyRequest<{ Params: VisitParams; Body: FinalizeVisitInput }>,
    reply: FastifyReply,
  ) {
    const userId = Number(request.user.sub);
    const visit = await this.service.finalizeVisit(request.params.id, request.body, userId);
    return reply.status(200).send(visit);
  }

  async updateItem(
    request: FastifyRequest<{ Params: VisitItemParams; Body: UpdateVisitItemInput }>,
    reply: FastifyReply,
  ) {
    const item = await this.service.updateVisitItem(
      request.params.id,
      request.params.itemId,
      request.body,
    );
    return reply.status(200).send(item);
  }

  async addNonConformity(
    request: FastifyRequest<{ Params: VisitItemParams; Body: AddNonConformityInput }>,
    reply: FastifyReply,
  ) {
    const nc = await this.service.addNonConformity(
      request.params.id,
      request.params.itemId,
      request.body,
    );
    return reply.status(201).send(nc);
  }

  async deleteNonConformity(
    request: FastifyRequest<{ Params: VisitItemParams }>,
    reply: FastifyReply,
  ) {
    await this.service.deleteNonConformity(request.params.id, request.params.itemId);
    return reply.status(204).send();
  }
}
