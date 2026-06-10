import 'dotenv/config';
import { prisma } from '../../../src/shared/infra/database/prisma.js';

async function main() {
  console.log('\n=== Estado atual do banco ===\n');

  const companies = await prisma.$queryRaw<any[]>`
    SELECT id, name, slug, status FROM "Company" ORDER BY id
  `;
  console.log('Empresas:', companies.length === 0 ? '(nenhuma)' : companies);

  const adminUsers = await prisma.$queryRaw<any[]>`
    SELECT u.id, u.email, u.is_platform_admin, u.company_id, r.name as role_name
    FROM "User" u
    LEFT JOIN "Role" r ON u.role_id = r.id
    ORDER BY u.id
  `;
  console.log('\nUsuários + roles:');
  adminUsers.forEach(u => {
    console.log(`  id=${u.id} email=${u.email} role=${u.role_name ?? 'null'} isPlatformAdmin=${u.is_platform_admin} companyId=${u.company_id}`);
  });

  const roles = await prisma.$queryRaw<any[]>`
    SELECT id, name, is_company_admin, company_id FROM "Role" ORDER BY id
  `;
  console.log('\nRoles existentes:');
  roles.forEach(r => {
    console.log(`  id=${r.id} name=${r.name} isCompanyAdmin=${r.is_company_admin} companyId=${r.company_id}`);
  });

  const counts = await prisma.$queryRaw<any[]>`
    SELECT
      (SELECT COUNT(*) FROM "Building"      WHERE company_id IS NULL) AS buildings,
      (SELECT COUNT(*) FROM "Apartment"     WHERE company_id IS NULL) AS apartments,
      (SELECT COUNT(*) FROM "Inspection"    WHERE company_id IS NULL) AS inspections,
      (SELECT COUNT(*) FROM "Visit"         WHERE company_id IS NULL) AS visits,
      (SELECT COUNT(*) FROM "NonConformity" WHERE company_id IS NULL) AS nc,
      (SELECT COUNT(*) FROM "Photo"         WHERE company_id IS NULL) AS photos
  `;
  console.log('\nRegistros sem company_id (precisam de backfill):', counts[0]);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
