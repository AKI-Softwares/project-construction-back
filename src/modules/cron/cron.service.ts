import { prisma } from "../../shared/infra/database/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { AnalyticsRepository } from "../analytics/analytics.repository.js";
import { PlatformAnalyticsRepository } from "../platform/analytics/platform-analytics.repository.js";
import { SnapshotRepository } from "../analytics/snapshot.repository.js";

export class CronService {
  private readonly analyticsRepo = new AnalyticsRepository();
  private readonly platformRepo  = new PlatformAnalyticsRepository();
  private readonly snapshotRepo  = new SnapshotRepository();

  async runDailySnapshot(): Promise<{ processed: number; date: string }> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const dateStr = yesterday.toISOString().split("T")[0]!;

    const companies = await prisma.company.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });

    const errors: string[] = [];
    for (const company of companies) {
      try {
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
      } catch (e) {
        errors.push(`company ${company.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

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
}
