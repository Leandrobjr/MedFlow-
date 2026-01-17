# Plano de Implementação - Módulo Financeiro Avançado (REVISADO)

## 📋 Alterações no Escopo

### Correções Aplicadas:

1. **Caixa Geral → Caixa Administrativo**
   - ❌ **Antes**: "Caixa Geral" que agrega todos os recepcionistas
   - ✅ **Agora**: "Caixa Administrativo" é o caixa diário do administrador (não mistura os caixas da recepção)

2. **Saldo Inicial e Final**
   - ✅ **Adicionado**: Todos os caixas devem ter **saldo inicial** e **saldo final** no fechamento
   - Essencial para conferência física e controle financeiro

---

## 🎯 Estrutura de Caixas

### Tipos de Caixa:

1. **Caixa de Recepcionista** (`closureType: 'RECEPTIONIST'`)
   - Cada recepcionista tem seu próprio caixa diário
   - Fechamento independente
   - Saldo inicial e final obrigatórios

2. **Caixa Administrativo** (`closureType: 'ADMIN'`)
   - Caixa diário do administrador
   - **Não mistura** os caixas da recepção
   - Saldo inicial e final obrigatórios

### Regras de Fechamento:

- **RECEPTIONIST**: Pode fechar apenas seu próprio caixa
- **ADMIN/OWNER**: Pode fechar qualquer caixa de recepcionista e o caixa administrativo
- Caixas não fechados ficam em aberto até serem fechados
- Cada caixa pode ter múltiplos fechamentos no mesmo dia (se necessário reabrir)

---

## 📊 Schema Atualizado

### Model DailyClosure

```prisma
model DailyClosure {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @map("tenant_id") @db.Uuid
  createdById     String   @map("created_by_id") @db.Uuid // Recepcionista ou Admin
  closureType     String   @map("closure_type") // 'RECEPTIONIST' | 'ADMIN'
  
  date            DateTime @db.Date
  initialBalance  Decimal  @map("initial_balance") @db.Decimal(10, 2) // OBRIGATÓRIO
  finalBalance    Decimal  @map("final_balance") @db.Decimal(10, 2) // OBRIGATÓRIO
  
  totalIncome     Decimal  @map("total_income") @db.Decimal(10, 2)
  totalExpense    Decimal  @map("total_expense") @db.Decimal(10, 2)
  netBalance      Decimal  @map("net_balance") @db.Decimal(10, 2)
  
  // Campos de conferência física
  cashCount       Decimal? @map("cash_count") @db.Decimal(10, 2)
  cardCount       Decimal? @map("card_count") @db.Decimal(10, 2)
  pixCount        Decimal? @map("pix_count") @db.Decimal(10, 2)
  difference      Decimal? @db.Decimal(10, 2) // Diferença entre contado e calculado
  
  observations    String?  @db.Text
  status          String   @default("closed")
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")
  
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  closedBy         User     @relation("ClosureCreatedBy", fields: [createdById], references: [id])
  
  @@unique([tenantId, date, createdById, closureType])
  @@map("daily_closures")
}
```

---

## 🗺️ Plano de Implementação Revisado

### **Fase 1: Estrutura de Dados (Backend)**
**Duração estimada:** 2-3 horas

1. ✅ Criar migration para modificar `DailyClosure`:
   - Adicionar `createdById` (nullable inicialmente, depois obrigatório)
   - Adicionar `closureType` (nullable inicialmente, depois obrigatório)
   - Adicionar `initialBalance` e `finalBalance` (obrigatórios)
   - Adicionar campos de conferência (`cashCount`, `cardCount`, `pixCount`, `difference`)
   - Remover constraint `@@unique([tenantId, date])`
   - Adicionar constraint `@@unique([tenantId, date, createdById, closureType])`
   - Migrar dados existentes (definir valores padrão)

2. ✅ Criar migration para `ExpenseCategory`:
   - Model completo com hierarquia
   - Seed com 11 categorias principais

3. ✅ Criar migration para `MedicalFeePayment`:
   - Model para fechamento de repasse por período

