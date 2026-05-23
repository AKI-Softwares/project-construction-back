-- Add missing FK indexes
CREATE INDEX "Room_apartment_type_id_idx" ON "Room"("apartment_type_id");
CREATE INDEX "Apartment_apartment_type_id_idx" ON "Apartment"("apartment_type_id");
CREATE INDEX "ApartmentRoom_apartment_id_idx" ON "ApartmentRoom"("apartment_id");
CREATE INDEX "ApartmentRoom_room_id_idx" ON "ApartmentRoom"("room_id");
CREATE INDEX "ApartmentRoomService_service_id_idx" ON "ApartmentRoomService"("service_id");

-- Add unique constraint on Room(apartmentTypeId, name)
ALTER TABLE "Room" ADD CONSTRAINT "Room_apartment_type_id_name_key" UNIQUE ("apartment_type_id", "name");

-- Fix ApartmentRoomService: cascade delete when parent ApartmentRoom is deleted
ALTER TABLE "ApartmentRoomService" DROP CONSTRAINT IF EXISTS "ApartmentRoomService_apartment_room_id_fkey";
ALTER TABLE "ApartmentRoomService" ADD CONSTRAINT "ApartmentRoomService_apartment_room_id_fkey"
  FOREIGN KEY ("apartment_room_id") REFERENCES "ApartmentRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove stale permissions (dependencies + checklists resources no longer exist)
DELETE FROM "Permission" WHERE resource IN ('dependencies', 'checklists');
