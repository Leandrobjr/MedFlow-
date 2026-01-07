# Análise de Implementação - Módulo Financeiro Avançado

## 📋 Sumário Executivo

Este documento analisa as implementações necessárias para expandir o módulo financeiro do MedFlow, incluindo:
1. Fechamento de repasse médico por período (com default diário)
2. Movimento de caixa diário (por recepcionista e caixa geral)
3. Sistema de relatórios (salváveis/impressíveis)
4. Categorização completa de despesas (11 categorias principais)

---

## 🔍 Estado Atual do Sistema

### Estrutura de Dados Existente

#### Models Prisma Atuais:
- **Transaction**: Transações financeiras (entradas/saídas)
  - Campos: `type`, `category`, `amount`, `method`, `description`, `status`
  - Relacionamentos: `patient`, `staff`, `appointment`, `createdBy`
  
- **DailyClosure**: Fechamento diário (simples)
  - Campos: `date`, `totalIncome`, `totalExpense`, `netBalance`
  - Limitação: **Não diferencia por recepcionista**, apenas um fechamento por dia/tenant
  
- **MedicalFee**: Repasse médico
  - Campos: `grossAmount`, `commissionRate`, `feeAmount`, `status`, `paidAt`
  - Limitação: **Não possui agrupamento por período**, apenas status `pending/paid/cancelled`

#### Funcionalidades Atuais:
- ✅ Criação de transações (entrada/saída)
- ✅ Listagem de transações diárias
- ✅ Fechamento de caixa diário (único por tenant)
- ✅ Cálculo automático de repasse médico
- ✅ Listagem de repasses médicos
- ❌ **Falta**: Fechamento por recepcionista
- ❌ **Falta**: Fechamento de repasse por período
- ❌ **Falta**: Sistema de categorias de despesas
- ❌ **Falta**: Relatórios exportáveis/impressíveis

---

## 🎯 Requisitos de Implementação

### 1. Fechamento de Repasse Médico por Período

**Requisito:**
- Permitir fechamento de repasse médico por período (diário como default)
- Agrupar repasses `pending` por médico e período
- Marcar repasses como `paid` após fechamento
- Registrar data de pagamento

**Impacto no Schema:**
- Criar model `MedicalFeePayment` para registrar fechamentos de repasse
- Adicionar campos opcionais de período em `MedicalFee` (ou criar agrupamento)

### 2. Movimento de Caixa Diário (por Recepcionista e Geral)

**Conceito:**
- **Fluxo de Caixa**: Registro de todas as transações (entradas/saídas)
- **Movimento de Caixa**: Fechamento físico do caixa, com contagem de dinheiro, conferência de valores, etc.

**Requisitos:**
- Cada recepcionista deve poder fechar seu próprio caixa diário
- Deve existir um "Caixa Geral" que agrega todos os recepcionistas
- Caixas não fechados ficam em aberto até serem fechados
- Um recepcionista não pode fechar o caixa de outro
- Admin/Owner pode fechar qualquer caixa ou o caixa geral

**Impacto no Schema:**
- Modificar `DailyClosure` para incluir `createdById` (recepcionista)
- Adicionar campo `closureType`: `'RECEPTIONIST' | 'GENERAL'`
- Remover constraint `@@unique([tenantId, date])` e criar `@@unique([tenantId, date, createdById, closureType])`
- Adicionar campos de conferência: `cashCount`, `cardCount`, `pixCount`, etc.

### 3. Sistema de Relatórios

**Requisitos:**
- Relatórios devem ser salváveis (PDF) e impressíveis
- Filtros por período, tipo de procedimento, categoria de despesa, etc.

**Relatórios Necessários:**

#### 3.1. Fechamento de Caixa Diário
- Data do fechamento
- Recepcionista responsável (se aplicável)
- Resumo de entradas/saídas por método de pagamento
- Lista de transações do dia
- Saldo final
- Assinatura do responsável

#### 3.2. Faturamento por Período
- Período selecionado
- Filtros: tipo de procedimento, médico, paciente
- Total faturado
- Quantidade de atendimentos
- Gráficos (opcional)

