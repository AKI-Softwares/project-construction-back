-- AlterTable
ALTER TABLE "Apartment" ADD COLUMN     "company_id" INTEGER;

-- AlterTable
ALTER TABLE "ApartmentType" ADD COLUMN     "company_id" INTEGER;

-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "company_id" INTEGER;

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "company_id" INTEGER;

-- AlterTable
ALTER TABLE "NonConformity" ADD COLUMN     "company_id" INTEGER;

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "company_id" INTEGER;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "company_id" INTEGER;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "company_id" INTEGER;

-- CreateIndex
CREATE INDEX "Apartment_company_id_idx" ON "Apartment"("company_id");

-- CreateIndex
CREATE INDEX "ApartmentType_company_id_idx" ON "ApartmentType"("company_id");

-- CreateIndex
CREATE INDEX "Building_company_id_idx" ON "Building"("company_id");

-- CreateIndex
CREATE INDEX "Inspection_company_id_idx" ON "Inspection"("company_id");

-- CreateIndex
CREATE INDEX "NonConformity_company_id_idx" ON "NonConformity"("company_id");

-- CreateIndex
CREATE INDEX "Photo_company_id_idx" ON "Photo"("company_id");

-- CreateIndex
CREATE INDEX "Service_company_id_idx" ON "Service"("company_id");

-- CreateIndex
CREATE INDEX "Visit_company_id_idx" ON "Visit"("company_id");

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApartmentType" ADD CONSTRAINT "ApartmentType_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apartment" ADD CONSTRAINT "Apartment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
