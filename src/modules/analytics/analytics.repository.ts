// src/modules/analytics/analytics.repository.ts
import { prisma } from "../../shared/infra/database/prisma.js";

export class AnalyticsRepository {
  async getOverviewRealtime(companyId: number | null, from: Date, to: Date) {
    const companyFilter = companyId !== null ? { companyId } : {};
    const [
      totalApartments,
      visitsFinalized,
      visitsPending,
      nokCount,
      evaluatedCount,
      totalNonConformities,
      totalInspectors,
    ] = await Promise.all([
      prisma.apartment.count({ where: { ...companyFilter } }),
      prisma.visit.count({
        where: { ...companyFilter, status: "FINALIZED", finalizedAt: { gte: from, lte: to } },
      }),
      // current backlog: all pending visits regardless of period (gauge, not counter)
      prisma.visit.count({
        where: { ...companyFilter, status: { in: ["NOT_STARTED", "ONGOING"] } },
      }),
      prisma.visitItem.count({
        where: { status: "NOK", visit: { ...companyFilter, finalizedAt: { gte: from, lte: to } } },
      }),
      prisma.visitItem.count({
        where: {
          status: { in: ["OK", "NOK"] },
          visit: { ...companyFilter, finalizedAt: { gte: from, lte: to } },
        },
      }),
      prisma.nonConformity.count({ where: { ...companyFilter } }),
      prisma.user.count({ where: { ...companyFilter } }),
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

  async getProgress(companyId: number | null) {
    const companyFilter = companyId !== null ? { companyId } : {};
    const buildings = await prisma.building.findMany({
      where: { ...companyFilter },
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

  async getQuality(companyId: number | null, from: Date, to: Date) {
    type QualityRow = {
      serviceId: bigint;
      serviceName: string;
      category: string | null;
      nokCount: bigint;
      evaluatedCount: bigint;
    };
    if (companyId !== null) {
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
      WHERE v.finalized_at >= ${from}
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

  async getInspectors(companyId: number | null, from: Date, to: Date) {
    type InspectorRow = {
      inspectorId: bigint;
      inspectorName: string;
      visitCount: bigint;
      avgDurationSeconds: number | null;
    };
    if (companyId !== null) {
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
    const rows = await prisma.$queryRaw<InspectorRow[]>`
      SELECT
        u.id                                                                    AS "inspectorId",
        u.name                                                                  AS "inspectorName",
        COUNT(v.id)                                                             AS "visitCount",
        AVG(EXTRACT(EPOCH FROM (v.finalized_at - v.created_at)))               AS "avgDurationSeconds"
      FROM "Visit" v
      JOIN "User" u ON u.id = v.inspector_id
      WHERE v.finalized_at >= ${from}
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

  async getNcResolution(companyId: number | null, from: Date, to: Date) {
    const companyFilter = companyId !== null ? { companyId } : {};
    if (companyId !== null) {
      const [openNcs, resolvedInPeriod, createdInPeriod, avgRow] = await Promise.all([
        prisma.nonConformity.count({ where: { ...companyFilter, resolvedAt: null } }),
        prisma.nonConformity.count({ where: { ...companyFilter, resolvedAt: { gte: from, lte: to } } }),
        prisma.nonConformity.count({ where: { ...companyFilter, createdAt: { gte: from, lte: to } } }),
        prisma.$queryRaw<[{ avgSeconds: number | null }]>`
          SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) AS "avgSeconds"
          FROM "NonConformity"
          WHERE company_id = ${companyId}
            AND resolved_at >= ${from}
            AND resolved_at <= ${to}
        `,
      ]);
      return {
        openNcs,
        resolvedInPeriod,
        createdInPeriod,
        avgResolutionSeconds: avgRow[0].avgSeconds ? Math.round(avgRow[0].avgSeconds) : null,
      };
    }
    const [openNcs, resolvedInPeriod, createdInPeriod, avgRow] = await Promise.all([
      prisma.nonConformity.count({ where: { resolvedAt: null } }),
      prisma.nonConformity.count({ where: { resolvedAt: { gte: from, lte: to } } }),
      prisma.nonConformity.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.$queryRaw<[{ avgSeconds: number | null }]>`
        SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) AS "avgSeconds"
        FROM "NonConformity"
        WHERE resolved_at >= ${from}
          AND resolved_at <= ${to}
      `,
    ]);
    return {
      openNcs,
      resolvedInPeriod,
      createdInPeriod,
      avgResolutionSeconds: avgRow[0].avgSeconds ? Math.round(avgRow[0].avgSeconds) : null,
    };
  }

  async getSla(companyId: number | null, from: Date, to: Date) {
    type SlaRow = { withSchedule: bigint; onTime: bigint; overdue: bigint };
    const companyFilter = companyId !== null ? { companyId } : {};
    if (companyId !== null) {
      const [slaRow, currentlyOverdue] = await Promise.all([
        prisma.$queryRaw<[SlaRow]>`
          SELECT
            COUNT(*) FILTER (WHERE scheduled_for IS NOT NULL)                                   AS "withSchedule",
            COUNT(*) FILTER (WHERE scheduled_for IS NOT NULL AND finalized_at <= scheduled_for) AS "onTime",
            COUNT(*) FILTER (WHERE scheduled_for IS NOT NULL AND finalized_at  > scheduled_for) AS "overdue"
          FROM "Visit"
          WHERE company_id    = ${companyId}
            AND status        = 'FINALIZED'
            AND finalized_at >= ${from}
            AND finalized_at <= ${to}
        `,
        prisma.visit.count({
          where: { ...companyFilter, status: { in: ["NOT_STARTED", "ONGOING"] }, scheduledFor: { lt: new Date() } },
        }),
      ]);
      const withSchedule = Number(slaRow[0].withSchedule);
      const onTime = Number(slaRow[0].onTime);
      const overdue = Number(slaRow[0].overdue);
      return {
        withSchedule,
        onTime,
        overdue,
        slaComplianceRate: withSchedule === 0 ? null : onTime / withSchedule,
        currentlyOverdue,
      };
    }
    const [slaRow, currentlyOverdue] = await Promise.all([
      prisma.$queryRaw<[SlaRow]>`
        SELECT
          COUNT(*) FILTER (WHERE scheduled_for IS NOT NULL)                                   AS "withSchedule",
          COUNT(*) FILTER (WHERE scheduled_for IS NOT NULL AND finalized_at <= scheduled_for) AS "onTime",
          COUNT(*) FILTER (WHERE scheduled_for IS NOT NULL AND finalized_at  > scheduled_for) AS "overdue"
        FROM "Visit"
        WHERE status        = 'FINALIZED'
          AND finalized_at >= ${from}
          AND finalized_at <= ${to}
      `,
      prisma.visit.count({
        where: { status: { in: ["NOT_STARTED", "ONGOING"] }, scheduledFor: { lt: new Date() } },
      }),
    ]);
    const withSchedule = Number(slaRow[0].withSchedule);
    const onTime = Number(slaRow[0].onTime);
    const overdue = Number(slaRow[0].overdue);
    return {
      withSchedule,
      onTime,
      overdue,
      slaComplianceRate: withSchedule === 0 ? null : onTime / withSchedule,
      currentlyOverdue,
    };
  }

  async getReinspectionRate(companyId: number | null, from: Date, to: Date) {
    const companyFilter = companyId !== null ? { companyId } : {};
    const [initialVisits, reinspections] = await Promise.all([
      prisma.visit.count({ where: { ...companyFilter, type: "INITIAL", status: "FINALIZED", finalizedAt: { gte: from, lte: to } } }),
      prisma.visit.count({ where: { ...companyFilter, type: "REINSPECTION", status: "FINALIZED", finalizedAt: { gte: from, lte: to } } }),
    ]);
    const total = initialVisits + reinspections;
    return {
      initialVisits,
      reinspections,
      reinspectionRate: total === 0 ? null : reinspections / total,
    };
  }

  async getTimelineRaw(companyId: number | null, from: Date, to: Date) {
    const companyFilter = companyId !== null ? { companyId } : {};
    const [visits, ncs] = await Promise.all([
      prisma.visit.findMany({
        where: { ...companyFilter, status: "FINALIZED", finalizedAt: { gte: from, lte: to } },
        select: { finalizedAt: true },
      }),
      prisma.nonConformity.findMany({
        where: { ...companyFilter, createdAt: { gte: from, lte: to } },
        select: { createdAt: true },
      }),
    ]);
    return {
      visitDates: visits.map((v) => v.finalizedAt!),
      ncDates: ncs.map((n) => n.createdAt),
    };
  }

  async getInspectorRanking(companyId: number | null, from: Date, to: Date) {
    type RankRow = {
      inspectorId: bigint;
      inspectorName: string;
      visitCount: bigint;
      avgDurationSeconds: number | null;
      nokCount: bigint;
      evaluatedCount: bigint;
    };
    if (companyId !== null) {
      const rows = await prisma.$queryRaw<RankRow[]>`
        SELECT
          u.id                                                                  AS "inspectorId",
          u.name                                                                AS "inspectorName",
          COUNT(DISTINCT v.id)                                                  AS "visitCount",
          AVG(EXTRACT(EPOCH FROM (v.finalized_at - v.created_at)))             AS "avgDurationSeconds",
          COUNT(vi.id) FILTER (WHERE vi.status = 'NOK')                        AS "nokCount",
          COUNT(vi.id) FILTER (WHERE vi.status IN ('OK', 'NOK'))               AS "evaluatedCount"
        FROM "Visit" v
        JOIN "User" u ON u.id = v.inspector_id
        LEFT JOIN "VisitItem" vi ON vi.visit_id = v.id
        WHERE v.company_id    = ${companyId}
          AND v.finalized_at >= ${from}
          AND v.finalized_at <= ${to}
          AND v.status        = 'FINALIZED'
        GROUP BY u.id, u.name
        ORDER BY "visitCount" DESC
      `;
      return rows.map((r, i) => {
        const nokCount = Number(r.nokCount);
        const evaluatedCount = Number(r.evaluatedCount);
        return {
          rank: i + 1,
          inspectorId: Number(r.inspectorId),
          inspectorName: r.inspectorName,
          visitCount: Number(r.visitCount),
          avgDurationSeconds: r.avgDurationSeconds ? Math.round(r.avgDurationSeconds) : null,
          nokRate: evaluatedCount === 0 ? 0 : nokCount / evaluatedCount,
        };
      });
    }
    const rows = await prisma.$queryRaw<RankRow[]>`
      SELECT
        u.id                                                                  AS "inspectorId",
        u.name                                                                AS "inspectorName",
        COUNT(DISTINCT v.id)                                                  AS "visitCount",
        AVG(EXTRACT(EPOCH FROM (v.finalized_at - v.created_at)))             AS "avgDurationSeconds",
        COUNT(vi.id) FILTER (WHERE vi.status = 'NOK')                        AS "nokCount",
        COUNT(vi.id) FILTER (WHERE vi.status IN ('OK', 'NOK'))               AS "evaluatedCount"
      FROM "Visit" v
      JOIN "User" u ON u.id = v.inspector_id
      LEFT JOIN "VisitItem" vi ON vi.visit_id = v.id
      WHERE v.finalized_at >= ${from}
        AND v.finalized_at <= ${to}
        AND v.status        = 'FINALIZED'
      GROUP BY u.id, u.name
      ORDER BY "visitCount" DESC
    `;
    return rows.map((r, i) => {
      const nokCount = Number(r.nokCount);
      const evaluatedCount = Number(r.evaluatedCount);
      return {
        rank: i + 1,
        inspectorId: Number(r.inspectorId),
        inspectorName: r.inspectorName,
        visitCount: Number(r.visitCount),
        avgDurationSeconds: r.avgDurationSeconds ? Math.round(r.avgDurationSeconds) : null,
        nokRate: evaluatedCount === 0 ? 0 : nokCount / evaluatedCount,
      };
    });
  }

  async getBuildingRanking(companyId: number | null, from: Date, to: Date) {
    type BuildingRow = {
      buildingId: bigint;
      buildingName: string;
      totalApartments: bigint;
      finalizedApartments: bigint;
      nokCount: bigint;
      evaluatedCount: bigint;
    };
    if (companyId !== null) {
      const rows = await prisma.$queryRaw<BuildingRow[]>`
        SELECT
          b.id                                                                              AS "buildingId",
          b.name                                                                            AS "buildingName",
          COUNT(DISTINCT a.id)                                                              AS "totalApartments",
          COUNT(DISTINCT a.id) FILTER (WHERE i.status = 'FINALIZED')                       AS "finalizedApartments",
          COUNT(vi.id) FILTER (WHERE vi.status = 'NOK'
            AND v.finalized_at >= ${from} AND v.finalized_at <= ${to})                     AS "nokCount",
          COUNT(vi.id) FILTER (WHERE vi.status IN ('OK', 'NOK')
            AND v.finalized_at >= ${from} AND v.finalized_at <= ${to})                     AS "evaluatedCount"
        FROM "Building" b
        JOIN "Apartment" a ON a.building_id = b.id
        LEFT JOIN "Inspection" i ON i.apartment_id = a.id
        LEFT JOIN "Visit" v ON v.checklist_id = i.id AND v.status = 'FINALIZED'
        LEFT JOIN "VisitItem" vi ON vi.visit_id = v.id
        WHERE b.company_id = ${companyId}
        GROUP BY b.id, b.name
        ORDER BY "finalizedApartments" DESC, "nokCount" ASC
      `;
      return rows.map((r, i) => {
        const total = Number(r.totalApartments);
        const finalized = Number(r.finalizedApartments);
        const nokCount = Number(r.nokCount);
        const evaluatedCount = Number(r.evaluatedCount);
        return {
          rank: i + 1,
          buildingId: Number(r.buildingId),
          buildingName: r.buildingName,
          totalApartments: total,
          finalizedApartments: finalized,
          progressPercent: total === 0 ? 0 : Math.round((finalized / total) * 100),
          nokRate: evaluatedCount === 0 ? 0 : nokCount / evaluatedCount,
        };
      });
    }
    const rows = await prisma.$queryRaw<BuildingRow[]>`
      SELECT
        b.id                                                                              AS "buildingId",
        b.name                                                                            AS "buildingName",
        COUNT(DISTINCT a.id)                                                              AS "totalApartments",
        COUNT(DISTINCT a.id) FILTER (WHERE i.status = 'FINALIZED')                       AS "finalizedApartments",
        COUNT(vi.id) FILTER (WHERE vi.status = 'NOK'
          AND v.finalized_at >= ${from} AND v.finalized_at <= ${to})                     AS "nokCount",
        COUNT(vi.id) FILTER (WHERE vi.status IN ('OK', 'NOK')
          AND v.finalized_at >= ${from} AND v.finalized_at <= ${to})                     AS "evaluatedCount"
      FROM "Building" b
      JOIN "Apartment" a ON a.building_id = b.id
      LEFT JOIN "Inspection" i ON i.apartment_id = a.id
      LEFT JOIN "Visit" v ON v.checklist_id = i.id AND v.status = 'FINALIZED'
      LEFT JOIN "VisitItem" vi ON vi.visit_id = v.id
      GROUP BY b.id, b.name
      ORDER BY "finalizedApartments" DESC, "nokCount" ASC
    `;
    return rows.map((r, i) => {
      const total = Number(r.totalApartments);
      const finalized = Number(r.finalizedApartments);
      const nokCount = Number(r.nokCount);
      const evaluatedCount = Number(r.evaluatedCount);
      return {
        rank: i + 1,
        buildingId: Number(r.buildingId),
        buildingName: r.buildingName,
        totalApartments: total,
        finalizedApartments: finalized,
        progressPercent: total === 0 ? 0 : Math.round((finalized / total) * 100),
        nokRate: evaluatedCount === 0 ? 0 : nokCount / evaluatedCount,
      };
    });
  }
}
