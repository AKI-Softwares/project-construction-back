import { describe, it, expect } from "vitest";
import { analyticsQuerySchema, parseDateRange, isShortRange } from "../../../modules/analytics/analytics.schema.js";

describe("analyticsQuerySchema", () => {
  it("accepts valid period", () => {
    expect(() => analyticsQuerySchema.parse({ period: "30d" })).not.toThrow();
  });

  it("rejects invalid period", () => {
    expect(() => analyticsQuerySchema.parse({ period: "60d" })).toThrow();
  });

  it("accepts valid from/to range", () => {
    expect(() => analyticsQuerySchema.parse({ from: "2026-01-01", to: "2026-03-01" })).not.toThrow();
  });

  it("rejects from > to", () => {
    expect(() => analyticsQuerySchema.parse({ from: "2026-03-01", to: "2026-01-01" })).toThrow();
  });

  it("rejects range > 2 years", () => {
    expect(() => analyticsQuerySchema.parse({ from: "2020-01-01", to: "2026-01-02" })).toThrow();
  });

  it("defaults to empty (service picks 30d)", () => {
    expect(() => analyticsQuerySchema.parse({})).not.toThrow();
  });
});

describe("parseDateRange", () => {
  it("returns 30-day range by default", () => {
    const { from, to } = parseDateRange({});
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(29);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  it("returns 7-day range for period=7d", () => {
    const { from, to } = parseDateRange({ period: "7d" });
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(8);
  });

  it("uses explicit from/to when provided", () => {
    const { from, to } = parseDateRange({ from: "2026-01-01", to: "2026-01-31" });
    expect(from.toISOString().startsWith("2026-01-01")).toBe(true);
    expect(to.toISOString().startsWith("2026-01-31")).toBe(true);
  });
});

describe("isShortRange", () => {
  it("returns true for 30 days or less", () => {
    const from = new Date("2026-05-14");
    const to = new Date("2026-06-13");
    expect(isShortRange(from, to)).toBe(true);
  });

  it("returns false for more than 30 days", () => {
    const from = new Date("2026-01-01");
    const to = new Date("2026-06-13");
    expect(isShortRange(from, to)).toBe(false);
  });
});
