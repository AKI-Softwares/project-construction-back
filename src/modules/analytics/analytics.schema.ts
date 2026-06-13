import { z } from "zod";

const VALID_PERIODS = ["7d", "30d", "90d"] as const;
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export const analyticsQuerySchema = z
  .object({
    period: z.enum(VALID_PERIODS).optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  })
  .refine((d) => !(d.from && d.to && d.from > d.to), {
    message: "from must be <= to",
  })
  .refine(
    (d) => {
      if (d.from && d.to) {
        return new Date(d.to).getTime() - new Date(d.from).getTime() <= TWO_YEARS_MS;
      }
      return true;
    },
    { message: "Date range cannot exceed 2 years" },
  );

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export function parseDateRange(query: AnalyticsQuery): { from: Date; to: Date } {
  if (query.from && query.to) {
    return {
      from: new Date(query.from + "T00:00:00.000Z"),
      to: new Date(query.to + "T23:59:59.999Z"),
    };
  }
  const days = query.period === "7d" ? 7 : query.period === "90d" ? 90 : 30;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export function isShortRange(from: Date, to: Date): boolean {
  return to.getTime() - from.getTime() <= 30 * 24 * 60 * 60 * 1000;
}
