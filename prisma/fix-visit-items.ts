/**
 * Cria os VisitItems faltantes para as visitas do Residencial Banca II.
 * Cada vistoria precisa de 1 VisitItem por ChecklistItem do apartamento.
 *
 * Run: npx tsx prisma/fix-visit-items.ts
 */
import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client.js";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não definida.");

  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // Buscar todas as visitas do Banca II sem VisitItems
    const visits = await prisma.visit.findMany({
      where: {
        companyId: 97,
        checklist: { apartment: { building: { name: { contains: "Banca II" } } } },
      },
      select: {
        id: true,
        checklistId: true,
        checklist: {
          select: {
            apartment: { select: { identifier: true } },
            items: { select: { id: true } },
          },
        },
        _count: { select: { items: true } },
      },
    });

    console.log(`Visitas encontradas: ${visits.length}`);

    let totalCreated = 0;
    let skipped = 0;

    for (const visit of visits) {
      const existingCount = visit._count.items;
      const checklistItems = visit.checklist.items;
      const aptId = visit.checklist.apartment.identifier;

      if (existingCount >= checklistItems.length) {
        skipped++;
        continue;
      }

      // Buscar quais ChecklistItem IDs já têm VisitItem nesta vistoria
      const existing = await prisma.visitItem.findMany({
        where: { visitId: visit.id },
        select: { checklistItemId: true },
      });
      const existingIds = new Set(existing.map((e) => e.checklistItemId));

      const toCreate = checklistItems
        .filter((item) => !existingIds.has(item.id))
        .map((item) => ({ visitId: visit.id, checklistItemId: item.id }));

      if (toCreate.length > 0) {
        await prisma.visitItem.createMany({ data: toCreate });
        totalCreated += toCreate.length;
        console.log(`  ✓ Apto ${aptId} (visit #${visit.id}): +${toCreate.length} VisitItems`);
      }
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`  VisitItems criados: ${totalCreated}`);
    console.log(`  Vistorias já completas (skip): ${skipped}`);
    console.log(`═══════════════════════════════════════\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("✗ Falhou:", err.message ?? err);
  process.exit(1);
});
