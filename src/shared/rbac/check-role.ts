import type { FastifyReply, FastifyRequest } from "fastify";
import { HttpError } from "../errors/http-error.js";
import type { RoleName } from "./roles.js";

/**
 * Factory de preHandler para controle de acesso por role (RBAC).
 *
 * Uso nas rotas:
 *   preHandler: [app.authenticate, checkRole(Role.ADMIN)]
 *   preHandler: [app.authenticate, checkRole(Role.ADMIN, Role.MANAGER)]
 */
export function checkRole(...allowedRoles: RoleName[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const userRole = request.user?.role as RoleName | undefined;

    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new HttpError(403, "Acesso negado: permissão insuficiente.");
    }
  };
}
