-- FASE 2A: Verificação de que as colunas nullable existem
-- As colunas company_id foram criadas pelo Prisma Migrate (Plano A).
-- Este script apenas verifica que estão presentes e nullable antes do backfill.

SELECT table_name, column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'company_id'
  AND table_name IN (
    'User', 'Role', 'Building', 'ApartmentType', 'Service',
    'Apartment', 'Inspection', 'Visit', 'NonConformity', 'Photo'
  )
ORDER BY table_name;

-- Resultado esperado: todas as tabelas listadas com is_nullable = 'YES'
-- Se alguma tabela não aparecer, rode: npm run db:deploy
