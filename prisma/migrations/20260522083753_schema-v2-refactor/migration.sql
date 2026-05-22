-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "Checklist" DROP CONSTRAINT "Checklist_signed_by_fkey";

-- AlterTable
ALTER TABLE "Apartment" ADD COLUMN     "floor" INTEGER NOT NULL,
ADD COLUMN     "number" VARCHAR(20) NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "Building" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "Checklist" ALTER COLUMN "signed_by" DROP NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "Dependency" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "Inspection" DROP COLUMN "approved",
ADD COLUMN     "status" "InspectionStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Role" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "Service" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Apartment_building_id_floor_number_key" ON "Apartment"("building_id", "floor", "number");

-- CreateIndex
CREATE INDEX "Checklist_building_id_idx" ON "Checklist"("building_id");

-- CreateIndex
CREATE INDEX "Checklist_apartment_id_idx" ON "Checklist"("apartment_id");

-- CreateIndex
CREATE INDEX "Checklist_dependency_id_idx" ON "Checklist"("dependency_id");

-- CreateIndex
CREATE INDEX "Checklist_inspection_id_idx" ON "Checklist"("inspection_id");

-- CreateIndex
CREATE INDEX "Checklist_inspect_by_idx" ON "Checklist"("inspect_by");

-- CreateIndex
CREATE INDEX "Checklist_signed_by_idx" ON "Checklist"("signed_by");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_resource_operation_key" ON "Permission"("resource", "operation");

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
