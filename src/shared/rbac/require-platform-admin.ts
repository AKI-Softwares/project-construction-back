import type { FastifyRequest, FastifyReply } from "fastify";
import { HttpError } from "../errors/http-error.js";

export async function requirePlatformAdmin(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  if (!request.user.isPlatformAdmin) {
    throw new HttpError(403, "Platform admin required.");
  }
}