#### 3.3. Repasse Médico Detalhado
- Período selecionado
- Médico
- Lista de pacientes faturados
- Valor do procedimento (bruto)
- Tipo de repasse (% ou fixo)
- Valor líquido por atendimento
- Valor total a receber
- **Espaço para assinatura** do profissional

#### 3.4. Relatório de Saídas
- Período selecionado
- Filtros por categoria de despesa
- Total por categoria
- Total geral
- Lista detalhada de despesas

### 4. Categorização de Despesas

**Estrutura Hierárquica:**
```
1. Despesas Operacionais (OPEX)
   ├── Serviços Essenciais
   ├── Serviços Profissionais
2. Insumos e Materiais
   ├── Materiais Médicos
   ├── Materiais Administrativos
3. Recursos Humanos
   ├── Folha de Pagamento
   ├── Encargos Trabalhistas
4. Tributos e Obrigações Fiscais
5. Estrutura e Ocupação
6. Tecnologia e Sistemas
7. Marketing e Comercial
8. Financeiro e Bancário
9. Investimentos e CAPEX
10. Despesas Extraordinárias
11. Outras Despesas
```

**Impacto no Schema:**
- Criar model `ExpenseCategory` com estrutura hierárquica
- Adicionar `categoryId` em `Transaction` (quando `type = EXPENSE`)
- Campos: `name`, `parentId`, `code`, `isFixed`, `costCenter`

---

## 📊 Proposta de Estrutura de Dados

### Novos Models Prisma

```prisma
// Categoria de Despesas (hierárquica)
model ExpenseCategory {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @map("tenant_id") @db.Uuid
  parentId      String?  @map("parent_id") @db.Uuid
  name          String
  code          String   // Código único (ex: "OPEX-001", "RH-001")
  description   String?  @db.Text
  isFixed       Boolean  @default(false) @map("is_fixed") // Despesa fixa vs variável
  costCenter    String?  @map("cost_center") // Centro de custo (unidade, especialidade, médico)
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  parent        ExpenseCategory? @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children      ExpenseCategory[] @relation("CategoryHierarchy")
  transactions  Transaction[]
  
  @@unique([tenantId, code])
  @@map("expense_categories")
}

// Fechamento de Repasse Médico
model MedicalFeePayment {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @map("tenant_id") @db.Uuid
  staffId         String   @map("staff_id") @db.Uuid
  periodStart     DateTime @map("period_start") @db.Date
  periodEnd       DateTime @map("period_end") @db.Date
  totalAmount     Decimal  @map("total_amount") @db.Decimal(10, 2)
  feesCount       Int      @map("fees_count")
  paidAt          DateTime @map("paid_at")
  paidBy          String   @map("paid_by") @db.Uuid // User que processou o pagamento
  paymentMethod   String?  @map("payment_method")
  observations    String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  staff           Staff    @relation(fields: [staffId], references: [id])
  paidByUser      User     @relation(fields: [paidBy], references: [id])
  fees            MedicalFee[]
  
  @@map("medical_fee_payments")
}

// Modificações em Models Existentes

model DailyClosure {
  // ... campos existentes ...
  createdById      String   @map("created_by_id") @db.Uuid // Recepcionista que fechou
  closureType      String   @map("closure_type") // 'RECEPTIONIST' | 'GENERAL'
  
  // Campos de conferência física
  cashCount        Decimal? @map("cash_count") @db.Decimal(10, 2)
  cardCount        Decimal? @map("card_count") @db.Decimal(10, 2)
  pixCount         Decimal? @map("pix_count") @db.Decimal(10, 2)
  difference       Decimal? @db.Decimal(10, 2) // Diferença entre contado e calculado
  
  closedBy         User     @relation("ClosureCreatedBy", fields: [createdById], references: [id])
  
  // Remover: @@unique([tenantId, date])
  // Adicionar: @@unique([tenantId, date, createdById, closureType])
  @@unique([tenantId, date, createdById, closureType])
}

model MedicalFee {
  // ... campos existentes ...
  paymentId        String?  @map("payment_id") @db.Uuid // Vínculo com fechamento
  
  payment          MedicalFeePayment? @relation(fields: [paymentId], references: [id])
}

model Transaction {
  // ... campos existentes ...
  categoryId       String?  @map("category_id") @db.Uuid // Para despesas categorizadas
  
  expenseCategory  ExpenseCategory? @relation(fields: [categoryId], references: [id])
}
```

