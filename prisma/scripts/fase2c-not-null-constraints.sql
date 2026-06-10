-- FASE 2C: Tornar company_id NOT NULL nas entidades de negócio puras
-- PRÉ-REQUISITOS:
--   1. Fase 2B executada e zero NULLs verificados
--   2. Deploy do novo código no Vercel estável (smoke test ok)
--
-- ATENÇÃO: ApartmentType e Service NÃO recebem NOT NULL porque
-- são usados como templates de plataforma (company_id = NULL).
-- User e Role também permanecem nullable (platform admin / role templates).

BEGIN;

ALTER TABLE "Building"      ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE "Apartment"     ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE "Inspection"    ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE "Visit"         ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE "NonConformity" ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE "Photo"         ALTER COLUMN company_id SET NOT NULL;

COMMIT;

-- Após executar, sincronizar o Prisma schema:
--   npm run db:migrate -- --name enforce-not-null-company-id
-- Ou se o Prisma reclamar que já é NOT NULL:
--   npx prisma db push