4. ✅ Atualizar `MedicalFee`:
   - Adicionar `paymentId` (nullable)

5. ✅ Atualizar `Transaction`:
   - Adicionar `categoryId` (nullable, para despesas)

6. ✅ Executar migrations e gerar Prisma Client

---

### **Fase 2: Backend - Fechamento de Caixa**
**Duração estimada:** 4-5 horas

1. ✅ Modificar `FinanceService`:
   - `closeReceptionistBox(tenantId, userId, date, initialBalance, finalBalance, ...)`
   - `closeAdminBox(tenantId, userId, date, initialBalance, finalBalance, ...)`
   - `getBoxStatus(tenantId, date, userId?, closureType?)`
   - Atualizar `createTransaction()` para validar fechamento por recepcionista/admin

2. ✅ Criar DTOs:
   - `CloseReceptionistBoxDto`
   - `CloseAdminBoxDto`
   - Ambos com `initialBalance` e `finalBalance` obrigatórios

3. ✅ Atualizar `FinanceController`:
   - `POST /finance/boxes/receptionist/close`
   - `POST /finance/boxes/admin/close`
   - `GET /finance/boxes/status`

4. ✅ Testes unitários

---

### **Fase 3: Backend - Fechamento de Repasse por Período**
**Duração estimada:** 3-4 horas

1. ✅ Criar `MedicalFeePaymentService`:
   - `closeMedicalFeePayment(tenantId, staffId, periodStart, periodEnd, ...)`
   - `getMedicalFeePayments(tenantId, staffId?, startDate?, endDate?)`
   - Agrupar repasses `pending` por médico e período
   - Marcar repasses como `paid` após fechamento

2. ✅ Criar DTOs:
   - `CloseMedicalFeePaymentDto`

3. ✅ Atualizar `FinanceController`:
   - `POST /finance/medical-fees/close`
   - `GET /finance/medical-fees/payments`

4. ✅ Testes

---

### **Fase 4: Backend - Categorização de Despesas**
**Duração estimada:** 3-4 horas

1. ✅ Criar `ExpenseCategoryService`:
   - CRUD completo
   - Suporte a hierarquia (parent/children)
   - Seed de categorias padrão

2. ✅ Criar `ExpenseCategoryController`:
   - `GET /finance/expense-categories`
   - `POST /finance/expense-categories`
   - `PUT /finance/expense-categories/:id`
   - `DELETE /finance/expense-categories/:id`

3. ✅ Atualizar `createTransaction()`:
   - Aceitar `categoryId` quando `type = EXPENSE`
   - Validar se categoria existe e pertence ao tenant

4. ✅ Script de migração:
   - Mapear categorias antigas (strings) para novas categorias

---

### **Fase 5: Backend - Sistema de Relatórios**
**Duração estimada:** 6-8 horas

1. ✅ Instalar biblioteca de PDF:
   - `pdfkit` ou `puppeteer`

2. ✅ Criar `ReportService`:
   - `generateDailyClosureReport(closureId)`
   - `generateBillingReport(tenantId, filters)`
   - `generateMedicalFeeReport(paymentId)`
   - `generateExpenseReport(tenantId, filters)`

3. ✅ Atualizar `FinanceController`:
   - `GET /finance/reports/daily-closure/:closureId`
   - `GET /finance/reports/billing`
   - `GET /finance/reports/medical-fee/:paymentId`
   - `GET /finance/reports/expenses`

4. ✅ Testes

---

### **Fase 6: Frontend - UI de Fechamento de Caixa**
**Duração estimada:** 5-6 horas

1. ✅ Atualizar `financeiro/page.tsx`:
   - Adicionar filtro por recepcionista
   - Mostrar status de fechamento por recepcionista e admin
   - Botões de fechamento diferenciados

2. ✅ Criar componentes:
   - `ReceptionistBoxClosureModal`: Modal com campos de saldo inicial e final
   - `AdminBoxClosureModal`: Modal com campos de saldo inicial e final
   - `BoxStatusCard`: Card mostrando status de fechamento

3. ✅ Atualizar `finance-service.ts`:
   - Métodos para novos endpoints

