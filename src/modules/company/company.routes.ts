import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { MyCompanyRepository } from "./company.repository.js";
import { MyCompanyService } from "./company.service.js";
import { MyCompanyController } from "./company.controller.js";
import { updateMyCompanySchema } from "./company.schema.js";
import { requireCompanyAdmin } from "../../shared/rbac/require-company-admin.js";

export const companyRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new MyCompanyRepository();
  const service = new MyCompanyService(repo);
  const controller = new MyCompanyController(service);

  app.get(
    "/me",
    { preHandler: [app.authenticate, requireCompanyAdmin] },
    controller.getMe.bind(controller),
  );

  app.patch(
    "/me",
    {
      schema: { body: updateMyCompanySchema },
      preHandler: [app.authenticate, requireCompanyAdmin],
    },
    controller.updateMe.bind(controller),
  );
};
