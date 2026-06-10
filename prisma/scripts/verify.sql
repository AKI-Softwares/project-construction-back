-- VERIFICAÇÃO FINAL: confirmar estado correto após migração completa

-- 1. Empresa default existe e está ACTIVE
SELECT id, name, slug, status FROM "Company" ORDER BY id;

-- 2. Platform admin existe com company_id = NULL
SELECT id, email, is_platform_admin, company_id
FROM "User"
WHERE is_platform_admin = true;

-- 3. Nenhum usuário não-platform-admin sem empresa
SELECT COUNT(*) AS usuarios_sem_empresa
FROM "User"
WHERE company_id IS NULL AND is_platform_admin = false;
-- Esperado: 0

-- 4. Todos os registros de negócio têm company_id
SELECT 'Building'      AS tbl, COUNT(*) AS nulls FROM "Building"      WHERE company_id IS NULL
UNION ALL SELECT 'Apartment',     COUNT(*) FROM "Apartment"     WHERE company_id IS NULL
UNION ALL SELECT 'Inspection',    COUNT(*) FROM "Inspection"    WHERE company_id IS NULL
UNION ALL SELECT 'Visit',         COUNT(*) FROM "Visit"         WHERE company_id IS NULL
UNION ALL SELECT 'NonConformity', COUNT(*) FROM "NonConformity" WHERE company_id IS NULL
UNION ALL SELECT 'Photo',         COUNT(*) FROM "Photo"         WHERE company_id IS NULL;
-- Esperado: todas as linhas com nulls = 0

-- 5. Templates de plataforma existem (roles com company_id NULL)
SELECT id, name, is_company_admin, company_id
FROM "Role"
WHERE company_id IS NULL
ORDER BY name;
-- Esperado: templates dos roles da empresa default (ex: Supervisor, Inspector)

-- 6. Company Admin role existe para a empresa default
SELECT r.name, r.is_company_admin, r.company_id
FROM "Role" r
WHERE r.is_company_admin = true;

-- 7. Contagem geral de dados por empresa
SELECT c.name AS empresa, c.status,
  (SELECT COUNT(*) FROM "Building" b WHERE b.company_id = c.id) AS buildings,
  (SELECT COUNT(*) FROM "Apartment" a WHERE a.company_id = c.id) AS apartments,
  (SELECT COUNT(*) FROM "Visit" v WHERE v.company_id = c.id) AS visits,
  (SELECT COUNT(*) FROM "User" u WHERE u.company_id = c.id) AS users
FROM "Company" c
ORDER BY c.id;
