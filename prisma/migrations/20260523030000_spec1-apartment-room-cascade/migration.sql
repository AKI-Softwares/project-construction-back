-- Fix ApartmentRoom: cascade delete when parent Apartment is deleted
ALTER TABLE "ApartmentRoom" DROP CONSTRAINT IF EXISTS "ApartmentRoom_apartment_id_fkey";
ALTER TABLE "ApartmentRoom" ADD CONSTRAINT "ApartmentRoom_apartment_id_fkey"
  FOREIGN KEY ("apartment_id") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
