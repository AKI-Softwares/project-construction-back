import type { FastifyRequest } from "fastify";
import { HttpError } from "../errors/http-error.js";

export function getTenantId(request: FastifyRequest): number {
  if (request.user.isPlatformAdmin) {
    const override = request.headers["x-company-id"];
    if (!override) {
      throw new HttpError(
        400,
        "Platform admin must specify X-Company-Id header.",
      );
    }
    const raw = Array.isArray(override) ? override[0] : override;
    const id = parseInt(raw as string, 10);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'X-Company-Id must be a positive integer.');
    }
    return id;
  }
  if (!request.user.companyId) {
    throw new HttpError(403, "No company context.");
  }
  return request.user.companyId;
}

export function getOptionalTenantId(request: FastifyRequest): number | null {
  if (request.user.isPlatformAdmin) {
    const override = request.headers["x-company-id"];
    if (!override) return null;
    const raw = Array.isArray(override) ? override[0] : override;
    const id = parseInt(raw as string, 10);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'X-Company-Id must be a positive integer.');
    }
    return id;
  }
  if (!request.user.companyId) {
    throw new HttpError(403, "No company context.");
  }
  return request.user.companyId;
}
