import type { FastifyRequest, FastifyReply } from 'fastify';
import type { CompanyService } from './company.service.js';
import type {
  CompanyParams,
  CreateCompanyInput,
  UpdateCompanyInput,
  UpdateCompanyStatusInput,
  ListCompaniesQuery,
} from './company.schema.js';

export class CompanyController {
  constructor(private service: CompanyService) {}

  async list(request: FastifyRequest<{ Querystring: ListCompaniesQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.list(request.query));
  }

  async getOne(request: FastifyRequest<{ Params: CompanyParams }>, reply: FastifyReply) {
    return reply.send(await this.service.getOne(request.params.id));
  }

  async create(request: FastifyRequest<{ Body: CreateCompanyInput }>, reply: FastifyReply) {
    return reply.status(201).send(await this.service.create(request.body));
  }

  async update(request: FastifyRequest<{ Params: CompanyParams; Body: UpdateCompanyInput }>, reply: FastifyReply) {
    return reply.send(await this.service.update(request.params.id, request.body));
  }

  async updateStatus(request: FastifyRequest<{ Params: CompanyParams; Body: UpdateCompanyStatusInput }>, reply: FastifyReply) {
    return reply.send(await this.service.updateStatus(request.params.id, request.body));
  }
}
