import { prisma } from "../../../shared/infra/database/prisma.js";

export class PlatformAnalyticsRepository {
  async getOverviewRealtime(from: Date, to: Date) {
    const [activeCompanies, suspendedCompanies, totalUsers, visitsCreated, inspectionsFinalized] =
      await Promise.all([
        prisma.company.count({ where: { status: "ACTIVE" } }),
        prisma.company.count({ where: { status: "SUSPENDED" } }),
        prisma.user.count({ where: { isPlatformAdmin: false } }),
        prisma.visit.count({ where: { createdAt: { gte: from, lte: to } } }),
        prisma.checklist.count({
          where: { status: "FINALIZED", finalizedAt: { gte: from, lte: to } },
        }),
      ]);
    return { activeCompanies, suspendedCompanies, totalUsers, visitsCreated, inspectionsFinalized };
  }

  async getUsage(from: Date, to: Date) {
    type UsageRow = {
      companyId: bigint;
      companyName: string;
      visitsCreated: bigint;
      inspectionsFinalized: bigint;
    };
    const rows = await prisma.$queryRaw<UsageRow[]>`
      SELECT
        c.id                                                                               AS "companyId",
        c.name                                                                             AS "companyName",
        COUNT(DISTINCT v.id)                                                               AS "visitsCreated",
        COUNT(DISTINCT cl.id) FILTER (WHERE cl.status = 'FINALIZED')                      AS "inspectionsFinalized"
      FROM "Company" c
      LEFT JOIN "Visit"      v  ON v.company_id  = c.id AND v.created_at    >= ${from} AND v.created_at    <= ${to}
      LEFT JOIN "Inspection" cl ON cl.company_id = c.id AND cl.finalized_at >= ${from} AND cl.finalized_at <= ${to}
      WHERE c.status = 'ACTIVE'
      GROUP BY c.id, c.name
      ORDER BY "visitsCreated" DESC
    `;
    return rows.map((r) => ({
      companyId: Number(r.companyId),
      companyName: r.companyName,
      visitsCreated: Number(r.visitsCreated),
      inspectionsFinalized: Number(r.inspectionsFinalized),
    }));
  }

  async getGrowth() {
    type GrowthRow = { month: string; newCompanies: bigint };
    const rows = await prisma.$queryRaw<GrowthRow[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COUNT(*)                                             AS "newCompanies"
      FROM "Company"
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) DESC
      LIMIT 12
    `;
    return rows.map((r) => ({
      month: r.month,
      newCompanies: Number(r.newCompanies),
    }));
  }
}
