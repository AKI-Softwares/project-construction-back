import { describe, it, expect } from 'vitest';
import { getTenantId } from '../../../shared/tenant/tenant-context.js';
import { HttpError } from '../../../shared/errors/http-error.js';
import type { FastifyRequest } from 'fastify';

function makeRequest(user: Partial<FastifyRequest['user']>): FastifyRequest {
  return { user, headers: {} } as unknown as FastifyRequest;
}

describe('getTenantId', () => {
  it('returns companyId from JWT for regular user', () => {
    const req = makeRequest({ isPlatformAdmin: false, companyId: 7 });
    expect(getTenantId(req)).toBe(7);
  });

  it('throws 403 when regular user has no companyId', () => {
    const req = makeRequest({ isPlatformAdmin: false, companyId: null });
    expect(() => getTenantId(req)).toThrow(HttpError);
    try { getTenantId(req); } catch (e) {
      expect((e as HttpError).statusCode).toBe(403);
    }
  });

  it('returns X-Company-Id header value for platform admin', () => {
    const req = { user: { isPlatformAdmin: true }, headers: { 'x-company-id': '42' } } as unknown as FastifyRequest;
    expect(getTenantId(req)).toBe(42);
  });

  it('throws 400 when platform admin omits X-Company-Id', () => {
    const req = { user: { isPlatformAdmin: true }, headers: {} } as unknown as FastifyRequest;
    expect(() => getTenantId(req)).toThrow(HttpError);
    try { getTenantId(req); } catch (e) {
      expect((e as HttpError).statusCode).toBe(400);
    }
  });
});
