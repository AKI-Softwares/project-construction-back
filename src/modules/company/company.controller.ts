import type { FastifyRequest, FastifyReply } from "fastify";
import { getTenantId } from "../../shared/tenant/tenant-context.js";
import type { MyCompanyService } from "./company.service.js";
import type { UpdateMyCompanyInput } from "./company.schema.js";

export class MyCompanyController {
  constructor(private service: MyCompanyService) {}

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const companyId = getTenantId(request);
    const company = await this.service.getMyCompany(companyId);
    return reply.status(200).send(company);
  }

  async updateMe(
    request: FastifyRequest<{ Body: UpdateMyCompanyInput }>,
    reply: FastifyReply,
  ) {
    const companyId = getTenantId(request);
    const company = await this.service.updateMyCompany(companyId, request.body);
    return reply.status(200).send(company);
  }
}
