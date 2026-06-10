import 'dotenv/config';
import { prisma } from '../../../src/shared/infra/database/prisma.js';

const DEFAULT_COMPANY_ID = 12;

async function main() {
  console.log(`\n=== Continuando migração (DEFAULT_COMPANY_ID=${DEFAULT_COMPANY_ID}) ===\n`);

  // ─── Verificar Fase 1 já aplicada ───────────────────────────────────────
  const company = await prisma.company.findUnique({ where: { id: DEFAULT_COMPANY_ID } });
  console.log('Company:', company?.name, '— status:', company?.status);

  const admin = await prisma.user.findUnique({ where: { id: 1 }, select: { email: true, isPlatformAdmin: true, companyId: true } });
  console.log('Platform admin:', admin);

  // ─── FASE 2A: Verificar colunas nullable ────────────────────────────────
  console.log('\nFASE 2A: Verificando colunas...');
  const cols = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name::text FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'company_id'
      AND table_name::text IN ('User','Role','Building','ApartmentType','Service',
                               'Apartment','Inspection','Visit','NonConformity','Photo')
    ORDER BY table_name
  `;
  console.log(`  ✓ ${cols.length}/10 tabelas com company_id`);

  // ─── FASE 2B: Backfill ──────────────────────────────────────────────────
  console.log('\nFASE 2B: Backfill de company_id...');

  const updates: [string, string][] = [
    ['User',          `UPDATE "User" SET company_id = ${DEFAULT_COMPANY_ID} WHERE company_id IS NULL AND is_platform_admin = false`],
    ['Role',          `UPDATE "Role" SET company_id = ${DEFAULT_COMPANY_ID} WHERE company_id IS NULL`],
    ['Building',      `UPDATE "Building" SET company_id = ${DEFAULT_COMPANY_ID} WHERE company_id IS NULL`],
    ['ApartmentType', `UPDATE "ApartmentType" SET company_id = ${DEFAULT_COMPANY_ID} WHERE company_id IS NULL`],
    ['Service',       `UPDATE "Service" SET company_id = ${DEFAULT_COMPANY_ID} WHERE company_id IS NULL`],
    ['Apartment',     `UPDATE "Apartment" SET company_id = ${DEFAULT_COMPANY_ID} WHERE company_id IS NULL`],
    ['Inspection',    `UPDATE "Inspection" SET company_id = ${DEFAULT_COMPANY_ID} WHERE company_id IS NULL`],
    ['Visit',         `UPDATE "Visit" SET company_id = ${DEFAULT_COMPANY_ID} WHERE company_id IS NULL`],
    ['NonConformity', `UPDATE "NonConformity" SET company_id = ${DEFAULT_COMPANY_ID} WHERE company_id IS NULL`],
    ['Photo',         `UPDATE "Photo" SET company_id = ${DEFAULT_COMPANY_ID} WHERE company_id IS NULL`],
  ];

  for (const [tbl, sql] of updates) {
    const n = await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${tbl}: ${n} linhas`);
  }

  const nulls = await prisma.$queryRaw<any[]>`
    SELECT
      (SELECT COUNT(*)::int FROM "User"          WHERE company_id IS NULL AND is_platform_admin = false) AS u,
      (SELECT COUNT(*)::int FROM "Building"      WHERE company_id IS NULL) AS b,
      (SELECT COUNT(*)::int FROM "Apartment"     WHERE company_id IS NULL) AS a,
      (SELECT COUNT(*)::int FROM "Inspection"    WHERE company_id IS NULL) AS i,
      (SELECT COUNT(*)::int FROM "Visit"         WHERE company_id IS NULL) AS v,
      (SELECT COUNT(*)::int FROM "NonConformity" WHERE company_id IS NULL) AS nc,
      (SELECT COUNT(*)::int FROM "Photo"         WHERE company_id IS NULL) AS p
  `;
  const row = nulls[0];
  const allZero = Object.values(row).every(v => v === 0);
  console.log(allZero ? '  ✓ ZERO NULLs em todas as tabelas' : '  ✗ AINDA HÁ NULLs!', row);
  if (!allZero) { await prisma.$disconnect(); process.exit(1); }

  // ─── FASE 2C: NOT NULL constraints ──────────────────────────────────────
  console.log('\nFASE 2C: NOT NULL constraints...');
  for (const tbl of ['Building', 'Apartment', 'Inspection', 'Visit', 'NonConformity', 'Photo']) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${tbl}" ALTER COLUMN company_id SET NOT NULL`);
    console.log(`  ✓ ${tbl}.company_id NOT NULL`);
  }

  // ─── FASE 3: Role templates ──────────────────────────────────────────────
  console.log('\nFASE 3: Role templates de plataforma...');

  const inserted = await prisma.$executeRawUnsafe(`
    INSERT INTO "Role" (name, description, is_system, is_company_admin, company_id, created_at, updated_at)
    SELECT name, description, false, false, NULL, NOW(), NOW()
    FROM "Role"
    WHERE company_id = ${DEFAULT_COMPANY_ID}
      AND is_company_admin = false
      AND name NOT IN (SELECT name FROM "Role" WHERE company_id IS NULL)
  `);
  console.log(`  ✓ ${inserted} role templates criados`);

  const permsCopied = await prisma.$executeRawUnsafe(`
    INSERT INTO "_RolePermissions" ("A", "B")
    SELECT rp."A", tpl.id
    FROM "Role" tpl
    JOIN "Role" orig ON orig.name = tpl.name AND orig.company_id = ${DEFAULT_COMPANY_ID}
    JOIN "_RolePermissions" rp ON rp."B" = orig.id
    WHERE tpl.company_id IS NULL
    ON CONFLICT DO NOTHING
  `);
  console.log(`  ✓ ${permsCopied} permissões copiadas`);

  const templates = await prisma.role.findMany({ where: { companyId: null }, select: { id: true, name: true } });
  console.log('  Templates:', templates.map(t => `${t.name}(${t.id})`));

  // ─── VERIFY ─────────────────────────────────────────────────────────────
  console.log('\n=== VERIFICAÇÃO FINAL ===');
  const companies = await prisma.company.findMany({ select: { id: true, name: true, slug: true, status: true } });
  console.log('Empresas:', companies);

  const adminCheck = await prisma.user.findMany({
    where: { isPlatformAdmin: true },
    select: { id: true, email: true, isPlatformAdmin: true, companyId: true },
  });
  console.log('Platform admins:', adminCheck);

  const bizNulls = await prisma.$queryRaw<any[]>`
    SELECT
      (SELECT COUNT(*)::int FROM "Building"      WHERE company_id IS NULL) AS b,
      (SELECT COUNT(*)::int FROM "Visit"         WHERE company_id IS NULL) AS v,
      (SELECT COUNT(*)::int FROM "NonConformity" WHERE company_id IS NULL) AS nc
  `;
  console.log('Nulls em entidades de negócio:', bizNulls[0], '(todos devem ser 0)');

  console.log('\n✅ Migração completa!');
  await prisma.$disconnect();
}

main().catch(async e => {
  console.error('\n❌ Erro:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
