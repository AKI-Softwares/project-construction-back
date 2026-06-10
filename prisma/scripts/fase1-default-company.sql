-- FASE 1: Criar empresa default + promover Administrator a platform admin
-- Substituir <NOME_EMPRESA>, <SLUG> e <ADMIN_USER_ID> antes de executar.
--
-- Para encontrar o ADMIN_USER_ID execute primeiro:
--   SELECT u.id, u.email, r.name as role
--   FROM "User" u JOIN "Role" r ON u.role_id = r.id
--   WHERE r.name = 'Administrator';
--
-- Sugestão de slug: lowercase sem espaços, ex: 'construtora-abc'

BEGIN;

-- 1. Criar empresa default como ACTIVE
INSERT INTO "Company" (name, slug, status, created_at, updated_at)
VALUES ('<NOME_EMPRESA>', '<SLUG>', 'ACTIVE', NOW(), NOW())
RETURNING id;
-- ANOTE O ID RETORNADO — será usado nas Fases 2B e 3 como <DEFAULT_COMPANY_ID>

-- 2. Promover usuário Administrator a platform admin e desvinculá-lo de empresa
UPDATE "User"
SET is_platform_admin = true, company_id = NULL, role_id = NULL
WHERE id = <ADMIN_USER_ID>;

COMMIT;
