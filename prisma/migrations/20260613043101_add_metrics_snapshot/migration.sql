-- CreateEnum
CREATE TYPE "SnapshotType" AS ENUM ('COMPANY_DAILY', 'PLATFORM_DAILY');

-- CreateTable
CREATE TABLE "MetricsSnapshot" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER,
    "snapshot_date" DATE NOT NULL,
    "type" "SnapshotType" NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetricsSnapshot_company_id_snapshot_date_idx" ON "MetricsSnapshot"("company_id", "snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "MetricsSnapshot_company_id_snapshot_date_type_key" ON "MetricsSnapshot"("company_id", "snapshot_date", "type");

-- AddForeignKey
ALTER TABLE "MetricsSnapshot" ADD CONSTRAINT "MetricsSnapshot_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