---

## ⚠️ Análise de Impactos e Riscos

### Impactos no Backend

#### 1. **FinanceService**
- **Novos métodos necessários:**
  - `closeMedicalFeePayment()`: Agrupa e fecha repasses por período
  - `getMedicalFeePayments()`: Lista fechamentos de repasse
  - `closeReceptionistBox()`: Fecha caixa de um recepcionista específico
  - `closeGeneralBox()`: Fecha caixa geral (agrega todos os recepcionistas)
  - `getBoxStatus()`: Verifica status de fechamento (por recepcionista e geral)
  - `generateReport()`: Gera relatórios em PDF

- **Modificações necessárias:**
  - `createTransaction()`: Validar se o caixa do recepcionista está fechado (não apenas o geral)
  - `closeDailyBox()`: Suportar fechamento por recepcionista ou geral
  - `getDailyTransactions()`: Filtrar por recepcionista quando necessário

#### 2. **FinanceController**
- **Novos endpoints:**
  - `POST /finance/medical-fees/close`: Fechar repasse por período
  - `GET /finance/medical-fees/payments`: Listar fechamentos de repasse
  - `POST /finance/boxes/receptionist/close`: Fechar caixa de recepcionista
  - `POST /finance/boxes/general/close`: Fechar caixa geral
  - `GET /finance/boxes/status`: Status de fechamento
  - `GET /finance/reports/:type`: Gerar relatórios

#### 3. **Autorização e Permissões**
- **RECEPTIONIST**: Pode fechar apenas seu próprio caixa
- **ADMIN/OWNER**: Pode fechar qualquer caixa e o caixa geral
- **DOCTOR**: Pode visualizar seus próprios repasses e relatórios

### Impactos no Frontend

#### 1. **Página Financeiro (`financeiro/page.tsx`)**
- Adicionar abas: "Caixa Diário", "Repasses", "Relatórios"
- Filtros por recepcionista no caixa diário
- Modal de fechamento de caixa por recepcionista
- Modal de fechamento de repasse por período
- Seção de relatórios com filtros e botão de exportar/imprimir

#### 2. **Novos Componentes**
- `ReceptionistBoxClosure`: Modal para fechar caixa de recepcionista
- `MedicalFeePaymentModal`: Modal para fechar repasse por período
- `ReportGenerator`: Componente para gerar relatórios com filtros
- `ExpenseCategorySelector`: Select hierárquico de categorias

#### 3. **Serviços Frontend**
- `finance-service.ts`: Adicionar métodos para novos endpoints
- `report-service.ts`: Novo serviço para geração de relatórios

### Riscos Identificados

#### 🔴 **Alto Risco**

1. **Migração de Dados**
   - `DailyClosure` existente não tem `createdById` nem `closureType`
   - **Solução**: Criar migration que:
     - Adiciona campos novos como nullable
     - Define valores padrão para registros existentes
     - Depois torna campos obrigatórios

2. **Constraint Única em DailyClosure**
   - Mudança de `@@unique([tenantId, date])` para `@@unique([tenantId, date, createdById, closureType])`
   - **Solução**: 
     - Remover constraint antiga
     - Adicionar nova constraint
     - Validar que não há duplicatas antes da migration

3. **Validação de Fechamento de Caixa**
   - Lógica atual impede transações se `DailyClosure` existe para o dia
   - Nova lógica deve verificar se o caixa do recepcionista específico está fechado
   - **Solução**: Refatorar `createTransaction()` para verificar fechamento por recepcionista

#### 🟡 **Médio Risco**

4. **Geração de Relatórios PDF**
   - Requer biblioteca de geração de PDF (ex: `pdfkit`, `puppeteer`)
   - **Solução**: Usar `@react-pdf/renderer` no frontend ou `pdfkit` no backend

5. **Performance em Relatórios**
   - Relatórios podem consultar muitos dados
   - **Solução**: Implementar paginação e cache quando possível

6. **Categorização de Despesas**
   - Migração de `category` (string) para `categoryId` (UUID)
   - **Solução**: Criar script de migração que mapeia categorias antigas para novas

