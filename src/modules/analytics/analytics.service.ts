// src/modules/analytics/analytics.service.ts
import { AnalyticsRepository } from "./analytics.repository.js";
import { SnapshotRepository } from "./snapshot.repository.js";
import { type AnalyticsQuery, parseDateRange, isShortRange, type CompanySnapshotData } from "./analytics.schema.js";

type OverviewData = {
  totalApartments: number;
  visitsFinalized: number;
  visitsPending: number;
  nokRate: number;
  totalNonConformities: number;
  totalInspectors: number;
};

type AnalyticsResponse<T> = {
  period: { from: string; to: string };
  dataSource: "realtime" | "snapshot";
  data: T;
};

export class AnalyticsService {
  constructor(
    private readonly repo: AnalyticsRepository,
    private readonly snapshotRepo: SnapshotRepository,
  ) {}

  private buildOverviewFromRaw(
    from: Date,
    to: Date,
    raw: { totalApartments: number; visitsFinalized: number; visitsPending: number; nokCount: number; evaluatedCount: number; totalNonConformities: number; totalInspectors: number },
    dataSource: "realtime" | "snapshot" = "realtime",
  ): AnalyticsResponse<OverviewData> {
    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      dataSource,
      data: {
        totalApartments: raw.totalApartments,
        visitsFinalized: raw.visitsFinalized,
        visitsPending: raw.visitsPending,
        nokRate: raw.evaluatedCount === 0 ? 0 : raw.nokCount / raw.evaluatedCount,
        totalNonConformities: raw.totalNonConformities,
        totalInspectors: raw.totalInspectors,
      },
    };
  }

  async getOverview(
    companyId: number,
    query: AnalyticsQuery,
  ): Promise<AnalyticsResponse<OverviewData>> {
    const { from, to } = parseDateRange(query);

    if (isShortRange(from, to)) {
      const raw = await this.repo.getOverviewRealtime(companyId, from, to);
      return this.buildOverviewFromRaw(from, to, raw);
    }

    // Long range: aggregate snapshots, fall back to realtime if missing
    const snapshots = await this.snapshotRepo.findCompanySnapshots(companyId, from, to);
    if (snapshots.length === 0) {
      const raw = await this.repo.getOverviewRealtime(companyId, from, to);
      return this.buildOverviewFromRaw(from, to, raw);
    }

    // Aggregate daily snapshots
    // snapshots.length > 0 is guaranteed by the guard above
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const last = snapshots.at(-1)!.data as CompanySnapshotData;
    const totalNok = snapshots.reduce((sum, s) => sum + ((s.data as CompanySnapshotData).nokCount ?? 0), 0);
    const totalEval = snapshots.reduce((sum, s) => sum + ((s.data as CompanySnapshotData).evaluatedCount ?? 0), 0);
    const totalFinalized = snapshots.reduce((sum, s) => sum + ((s.data as CompanySnapshotData).visitsFinalized ?? 0), 0);

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      dataSource: "snapshot",
      data: {
        totalApartments: last.totalApartments,
        visitsFinalized: totalFinalized,
        visitsPending: last.visitsPending,
        nokRate: totalEval === 0 ? 0 : totalNok / totalEval,
        totalNonConformities: last.totalNonConformities,
        totalInspectors: last.totalInspectors,
      },
    };
  }

  async getProgress(companyId: number, query: AnalyticsQuery) {
    const { from, to } = parseDateRange(query);
    const data = await this.repo.getProgress(companyId);
    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      dataSource: "realtime" as const,
      data,
    };
  }

  async getQuality(companyId: number, query: AnalyticsQuery) {
    const { from, to } = parseDateRange(query);
    const data = await this.repo.getQuality(companyId, from, to);
    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      dataSource: "realtime" as const,
      data,
    };
  }

  async getInspectors(companyId: number, query: AnalyticsQuery) {
    const { from, to } = parseDateRange(query);
    const data = await this.repo.getInspectors(companyId, from, to);
    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      dataSource: "realtime" as const,
      data,
    };
  }

  async getNcResolution(companyId: number, query: AnalyticsQuery) {
    const { from, to } = parseDateRange(query);
    const data = await this.repo.getNcResolution(companyId, from, to);
    return { period: { from: from.toISOString(), to: to.toISOString() }, dataSource: "realtime" as const, data };
  }

  async getSla(companyId: number, query: AnalyticsQuery) {
    const { from, to } = parseDateRange(query);
    const data = await this.repo.getSla(companyId, from, to);
    return { period: { from: from.toISOString(), to: to.toISOString() }, dataSource: "realtime" as const, data };
  }

  async getReinspectionRate(companyId: number, query: AnalyticsQuery) {
    const { from, to } = parseDateRange(query);
    const data = await this.repo.getReinspectionRate(companyId, from, to);
    return { period: { from: from.toISOString(), to: to.toISOString() }, dataSource: "realtime" as const, data };
  }

  async getTimeline(companyId: number, query: AnalyticsQuery) {
    const { from, to } = parseDateRange(query);
    const { visitDates, ncDates } = await this.repo.getTimelineRaw(companyId, from, to);

    const days = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    const granularity: "day" | "week" | "month" = days <= 30 ? "day" : days <= 90 ? "week" : "month";

    const bucket = (date: Date): string => {
      if (granularity === "day") return date.toISOString().slice(0, 10);
      if (granularity === "week") {
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0);
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
        return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
      }
      return date.toISOString().slice(0, 7);
    };

    const map = new Map<string, { visitsFinalized: number; ncsCreated: number }>();
    for (const d of visitDates) {
      const label = bucket(d);
      const e = map.get(label) ?? { visitsFinalized: 0, ncsCreated: 0 };
      e.visitsFinalized++;
      map.set(label, e);
    }
    for (const d of ncDates) {
      const label = bucket(d);
      const e = map.get(label) ?? { visitsFinalized: 0, ncsCreated: 0 };
      e.ncsCreated++;
      map.set(label, e);
    }

    const points = [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, counts]) => ({ label, ...counts }));

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      dataSource: "realtime" as const,
      data: { granularity, points },
    };
  }

  async getInspectorRanking(companyId: number, query: AnalyticsQuery) {
    const { from, to } = parseDateRange(query);
    const data = await this.repo.getInspectorRanking(companyId, from, to);
    return { period: { from: from.toISOString(), to: to.toISOString() }, dataSource: "realtime" as const, data };
  }

  async getBuildingRanking(companyId: number, query: AnalyticsQuery) {
    const { from, to } = parseDateRange(query);
    const data = await this.repo.getBuildingRanking(companyId, from, to);
    return { period: { from: from.toISOString(), to: to.toISOString() }, dataSource: "realtime" as const, data };
  }
}
