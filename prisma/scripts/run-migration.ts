import 'dotenv/config';
import { prisma } from '../../../src/shared/infra/database/prisma.js';

async function main() {
  console.log('\n=== B2B Migration Runner ===\n');

  // ─── FASE 1: Empresa default + platform admin ───────────────────────────
  console.log('FASE 1: Criando empresa default + promovendo platform admin...');

  const [company] = await prisma.$queryRaw<{ id: number }[]>`
    INSERT INTO "Company" (name, slug, status, created_at, updated_at)
    VALUES ('AKI Softwares', 'aki-softwares', 'ACTIVE', NOW(), NOW())
    RETURNING id
  `;
  const DEFAULT_COMPANY_ID = company.id;
  console.log(`  ✓ Company criada — id=${DEFAULT_COMPANY_ID}`);

  await prisma.$executeRaw`
    UPDATE "User"
    SET is_platform_admin = true, company_id = NULL, role_id = NULL
    WHERE id = 1
  `;
  console.log('  ✓ User id=1 promovido a platform admin');

  // ─── FASE 2A: Verificar colunas nullable ────────────────────────────────
  console.log('\nFASE 2A: Verificando colunas nullable...');
  const cols = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'company_id'
      AND table_name IN ('User','Role','Building','ApartmentType','Service',
                         'Apartment','Inspection','Visit','NonConformity','Photo')
    ORDER BY table_name
  `;
  console.log(`  ✓ ${cols.length}/10 tabelas com company_id: ${cols.map(c => c.table_name).join(', ')}`);

  // ─── FASE 2B: Backfill ──────────────────────────────────────────────────
  console.log('\nFASE 2B: Backfill de company_id...');

  const tables: [string, string][] = [
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

  for (const [tbl, sql] of tables) {
    const n = await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${tbl}: ${n} linhas atualizadas`);
  }

  // verificar zeros
  const nulls = await prisma.$queryRaw<any[]>`
    SELECT
      (SELECT COUNT(*) FROM "User"          WHERE company_id IS NULL AND is_platform_admin = false) AS "User",
      (SELECT COUNT(*) FROM "Building"      WHERE company_id IS NULL) AS "Building",
      (SELECT COUNT(*) FROM "Apartment"     WHERE company_id IS NULL) AS "Apartment",
      (SELECT COUNT(*) FROM "Inspection"    WHERE company_id IS NULL) AS "Inspection",
      (SELECT COUNT(*) FROM "Visit"         WHERE company_id IS NULL) AS "Visit",
      (SELECT COUNT(*) FROM "NonConformity" WHERE company_id IS NULL) AS "NonConformity",
      (SELECT COUNT(*) FROM "Photo"         WHERE company_id IS NULL) AS "Photo"
  `;
  const allZero = Object.values(nulls[0]).every(v => v === 0n || v === 0);
  console.log(`  ${allZero ? '✓ Zero NULLs em todas as tabelas' : '✗ AINDA HÁ NULLs — verifique!'}`, nulls[0]);

  // ─── FASE 2C: NOT NULL constraints ──────────────────────────────────────
  console.log('\nFASE 2C: Aplicando NOT NULL nas entidades de negócio...');
  const ddlTables = ['Building', 'Apartment', 'Inspection', 'Visit', 'NonConformity', 'Photo'];
  for (const tbl of ddlTables) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${tbl}" ALTER COLUMN company_id SET NOT NULL`);
    console.log(`  ✓ ${tbl}.company_id = NOT NULL`);
  }

  // ─── FASE 3: Role templates ──────────────────────────────────────────────
  console.log('\nFASE 3: Criando role templates de plataforma...');

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Role" (name, description, is_system, is_company_admin, company_id, created_at, updated_at)
    SELECT name, description, false, false, NULL, NOW(), NOW()
    FROM "Role"
    WHERE company_id = ${DEFAULT_COMPANY_ID}
      AND is_company_admin = false
      AND name NOT IN (SELECT name FROM "Role" WHERE company_id IS NULL)
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "_RolePermissions" ("A", "B")
    SELECT rp."A", tpl.id
    FROM "Role" tpl
    JOIN "Role" orig ON orig.name = tpl.name AND orig.company_id = ${DEFAULT_COMPANY_ID}
    JOIN "_RolePermissions" rp ON rp."B" = orig.id
    WHERE tpl.company_id IS NULL
    ON CONFLICT DO NOTHING
  `);

  const templates = await prisma.$queryRaw<any[]>`
    SELECT id, name, company_id FROM "Role" WHERE company_id IS NULL ORDER BY name
  `;
  console.log('  ✓ Role templates:', templates.map(t => t.name));

  // ─── VERIFY ─────────────────────────────────────────────────────────────
  console.log('\n=== VERIFICAÇÃO FINAL ===');
  const companies = await prisma.$queryRaw<any[]>`SELECT id, name, slug, status FROM "Company"`;
  console.log('Empresas:', companies);

  const adminCheck = await prisma.$queryRaw<any[]>`
    SELECT id, email, is_platform_admin, company_id FROM "User" WHERE is_platform_admin = true
  `;
  console.log('Platform admins:', adminCheck);

  console.log('\n✅ Migração concluída com sucesso!');
  await prisma.$disconnect();
}

main().catch(async e => {
  console.error('\n❌ Erro na migração:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
