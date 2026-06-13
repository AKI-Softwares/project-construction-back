import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcrypt";
import { prisma } from "../../../shared/infra/database/prisma.js";
import { createTestApp } from "../../helpers/build-app.js";

const PLATFORM_EMAIL = `plat-analytics-admin-${Date.now()}@test.com`;
const REGULAR_EMAIL  = `plat-analytics-regular-${Date.now()}@test.com`;
const PASSWORD       = "Test@1234";

let app: Awaited<ReturnType<typeof createTestApp>>;
let platformToken: string;
let regularToken: string;
let platformAdminId: number;
let regularUserId: number;

beforeAll(async () => {
  app = await createTestApp();
  const hash = await bcrypt.hash(PASSWORD, 10);

  const platformAdmin = await prisma.user.create({
    data: { name: "Platform Admin", email: PLATFORM_EMAIL, passwordHash: hash, isPlatformAdmin: true },
  });
  platformAdminId = platformAdmin.id;

  const regularUser = await prisma.user.create({
    data: { name: "Regular User", email: REGULAR_EMAIL, passwordHash: hash, isPlatformAdmin: false },
  });
  regularUserId = regularUser.id;

  const platLogin = await app.inject({
    method: "POST", url: "/auth/login",
    payload: { email: PLATFORM_EMAIL, password: PASSWORD },
  });
  platformToken = (platLogin.json() as { token: string }).token;

  const regLogin = await app.inject({
    method: "POST", url: "/auth/login",
    payload: { email: REGULAR_EMAIL, password: PASSWORD },
  });
  regularToken = (regLogin.json() as { token: string }).token;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [platformAdminId, regularUserId] } } });
  await app.close();
});

describe("GET /platform/analytics/overview", () => {
  it("returns 200 with overview data for platform admin", async () => {
    const res = await app.inject({
      method: "GET", url: "/platform/analytics/overview",
      headers: { authorization: `Bearer ${platformToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: Record<string, unknown> }>();
    expect(body.data).toHaveProperty("activeCompanies");
    expect(body.data).toHaveProperty("totalUsers");
  });

  it("returns 403 for non-platform-admin", async () => {
    const res = await app.inject({
      method: "GET", url: "/platform/analytics/overview",
      headers: { authorization: `Bearer ${regularToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /platform/analytics/usage", () => {
  it("returns 200 with array", async () => {
    const res = await app.inject({
      method: "GET", url: "/platform/analytics/usage",
      headers: { authorization: `Bearer ${platformToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json<{ data: unknown[] }>().data)).toBe(true);
  });
});

describe("GET /platform/analytics/growth", () => {
  it("returns 200 with array", async () => {
    const res = await app.inject({
      method: "GET", url: "/platform/analytics/growth",
      headers: { authorization: `Bearer ${platformToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json<{ data: unknown[] }>().data)).toBe(true);
  });
});
