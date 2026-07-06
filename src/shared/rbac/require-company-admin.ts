import type { FastifyRequest, FastifyReply } from "fastify";
import { HttpError } from "../errors/http-error.js";

export async function requireCompanyAdmin(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  if (!request.user.isCompanyAdmin && !request.user.isPlatformAdmin) {
    throw new HttpError(403, "Company admin required.");
  }
}
