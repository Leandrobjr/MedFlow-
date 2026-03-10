# 📊 Relatório: Configuração de RLS para Tabelas Pendentes no Supabase

**Data:** 21 de Janeiro de 2026  
**Objetivo:** Definir como configurar Row Level Security (RLS) para 7 tabelas que ainda não têm políticas de isolamento configuradas no Supabase.

---

## 🎯 Resumo Executivo

Após análise do código e documentação, identifiquei que **7 tabelas** precisam ter suas políticas de RLS configuradas no Supabase. Destas:

- ✅ **5 tabelas** já têm `tenant_id` no schema e devem ter RLS **por clínica**
- ⚠️ **2 tabelas** não têm `tenant_id` diretamente, mas são **por clínica** através de relacionamentos
- 🔒 **1 tabela especial** (`tenants`) precisa de política restrita de SELECT

**Recomendação:** Configurar todas como **multi-tenant (por clínica)** para garantir segurança total.

---

## 📋 Análise Detalhada por Tabela

### 1. ✅ `expense_categories` (Categorias de Despesas)

**O que é:** Tabela que armazena categorias de despesas da clínica (ex: "Material de Escritório", "Salários", etc.).

**Status no Schema:**
- ✅ **TEM `tenant_id`** (linha 399 do `schema.prisma`)
- ✅ Relacionada com `Tenant` através de foreign key
- ✅ Usada em `Transaction` (transações financeiras)

**Decisão:** **POR CLÍNICA** ✅

**Justificativa:**
- Cada clínica tem suas próprias categorias de despesas
- O código já implementa isolamento por tenant (veja `seed.ts` linha 174)
- Não faz sentido compartilhar categorias entre clínicas

**Ação Necessária:**
- ✅ Adicionar RLS com política de isolamento por `tenant_id`
- ✅ Não precisa criar coluna (já existe)

---

### 2. ⚠️ `medical_addendums` (Adendos ao Prontuário)

**O que é:** Tabela que armazena adendos/retificações feitos em prontuários médicos já finalizados.

**Status no Schema:**
- ❌ **NÃO TEM `tenant_id` diretamente**
- ✅ Está vinculada a `MedicalRecord` através de `medicalRecordId`
- ✅ `MedicalRecord` TEM `tenant_id` (linha 156 do schema)

**Decisão:** **POR CLÍNICA** (através de relacionamento) ✅

**Justificativa:**
- Adendos são parte do prontuário médico, que já é isolado por tenant
- Um adendo só existe se o prontuário existir, e prontuários são por clínica
- Segurança: mesmo sem `tenant_id` direto, o acesso é controlado pelo relacionamento

**Ação Necessária:**
- ⚠️ **OPÇÃO 1 (Recomendada):** Adicionar `tenant_id` diretamente na tabela para facilitar RLS
- ⚠️ **OPÇÃO 2:** Criar política RLS que usa JOIN com `medical_records` (mais complexo)

**Recomendação:** Adicionar `tenant_id` para simplificar e garantir segurança.

---

### 3. ✅ `medical_fee_payments` (Fechamentos de Repasse Médico)

**O que é:** Tabela que registra quando um repasse médico foi fechado/pago (agrupa vários `MedicalFee`).

**Status no Schema:**
- ✅ **TEM `tenant_id`** (linha 422 do `schema.prisma`)
- ✅ Relacionada com `Tenant`, `Staff` e `User`
- ✅ Usada para relatórios de repasse médico

**Decisão:** **POR CLÍNICA** ✅

**Justificativa:**
- Cada clínica tem seus próprios fechamentos de repasse
- Está diretamente relacionada com `Tenant`
- Dados financeiros sensíveis que devem ser isolados

**Ação Necessária:**
- ✅ Adicionar RLS com política de isolamento por `tenant_id`
- ✅ Não precisa criar coluna (já existe)

---

### 4. ✅ `schedule_blocks` (Bloqueios de Agenda)

**O que é:** Tabela que armazena bloqueios temporários de agenda (ex: médico de férias, feriados).

