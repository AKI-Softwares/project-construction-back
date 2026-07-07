/**
 * Setup Banca: limpa vistorias dos inspetores, cria novo empreendimento
 * com 30 aptos (4 cômodos, 3-5 serviços cada), distribui 10 aptos por inspetor.
 *
 * Run: npx tsx prisma/setup-banca.ts
 */
import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client.js";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not defined in .env");

  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // ── 1. Localizar empresa Banca ──────────────────────────────────────────
    const company = await prisma.company.findFirst({
      where: { name: { contains: "banca", mode: "insensitive" } },
      select: { id: true, name: true, slug: true },
    });
    if (!company) throw new Error("Empresa 'Banca' não encontrada.");
    console.log(`✓ Empresa: ${company.name} (id=${company.id}, slug=${company.slug})\n`);

    // ── 2. Listar todos os usuários da empresa ──────────────────────────────
    const allUsers = await prisma.user.findMany({
      where: { companyId: company.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { id: true, name: true, isCompanyAdmin: true } },
      },
      orderBy: { id: "asc" },
    });

    console.log(`Usuários da empresa (${allUsers.length} total):`);
    for (const u of allUsers) {
      const tag = u.role?.isCompanyAdmin ? "[ADMIN]" : "[inspector]";
      console.log(`  ${tag} ${u.name} <${u.email}> role="${u.role?.name ?? "—"}"`);
    }

    const admins = allUsers.filter((u) => u.role?.isCompanyAdmin);
    const inspectors = allUsers.filter((u) => !u.role?.isCompanyAdmin);

    if (admins.length === 0) throw new Error("Nenhum admin encontrado na empresa.");
    if (inspectors.length < 3)
      throw new Error(`Precisam de pelo menos 3 inspetores, encontrado ${inspectors.length}.`);

    const admin = admins[0];
    const trio = inspectors.slice(0, 3);
    console.log(`\nAdmin (createdBy): ${admin.name}`);
    console.log(`Inspetores selecionados: ${trio.map((i) => i.name).join(", ")}\n`);

    // ── 3. Listar vistorias existentes dos inspetores ───────────────────────
    const existingVisits = await prisma.visit.findMany({
      where: {
        companyId: company.id,
        inspectorId: { in: trio.map((i) => i.id) },
      },
      select: {
        id: true,
        status: true,
        inspectorId: true,
        checklist: { select: { apartment: { select: { identifier: true } } } },
      },
    });

    console.log(`Vistorias existentes vinculadas aos 3 inspetores: ${existingVisits.length}`);
    for (const v of existingVisits) {
      const insp = trio.find((i) => i.id === v.inspectorId)?.name ?? v.inspectorId;
      const apt = v.checklist.apartment.identifier;
      console.log(`  visit #${v.id} [${v.status}] apto ${apt} → ${insp}`);
    }

    // ── 4. Limpar vistorias (cascade: VisitItem → NonConformity → Photo) ────
    if (existingVisits.length > 0) {
      await prisma.visit.deleteMany({
        where: { id: { in: existingVisits.map((v) => v.id) } },
      });
      console.log(`\n✓ ${existingVisits.length} vistoria(s) excluída(s) (+ itens em cascata)\n`);
    } else {
      console.log("  (nenhuma vistoria para excluir)\n");
    }

    // ── 5. Serviços da empresa (3-5 por cômodo) ─────────────────────────────
    const serviceDefs = [
      { name: "Pintura", category: "Acabamento", description: "Pintura de paredes e tetos" },
      { name: "Elétrica", category: "Instalações", description: "Instalações elétricas" },
      { name: "Hidráulica", category: "Instalações", description: "Instalações hidráulicas" },
      { name: "Revestimento", category: "Acabamento", description: "Revestimento cerâmico" },
      { name: "Esquadrias", category: "Acabamento", description: "Portas, janelas e batentes" },
    ];

    const svcMap: Record<string, number> = {};
    for (const s of serviceDefs) {
      const svc = await prisma.service.upsert({
        where: { companyId_name: { companyId: company.id, name: s.name } },
        update: {},
        create: { ...s, companyId: company.id },
        select: { id: true, name: true },
      });
      svcMap[svc.name] = svc.id;
      console.log(`  Serviço: ${svc.name} (id=${svc.id})`);
    }
    console.log();

    // ── 6. Tipo de apartamento com 4 cômodos ────────────────────────────────
    const TYPE_NAME = "Padrão 4 Cômodos";

    // Definição de cômodos → serviços (3-5 por cômodo)
    const roomDefs = [
      {
        name: "Sala de Estar",
        services: ["Pintura", "Elétrica", "Piso"] as string[], // ajustado abaixo
      },
      {
        name: "Banheiro",
        services: ["Pintura", "Hidráulica", "Revestimento", "Elétrica"],
      },
      {
        name: "Quarto 1",
        services: ["Pintura", "Elétrica", "Revestimento", "Esquadrias"],
      },
      {
        name: "Quarto 2",
        services: ["Pintura", "Elétrica", "Revestimento", "Esquadrias"],
      },
    ];

    // Corrigir "Piso" que não está na lista → usar "Esquadrias"
    roomDefs[0].services = ["Pintura", "Elétrica", "Hidráulica", "Esquadrias"];

    let aptType = await prisma.apartmentType.findFirst({
      where: { companyId: company.id, name: TYPE_NAME },
      select: { id: true, name: true, rooms: { select: { id: true, name: true, defaultServices: { select: { serviceId: true } } } } },
    });

    if (!aptType) {
      aptType = await prisma.apartmentType.create({
        data: {
          name: TYPE_NAME,
          description: "4 cômodos: Sala, Banheiro, Quarto 1, Quarto 2",
          companyId: company.id,
          rooms: {
            create: roomDefs.map((r) => ({
              name: r.name,
              defaultServices: {
                create: r.services
                  .filter((s) => svcMap[s] !== undefined)
                  .map((s) => ({ serviceId: svcMap[s] })),
              },
            })),
          },
        },
        select: {
          id: true,
          name: true,
          rooms: {
            select: {
              id: true,
              name: true,
              defaultServices: { select: { serviceId: true } },
            },
          },
        },
      });
      console.log(`✓ Tipo criado: ${aptType.name} (id=${aptType.id})`);
    } else {
      console.log(`✓ Tipo existente: ${aptType.name} (id=${aptType.id})`);
    }

    for (const r of aptType.rooms) {
      const svcs = r.defaultServices.map((ds) =>
        Object.entries(svcMap).find(([, id]) => id === ds.serviceId)?.[0] ?? ds.serviceId,
      );
      console.log(`  Cômodo: ${r.name} → ${svcs.join(", ")}`);
    }
    console.log();

    // ── 7. Criar o novo empreendimento ──────────────────────────────────────
    const BUILDING_NAME = "Residencial Banca II";
    const building = await prisma.building.create({
      data: {
        name: BUILDING_NAME,
        address: "Endereço Banca, 200",
        companyId: company.id,
      },
      select: { id: true, name: true },
    });
    console.log(`✓ Empreendimento criado: ${building.name} (id=${building.id})\n`);

    // ── 8. Criar 30 apartamentos: blocos A-F, andares 1-5 ──────────────────
    // 6 blocos × 5 andares = 30 (dentro do range A-G solicitado)
    const blocks = ["A", "B", "C", "D", "E", "F"];
    const floors = [1, 2, 3, 4, 5];

    type ApartmentEntry = { id: number; checklistId: number; identifier: string; block: string; floor: number };
    const createdApartments: ApartmentEntry[] = [];

    for (const block of blocks) {
      for (const floor of floors) {
        const identifier = `${block}${floor}`; // ex: A1, A2 ... F5

        // Criar apartamento
        const apt = await prisma.apartment.create({
          data: {
            buildingId: building.id,
            apartmentTypeId: aptType.id,
            identifier,
            block,
            floor,
            companyId: company.id,
          },
          select: { id: true },
        });

        // Criar cômodos + serviços
        const roomIds: number[] = [];
        for (const roomDef of aptType.rooms) {
          const aptRoom = await prisma.apartmentRoom.create({
            data: {
              apartmentId: apt.id,
              roomId: roomDef.id,
              name: roomDef.name,
            },
            select: { id: true },
          });
          roomIds.push(aptRoom.id);

          if (roomDef.defaultServices.length > 0) {
            await prisma.apartmentRoomService.createMany({
              data: roomDef.defaultServices.map((ds) => ({
                apartmentRoomId: aptRoom.id,
                serviceId: ds.serviceId,
              })),
            });
          }
        }

        // Criar checklist
        const checklist = await prisma.checklist.create({
          data: { apartmentId: apt.id, companyId: company.id },
          select: { id: true },
        });

        // Criar checklist items
        const arsRecords = await prisma.apartmentRoomService.findMany({
          where: { apartmentRoomId: { in: roomIds } },
          select: { id: true },
        });

        if (arsRecords.length > 0) {
          await prisma.checklistItem.createMany({
            data: arsRecords.map((ars) => ({
              checklistId: checklist.id,
              apartmentRoomServiceId: ars.id,
            })),
          });
        }

        createdApartments.push({
          id: apt.id,
          checklistId: checklist.id,
          identifier,
          block,
          floor,
        });
        console.log(`  ✓ Apto ${identifier} (Bloco ${block}, ${floor}º andar) — ${arsRecords.length} itens`);
      }
    }
    console.log(`\nTotal: ${createdApartments.length} apartamentos criados\n`);

    // ── 9. Distribuir 10 aptos por inspetor e criar vistorias ───────────────
    console.log("Distribuição de vistorias:");
    for (let i = 0; i < 3; i++) {
      const inspector = trio[i];
      const slice = createdApartments.slice(i * 10, (i + 1) * 10);

      for (const apt of slice) {
        const visit = await prisma.visit.create({
          data: {
            checklistId: apt.checklistId,
            inspectorId: inspector.id,
            createdById: admin.id,
            companyId: company.id,
          },
          select: { id: true },
        });

        // Criar VisitItems para cada ChecklistItem do apartamento
        const checklistItems = await prisma.checklistItem.findMany({
          where: { checklistId: apt.checklistId },
          select: { id: true },
        });
        if (checklistItems.length > 0) {
          await prisma.visitItem.createMany({
            data: checklistItems.map((item) => ({
              visitId: visit.id,
              checklistItemId: item.id,
            })),
          });
        }
      }

      const ids = slice.map((a) => a.identifier).join(", ");
      console.log(`  ${inspector.name}: [${ids}]`);
    }

    console.log("\n═══════════════════════════════════════════");
    console.log("  Setup Banca II concluído com sucesso!");
    console.log(`  Empreendimento: ${building.name} (id=${building.id})`);
    console.log(`  Tipo: ${aptType.name}`);
    console.log(`  Apartamentos: 30 (blocos A-F, andares 1-5)`);
    console.log(`  Cômodos/apto: 4 | Serviços/cômodo: 4`);
    console.log(`  Inspetores: ${trio.map((i) => i.name).join(", ")}`);
    console.log("═══════════════════════════════════════════\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\n✗ Script falhou:", err.message ?? err);
  process.exit(1);
});
