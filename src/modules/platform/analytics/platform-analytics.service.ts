import { PlatformAnalyticsRepository } from "./platform-analytics.repository.js";
import { SnapshotRepository } from "../../analytics/snapshot.repository.js";
import {
  type AnalyticsQuery,
  parseDateRange,
  isShortRange,
  type PlatformSnapshotData,
} from "../../analytics/analytics.schema.js";

export class PlatformAnalyticsService {
  constructor(
    private readonly repo: PlatformAnalyticsRepository,
    private readonly snapshotRepo: SnapshotRepository,
  ) {}

  async getOverview(query: AnalyticsQuery) {
    const { from, to } = parseDateRange(query);

    if (isShortRange(from, to)) {
      const raw = await this.repo.getOverviewRealtime(from, to);
      return {
        period: { from: from.toISOString(), to: to.toISOString() },
        dataSource: "realtime" as const,
        data: {
          activeCompanies: raw.activeCompanies,
          suspendedCompanies: raw.suspendedCompanies,
          totalUsers: raw.totalUsers,
          visitsCreated: raw.visitsCreated,
          inspectionsFinalized: raw.inspectionsFinalized,
        },
      };
    }

    const snapshots = await this.snapshotRepo.findPlatformSnapshots(from, to);
    if (snapshots.length === 0) {
      const raw = await this.repo.getOverviewRealtime(from, to);
      return {
        period: { from: from.toISOString(), to: to.toISOString() },
        dataSource: "realtime" as const,
        data: {
          activeCompanies: raw.activeCompanies,
          suspendedCompanies: raw.suspendedCompanies,
          totalUsers: raw.totalUsers,
          visitsCreated: raw.visitsCreated,
          inspectionsFinalized: raw.inspectionsFinalized,
        },
      };
    }

    const last = snapshots.at(-1)!.data as PlatformSnapshotData;
    const totalVisits = snapshots.reduce(
      (sum, s) => sum + ((s.data as PlatformSnapshotData).visitsCreatedToday ?? 0),
      0,
    );
    const totalInspections = snapshots.reduce(
      (sum, s) => sum + ((s.data as PlatformSnapshotData).inspectionsFinalized ?? 0),
      0,
    );
    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      dataSource: "snapshot" as const,
      data: {
        activeCompanies: last.activeCompanies,
        suspendedCompanies: last.suspendedCompanies,
        totalUsers: last.totalUsers,
        visitsCreated: totalVisits,
        inspectionsFinalized: totalInspections,
      },
    };
  }

  async getUsage(query: AnalyticsQuery) {
    const { from, to } = parseDateRange(query);
    const data = await this.repo.getUsage(from, to);
    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      dataSource: "realtime" as const,
      data,
    };
  }

  async getGrowth() {
    const to = new Date();
    const from = new Date();
    from.setUTCMonth(from.getUTCMonth() - 12);
    from.setUTCDate(1);
    from.setUTCHours(0, 0, 0, 0);
    const data = await this.repo.getGrowth();
    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      dataSource: "realtime" as const,
      data,
    };
  }
}
