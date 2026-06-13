// src/modules/analytics/snapshot.repository.ts
import { prisma } from "../../shared/infra/database/prisma.js";
import type { SnapshotType } from "../../../generated/prisma/enums.js";

export class SnapshotRepository {
  async findCompanySnapshots(companyId: number, from: Date, to: Date) {
    return prisma.metricsSnapshot.findMany({
      where: {
        companyId,
        type: "COMPANY_DAILY",
        snapshotDate: { gte: from, lte: to },
      },
      orderBy: { snapshotDate: "asc" },
    });
  }

  async findPlatformSnapshots(from: Date, to: Date) {
    return prisma.metricsSnapshot.findMany({
      where: {
        companyId: null,
        type: "PLATFORM_DAILY",
        snapshotDate: { gte: from, lte: to },
      },
      orderBy: { snapshotDate: "asc" },
    });
  }

  // Uses findFirst + update/create because SQL unique constraints treat NULL != NULL,
  // making upsert by compound key unreliable when companyId is null (platform snapshots).
  async upsertSnapshot(
    companyId: number | null,
    date: Date,
    type: SnapshotType,
    data: object,
  ) {
    try {
      const existing = await prisma.metricsSnapshot.findFirst({
        where: { companyId, snapshotDate: date, type },
      });
      if (existing) {
        return await prisma.metricsSnapshot.update({
          where: { id: existing.id },
          data: { data },
        });
      }
      return await prisma.metricsSnapshot.create({
        data: { companyId, snapshotDate: date, type, data },
      });
    } catch (e: unknown) {
      // P2002: unique constraint violation — concurrent insert; update the existing row
      if ((e as { code?: string }).code === "P2002") {
        const existing = await prisma.metricsSnapshot.findFirst({
          where: { companyId, snapshotDate: date, type },
        });
        if (existing) {
          return prisma.metricsSnapshot.update({
            where: { id: existing.id },
            data: { data },
          });
        }
      }
      throw e;
    }
  }
}
