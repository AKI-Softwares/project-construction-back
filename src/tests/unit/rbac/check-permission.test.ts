import { describe, it, expect } from 'vitest';
import { checkPermission } from '../../../shared/rbac/check-permission.js';
import { HttpError } from '../../../shared/errors/http-error.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

function makeReq(user: Partial<FastifyRequest['user']>): FastifyRequest {
  return { user } as unknown as FastifyRequest;
}
const reply = {} as FastifyReply;

describe('checkPermission', () => {
  it('bypasses for isPlatformAdmin', async () => {
    const handler = checkPermission('visits:read');
    await expect(handler(makeReq({ isPlatformAdmin: true, isCompanyAdmin: false, permissions: [] }), reply))
      .resolves.toBeUndefined();
  });

  it('bypasses for isCompanyAdmin', async () => {
    const handler = checkPermission('visits:read');
    await expect(handler(makeReq({ isPlatformAdmin: false, isCompanyAdmin: true, permissions: [] }), reply))
      .resolves.toBeUndefined();
  });

  it('passes when user has required permission', async () => {
    const handler = checkPermission('visits:read');
    await expect(handler(makeReq({ isPlatformAdmin: false, isCompanyAdmin: false, permissions: ['visits:read'] }), reply))
      .resolves.toBeUndefined();
  });

  it('throws 403 when user lacks permission', async () => {
    const handler = checkPermission('visits:read');
    const req = makeReq({ isPlatformAdmin: false, isCompanyAdmin: false, permissions: ['buildings:read'] });
    await expect(handler(req, reply)).rejects.toThrow(HttpError);
    try {
      await handler(req, reply);
    } catch (e) {
      expect((e as HttpError).statusCode).toBe(403);
    }
  });

  it('requires ALL permissions when multiple specified', async () => {
    const handler = checkPermission('visits:read', 'visits:update');
    const req = makeReq({ isPlatformAdmin: false, isCompanyAdmin: false, permissions: ['visits:read'] });
    await expect(handler(req, reply)).rejects.toThrow(HttpError);
  });
});