**Status no Schema:**
- ✅ **TEM `tenant_id`** (linha 321 do `schema.prisma`)
- ✅ Relacionada com `Staff` e `Tenant`
- ✅ Usada na lógica de agendamento

**Decisão:** **POR CLÍNICA** ✅

**Justificativa:**
- Cada clínica tem seus próprios bloqueios de agenda
- Bloqueios são específicos por profissional, que já é por tenant
- Não faz sentido compartilhar bloqueios entre clínicas

**Ação Necessária:**
- ✅ Adicionar RLS com política de isolamento por `tenant_id`
- ✅ Não precisa criar coluna (já existe)

---

### 5. ✅ `schedule_configs` (Configurações de Agenda)

**O que é:** Tabela que armazena configurações de agenda por profissional (horários de trabalho, duração de consultas).

**Status no Schema:**
- ✅ **TEM `tenant_id`** (linha 297 do `schema.prisma`)
- ✅ Relacionada com `Staff` e `Tenant`
- ✅ Usada na página de configuração de agenda

**Decisão:** **POR CLÍNICA** ✅

**Justificativa:**
- Cada clínica tem suas próprias configurações de agenda
- Configurações são específicas por profissional, que já é por tenant
- Dados operacionais que devem ser isolados

**Ação Necessária:**
- ✅ Adicionar RLS com política de isolamento por `tenant_id`
- ✅ Não precisa criar coluna (já existe)

---

### 6. ⚠️ `staff_procedures` (Relacionamento Profissional ↔ Procedimento)

**O que é:** Tabela de relacionamento Many-to-Many que vincula quais procedimentos cada profissional pode realizar.

**Status no Schema:**
- ❌ **NÃO TEM `tenant_id` diretamente**
- ✅ Está vinculada a `Staff` (que TEM `tenant_id`) e `Procedure` (que TEM `tenant_id`)
- ✅ É uma tabela de relacionamento pura

**Decisão:** **POR CLÍNICA** (através de relacionamentos) ✅

**Justificativa:**
- Um relacionamento só existe se ambos (`Staff` e `Procedure`) existirem
- Ambos são por tenant, então o relacionamento também é por tenant
- Segurança: acesso controlado pelos relacionamentos

**Ação Necessária:**
- ⚠️ **OPÇÃO 1 (Recomendada):** Adicionar `tenant_id` diretamente na tabela para facilitar RLS
- ⚠️ **OPÇÃO 2:** Criar política RLS que usa JOIN com `staff` ou `procedures` (mais complexo)

**Recomendação:** Adicionar `tenant_id` para simplificar e garantir segurança.

---

### 7. 🔒 `tenants` (Tabela de Clínicas)

**O que é:** Tabela raiz que armazena as próprias clínicas (tenants) do sistema.

**Status no Schema:**
- ❌ **NÃO TEM `tenant_id`** (é a tabela raiz)
- ✅ Cada linha representa uma clínica diferente

**Decisão:** **POLÍTICA ESPECIAL** 🔒

**Justificativa:**
- Esta tabela não pode ter `tenant_id` porque ela mesma define os tenants
- Cada usuário só deve ver o próprio tenant (não pode ver outras clínicas)
- Não deve permitir INSERT/UPDATE/DELETE via API (só admin/service_role)

**Ação Necessária:**
- 🔒 Criar política de SELECT restrita: usuário só vê o próprio tenant
- 🔒 Não criar políticas de INSERT/UPDATE/DELETE (deixar apenas para admin)

---

## ✅ Recomendações Finais

### **Tabelas que PRECISAM de `tenant_id` adicionado:**

1. **`medical_addendums`** - Adicionar `tenant_id` e popular com base em `medical_records.tenant_id`
2. **`staff_procedures`** - Adicionar `tenant_id` e popular com base em `staff.tenant_id` ou `procedures.tenant_id`

### **Tabelas que JÁ TÊM `tenant_id` (só precisam de RLS):**

1. ✅ `expense_categories`
2. ✅ `medical_fee_payments`
3. ✅ `schedule_blocks`
4. ✅ `schedule_configs`

### **Tabela especial:**

1. 🔒 `tenants` - Política de SELECT restrita

---

## 📝 Script SQL Recomendado

