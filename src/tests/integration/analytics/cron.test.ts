import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../../shared/infra/database/prisma.js";
import { createTestApp } from "../../helpers/build-app.js";
import { env } from "../../../shared/config/env.js";

let app: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await prisma.metricsSnapshot.deleteMany({});
  await app.close();
});

describe("GET /cron/metrics-snapshot", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await app.inject({ method: "GET", url: "/cron/metrics-snapshot" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when Authorization header is wrong", async () => {
    const res = await app.inject({
      method: "GET", url: "/cron/metrics-snapshot",
      headers: { authorization: "Bearer wrong-secret" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 200 with processed count when secret is correct", async () => {
    const res = await app.inject({
      method: "GET", url: "/cron/metrics-snapshot",
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ processed: number; date: string }>();
    expect(typeof body.processed).toBe("number");
    expect(typeof body.date).toBe("string");
  });
});
