-- DropForeignKey (Checklist dependencies)
ALTER TABLE "Checklist" DROP CONSTRAINT IF EXISTS "Checklist_building_id_fkey";
ALTER TABLE "Checklist" DROP CONSTRAINT IF EXISTS "Checklist_apartment_id_fkey";
ALTER TABLE "Checklist" DROP CONSTRAINT IF EXISTS "Checklist_dependency_id_fkey";
ALTER TABLE "Checklist" DROP CONSTRAINT IF EXISTS "Checklist_service_id_fkey";
ALTER TABLE "Checklist" DROP CONSTRAINT IF EXISTS "Checklist_inspection_id_fkey";
ALTER TABLE "Checklist" DROP CONSTRAINT IF EXISTS "Checklist_inspect_by_fkey";
ALTER TABLE "Checklist" DROP CONSTRAINT IF EXISTS "Checklist_signed_by_fkey";

-- DropForeignKey (Dependency)
ALTER TABLE "Dependency" DROP CONSTRAINT IF EXISTS "Dependency_apartment_id_fkey";

-- DropForeignKey (Service -> Inspection)
ALTER TABLE "Service" DROP CONSTRAINT IF EXISTS "Service_inspection_id_fkey";

-- DropForeignKey (Apartment)
ALTER TABLE "Apartment" DROP CONSTRAINT IF EXISTS "Apartment_building_id_fkey";

-- DropIndex (old Apartment unique)
DROP INDEX IF EXISTS "Apartment_building_id_floor_number_key";

-- DropTable
DROP TABLE IF EXISTS "Checklist";

-- DropTable
DROP TABLE IF EXISTS "Dependency";

-- AlterTable: Building — widen address, add geo columns
ALTER TABLE "Building"
  ALTER COLUMN "address" TYPE VARCHAR(500),
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION;

-- AlterTable: Apartment — restructure columns
ALTER TABLE "Apartment"
  DROP COLUMN IF EXISTS "number",
  ADD COLUMN "apartment_type_id" INTEGER,
  ADD COLUMN "identifier" VARCHAR(50),
  ADD COLUMN "block" VARCHAR(50),
  ALTER COLUMN "floor" DROP NOT NULL;

-- Backfill: set identifier from floor (temporary, required for NOT NULL)
UPDATE "Apartment" SET "identifier" = COALESCE(CAST("floor" AS VARCHAR), 'unknown') WHERE "identifier" IS NULL;
UPDATE "Apartment" SET "apartment_type_id" = 0 WHERE "apartment_type_id" IS NULL;

-- CreateTable: ApartmentType
CREATE TABLE "ApartmentType" (
  "id" SERIAL NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" VARCHAR(500),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApartmentType_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex: ApartmentType name
CREATE UNIQUE INDEX "ApartmentType_name_key" ON "ApartmentType"("name");

-- Insert default ApartmentType for existing apartments
INSERT INTO "ApartmentType" ("name", "description") VALUES ('Standard', 'Default apartment type') ON CONFLICT DO NOTHING;

-- Update apartment_type_id to use the new default row
UPDATE "Apartment" SET "apartment_type_id" = (SELECT "id" FROM "ApartmentType" WHERE "name" = 'Standard' LIMIT 1);

-- AlterTable: Apartment — make columns NOT NULL after backfill
ALTER TABLE "Apartment"
  ALTER COLUMN "identifier" SET NOT NULL,
  ALTER COLUMN "apartment_type_id" SET NOT NULL;

-- AddForeignKey: Apartment -> Building
ALTER TABLE "Apartment" ADD CONSTRAINT "Apartment_building_id_fkey"
  FOREIGN KEY ("building_id") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Apartment -> ApartmentType
ALTER TABLE "Apartment" ADD CONSTRAINT "Apartment_apartment_type_id_fkey"
  FOREIGN KEY ("apartment_type_id") REFERENCES "ApartmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateUniqueIndex: Apartment (building_id, identifier)
CREATE UNIQUE INDEX "Apartment_building_id_identifier_key" ON "Apartment"("building_id", "identifier");

-- CreateTable: Room
CREATE TABLE "Room" (
  "id" SERIAL NOT NULL,
  "apartment_type_id" INTEGER NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: Room -> ApartmentType
ALTER TABLE "Room" ADD CONSTRAINT "Room_apartment_type_id_fkey"
  FOREIGN KEY ("apartment_type_id") REFERENCES "ApartmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: ApartmentRoom
CREATE TABLE "ApartmentRoom" (
  "id" SERIAL NOT NULL,
  "apartment_id" INTEGER NOT NULL,
  "room_id" INTEGER,
  "name" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApartmentRoom_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: ApartmentRoom -> Apartment
ALTER TABLE "ApartmentRoom" ADD CONSTRAINT "ApartmentRoom_apartment_id_fkey"
  FOREIGN KEY ("apartment_id") REFERENCES "Apartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: ApartmentRoom -> Room (nullable)
ALTER TABLE "ApartmentRoom" ADD CONSTRAINT "ApartmentRoom_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Service — drop inspection relation columns
ALTER TABLE "Service"
  DROP COLUMN IF EXISTS "type",
  DROP COLUMN IF EXISTS "inspection_id";

-- CreateTable: ApartmentRoomService
CREATE TABLE "ApartmentRoomService" (
  "id" SERIAL NOT NULL,
  "apartment_room_id" INTEGER NOT NULL,
  "service_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApartmentRoomService_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex: ApartmentRoomService (apartment_room_id, service_id)
CREATE UNIQUE INDEX "ApartmentRoomService_apartment_room_id_service_id_key"
  ON "ApartmentRoomService"("apartment_room_id", "service_id");

-- AddForeignKey: ApartmentRoomService -> ApartmentRoom
ALTER TABLE "ApartmentRoomService" ADD CONSTRAINT "ApartmentRoomService_apartment_room_id_fkey"
  FOREIGN KEY ("apartment_room_id") REFERENCES "ApartmentRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: ApartmentRoomService -> Service
ALTER TABLE "ApartmentRoomService" ADD CONSTRAINT "ApartmentRoomService_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Inspection — remove relation columns (dormant)
-- No physical columns to drop; relations are virtual in Prisma

-- DropIndex: Checklist indexes (already dropped with table)
-- DropIndex: old service inspection index if exists
DROP INDEX IF EXISTS "Service_inspection_id_idx";