### **Passo 1: Verificar quais tabelas têm `tenant_id`**

Execute no Supabase SQL Editor:

```sql
SELECT
  table_name,
  EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = t.table_name
      AND c.column_name = 'tenant_id'
  ) as has_tenant_id
FROM (VALUES
  ('expense_categories'),
  ('medical_addendums'),
  ('medical_fee_payments'),
  ('schedule_blocks'),
  ('schedule_configs'),
  ('staff_procedures')
) AS t(table_name)
ORDER BY table_name;
```

### **Passo 2: Adicionar `tenant_id` nas tabelas que não têm**

#### **Para `medical_addendums`:**

```sql
-- 1. Adicionar coluna tenant_id
ALTER TABLE public.medical_addendums 
ADD COLUMN tenant_id UUID;

-- 2. Popular tenant_id com base no relacionamento com medical_records
UPDATE public.medical_addendums ma
SET tenant_id = mr.tenant_id
FROM public.medical_records mr
WHERE ma.medical_record_id = mr.id
  AND ma.tenant_id IS NULL;

-- 3. Tornar obrigatório e criar índice
ALTER TABLE public.medical_addendums 
ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS medical_addendums_tenant_id_idx 
ON public.medical_addendums(tenant_id);

-- 4. Adicionar foreign key
ALTER TABLE public.medical_addendums
ADD CONSTRAINT medical_addendums_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
```

#### **Para `staff_procedures`:**

```sql
-- 1. Adicionar coluna tenant_id
ALTER TABLE public.staff_procedures 
ADD COLUMN tenant_id UUID;

-- 2. Popular tenant_id com base no relacionamento com staff
UPDATE public.staff_procedures sp
SET tenant_id = s.tenant_id
FROM public.staff s
WHERE sp.staff_id = s.id
  AND sp.tenant_id IS NULL;

-- 3. Tornar obrigatório e criar índice
ALTER TABLE public.staff_procedures 
ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS staff_procedures_tenant_id_idx 
ON public.staff_procedures(tenant_id);

-- 4. Adicionar foreign key
ALTER TABLE public.staff_procedures
ADD CONSTRAINT staff_procedures_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
```

### **Passo 3: Habilitar RLS e criar políticas**

```sql
-- Habilitar RLS nas tabelas
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_addendums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Política para expense_categories
DROP POLICY IF EXISTS tenant_isolation_policy ON public.expense_categories;
CREATE POLICY tenant_isolation_policy ON public.expense_categories
FOR ALL
USING (tenant_id = current_setting('medflow.current_tenant')::uuid)
WITH CHECK (tenant_id = current_setting('medflow.current_tenant')::uuid);

-- Política para medical_addendums
DROP POLICY IF EXISTS tenant_isolation_policy ON public.medical_addendums;
CREATE POLICY tenant_isolation_policy ON public.medical_addendums
FOR ALL
USING (tenant_id = current_setting('medflow.current_tenant')::uuid)
WITH CHECK (tenant_id = current_setting('medflow.current_tenant')::uuid);

-- Política para medical_fee_payments
DROP POLICY IF EXISTS tenant_isolation_policy ON public.medical_fee_payments;
CREATE POLICY tenant_isolation_policy ON public.medical_fee_payments
FOR ALL
USING (tenant_id = current_setting('medflow.current_tenant')::uuid)
WITH CHECK (tenant_id = current_setting('medflow.current_tenant')::uuid);

-- Política para schedule_blocks
DROP POLICY IF EXISTS tenant_isolation_policy ON public.schedule_blocks;
CREATE POLICY tenant_isolation_policy ON public.schedule_blocks
FOR ALL
USING (tenant_id = current_setting('medflow.current_tenant')::uuid)
WITH CHECK (tenant_id = current_setting('medflow.current_tenant')::uuid);

-- Política para schedule_configs
DROP POLICY IF EXISTS tenant_isolation_policy ON public.schedule_configs;
CREATE POLICY tenant_isolation_policy ON public.schedule_configs
FOR ALL
USING (tenant_id = current_setting('medflow.current_tenant')::uuid)
WITH CHECK (tenant_id = current_setting('medflow.current_tenant')::uuid);

-- Política para staff_procedures
DROP POLICY IF EXISTS tenant_isolation_policy ON public.staff_procedures;
CREATE POLICY tenant_isolation_policy ON public.staff_procedures
FOR ALL
USING (tenant_id = current_setting('medflow.current_tenant')::uuid)
WITH CHECK (tenant_id = current_setting('medflow.current_tenant')::uuid);

-- Política ESPECIAL para tenants (apenas SELECT do próprio tenant)
DROP POLICY IF EXISTS tenant_isolation_policy ON public.tenants;
CREATE POLICY tenant_isolation_policy ON public.tenants
FOR SELECT
USING (id = current_setting('medflow.current_tenant')::uuid);
-- Nota: INSERT/UPDATE/DELETE não têm política (só admin/service_role pode fazer)
```

