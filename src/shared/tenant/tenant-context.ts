import type { FastifyRequest } from 'fastify';
import { HttpError } from '../errors/http-error.js';

export function getTenantId(request: FastifyRequest): number {
  if (request.user.isPlatformAdmin) {
    const override = request.headers['x-company-id'];
    if (!override) {
      throw new HttpError(400, 'Platform admin must specify X-Company-Id header.');
    }
    return Number(override);
  }
  if (!request.user.companyId) {
    throw new HttpError(403, 'No company context.');
  }
  return request.user.companyId;
}
