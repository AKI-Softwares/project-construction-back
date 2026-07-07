/**
 * Limpa assets órfãos do Cloudinary: lista tudo em home/checkobra,
 * cruza com os publicIds ativos no banco e deleta o que não tem registro.
 *
 * Run: npx tsx prisma/cleanup-cloudinary.ts
 */
import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client.js";

const PHOTO_FOLDER = "home/checkobra";

async function listAllCloudinaryResources(prefix: string): Promise<string[]> {
  const publicIds: string[] = [];
  let nextCursor: string | undefined;

  do {
    const result: { resources: { public_id: string }[]; next_cursor?: string } =
      await cloudinary.api.resources({
        type: "upload",
        prefix,
        max_results: 500,
        ...(nextCursor ? { next_cursor: nextCursor } : {}),
      });

    for (const r of result.resources) {
      // ignorar subpasta signatures — publicId não é rastreado no banco
      if (!r.public_id.startsWith(`${prefix}/signatures/`)) {
        publicIds.push(r.public_id);
      }
    }
    nextCursor = result.next_cursor;
  } while (nextCursor);

  return publicIds;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não definida.");

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. publicIds ativos no banco
    const dbPhotos = await prisma.photo.findMany({ select: { publicId: true } });
    const activeIds = new Set(dbPhotos.map((p) => p.publicId));
    console.log(`✓ Fotos ativas no banco: ${activeIds.size}`);

    // 2. recursos no Cloudinary (exclui /signatures)
    console.log(`Listando recursos Cloudinary em "${PHOTO_FOLDER}"...`);
    const cloudinaryIds = await listAllCloudinaryResources(PHOTO_FOLDER);
    console.log(`✓ Recursos encontrados no Cloudinary: ${cloudinaryIds.length}`);

    // 3. órfãos = estão no Cloudinary mas não no banco
    const orphans = cloudinaryIds.filter((id) => !activeIds.has(id));
    console.log(`\nÓrfãos a deletar: ${orphans.length}`);

    if (orphans.length === 0) {
      console.log("Nenhum ativo órfão encontrado. Cloudinary está limpo.");
      return;
    }

    for (const id of orphans) {
      console.log(`  ${id}`);
    }

    // 4. deletar em lotes de 100 (limite da API Cloudinary)
    console.log("\nDeletando...");
    let deleted = 0;
    let failed = 0;

    for (let i = 0; i < orphans.length; i += 100) {
      const batch = orphans.slice(i, i + 100);
      try {
        const result = await cloudinary.api.delete_resources(batch);
        const batchDeleted = Object.values(result.deleted as Record<string, string>).filter(
          (v) => v === "deleted",
        ).length;
        const batchNotFound = Object.values(result.deleted as Record<string, string>).filter(
          (v) => v === "not_found",
        ).length;
        deleted += batchDeleted;
        console.log(
          `  lote ${Math.floor(i / 100) + 1}: ${batchDeleted} deletados, ${batchNotFound} não encontrados`,
        );
      } catch (err) {
        console.error(`  lote ${Math.floor(i / 100) + 1}: erro`, err);
        failed += batch.length;
      }
    }

    console.log(`\n═══════════════════════════════`);
    console.log(`  Órfãos processados: ${orphans.length}`);
    console.log(`  Deletados:          ${deleted}`);
    if (failed > 0) console.log(`  Falhas:             ${failed}`);
    console.log(`═══════════════════════════════\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("✗ Falhou:", err.message ?? err);
  process.exit(1);
});
