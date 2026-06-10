import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { CatalogRepository } from './catalog.repository.js';
import { CatalogService } from './catalog.service.js';
import { CatalogController } from './catalog.controller.js';
import {
  catalogParamsSchema,
  createServiceSchema, updateServiceSchema,
  createApartmentTypeSchema, updateApartmentTypeSchema,
} from './catalog.schema.js';

export const catalogPlatformRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new CatalogRepository();
  const service = new CatalogService(repo);
  const c = new CatalogController(service);

  app.get('/services', c.listServices.bind(c));
  app.post('/services', { schema: { body: createServiceSchema } }, c.createService.bind(c));
  app.get('/services/:id', { schema: { params: catalogParamsSchema } }, c.getService.bind(c));
  app.patch('/services/:id', { schema: { params: catalogParamsSchema, body: updateServiceSchema } }, c.updateService.bind(c));
  app.delete('/services/:id', { schema: { params: catalogParamsSchema } }, c.deleteService.bind(c));

  app.get('/apartment-types', c.listAptTypes.bind(c));
  app.post('/apartment-types', { schema: { body: createApartmentTypeSchema } }, c.createAptType.bind(c));
  app.get('/apartment-types/:id', { schema: { params: catalogParamsSchema } }, c.getAptType.bind(c));
  app.patch('/apartment-types/:id', { schema: { params: catalogParamsSchema, body: updateApartmentTypeSchema } }, c.updateAptType.bind(c));
  app.delete('/apartment-types/:id', { schema: { params: catalogParamsSchema } }, c.deleteAptType.bind(c));
};
