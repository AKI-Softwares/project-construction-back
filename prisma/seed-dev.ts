import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client.js";

const INSPECTOR_ID = 1; // super-admin@aki.com.br

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not defined in .env");

  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // ── 1. Services ────────────────────────────────────────────────────────
    const serviceDefs = [
      { name: "Pintura", category: "Acabamento", description: "Pintura de paredes e tetos" },
      { name: "Elétrica", category: "Instalações", description: "Instalações elétricas" },
      { name: "Hidráulica", category: "Instalações", description: "Instalações hidráulicas e sanitárias" },
      { name: "Piso", category: "Acabamento", description: "Piso laminado ou cerâmico" },
      { name: "Revestimento", category: "Acabamento", description: "Revestimento cerâmico de paredes" },
    ];

    const svcMap: Record<string, number> = {};
    for (const s of serviceDefs) {
      const svc = await prisma.service.upsert({
        where: { name: s.name },
        update: {},
        create: s,
        select: { id: true, name: true },
      });
      svcMap[svc.name] = svc.id;
    }

    // ── 2. ApartmentType ────────────────────────────────────────────────────
    const aptType = await prisma.apartmentType.upsert({
      where: { name: "Apartamento 2 Quartos" },
      update: {},
      create: { name: "Apartamento 2 Quartos", description: "Padrão 2 quartos" },
    });

    // ── 3. Rooms + DefaultServices ──────────────────────────────────────────
    const roomDefs = [
      { name: "Sala de Estar",    services: ["Pintura", "Piso", "Elétrica"] },
      { name: "Cozinha",          services: ["Pintura", "Hidráulica", "Revestimento"] },
      { name: "Banheiro Social",  services: ["Pintura", "Hidráulica", "Revestimento", "Elétrica"] },
      { name: "Quarto 1",         services: ["Pintura", "Piso", "Elétrica"] },
      { name: "Quarto 2",         services: ["Pintura", "Piso", "Elétrica"] },
    ];

    const roomMap: Record<string, number> = {};
    for (const r of roomDefs) {
      const room = await prisma.room.upsert({
        where: { apartmentTypeId_name: { apartmentTypeId: aptType.id, name: r.name } },
        update: {},
        create: { apartmentTypeId: aptType.id, name: r.name },
        select: { id: true },
      });
      roomMap[r.name] = room.id;

      for (const sName of r.services) {
        await prisma.roomDefaultService.upsert({
          where: { roomId_serviceId: { roomId: room.id, serviceId: svcMap[sName] } },
          update: {},
          create: { roomId: room.id, serviceId: svcMap[sName] },
        });
      }
    }

    // ── 4. Building ─────────────────────────────────────────────────────────
    let building = await prisma.building.findFirst({
      where: { name: "Edifício Aurora" },
    });
    if (!building) {
      building = await prisma.building.create({
        data: {
          name: "Edifício Aurora",
          address: "Av. Paulista, 1000 - Bela Vista, São Paulo/SP",
          latitude: -23.5614,
          longitude: -46.6561,
        },
      });
    }

    // ── 5. Apartments ───────────────────────────────────────────────────────
    const aptDefs = [
      { identifier: "101", floor: 1, block: "A", visitStatus: "NOT_STARTED" as const },
      { identifier: "201", floor: 2, block: "A", visitStatus: "ONGOING" as const },
      { identifier: "102", floor: 1, block: "B", visitStatus: "NOT_STARTED" as const },
    ];

    for (const aptDef of aptDefs) {
      // Apartment
      const apt = await prisma.apartment.upsert({
        where: { buildingId_identifier: { buildingId: building.id, identifier: aptDef.identifier } },
        update: {},
        create: {
          buildingId: building.id,
          apartmentTypeId: aptType.id,
          identifier: aptDef.identifier,
          floor: aptDef.floor,
          block: aptDef.block,
        },
      });

      // ApartmentRooms + ApartmentRoomServices
      const arsIds: number[] = [];
      for (const r of roomDefs) {
        let aptRoom = await prisma.apartmentRoom.findFirst({
          where: { apartmentId: apt.id, roomId: roomMap[r.name] },
        });
        if (!aptRoom) {
          aptRoom = await prisma.apartmentRoom.create({
            data: { apartmentId: apt.id, roomId: roomMap[r.name], name: r.name },
          });
        }

        for (const sName of r.services) {
          const ars = await prisma.apartmentRoomService.upsert({
            where: { apartmentRoomId_serviceId: { apartmentRoomId: aptRoom.id, serviceId: svcMap[sName] } },
            update: {},
            create: { apartmentRoomId: aptRoom.id, serviceId: svcMap[sName] },
            select: { id: true },
          });
          arsIds.push(ars.id);
        }
      }

      // Checklist
      let checklist = await prisma.checklist.findUnique({ where: { apartmentId: apt.id } });
      if (!checklist) {
        checklist = await prisma.checklist.create({
          data: {
            apartmentId: apt.id,
            title: `Vistoria — Apt ${aptDef.identifier} Bloco ${aptDef.block}`,
          },
        });
      }

      // ChecklistItems
      const itemIds: number[] = [];
      for (const arsId of arsIds) {
        const item = await prisma.checklistItem.upsert({
          where: { checklistId_apartmentRoomServiceId: { checklistId: checklist.id, apartmentRoomServiceId: arsId } },
          update: {},
          create: { checklistId: checklist.id, apartmentRoomServiceId: arsId },
          select: { id: true },
        });
        itemIds.push(item.id);
      }

      // Visit
      let visit = await prisma.visit.findFirst({
        where: { checklistId: checklist.id, inspectorId: INSPECTOR_ID },
      });
      if (!visit) {
        visit = await prisma.visit.create({
          data: {
            checklistId: checklist.id,
            inspectorId: INSPECTOR_ID,
            createdById: INSPECTOR_ID,
            status: aptDef.visitStatus,
          },
        });
      }

      // VisitItems
      for (const itemId of itemIds) {
        await prisma.visitItem.upsert({
          where: { visitId_checklistItemId: { visitId: visit.id, checklistItemId: itemId } },
          update: {},
          create: { visitId: visit.id, checklistItemId: itemId },
        });
      }

      console.log(`✓ Apt ${aptDef.identifier} Bloco ${aptDef.block} — visit #${visit.id} [${aptDef.visitStatus}]`);
    }

    console.log("\n=== Dev seed complete ===");
    console.log(`Building: ${building.name} (id=${building.id})`);
    console.log(`ApartmentType: ${aptType.name} (id=${aptType.id})`);
    console.log(`Inspector: user id=${INSPECTOR_ID}`);
    console.log("=========================\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Dev seed failed:", err);
  process.exit(1);
});
