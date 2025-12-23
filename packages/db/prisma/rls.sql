-- SQL para habilitar RLS (Row Level Security) nas tabelas do MedFlow

-- 1. Habilitar RLS nas tabelas sensíveis
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medical_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_closures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medical_fees" ENABLE ROW LEVEL SECURITY;

-- 2. Criar política de isolamento para as tabelas
-- Esta política impede que um tenant acesse dados de outro tenant.
-- A variável 'medflow.current_tenant' deve ser setada em cada requisição.

-- Política para users
DROP POLICY IF EXISTS tenant_isolation_policy ON "users";
CREATE POLICY tenant_isolation_policy ON "users"
USING ("tenant_id" = current_setting('medflow.current_tenant')::uuid);

-- Política para patients
DROP POLICY IF EXISTS tenant_isolation_policy ON "patients";
CREATE POLICY tenant_isolation_policy ON "patients"
USING ("tenant_id" = current_setting('medflow.current_tenant')::uuid);

-- Política para staff
DROP POLICY IF EXISTS tenant_isolation_policy ON "staff";
CREATE POLICY tenant_isolation_policy ON "staff"
USING ("tenant_id" = current_setting('medflow.current_tenant')::uuid);

-- Política para appointments
DROP POLICY IF EXISTS tenant_isolation_policy ON "appointments";
CREATE POLICY tenant_isolation_policy ON "appointments"
USING ("tenant_id" = current_setting('medflow.current_tenant')::uuid);

-- Política para medical_records
DROP POLICY IF EXISTS tenant_isolation_policy ON "medical_records";
CREATE POLICY tenant_isolation_policy ON "medical_records"
USING ("tenant_id" = current_setting('medflow.current_tenant')::uuid);

-- Política para transactions
DROP POLICY IF EXISTS tenant_isolation_policy ON "transactions";
CREATE POLICY tenant_isolation_policy ON "transactions"
USING ("tenant_id" = current_setting('medflow.current_tenant')::uuid);

-- Política para daily_closures
DROP POLICY IF EXISTS tenant_isolation_policy ON "daily_closures";
CREATE POLICY tenant_isolation_policy ON "daily_closures"
USING ("tenant_id" = current_setting('medflow.current_tenant')::uuid);

-- Política para medical_fees
DROP POLICY IF EXISTS tenant_isolation_policy ON "medical_fees";
CREATE POLICY tenant_isolation_policy ON "medical_fees"
USING ("tenant_id" = current_setting('medflow.current_tenant')::uuid);
