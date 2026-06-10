import { describe, it, expect } from 'vitest';
import { withCompanyScope, assertCompanyOwnership } from '../../../shared/tenant/with-company-scope.js';
import { HttpError } from '../../../shared/errors/http-error.js';

describe('withCompanyScope', () => {
  it('returns object with companyId', () => {
    expect(withCompanyScope(42)).toEqual({ companyId: 42 });
  });

  it('can be spread into a Prisma where clause', () => {
    const where = { id: 1, ...withCompanyScope(5) };
    expect(where).toEqual({ id: 1, companyId: 5 });
  });
});

describe('assertCompanyOwnership', () => {
  it('does not throw when ids match', () => {
    expect(() => assertCompanyOwnership(10, 10)).not.toThrow();
  });

  it('throws HttpError 403 when ids differ', () => {
    expect(() => assertCompanyOwnership(10, 99)).toThrow(HttpError);
    try {
      assertCompanyOwnership(10, 99);
    } catch (e) {
      expect((e as HttpError).statusCode).toBe(403);
    }
  });
});
