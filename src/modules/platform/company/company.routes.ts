import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { CompanyRepository } from './company.repository.js';
import { CompanyService } from './company.service.js';
import { CompanyController } from './company.controller.js';
import {
  companyParamsSchema,
  createCompanySchema,
  updateCompanySchema,
  updateCompanyStatusSchema,
  listCompaniesQuerySchema,
} from './company.schema.js';

export const companyPlatformRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new CompanyRepository();
  const service = new CompanyService(repo);
  const controller = new CompanyController(service);

  app.get('/', { schema: { querystring: listCompaniesQuerySchema } },
    controller.list.bind(controller));

  app.post('/', { schema: { body: createCompanySchema } },
    controller.create.bind(controller));

  app.get('/:id', { schema: { params: companyParamsSchema } },
    controller.getOne.bind(controller));

  app.patch('/:id', { schema: { params: companyParamsSchema, body: updateCompanySchema } },
    controller.update.bind(controller));

  app.patch('/:id/status', { schema: { params: companyParamsSchema, body: updateCompanyStatusSchema } },
    controller.updateStatus.bind(controller));
};
