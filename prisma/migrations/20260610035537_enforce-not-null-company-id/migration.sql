-- AlterTable: enforce NOT NULL on companyId for pure business entities
-- ApartmentType and Service remain nullable (platform templates use companyId = NULL)
-- Applied manually via fase2c-not-null-constraints.sql before running prisma migrate resolve

ALTER TABLE "Building"      ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Apartment"     ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Inspection"    ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Visit"         ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "NonConformity" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Photo"         ALTER COLUMN "company_id" SET NOT NULL;
