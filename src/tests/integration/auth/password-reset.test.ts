import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../../../shared/infra/database/prisma.js';
import { createTestApp } from '../../helpers/build-app.js';

const USER_EMAIL = `reset-test-${Date.now()}@test.com`;
const PASSWORD = 'Test@1234';
let app: Awaited<ReturnType<typeof createTestApp>>;
let userId: number;
let adminUserId: number;
let adminToken: string;
const ADMIN_EMAIL = `admin-reset-test-${Date.now()}@test.com`;

beforeAll(async () => {
  app = await createTestApp();
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.create({
    data: { name: 'Reset Test User', email: USER_EMAIL, passwordHash },
  });
  userId = user.id;

  const company = await prisma.company.create({
    data: { name: 'Reset Test Co', slug: `reset-test-co-${Date.now()}`, status: 'ACTIVE' },
  });
  const adminRole = await prisma.role.create({
    data: {
      name: 'Admin',
      isCompanyAdmin: true,
      companyId: company.id,
    },
  });
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin Reset Test',
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(PASSWORD, 12),
      companyId: company.id,
      roleId: adminRole.id,
    },
  });
  adminUserId = adminUser.id;

  await prisma.user.update({ where: { id: userId }, data: { companyId: company.id } });

  const adminLoginRes = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: ADMIN_EMAIL, password: PASSWORD },
  });
  adminToken = (adminLoginRes.json() as { token: string }).token;
});

afterAll(async () => {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: adminUserId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.role.deleteMany({ where: { name: 'Admin', isCompanyAdmin: true } });
  await prisma.company.deleteMany({ where: { name: 'Reset Test Co' } });
  await app.close();
});

describe('POST /auth/forgot-password', () => {
  it('returns 200 for existing email and creates token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: USER_EMAIL },
    });
    expect(res.statusCode).toBe(200);

    const token = await prisma.passwordResetToken.findUnique({ where: { userId } });
    expect(token).not.toBeNull();
    expect(token!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns 200 for non-existent email without creating token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'nonexistent@test.com' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('overwrites existing token on second request', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: USER_EMAIL },
    });
    const firstToken = await prisma.passwordResetToken.findUnique({ where: { userId } });

    await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: USER_EMAIL },
    });
    const secondToken = await prisma.passwordResetToken.findUnique({ where: { userId } });

    expect(secondToken!.tokenHash).not.toBe(firstToken!.tokenHash);
  });
});

describe('POST /auth/reset-password', () => {
  it('resets password with valid token and deletes token', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.upsert({
      where: { userId },
      create: { userId, tokenHash, expiresAt },
      update: { tokenHash, expiresAt },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: rawToken, newPassword: 'NewPassword@123' },
    });
    expect(res.statusCode).toBe(200);

    const tokenAfter = await prisma.passwordResetToken.findUnique({ where: { userId } });
    expect(tokenAfter).toBeNull();

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: USER_EMAIL, password: 'NewPassword@123' },
    });
    expect(loginRes.statusCode).toBe(200);

    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(PASSWORD, 12) } });
  });

  it('returns 400 for invalid token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'invalidtoken', newPassword: 'NewPassword@123' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for expired token', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() - 1000);

    await prisma.passwordResetToken.upsert({
      where: { userId },
      create: { userId, tokenHash, expiresAt },
      update: { tokenHash, expiresAt },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: rawToken, newPassword: 'NewPassword@123' },
    });
    expect(res.statusCode).toBe(400);

    await prisma.passwordResetToken.deleteMany({ where: { userId } });
  });
});

describe('POST /auth/change-password', () => {
  let userToken: string;

  beforeAll(async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: USER_EMAIL, password: PASSWORD },
    });
    userToken = (loginRes.json() as { token: string }).token;
  });

  it('changes password with valid current password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { currentPassword: PASSWORD, newPassword: 'NewPassword@999' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe('Password updated successfully.');

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: USER_EMAIL, password: 'NewPassword@999' },
    });
    expect(loginRes.statusCode).toBe(200);

    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(PASSWORD, 12) } });
  });

  it('returns 401 for wrong current password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { currentPassword: 'wrongpassword', newPassword: 'NewPassword@999' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 without auth token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      payload: { currentPassword: PASSWORD, newPassword: 'NewPassword@999' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /users/:id/reset-password', () => {
  it('sends temp password and sets mustChangePassword', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/users/${userId}/reset-password`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe("Temporary password sent to user's email.");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mustChangePassword: true },
    });
    expect(user!.mustChangePassword).toBe(true);

    await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: false } });
  });

  it('returns 404 for non-existent user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/999999/reset-password',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/users/${userId}/reset-password`,
    });
    expect(res.statusCode).toBe(401);
  });
});
