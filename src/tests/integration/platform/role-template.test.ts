import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcrypt';
import { prisma } from '../../../shared/infra/database/prisma.js';
import { createTestApp } from '../../helpers/build-app.js';

const PLATFORM_ADMIN_EMAIL = `platform-admin-rt-test-${Date.now()}@test.com`;
const PASSWORD = 'Test@1234';
const TEMPLATE_NAME = `Test Role Template ${Date.now()}`;

let app: Awaited<ReturnType<typeof createTestApp>>;
let adminToken: string;
let platformAdminId: number;
let createdTemplateId: number;

beforeAll(async () => {
  app = await createTestApp();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: PLATFORM_ADMIN_EMAIL },
    update: {},
    create: { name: 'Platform Admin RT Test', email: PLATFORM_ADMIN_EMAIL, passwordHash, isPlatformAdmin: true },
  });
  platformAdminId = admin.id;

  const loginRes = await app.inject({
    method: 'POST', url: '/auth/login',
    payload: { email: PLATFORM_ADMIN_EMAIL, password: PASSWORD },
  });
  adminToken = loginRes.json().token;
});

afterAll(async () => {
  if (createdTemplateId) {
    await prisma.role.deleteMany({ where: { id: createdTemplateId, companyId: null } });
  }
  await prisma.user.deleteMany({ where: { id: platformAdminId } });
  await app.close();
});

describe('Platform role-template routes', () => {
  it('POST /platform/role-templates — creates template (201)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/platform/role-templates',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: TEMPLATE_NAME, description: 'Test template', permissionIds: [] },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe(TEMPLATE_NAME);
    expect(body.id).toBeDefined();
    createdTemplateId = body.id;
  });

  it('GET /platform/role-templates — lists templates (200)', async () => {
    const res = await app.inject({
      method: 'GET', url: '/platform/role-templates',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it('GET /platform/role-templates/:id — returns template (200)', async () => {
    const res = await app.inject({
      method: 'GET', url: `/platform/role-templates/${createdTemplateId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe(TEMPLATE_NAME);
  });

  it('PATCH /platform/role-templates/:id — updates template (200)', async () => {
    const updated = `${TEMPLATE_NAME} Updated`;
    const res = await app.inject({
      method: 'PATCH', url: `/platform/role-templates/${createdTemplateId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: updated },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe(updated);
  });

  it('DELETE /platform/role-templates/:id — deletes template (204)', async () => {
    const res = await app.inject({
      method: 'DELETE', url: `/platform/role-templates/${createdTemplateId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(204);
    createdTemplateId = 0;
  });

  it('GET /platform/role-templates/:id — 404 after delete', async () => {
    const res = await app.inject({
      method: 'GET', url: `/platform/role-templates/999999`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 401 with no token', async () => {
    const res = await app.inject({ method: 'GET', url: '/platform/role-templates' });
    expect(res.statusCode).toBe(401);
  });
});
