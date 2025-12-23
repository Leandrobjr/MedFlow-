-- SQL para habilitar RLS (Row Level Security) nas tabelas do MedFlow

-- 1. Habilitar RLS nas tabelas sensíveis
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

-- 2. Criar política de isolamento para a tabela "users"
-- Esta política impede que um tenant acesse usuários de outro tenant.
-- A variável 'medflow.current_tenant' deve ser setada em cada requisição.
CREATE POLICY tenant_isolation_policy ON "users"
USING ("tenant_id" = current_setting('medflow.current_tenant')::uuid);

-- 3. Repetir para novas tabelas conforme o desenvolvimento avançar:
-- ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation_policy ON "appointments" USING ("tenant_id" = current_setting('medflow.current_tenant')::uuid);

