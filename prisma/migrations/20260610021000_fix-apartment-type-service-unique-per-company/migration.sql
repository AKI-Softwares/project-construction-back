-- DropIndex
DROP INDEX "ApartmentType_name_key";

-- DropIndex
DROP INDEX "Service_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "ApartmentType_company_id_name_key" ON "ApartmentType"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Service_company_id_name_key" ON "Service"("company_id", "name");