4. ✅ Testes E2E

---

### **Fase 7: Frontend - UI de Repasse por Período**
**Duração estimada:** 4-5 horas

1. ✅ Criar `MedicalFeePaymentModal`:
   - Seleção de período (com default diário)
   - Seleção de médico
   - Visualização de repasses agrupados
   - Botão de fechamento

2. ✅ Atualizar página de repasses:
   - Filtros de período
   - Lista de fechamentos realizados

3. ✅ Integração com backend

---

### **Fase 8: Frontend - Sistema de Relatórios**
**Duração estimada:** 6-8 horas

1. ✅ Criar página/seção de relatórios:
   - `dashboard/financeiro/relatorios/page.tsx`

2. ✅ Componentes de filtros:
   - Filtro de período
   - Filtro por tipo de procedimento
   - Filtro por categoria de despesa
   - Filtro por médico

3. ✅ Integração com geração de PDF:
   - Botão "Gerar PDF"
   - Botão "Imprimir"
   - Download automático

4. ✅ Visualização prévia (opcional)

---

### **Fase 9: Frontend - Categorização de Despesas**
**Duração estimada:** 4-5 horas

1. ✅ Criar seletor hierárquico:
   - `ExpenseCategorySelector` (usando react-select ou similar)
   - Suporte a busca e hierarquia

2. ✅ Atualizar formulário de despesas:
   - Substituir select simples por seletor hierárquico
   - Validação

3. ✅ Página de gerenciamento de categorias (opcional, para admin)

---

### **Fase 10: Testes e Ajustes Finais**
**Duração estimada:** 4-6 horas

1. ✅ Testes de integração:
   - Fechamento de caixa por recepcionista
   - Fechamento de caixa administrativo
   - Fechamento de repasse por período
   - Geração de relatórios
   - Categorização de despesas

2. ✅ Ajustes de performance:
   - Índices no banco
   - Cache quando aplicável

3. ✅ Documentação:
   - Atualizar README
   - Documentar endpoints
   - Guia de uso

4. ✅ Deploy

---

## ⚠️ Pontos de Atenção

### 1. Migração de Dados
- `DailyClosure` existente não tem `createdById`, `closureType`, `initialBalance`, `finalBalance`
- **Solução**: Migration em etapas:
  1. Adicionar campos como nullable
  2. Popular com valores padrão (ex: `createdById` = primeiro admin, `closureType` = 'ADMIN', `initialBalance` = 0, `finalBalance` = `netBalance`)
  3. Tornar campos obrigatórios

### 2. Validação de Saldos
- `finalBalance` deve ser calculado: `initialBalance + totalIncome - totalExpense`
- Permitir diferença (para conferência física)
- Validar que saldos são números positivos

### 3. Permissões
- RECEPTIONIST só pode fechar seu próprio caixa
- ADMIN/OWNER pode fechar qualquer caixa
- Validar no backend (não confiar apenas no frontend)

---

## ✅ Checklist de Validação

- [ ] Migrations criadas e testadas
- [ ] Saldo inicial e final implementados em todos os fechamentos
- [ ] Caixa administrativo separado dos caixas de recepcionista
- [ ] Backend implementado e testado
- [ ] Frontend implementado e testado
- [ ] Relatórios gerando PDF corretamente
- [ ] Fechamento de caixa por recepcionista funcionando
- [ ] Fechamento de caixa administrativo funcionando
- [ ] Fechamento de repasse por período funcionando
- [ ] Categorização de despesas funcionando
- [ ] Testes de integração passando
- [ ] Documentação atualizada
- [ ] Performance validada
- [ ] Segurança validada

---

## 🚀 Próximos Passos

1. ✅ **Commit realizado** das alterações anteriores (fluxo de atendimento)
2. ✅ **Documento revisado** com correções aplicadas
3. ⏭️ **Aguardar aprovação** para iniciar Fase 1
4. ⏭️ **Iniciar implementação** após aprovação

---

**Data de Revisão:** 2026-01-07  
**Status:** Aguardando aprovação para iniciar implementação
