import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcrypt';
import { prisma } from '../../../shared/infra/database/prisma.js';
import { createTestApp } from '../../helpers/build-app.js';

const PLATFORM_ADMIN_EMAIL = `platform-admin-catalog-test-${Date.now()}@test.com`;
const PASSWORD             = 'Test@1234';

let app: Awaited<ReturnType<typeof createTestApp>>;
let adminToken: string;
let platformAdminId: number;
let createdServiceId: number;

beforeAll(async () => {
  app = await createTestApp();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Create platform admin user
  const admin = await prisma.user.upsert({
    where: { email: PLATFORM_ADMIN_EMAIL },
    update: {},
    create: {
      name: 'Platform Admin Catalog Test',
      email: PLATFORM_ADMIN_EMAIL,
      passwordHash,
      isPlatformAdmin: true,
    },
  });
  platformAdminId = admin.id;

  // Login as platform admin
  const loginRes = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: PLATFORM_ADMIN_EMAIL, password: PASSWORD },
  });
  expect(loginRes.statusCode).toBe(200);
  adminToken = (loginRes.json() as { token: string }).token;
});

afterAll(async () => {
  // Clean up any remaining service template created by tests
  if (createdServiceId) {
    await prisma.service.deleteMany({ where: { id: createdServiceId } });
  }
  // Delete platform admin user
  await prisma.user.deleteMany({ where: { id: platformAdminId } });
  await app.close();
});

describe('POST /platform/catalog/services', () => {
  it('creates a service template and returns 201 with id and name', async () => {
    const serviceName = `Test Service ${Date.now()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/platform/catalog/services',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: serviceName,
        description: 'A test platform service template',
        category: 'Testing',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{ id: number; name: string }>();
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('number');
    expect(body.name).toBe(serviceName);
    createdServiceId = body.id;
  });
});

describe('GET /platform/catalog/services', () => {
  it('returns 200 with an array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/platform/catalog/services',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});

describe('GET /platform/catalog/services/:id', () => {
  it('returns 200 with the created service', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/platform/catalog/services/${createdServiceId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: number }>();
    expect(body.id).toBe(createdServiceId);
  });
});

describe('PATCH /platform/catalog/services/:id', () => {
  it('returns 200 with updated name', async () => {
    const updatedName = `Test Service Updated ${Date.now()}`;
    const res = await app.inject({
      method: 'PATCH',
      url: `/platform/catalog/services/${createdServiceId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: updatedName },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ name: string }>();
    expect(body.name).toBe(updatedName);
  });
});

describe('DELETE /platform/catalog/services/:id', () => {
  it('returns 204 and removes the service', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/platform/catalog/services/${createdServiceId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(204);

    // Confirm it's gone
    const checkRes = await app.inject({
      method: 'GET',
      url: `/platform/catalog/services/${createdServiceId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(checkRes.statusCode).toBe(404);

    // Already deleted — prevent afterAll from trying again
    createdServiceId = 0;
  });
});