#### 🟢 **Baixo Risco**

7. **UI/UX Complexa**
   - Muitos filtros e opções podem confundir usuário
   - **Solução**: Interface progressiva, com valores padrão sensatos

---

## 🗺️ Plano de Implementação

### Fase 1: Estrutura de Dados (Backend)
1. Criar migrations para novos models
2. Modificar `DailyClosure` e `MedicalFee`
3. Criar seed de categorias de despesas
4. Atualizar Prisma Client

### Fase 2: Backend - Fechamento de Caixa por Recepcionista
1. Modificar `FinanceService.closeDailyBox()`
2. Criar `closeReceptionistBox()` e `closeGeneralBox()`
3. Atualizar validação em `createTransaction()`
4. Criar endpoints no controller
5. Testes unitários

### Fase 3: Backend - Fechamento de Repasse por Período
1. Criar `MedicalFeePaymentService`
2. Implementar agrupamento e fechamento
3. Criar endpoints
4. Testes

### Fase 4: Backend - Categorização de Despesas
1. Criar `ExpenseCategoryService`
2. Endpoints CRUD de categorias
3. Atualizar `createTransaction()` para usar `categoryId`
4. Script de migração de dados antigos

### Fase 5: Backend - Sistema de Relatórios
1. Criar `ReportService`
2. Implementar geração de PDF
3. Endpoints de relatórios
4. Testes

### Fase 6: Frontend - UI de Fechamento de Caixa
1. Atualizar `financeiro/page.tsx`
2. Criar componentes de fechamento por recepcionista
3. Integração com backend
4. Testes E2E

### Fase 7: Frontend - UI de Repasse por Período
1. Criar modal de fechamento de repasse
2. Filtros de período
3. Integração com backend

### Fase 8: Frontend - Sistema de Relatórios
1. Criar página/seção de relatórios
2. Componentes de filtros
3. Integração com geração de PDF
4. Botões de salvar/imprimir

### Fase 9: Frontend - Categorização de Despesas
1. Criar seletor hierárquico de categorias
2. Atualizar formulário de despesas
3. Validações

### Fase 10: Testes e Ajustes Finais
1. Testes de integração
2. Ajustes de performance
3. Documentação
4. Deploy

---

## 📝 Considerações Técnicas

### Bibliotecas Sugeridas

**Backend:**
- `pdfkit` ou `puppeteer`: Geração de PDF
- `date-fns`: Manipulação de datas

**Frontend:**
- `@react-pdf/renderer`: Geração de PDF no cliente (alternativa)
- `react-select`: Select hierárquico de categorias
- `react-datepicker`: Seleção de períodos

### Performance

- **Índices no Banco:**
  - `DailyClosure`: `[tenantId, date, createdById, closureType]`
  - `MedicalFeePayment`: `[tenantId, staffId, periodStart, periodEnd]`
  - `Transaction`: `[tenantId, createdAt, categoryId]`

- **Cache:**
  - Cachear categorias de despesas (raramente mudam)
  - Cachear status de fechamento de caixa (atualizar após fechamento)

### Segurança

- Validar que recepcionista só fecha seu próprio caixa
- Validar que períodos de repasse não se sobrepõem
- Sanitizar dados de relatórios antes de gerar PDF
- Rate limiting em endpoints de relatórios

---

## ✅ Checklist de Validação

- [ ] Migrations criadas e testadas
- [ ] Backend implementado e testado
- [ ] Frontend implementado e testado
- [ ] Relatórios gerando PDF corretamente
- [ ] Fechamento de caixa por recepcionista funcionando
- [ ] Fechamento de repasse por período funcionando
- [ ] Categorização de despesas funcionando
- [ ] Testes de integração passando
- [ ] Documentação atualizada
- [ ] Performance validada
- [ ] Segurança validada

---

## 🚀 Próximos Passos

1. **Revisar este documento** com o time
2. **Aprovar estrutura de dados** proposta
3. **Iniciar Fase 1** (Estrutura de Dados)
4. **Testar migrations** em ambiente de desenvolvimento
5. **Iterar** conforme necessário

---

**Data de Criação:** 2026-01-06  
**Última Atualização:** 2026-01-06  
**Autor:** Sistema de Análise Automatizada
