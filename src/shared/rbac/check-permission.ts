import type { FastifyReply, FastifyRequest } from "fastify";
import { HttpError } from "../errors/http-error.js";
import type { PermissionAction } from "./permissions.catalog.js";

/**
 * Factory de preHandler para autorização por permissão.
 *
 * Semântica AND: requer TODAS as permissões listadas.
 * Bypasses: isPlatformAdmin e isCompanyAdmin têm acesso total.
 *   preHandler: [app.authenticate, checkPermission("users:update")]
 *   preHandler: [app.authenticate, checkPermission("roles:create", "permissions:read")]
 */
export function checkPermission(...required: PermissionAction[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (request.user.isPlatformAdmin) return;
    if (request.user.isCompanyAdmin) return;

    const userPerms = request.user?.permissions ?? [];
    const hasAll = required.every((p) => userPerms.includes(p));
    if (!hasAll) {
      throw new HttpError(403, "Access denied: insufficient permissions.");
    }
  };
}