---

## ⚠️ Importante: Atualizar Schema Prisma

Após executar os scripts SQL, você precisa atualizar o `schema.prisma` para refletir as mudanças:

### **Adicionar `tenant_id` em `MedicalAddendum`:**

```prisma
model MedicalAddendum {
  id              String   @id @default(uuid()) @db.Uuid
  medicalRecordId String   @map("medical_record_id") @db.Uuid
  tenantId        String   @map("tenant_id") @db.Uuid  // ← ADICIONAR ESTA LINHA
  content         String   @db.Text
  createdAt       DateTime @default(now()) @map("created_at")

  medicalRecord MedicalRecord @relation(fields: [medicalRecordId], references: [id])
  tenant        Tenant        @relation(fields: [tenantId], references: [id])  // ← ADICIONAR ESTA LINHA

  @@map("medical_addendums")
}
```

### **Adicionar `tenant_id` em `StaffProcedure`:**

```prisma
model StaffProcedure {
  id          String @id @default(uuid()) @db.Uuid
  staffId     String @map("staff_id") @db.Uuid
  procedureId String @map("procedure_id") @db.Uuid
  tenantId    String @map("tenant_id") @db.Uuid  // ← ADICIONAR ESTA LINHA
  createdAt   DateTime @default(now()) @map("created_at")

  staff     Staff     @relation(fields: [staffId], references: [id], onDelete: Cascade)
  procedure Procedure @relation(fields: [procedureId], references: [id], onDelete: Cascade)
  tenant    Tenant    @relation(fields: [tenantId], references: [id])  // ← ADICIONAR ESTA LINHA

  @@unique([staffId, procedureId])
  @@map("staff_procedures")
}
```

### **Atualizar relação em `Tenant`:**

```prisma
model Tenant {
  // ... campos existentes ...
  
  medicalAddendums MedicalAddendum[]  // ← ADICIONAR ESTA LINHA
  staffProcedures   StaffProcedure[]  // ← ADICIONAR ESTA LINHA
  
  // ... resto das relações ...
}
```

Depois, execute:

```bash
cd packages/db
pnpm prisma generate
```

---

## ✅ Checklist de Execução

- [ ] Executar query de verificação (Passo 1)
- [ ] Adicionar `tenant_id` em `medical_addendums` (Passo 2)
- [ ] Adicionar `tenant_id` em `staff_procedures` (Passo 2)
- [ ] Habilitar RLS em todas as 7 tabelas (Passo 3)
- [ ] Criar políticas de isolamento (Passo 3)
- [ ] Atualizar `schema.prisma` com as mudanças
- [ ] Executar `pnpm prisma generate`
- [ ] Testar isolamento: tentar acessar dados de outro tenant (deve retornar vazio)

---

## 🎯 Conclusão

**Todas as 7 tabelas devem ser configuradas como multi-tenant (por clínica)** para garantir segurança total. Duas tabelas precisam ter `tenant_id` adicionado, e todas precisam de políticas RLS configuradas.

**Risco:** Baixo (não quebra funcionalidades existentes)  
**Tempo estimado:** 30-45 minutos  
**Impacto:** Alto (segurança crítica do sistema)

---

**Próximo passo:** Autorizar a execução dos scripts SQL no Supabase e atualização do schema Prisma.
