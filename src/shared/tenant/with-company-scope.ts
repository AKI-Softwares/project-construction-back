import { HttpError } from "../errors/http-error.js";

export function withCompanyScope(companyId: number) {
  return { companyId } as const;
}

export function assertCompanyOwnership(
  entityCompanyId: number,
  requestCompanyId: number,
) {
  if (entityCompanyId !== requestCompanyId) {
    throw new HttpError(403, "Access denied.");
  }
}
