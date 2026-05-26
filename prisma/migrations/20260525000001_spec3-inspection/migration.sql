-- Drop the default (which references the enum) before converting the column type
ALTER TABLE "Inspection" ALTER COLUMN "status" DROP DEFAULT;

-- Convert status column to varchar before dropping enum
ALTER TABLE "Inspection" ALTER COLUMN "status" TYPE VARCHAR(20) USING "status"::VARCHAR;

-- Drop old enum
DROP TYPE "InspectionStatus";

-- Create new enums
CREATE TYPE "ChecklistStatus" AS ENUM ('PENDING', 'FINALIZED');
CREATE TYPE "ChecklistItemStatus" AS ENUM ('PENDING', 'OK', 'NOK');
CREATE TYPE "VisitStatus" AS ENUM ('ONGOING', 'FINALIZED');

-- Drop unused columns from Inspection (table is dormant, no data)
ALTER TABLE "Inspection" DROP COLUMN "name";
ALTER TABLE "Inspection" DROP COLUMN "observations";

-- Add new columns to Inspection (Checklist)
ALTER TABLE "Inspection" ADD COLUMN "apartment_id" INTEGER;
ALTER TABLE "Inspection" ADD COLUMN "title" VARCHAR(255);
ALTER TABLE "Inspection" ADD COLUMN "finalized_by_id" INTEGER;
ALTER TABLE "Inspection" ADD COLUMN "finalized_at" TIMESTAMPTZ;

-- Cast status to ChecklistStatus (safe: no data)
ALTER TABLE "Inspection" ALTER COLUMN "status" TYPE "ChecklistStatus"
  USING 'PENDING'::"ChecklistStatus";
ALTER TABLE "Inspection" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ChecklistStatus";

-- Make apartment_id NOT NULL and add UNIQUE (no data, safe)
ALTER TABLE "Inspection" ALTER COLUMN "apartment_id" SET NOT NULL;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_apartment_id_key" UNIQUE ("apartment_id");

-- FK constraints on Inspection (Checklist)
ALTER TABLE "Inspection"
  ADD CONSTRAINT "Inspection_apartment_id_fkey"
  FOREIGN KEY ("apartment_id") REFERENCES "Apartment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Inspection"
  ADD CONSTRAINT "Inspection_finalized_by_id_fkey"
  FOREIGN KEY ("finalized_by_id") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ChecklistItem table
CREATE TABLE "ChecklistItem" (
  "id"                         SERIAL PRIMARY KEY,
  "checklist_id"               INTEGER NOT NULL,
  "apartment_room_service_id"  INTEGER NOT NULL,
  "status"                     "ChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
  "created_at"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ChecklistItem_checklist_id_fkey"
    FOREIGN KEY ("checklist_id") REFERENCES "Inspection"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ChecklistItem_apartment_room_service_id_fkey"
    FOREIGN KEY ("apartment_room_service_id") REFERENCES "ApartmentRoomService"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ChecklistItem_checklist_id_apartment_room_service_id_key"
    UNIQUE ("checklist_id", "apartment_room_service_id")
);
CREATE INDEX "ChecklistItem_checklist_id_idx" ON "ChecklistItem"("checklist_id");

-- Visit table
CREATE TABLE "Visit" (
  "id"             SERIAL PRIMARY KEY,
  "checklist_id"   INTEGER NOT NULL,
  "inspector_id"   INTEGER NOT NULL,
  "created_by_id"  INTEGER NOT NULL,
  "observations"   TEXT,
  "status"         "VisitStatus" NOT NULL DEFAULT 'ONGOING',
  "finalized_at"   TIMESTAMPTZ,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Visit_checklist_id_fkey"
    FOREIGN KEY ("checklist_id") REFERENCES "Inspection"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Visit_inspector_id_fkey"
    FOREIGN KEY ("inspector_id") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Visit_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Visit_checklist_id_idx" ON "Visit"("checklist_id");
CREATE INDEX "Visit_inspector_id_idx" ON "Visit"("inspector_id");

-- VisitItem table
CREATE TABLE "VisitItem" (
  "id"                SERIAL PRIMARY KEY,
  "visit_id"          INTEGER NOT NULL,
  "checklist_item_id" INTEGER NOT NULL,
  "status"            "ChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "VisitItem_visit_id_fkey"
    FOREIGN KEY ("visit_id") REFERENCES "Visit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VisitItem_checklist_item_id_fkey"
    FOREIGN KEY ("checklist_item_id") REFERENCES "ChecklistItem"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VisitItem_visit_id_checklist_item_id_key"
    UNIQUE ("visit_id", "checklist_item_id")
);
CREATE INDEX "VisitItem_checklist_item_id_idx" ON "VisitItem"("checklist_item_id");

-- NonConformity table
CREATE TABLE "NonConformity" (
  "id"            SERIAL PRIMARY KEY,
  "visit_item_id" INTEGER NOT NULL,
  "description"   TEXT NOT NULL,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "NonConformity_visit_item_id_key" UNIQUE ("visit_item_id"),
  CONSTRAINT "NonConformity_visit_item_id_fkey"
    FOREIGN KEY ("visit_item_id") REFERENCES "VisitItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Photo table
CREATE TABLE "Photo" (
  "id"                SERIAL PRIMARY KEY,
  "non_conformity_id" INTEGER NOT NULL,
  "url"               VARCHAR(500) NOT NULL,
  "uploaded_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Photo_non_conformity_id_fkey"
    FOREIGN KEY ("non_conformity_id") REFERENCES "NonConformity"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Photo_non_conformity_id_idx" ON "Photo"("non_conformity_id");
