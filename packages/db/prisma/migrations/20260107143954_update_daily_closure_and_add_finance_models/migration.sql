-- AlterTable: Modificar daily_closures
-- Primeiro, remover a constraint única antiga
ALTER TABLE "daily_closures" DROP CONSTRAINT IF EXISTS "daily_closures_tenant_id_date_key";

-- Adicionar novos campos (nullable inicialmente para migração de dados existentes)
ALTER TABLE "daily_closures" ADD COLUMN IF NOT EXISTS "created_by_id" UUID;
ALTER TABLE "daily_closures" ADD COLUMN IF NOT EXISTS "closure_type" TEXT;
ALTER TABLE "daily_closures" ADD COLUMN IF NOT EXISTS "initial_balance" DECIMAL(10,2);
ALTER TABLE "daily_closures" ADD COLUMN IF NOT EXISTS "final_balance" DECIMAL(10,2);
ALTER TABLE "daily_closures" ADD COLUMN IF NOT EXISTS "cash_count" DECIMAL(10,2);
ALTER TABLE "daily_closures" ADD COLUMN IF NOT EXISTS "card_count" DECIMAL(10,2);
ALTER TABLE "daily_closures" ADD COLUMN IF NOT EXISTS "pix_count" DECIMAL(10,2);
ALTER TABLE "daily_closures" ADD COLUMN IF NOT EXISTS "difference" DECIMAL(10,2);

-- Migrar dados existentes: definir valores padrão
-- Para registros existentes, vamos usar o closed_by_id como created_by_id
-- e definir closure_type como 'ADMIN' (assumindo que eram fechamentos administrativos)
UPDATE "daily_closures" 
SET 
  "created_by_id" = (
    SELECT u.id 
    FROM users u 
    WHERE u.tenant_id = "daily_closures"."tenant_id" 
    AND (u.role = 'admin' OR u.role = 'owner')
    LIMIT 1
  ),
  "closure_type" = 'ADMIN',
  "initial_balance" = 0,
  "final_balance" = "net_balance"
WHERE "created_by_id" IS NULL;

-- Se ainda houver registros sem created_by_id, usar o primeiro usuário do tenant
UPDATE "daily_closures" 
SET 
  "created_by_id" = (
    SELECT u.id 
    FROM users u 
    WHERE u.tenant_id = "daily_closures"."tenant_id" 
    LIMIT 1
  ),
  "closure_type" = 'ADMIN',
  "initial_balance" = 0,
  "final_balance" = "net_balance"
WHERE "created_by_id" IS NULL;

-- Remover a foreign key antiga (closed_by_id -> staff)
ALTER TABLE "daily_closures" DROP CONSTRAINT IF EXISTS "daily_closures_closed_by_id_fkey";

-- Adicionar foreign key para created_by_id -> users
ALTER TABLE "daily_closures" 
ADD CONSTRAINT "daily_closures_created_by_id_fkey" 
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tornar campos obrigatórios
ALTER TABLE "daily_closures" ALTER COLUMN "created_by_id" SET NOT NULL;
ALTER TABLE "daily_closures" ALTER COLUMN "closure_type" SET NOT NULL;
ALTER TABLE "daily_closures" ALTER COLUMN "initial_balance" SET NOT NULL;
ALTER TABLE "daily_closures" ALTER COLUMN "final_balance" SET NOT NULL;

-- Adicionar constraint de check para closure_type
ALTER TABLE "daily_closures" ADD CONSTRAINT "daily_closures_closure_type_check" 
CHECK ("closure_type" IN ('RECEPTIONIST', 'ADMIN'));

-- Adicionar nova constraint única
ALTER TABLE "daily_closures" 
ADD CONSTRAINT "daily_closures_tenant_id_date_created_by_id_closure_type_key" 
UNIQUE ("tenant_id", "date", "created_by_id", "closure_type");

-- Remover coluna closed_by_id antiga (se ainda existir)
ALTER TABLE "daily_closures" DROP COLUMN IF EXISTS "closed_by_id";

-- CreateTable: expense_categories
CREATE TABLE IF NOT EXISTS "expense_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "is_fixed" BOOLEAN NOT NULL DEFAULT false,
    "cost_center" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: medical_fee_payments
CREATE TABLE IF NOT EXISTS "medical_fee_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "fees_count" INTEGER NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "paid_by" UUID NOT NULL,
    "payment_method" TEXT,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_fee_payments_pkey" PRIMARY KEY ("id")
);

-- AlterTable: transactions - adicionar category_id
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "category_id" UUID;

-- AlterTable: medical_fees - adicionar payment_id
ALTER TABLE "medical_fees" ADD COLUMN IF NOT EXISTS "payment_id" UUID;

-- AddForeignKey: expense_categories
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_tenant_id_fkey" 
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_parent_id_fkey" 
FOREIGN KEY ("parent_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: medical_fee_payments
ALTER TABLE "medical_fee_payments" ADD CONSTRAINT "medical_fee_payments_tenant_id_fkey" 
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medical_fee_payments" ADD CONSTRAINT "medical_fee_payments_staff_id_fkey" 
FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medical_fee_payments" ADD CONSTRAINT "medical_fee_payments_paid_by_fkey" 
FOREIGN KEY ("paid_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: transactions -> expense_categories
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" 
FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: medical_fees -> medical_fee_payments
ALTER TABLE "medical_fees" ADD CONSTRAINT "medical_fees_payment_id_fkey" 
FOREIGN KEY ("payment_id") REFERENCES "medical_fee_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: expense_categories unique code per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_tenant_id_code_key" 
ON "expense_categories"("tenant_id", "code");

-- CreateIndex: transactions category_id (para performance)
CREATE INDEX IF NOT EXISTS "transactions_category_id_idx" ON "transactions"("category_id");

-- CreateIndex: medical_fees payment_id (para performance)
CREATE INDEX IF NOT EXISTS "medical_fees_payment_id_idx" ON "medical_fees"("payment_id");
