import { prisma } from "../../shared/infra/database/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { sendPushToUsers } from "../../shared/push/push-notification.js";
import { AnalyticsRepository } from "../analytics/analytics.repository.js";
import { PlatformAnalyticsRepository } from "../platform/analytics/platform-analytics.repository.js";
import { SnapshotRepository } from "../analytics/snapshot.repository.js";

export class CronService {
  private readonly analyticsRepo = new AnalyticsRepository();
  private readonly platformRepo  = new PlatformAnalyticsRepository();
  private readonly snapshotRepo  = new SnapshotRepository();

  async runDailySnapshot(): Promise<{ processed: number; date: string }> {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);

    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setUTCHours(23, 59, 59, 999);

    const dateStr = yesterday.toISOString().split("T")[0]!;

    const companies = await prisma.company.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });

    const results = await Promise.allSettled(
      companies.map(async (company) => {
        const raw = await this.analyticsRepo.getOverviewRealtime(
          company.id,
          yesterday,
          yesterdayEnd,
        );
        await this.snapshotRepo.upsertSnapshot(company.id, yesterday, "COMPANY_DAILY", {
          totalApartments:      raw.totalApartments,
          visitsFinalized:      raw.visitsFinalized,
          visitsPending:        raw.visitsPending,
          nokCount:             raw.nokCount,
          evaluatedCount:       raw.evaluatedCount,
          totalNonConformities: raw.totalNonConformities,
          totalInspectors:      raw.totalInspectors,
        });
      }),
    );

    const errors = results
      .map((r, i) =>
        r.status === "rejected"
          ? `company ${companies[i]!.id}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`
          : null,
      )
      .filter((e): e is string => e !== null);

    if (errors.length > 0) {
      throw new HttpError(500, `Snapshot failed for ${errors.length} of ${companies.length} companies: ${errors.join("; ")}`);
    }

    const platformRaw = await this.platformRepo.getOverviewRealtime(yesterday, yesterdayEnd);
    await this.snapshotRepo.upsertSnapshot(null, yesterday, "PLATFORM_DAILY", {
      activeCompanies:      platformRaw.activeCompanies,
      suspendedCompanies:   platformRaw.suspendedCompanies,
      totalUsers:           platformRaw.totalUsers,
      visitsCreatedToday:   platformRaw.visitsCreated,
      inspectionsFinalized: platformRaw.inspectionsFinalized,
    });

    return { processed: companies.length, date: dateStr };
  }

  async runSlaAlerts(): Promise<{ notified: number }> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const atRisk = await prisma.visit.findMany({
      where: {
        scheduledFor: { gte: now, lte: in24h },
        status: { in: ["NOT_STARTED", "ONGOING"] },
        inspectorId: { not: null },
      },
      select: {
        id: true,
        inspectorId: true,
        checklist: { select: { apartment: { select: { identifier: true, building: { select: { name: true } } } } } },
      },
    });

    for (const visit of atRisk) {
      if (visit.inspectorId) {
        void sendPushToUsers([visit.inspectorId], {
          title: "Vistoria próxima do prazo",
          body: `Apt ${visit.checklist.apartment.identifier} — ${visit.checklist.apartment.building.name}`,
          data: { visitId: visit.id },
        });
      }
    }

    return { notified: atRisk.length };
  }
}
