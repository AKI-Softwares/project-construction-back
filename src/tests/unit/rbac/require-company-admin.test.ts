import { describe, it, expect } from "vitest";
import { requireCompanyAdmin } from "../../../shared/rbac/require-company-admin.js";
import { HttpError } from "../../../shared/errors/http-error.js";
import type { FastifyRequest, FastifyReply } from "fastify";

function makeReq(isCompanyAdmin: boolean, isPlatformAdmin = false): FastifyRequest {
  return { user: { isCompanyAdmin, isPlatformAdmin } } as unknown as FastifyRequest;
}
const reply = {} as FastifyReply;

describe("requireCompanyAdmin", () => {
  it("does not reject for company admin", async () => {
    await expect(requireCompanyAdmin(makeReq(true), reply)).resolves.toBeUndefined();
  });

  it("rejects with HttpError 403 for non-company-admin", async () => {
    await expect(requireCompanyAdmin(makeReq(false), reply)).rejects.toThrow(HttpError);
    try {
      await requireCompanyAdmin(makeReq(false), reply);
    } catch (e) {
      expect((e as HttpError).statusCode).toBe(403);
      expect((e as HttpError).message).toBe("Company admin required.");
    }
  });

  it("does not reject for platform admin even when isCompanyAdmin is false", async () => {
    await expect(requireCompanyAdmin(makeReq(false, true), reply)).resolves.toBeUndefined();
  });

  it("rejects with HttpError 403 when both isCompanyAdmin and isPlatformAdmin are false", async () => {
    await expect(requireCompanyAdmin(makeReq(false, false), reply)).rejects.toThrow(HttpError);
    try {
      await requireCompanyAdmin(makeReq(false, false), reply);
    } catch (e) {
      expect((e as HttpError).statusCode).toBe(403);
      expect((e as HttpError).message).toBe("Company admin required.");
    }
  });
});
