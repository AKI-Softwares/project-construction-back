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
}
