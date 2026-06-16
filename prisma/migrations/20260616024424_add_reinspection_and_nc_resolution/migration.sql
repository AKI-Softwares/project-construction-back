-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('INITIAL', 'REINSPECTION');

-- DropForeignKey
ALTER TABLE "Visit" DROP CONSTRAINT "Visit_inspector_id_fkey";

-- AlterTable
ALTER TABLE "NonConformity" ADD COLUMN     "resolved_at" TIMESTAMPTZ,
ADD COLUMN     "resolved_by_id" INTEGER;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "parent_visit_id" INTEGER,
ADD COLUMN     "type" "VisitType" NOT NULL DEFAULT 'INITIAL',
ALTER COLUMN "inspector_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Visit_parent_visit_id_idx" ON "Visit"("parent_visit_id");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_parent_visit_id_fkey" FOREIGN KEY ("parent_visit_id") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
