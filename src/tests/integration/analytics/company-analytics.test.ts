import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcrypt";
import { prisma } from "../../../shared/infra/database/prisma.js";
import { createTestApp } from "../../helpers/build-app.js";

const EMAIL_ADMIN   = `analytics-admin-${Date.now()}@test.com`;
const EMAIL_REGULAR = `analytics-regular-${Date.now()}@test.com`;
const PASSWORD      = "Test@1234";

let app: Awaited<ReturnType<typeof createTestApp>>;
let adminToken: string;
let regularToken: string;
let companyId: number;
let adminUserId: number;
let regularUserId: number;
let adminRoleId: number;
let regularRoleId: number;

beforeAll(async () => {
  app = await createTestApp();
  const hash = await bcrypt.hash(PASSWORD, 10);

  const company = await prisma.company.create({
    data: { name: "Analytics Test Co", slug: `analytics-co-${Date.now()}`, status: "ACTIVE" },
  });
  companyId = company.id;

  const adminRole = await prisma.role.create({
    data: { name: "Admin Analytics", isCompanyAdmin: true, companyId },
  });
  adminRoleId = adminRole.id;

  const regularRole = await prisma.role.create({
    data: { name: "Inspector Analytics", isCompanyAdmin: false, companyId },
  });
  regularRoleId = regularRole.id;

  const adminUser = await prisma.user.create({
    data: { name: "Admin User", email: EMAIL_ADMIN, passwordHash: hash, companyId, roleId: adminRole.id },
  });
  adminUserId = adminUser.id;

  const regularUser = await prisma.user.create({
    data: { name: "Regular User", email: EMAIL_REGULAR, passwordHash: hash, companyId, roleId: regularRole.id },
  });
  regularUserId = regularUser.id;

  const adminLogin = await app.inject({
    method: "POST", url: "/auth/login",
    payload: { email: EMAIL_ADMIN, password: PASSWORD },
  });
  adminToken = (adminLogin.json() as { token: string }).token;

  const regularLogin = await app.inject({
    method: "POST", url: "/auth/login",
    payload: { email: EMAIL_REGULAR, password: PASSWORD },
  });
  regularToken = (regularLogin.json() as { token: string }).token;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [adminUserId, regularUserId] } } });
  await prisma.role.deleteMany({ where: { id: { in: [adminRoleId, regularRoleId] } } });
  await prisma.company.delete({ where: { id: companyId } });
  await app.close();
});

describe("GET /analytics/overview", () => {
  it("returns 200 with overview data for company admin", async () => {
    const res = await app.inject({
      method: "GET", url: "/analytics/overview",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ period: object; dataSource: string; data: Record<string, unknown> }>();
    expect(body).toHaveProperty("period");
    expect(body).toHaveProperty("dataSource");
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveProperty("totalApartments");
    expect(body.data).toHaveProperty("nokRate");
    expect(body.data).toHaveProperty("totalNonConformities");
  });

  it("returns 403 for non-admin user", async () => {
    const res = await app.inject({
      method: "GET", url: "/analytics/overview",
      headers: { authorization: `Bearer ${regularToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/analytics/overview" });
    expect(res.statusCode).toBe(401);
  });

  it("accepts period query param", async () => {
    const res = await app.inject({
      method: "GET", url: "/analytics/overview?period=7d",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 400 for invalid period", async () => {
    const res = await app.inject({
      method: "GET", url: "/analytics/overview?period=60d",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /analytics/progress", () => {
  it("returns 200 with array for company admin", async () => {
    const res = await app.inject({
      method: "GET", url: "/analytics/progress",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: unknown[] }>();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns 403 for non-admin", async () => {
    const res = await app.inject({
      method: "GET", url: "/analytics/progress",
      headers: { authorization: `Bearer ${regularToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /analytics/quality", () => {
  it("returns 200 with array for company admin", async () => {
    const res = await app.inject({
      method: "GET", url: "/analytics/quality",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: unknown[] }>();
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe("GET /analytics/inspectors", () => {
  it("returns 200 with array for company admin", async () => {
    const res = await app.inject({
      method: "GET", url: "/analytics/inspectors",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: unknown[] }>();
    expect(Array.isArray(body.data)).toBe(true);
  });
});
