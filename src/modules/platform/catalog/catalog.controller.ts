import type { FastifyRequest, FastifyReply } from 'fastify';
import type { CatalogService } from './catalog.service.js';
import type {
  CatalogParams,
  CreateServiceInput, UpdateServiceInput,
  CreateApartmentTypeInput, UpdateApartmentTypeInput,
} from './catalog.schema.js';

export class CatalogController {
  constructor(private service: CatalogService) {}

  async listServices(_r: FastifyRequest, reply: FastifyReply)  { return reply.send(await this.service.listServices()); }
  async listAptTypes(_r: FastifyRequest, reply: FastifyReply)  { return reply.send(await this.service.listApartmentTypes()); }

  async getService(r: FastifyRequest<{ Params: CatalogParams }>, reply: FastifyReply) {
    return reply.send(await this.service.getService(r.params.id));
  }
  async createService(r: FastifyRequest<{ Body: CreateServiceInput }>, reply: FastifyReply) {
    return reply.status(201).send(await this.service.createService(r.body));
  }
  async updateService(r: FastifyRequest<{ Params: CatalogParams; Body: UpdateServiceInput }>, reply: FastifyReply) {
    return reply.send(await this.service.updateService(r.params.id, r.body));
  }
  async deleteService(r: FastifyRequest<{ Params: CatalogParams }>, reply: FastifyReply) {
    await this.service.deleteService(r.params.id);
    return reply.status(204).send();
  }

  async getAptType(r: FastifyRequest<{ Params: CatalogParams }>, reply: FastifyReply) {
    return reply.send(await this.service.getApartmentType(r.params.id));
  }
  async createAptType(r: FastifyRequest<{ Body: CreateApartmentTypeInput }>, reply: FastifyReply) {
    return reply.status(201).send(await this.service.createApartmentType(r.body));
  }
  async updateAptType(r: FastifyRequest<{ Params: CatalogParams; Body: UpdateApartmentTypeInput }>, reply: FastifyReply) {
    return reply.send(await this.service.updateApartmentType(r.params.id, r.body));
  }
  async deleteAptType(r: FastifyRequest<{ Params: CatalogParams }>, reply: FastifyReply) {
    await this.service.deleteApartmentType(r.params.id);
    return reply.status(204).send();
  }
}
