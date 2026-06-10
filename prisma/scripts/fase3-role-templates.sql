-- FASE 3: Criar templates de roles de plataforma (company_id = NULL)
-- Os roles da empresa default (Supervisor, Inspector, etc.) viram templates
-- para que novas empresas sejam seedadas com eles na ativação.
-- Substituir <DEFAULT_COMPANY_ID> pelo id da empresa default.
--
-- NOTA TÉCNICA: a tabela "_RolePermissions" usa
--   A = permission_id (Permission)
--   B = role_id       (Role)
-- conforme gerado pelo Prisma Migrate.

BEGIN;

-- 1. Inserir template para cada role não-admin da empresa default
--    (ignora roles que já existam como template com o mesmo nome)
INSERT INTO "Role" (name, description, is_system, is_company_admin, company_id, created_at, updated_at)
SELECT name, description, false, false, NULL, NOW(), NOW()
FROM "Role"
WHERE company_id = <DEFAULT_COMPANY_ID>
  AND is_company_admin = false
  AND name NOT IN (
    SELECT name FROM "Role" WHERE company_id IS NULL
  );

-- 2. Copiar permissões para os templates recém-criados
INSERT INTO "_RolePermissions" ("A", "B")
SELECT rp."A", tpl.id
FROM "Role" tpl
JOIN "Role" orig
  ON orig.name = tpl.name
 AND orig.company_id = <DEFAULT_COMPANY_ID>
JOIN "_RolePermissions" rp ON rp."B" = orig.id
WHERE tpl.company_id IS NULL
ON CONFLICT DO NOTHING;

COMMIT;

-- VERIFICAÇÃO:
-- SELECT id, name, company_id, is_company_admin FROM "Role"
-- WHERE company_id IS NULL ORDER BY name;
-- Resultado esperado: templates de todos os roles não-admin da empresa default
