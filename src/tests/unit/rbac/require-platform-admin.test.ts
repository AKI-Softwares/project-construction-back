import { describe, it, expect } from "vitest";
import { requirePlatformAdmin } from "../../../shared/rbac/require-platform-admin.js";
import { HttpError } from "../../../shared/errors/http-error.js";
import type { FastifyRequest, FastifyReply } from "fastify";

function makeReq(isPlatformAdmin: boolean): FastifyRequest {
  return { user: { isPlatformAdmin } } as unknown as FastifyRequest;
}
const reply = {} as FastifyReply;

describe("requirePlatformAdmin", () => {
  it("does not reject for platform admin", async () => {
    await expect(requirePlatformAdmin(makeReq(true), reply)).resolves.toBeUndefined();
  });

  it("rejects with HttpError 403 for non-platform-admin", async () => {
    await expect(requirePlatformAdmin(makeReq(false), reply)).rejects.toThrow(HttpError);
    try {
      await requirePlatformAdmin(makeReq(false), reply);
    } catch (e) {
      expect((e as HttpError).statusCode).toBe(403);
      expect((e as HttpError).message).toBe("Platform admin required.");
    }
  });
});
