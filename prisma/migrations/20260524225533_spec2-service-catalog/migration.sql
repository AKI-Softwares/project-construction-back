-- AlterTable: Service — add description, category columns
ALTER TABLE "Service" ADD COLUMN "description" VARCHAR(500);
ALTER TABLE "Service" ADD COLUMN "category" VARCHAR(100);

-- CreateIndex: unique on Service.name
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateTable: RoomDefaultService
CREATE TABLE "RoomDefaultService" (
    "room_id" INTEGER NOT NULL,
    "service_id" INTEGER NOT NULL,
    CONSTRAINT "RoomDefaultService_pkey" PRIMARY KEY ("room_id","service_id")
);

-- CreateIndex: RoomDefaultService.service_id
CREATE INDEX "RoomDefaultService_service_id_idx" ON "RoomDefaultService"("service_id");

-- AddForeignKey: RoomDefaultService -> Room
ALTER TABLE "RoomDefaultService" ADD CONSTRAINT "RoomDefaultService_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: RoomDefaultService -> Service
ALTER TABLE "RoomDefaultService" ADD CONSTRAINT "RoomDefaultService_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
