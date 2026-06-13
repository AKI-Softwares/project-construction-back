import { describe, it, expect } from "vitest";
import { requireCompanyAdmin } from "../../../shared/rbac/require-company-admin.js";
import { HttpError } from "../../../shared/errors/http-error.js";
import type { FastifyRequest, FastifyReply } from "fastify";

function makeReq(isCompanyAdmin: boolean): FastifyRequest {
  return { user: { isCompanyAdmin } } as unknown as FastifyRequest;
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
});
