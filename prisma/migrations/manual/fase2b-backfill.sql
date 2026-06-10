-- FASE 2B: Backfill de company_id para todos os registros existentes
-- PRÉ-REQUISITO: executar Fase 1 e anotar o id da empresa criada.
-- Substituir <DEFAULT_COMPANY_ID> pelo id retornado na Fase 1.

BEGIN;

-- Usuários (exceto platform admin — que tem company_id = NULL por design)
UPDATE "User"
SET company_id = <DEFAULT_COMPANY_ID>
WHERE company_id IS NULL AND is_platform_admin = false;

-- Roles (todos os existentes pertencem à empresa default)
-- NOTA: após Fase 3, novos templates de plataforma terão company_id = NULL
UPDATE "Role"
SET company_id = <DEFAULT_COMPANY_ID>
WHERE company_id IS NULL;

-- Entidades de negócio
UPDATE "Building"      SET company_id = <DEFAULT_COMPANY_ID> WHERE company_id IS NULL;
UPDATE "ApartmentType" SET company_id = <DEFAULT_COMPANY_ID> WHERE company_id IS NULL;
UPDATE "Service"       SET company_id = <DEFAULT_COMPANY_ID> WHERE company_id IS NULL;
UPDATE "Apartment"     SET company_id = <DEFAULT_COMPANY_ID> WHERE company_id IS NULL;
UPDATE "Inspection"    SET company_id = <DEFAULT_COMPANY_ID> WHERE company_id IS NULL;
UPDATE "Visit"         SET company_id = <DEFAULT_COMPANY_ID> WHERE company_id IS NULL;
UPDATE "NonConformity" SET company_id = <DEFAULT_COMPANY_ID> WHERE company_id IS NULL;
UPDATE "Photo"         SET company_id = <DEFAULT_COMPANY_ID> WHERE company_id IS NULL;

COMMIT;

-- VERIFICAÇÃO PÓS-BACKFILL (execute após o COMMIT):
-- SELECT 'User'          as tbl, COUNT(*) as nulls FROM "User"          WHERE company_id IS NULL AND is_platform_admin = false
-- UNION ALL SELECT 'Role',          COUNT(*) FROM "Role"          WHERE company_id IS NULL
-- UNION ALL SELECT 'Building',      COUNT(*) FROM "Building"      WHERE company_id IS NULL
-- UNION ALL SELECT 'ApartmentType', COUNT(*) FROM "ApartmentType" WHERE company_id IS NULL
-- UNION ALL SELECT 'Service',       COUNT(*) FROM "Service"       WHERE company_id IS NULL
-- UNION ALL SELECT 'Apartment',     COUNT(*) FROM "Apartment"     WHERE company_id IS NULL
-- UNION ALL SELECT 'Inspection',    COUNT(*) FROM "Inspection"    WHERE company_id IS NULL
-- UNION ALL SELECT 'Visit',         COUNT(*) FROM "Visit"         WHERE company_id IS NULL
-- UNION ALL SELECT 'NonConformity', COUNT(*) FROM "NonConformity" WHERE company_id IS NULL
-- UNION ALL SELECT 'Photo',         COUNT(*) FROM "Photo"         WHERE company_id IS NULL;
-- Resultado esperado: TODAS as linhas com nulls = 0
