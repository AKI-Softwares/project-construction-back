import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcrypt';
import { prisma } from '../../../shared/infra/database/prisma.js';
import { createTestApp } from '../../helpers/build-app.js';

const PLATFORM_ADMIN_EMAIL = `platform-admin-company-test-${Date.now()}@test.com`;
const REGULAR_USER_EMAIL   = `regular-user-company-test-${Date.now()}@test.com`;
const SLUG                 = `platform-test-${Date.now()}`;
const PASSWORD             = 'Test@1234';

let app: Awaited<ReturnType<typeof createTestApp>>;
let adminToken: string;
let regularToken: string;
let createdCompanyId: number;
let platformAdminId: number;
let regularUserId: number;

beforeAll(async () => {
  app = await createTestApp();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Create platform admin user
  const admin = await prisma.user.upsert({
    where: { email: PLATFORM_ADMIN_EMAIL },
    update: {},
    create: {
      name: 'Platform Admin Test',
      email: PLATFORM_ADMIN_EMAIL,
      passwordHash,
      isPlatformAdmin: true,
    },
  });
  platformAdminId = admin.id;

  // Create regular (non-platform-admin) user (no company — login won't check company status)
  const regularUser = await prisma.user.upsert({
    where: { email: REGULAR_USER_EMAIL },
    update: {},
    create: {
      name: 'Regular User Test',
      email: REGULAR_USER_EMAIL,
      passwordHash,
      isPlatformAdmin: false,
    },
  });
  regularUserId = regularUser.id;

  // Login as platform admin
  const adminLoginRes = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: PLATFORM_ADMIN_EMAIL, password: PASSWORD },
  });
  expect(adminLoginRes.statusCode).toBe(200);
  adminToken = (adminLoginRes.json() as { token: string }).token;

  // Login as regular user
  const regularLoginRes = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: REGULAR_USER_EMAIL, password: PASSWORD },
  });
  expect(regularLoginRes.statusCode).toBe(200);
  regularToken = (regularLoginRes.json() as { token: string }).token;
});

afterAll(async () => {
  // Delete created company (if any)
  if (createdCompanyId) {
    await prisma.company.deleteMany({ where: { id: createdCompanyId } });
  }
  // Delete test users
  await prisma.user.deleteMany({
    where: { id: { in: [platformAdminId, regularUserId].filter(Boolean) } },
  });
  await app.close();
});

describe('POST /platform/companies', () => {
  it('creates a company and returns 201 with status ACTIVE and id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/platform/companies',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Test Company', slug: SLUG },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{ id: number; status: string; slug: string }>();
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('number');
    expect(body.status).toBe('ACTIVE');
    createdCompanyId = body.id;
  });
});

describe('GET /platform/companies', () => {
  it('returns 200 with an array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/platform/companies',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it('returns 200 with array when filtering by status=ACTIVE', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/platform/companies?status=ACTIVE',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<Array<{ status: string }>>();
    expect(Array.isArray(body)).toBe(true);
    // All returned companies must be ACTIVE
    for (const company of body) {
      expect(company.status).toBe('ACTIVE');
    }
  });
});

describe('GET /platform/companies/:id', () => {
  it('returns 200 with correct slug', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/platform/companies/${createdCompanyId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: number; slug: string }>();
    expect(body.id).toBe(createdCompanyId);
    expect(body.slug).toBe(SLUG);
  });
});

describe('PATCH /platform/companies/:id', () => {
  it('returns 200 with updated name', async () => {
    const updatedName = 'Test Company Updated';
    const res = await app.inject({
      method: 'PATCH',
      url: `/platform/companies/${createdCompanyId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: updatedName },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ name: string }>();
    expect(body.name).toBe(updatedName);
  });
});

describe('Auth guard', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/platform/companies',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when an invalid token is provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/platform/companies',
      headers: { authorization: 'Bearer invalid.token.here' },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('Platform admin guard', () => {
  it('returns 403 when authenticated as a non-platform-admin user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/platform/companies',
      headers: { authorization: `Bearer ${regularToken}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
