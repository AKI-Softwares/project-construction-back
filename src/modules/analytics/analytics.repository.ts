// src/modules/analytics/analytics.repository.ts
import { prisma } from "../../shared/infra/database/prisma.js";

export class AnalyticsRepository {
  async getOverviewRealtime(companyId: number, from: Date, to: Date) {
    const [
      totalApartments,
      visitsFinalized,
      visitsPending,
      nokCount,
      evaluatedCount,
      totalNonConformities,
      totalInspectors,
    ] = await Promise.all([
      prisma.apartment.count({ where: { companyId } }),
      prisma.visit.count({
        where: { companyId, status: "FINALIZED", finalizedAt: { gte: from, lte: to } },
      }),
      // current backlog: all pending visits regardless of period (gauge, not counter)
      prisma.visit.count({
        where: { companyId, status: { in: ["NOT_STARTED", "ONGOING"] } },
      }),
      prisma.visitItem.count({
        where: { status: "NOK", visit: { companyId, finalizedAt: { gte: from, lte: to } } },
      }),
      prisma.visitItem.count({
        where: {
          status: { in: ["OK", "NOK"] },
          visit: { companyId, finalizedAt: { gte: from, lte: to } },
        },
      }),
      prisma.nonConformity.count({ where: { companyId } }),
      prisma.visit.findMany({
        where: { companyId, status: "FINALIZED", finalizedAt: { gte: from, lte: to } },
        select: { inspectorId: true },
        distinct: ["inspectorId"],
      }).then(rows => rows.length),
    ]);
    return {
      totalApartments,
      visitsFinalized,
      visitsPending,
      nokCount,
      evaluatedCount,
      totalNonConformities,
      totalInspectors,
    };
  }

  async getProgress(companyId: number) {
    const buildings = await prisma.building.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        _count: { select: { apartments: true } },
        apartments: {
          select: { checklist: { select: { status: true } } },
        },
      },
    });
    return buildings.map((b) => {
      const total = b._count.apartments;
      const finalized = b.apartments.filter(
        (a) => a.checklist?.status === "FINALIZED",
      ).length;
      return {
        buildingId: b.id,
        buildingName: b.name,
        totalApartments: total,
        finalizedApartments: finalized,
        progressPercent: total === 0 ? 0 : Math.round((finalized / total) * 100),
      };
    });
  }

  async getQuality(companyId: number, from: Date, to: Date) {
    type QualityRow = {
      serviceId: bigint;
      serviceName: string;
      category: string | null;
      nokCount: bigint;
      evaluatedCount: bigint;
    };
    const rows = await prisma.$queryRaw<QualityRow[]>`
      SELECT
        s.id                                                          AS "serviceId",
        s.name                                                        AS "serviceName",
        s.category,
        COUNT(vi.id) FILTER (WHERE vi.status = 'NOK')                AS "nokCount",
        COUNT(vi.id) FILTER (WHERE vi.status IN ('OK', 'NOK'))       AS "evaluatedCount"
      FROM "VisitItem" vi
      JOIN "Visit"               v   ON v.id   = vi.visit_id
      JOIN "ChecklistItem"       ci  ON ci.id  = vi.checklist_item_id
      JOIN "ApartmentRoomService" ars ON ars.id = ci.apartment_room_service_id
      JOIN "Service"              s   ON s.id  = ars.service_id
      WHERE v.company_id    = ${companyId}
        AND v.finalized_at >= ${from}
        AND v.finalized_at <= ${to}
      GROUP BY s.id, s.name, s.category
      ORDER BY "nokCount" DESC
    `;
    return rows.map((r) => ({
      serviceId: Number(r.serviceId),
      serviceName: r.serviceName,
      category: r.category,
      nokCount: Number(r.nokCount),
      evaluatedCount: Number(r.evaluatedCount),
      nokRate:
        Number(r.evaluatedCount) === 0
          ? 0
          : Number(r.nokCount) / Number(r.evaluatedCount),
    }));
  }

  async getInspectors(companyId: number, from: Date, to: Date) {
    type InspectorRow = {
      inspectorId: bigint;
      inspectorName: string;
      visitCount: bigint;
      avgDurationSeconds: number | null;
    };
    const rows = await prisma.$queryRaw<InspectorRow[]>`
      SELECT
        u.id                                                                    AS "inspectorId",
        u.name                                                                  AS "inspectorName",
        COUNT(v.id)                                                             AS "visitCount",
        AVG(EXTRACT(EPOCH FROM (v.finalized_at - v.created_at)))               AS "avgDurationSeconds"
      FROM "Visit" v
      JOIN "User" u ON u.id = v.inspector_id
      WHERE v.company_id    = ${companyId}
        AND v.finalized_at >= ${from}
        AND v.finalized_at <= ${to}
        AND v.status        = 'FINALIZED'
      GROUP BY u.id, u.name
      ORDER BY "visitCount" DESC
    `;
    return rows.map((r) => ({
      inspectorId: Number(r.inspectorId),
      inspectorName: r.inspectorName,
      visitCount: Number(r.visitCount),
      avgDurationSeconds: r.avgDurationSeconds
        ? Math.round(r.avgDurationSeconds)
        : null,
    }));
  }
}
