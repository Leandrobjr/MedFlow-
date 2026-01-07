# ANÁLISE: CAIXA DIÁRIO POR RECEPCIONISTA E CAIXA GERAL

## 🔍 PROBLEMA IDENTIFICADO

### ❌ **O QUE NÃO ESTÁ IMPLEMENTADO:**

1. **Rastreamento de Quem Criou a Transação**
   - ❌ Modelo `Transaction` **NÃO** tem campo `createdById` ou `createdBy`
   - ❌ Não é possível saber qual recepcionista/admin criou cada faturamento
   - ❌ Não há auditoria de quem fez cada lançamento

2. **Caixa Diário por Recepcionista**
   - ❌ Não existe conceito de "caixa individual por recepcionista"
   - ❌ O fechamento de caixa (`DailyClosure`) é único por `tenantId + date`
   - ❌ Não há diferenciação entre transações de diferentes recepcionistas

3. **Filtros e Relatórios por Recepcionista**
   - ❌ `getDailyTransactions` retorna TODAS as transações do dia (sem filtro por recepcionista)
   - ❌ Não há endpoint para buscar transações de um recepcionista específico
   - ❌ Frontend não mostra quem criou cada transação

---

## 📊 SITUAÇÃO ATUAL

### **Modelo de Dados Atual:**

```prisma
model Transaction {
  id            String   @id @default(uuid())
  tenantId      String   @map("tenant_id")
  patientId     String?  @map("patient_id")
  staffId       String?  @map("staff_id")  // ⚠️ Este é o PROFISSIONAL que atendeu, não quem fez o faturamento
  appointmentId String?  @unique @map("appointment_id")
  
  type          String
  category      String
  amount        Decimal
  method        String?
  description   String?
  status        String   @default("completed")
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // ❌ FALTA: createdById (quem criou/faturou)
}
```

### **Fluxo Atual de Faturamento:**

1. Recepcionista/Admin cria transação via `POST /finance/transactions`
2. Sistema salva transação com `tenantId`, mas **NÃO** salva quem criou
3. `getDailyTransactions` retorna todas as transações do dia do tenant
4. `closeDailyBox` calcula totais de **TODAS** as transações (sem diferenciar recepcionista)

### **Problemas Concretos:**

1. **Impossível saber quem faturou:**
   - Se dois recepcionistas faturaram no mesmo dia, não há como diferenciar
   - Não há auditoria de responsabilidade

2. **Caixa único:**
   - Não há como fechar caixa individual por recepcionista
   - Não há como ver totais por recepcionista

3. **Relatórios limitados:**
   - Não é possível gerar relatório de faturamento por recepcionista
   - Não é possível identificar discrepâncias por recepcionista

---

## ✅ PROPOSTA DE SOLUÇÃO

### **FASE 1: Rastreamento de Quem Criou (OBRIGATÓRIO)**

#### **1.1. Adicionar Campo `createdById` em Transaction**

**Arquivo:** `packages/db/prisma/schema.prisma`

```prisma
model Transaction {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @map("tenant_id") @db.Uuid
  patientId     String?  @map("patient_id") @db.Uuid
  staffId       String?  @map("staff_id") @db.Uuid  // Profissional que atendeu
  appointmentId String?  @unique @map("appointment_id") @db.Uuid
  createdById   String?  @map("created_by_id") @db.Uuid  // ✅ NOVO: Quem criou/faturou
  
  type          String
  category      String
  amount        Decimal  @db.Decimal(10, 2)
  method        String?
  description   String?
  status        String   @default("completed")
  
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  tenant        Tenant      @relation(fields: [tenantId], references: [id])
  patient       Patient?    @relation(fields: [patientId], references: [id])
  staff         Staff?      @relation(fields: [staffId], references: [id])
  appointment   Appointment? @relation(fields: [appointmentId], references: [id])
  createdBy     User?       @relation("TransactionCreatedBy", fields: [createdById], references: [id])  // ✅ NOVO
  medicalFee    MedicalFee?

  @@map("transactions")
}
```

**Arquivo:** `packages/db/prisma/schema.prisma` (adicionar relação em User)

```prisma
model User {
  // ... campos existentes
  createdTransactions Transaction[] @relation("TransactionCreatedBy")  // ✅ NOVO
}
```

#### **1.2. Atualizar DTO para Aceitar `createdById`**

**Arquivo:** `apps/api/src/finance/dto/finance.dto.ts`

```typescript
export class CreateTransactionDto {
  // ... campos existentes
  
  @IsUUID()
  @IsOptional()
  createdById?: string;  // ✅ NOVO (opcional, será preenchido automaticamente se não fornecido)
}
```

#### **1.3. Atualizar Service para Salvar `createdById`**

**Arquivo:** `apps/api/src/finance/finance.service.ts`

```typescript
async createTransaction(tenantId: string, dto: CreateTransactionDto, userId?: string) {
  // ... validações existentes

  const transaction = await this.prisma.client.transaction.create({
    data: {
      ...dto,
      tenantId,
      createdById: dto.createdById || userId,  // ✅ Usar userId do request se não fornecido
    },
    include: {
      patient: { select: { name: true } },
      appointment: true,
      createdBy: { select: { id: true, name: true, email: true } },  // ✅ NOVO
    },
  });

  // ... resto do código
}
```

#### **1.4. Atualizar Controller para Passar `userId`**

**Arquivo:** `apps/api/src/finance/finance.controller.ts`

```typescript
@Post('transactions')
@Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
createTransaction(@Req() req: any, @Body() dto: CreateTransactionDto) {
  return this.financeService.createTransaction(
    req.tenantId, 
    dto, 
    req.user?.id  // ✅ Passar userId do usuário logado
  );
}
```

#### **1.5. Atualizar `getDailyTransactions` para Incluir `createdBy`**

**Arquivo:** `apps/api/src/finance/finance.service.ts`

```typescript
async getDailyTransactions(tenantId: string, date?: string, createdById?: string) {
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const where: any = {
    tenantId,
    createdAt: {
      gte: startOfDay,
      lte: endOfDay,
    },
  };

  // ✅ NOVO: Filtrar por recepcionista se fornecido
  if (createdById) {
    where.createdById = createdById;
  }

  return this.prisma.client.transaction.findMany({
    where,
    include: {
      patient: { select: { name: true } },
      appointment: true,
      createdBy: { select: { id: true, name: true, email: true } },  // ✅ NOVO
    },
    orderBy: { createdAt: 'desc' },
  });
}
```

**Arquivo:** `apps/api/src/finance/finance.controller.ts`

```typescript
@Get('transactions')
@Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
getDailyTransactions(
  @Req() req: any, 
  @Query('date') date?: string,
  @Query('createdById') createdById?: string  // ✅ NOVO: Filtrar por recepcionista
) {
  return this.financeService.getDailyTransactions(req.tenantId, date, createdById);
}
```

---

### **FASE 2: Endpoint para Totais por Recepcionista (OPCIONAL)**

#### **2.1. Criar Método para Totais por Recepcionista**

**Arquivo:** `apps/api/src/finance/finance.service.ts`

```typescript
async getDailyTransactionsByReceptionist(tenantId: string, date?: string) {
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Buscar todas as transações do dia
  const transactions = await this.prisma.client.transaction.findMany({
    where: {
      tenantId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: 'completed',
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  // Agrupar por recepcionista
  const byReceptionist = new Map<string, {
    receptionist: { id: string; name: string; email: string };
    totalIncome: number;
    totalExpense: number;
    transactions: any[];
  }>();

  transactions.forEach((t: any) => {
    const receptionistId = t.createdById || 'unknown';
    const receptionistName = t.createdBy?.name || 'Não identificado';
    const receptionistEmail = t.createdBy?.email || '';

    if (!byReceptionist.has(receptionistId)) {
      byReceptionist.set(receptionistId, {
        receptionist: { id: receptionistId, name: receptionistName, email: receptionistEmail },
        totalIncome: 0,
        totalExpense: 0,
        transactions: [],
      });
    }

    const group = byReceptionist.get(receptionistId)!;
    group.transactions.push(t);

    if (t.type === TransactionType.INCOME) {
      group.totalIncome += Number(t.amount);
    } else {
      group.totalExpense += Number(t.amount);
    }
  });

  return Array.from(byReceptionist.values()).map(group => ({
    ...group,
    netBalance: group.totalIncome - group.totalExpense,
  }));
}
```

#### **2.2. Criar Endpoint**

**Arquivo:** `apps/api/src/finance/finance.controller.ts`

```typescript
@Get('transactions/by-receptionist')
@Roles(UserRole.ADMIN, UserRole.OWNER)
getDailyTransactionsByReceptionist(
  @Req() req: any,
  @Query('date') date?: string
) {
  return this.financeService.getDailyTransactionsByReceptionist(req.tenantId, date);
}
```

---

### **FASE 3: Atualizar Frontend (OPCIONAL)**

#### **3.1. Mostrar Quem Criou na Listagem**

**Arquivo:** `apps/web/src/app/dashboard/financeiro/page.tsx`

```typescript
// Adicionar coluna na tabela
<th className="px-6 py-4">Recepcionista</th>

// Na renderização
<td className="px-6 py-4 text-sm text-gray-600">
  {t.createdBy?.name || 'Não identificado'}
</td>
```

#### **3.2. Adicionar Filtro por Recepcionista**

```typescript
const [filterByReceptionist, setFilterByReceptionist] = useState<string>('');

// No fetchFinanceData
const data = await financeService.getTransactions(
  selectedDate,
  filterByReceptionist || undefined
);
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### **FASE 1: Rastreamento (OBRIGATÓRIO)** ✅ IMPLEMENTADO
- [x] Adicionar campo `createdById` em `Transaction` (schema.prisma)
- [x] Adicionar relação `createdBy` em `Transaction`
- [x] Adicionar relação `createdTransactions` em `User`
- [x] Criar migration do Prisma (`20260106132535_add_created_by_to_transactions`)
- [x] Atualizar `createTransaction` para salvar `createdById` do usuário logado
- [x] Atualizar `getDailyTransactions` para incluir `createdBy` no include
- [x] Adicionar filtro opcional `createdById` em `getDailyTransactions`
- [x] Atualizar controller para passar `req.user.id`
- [ ] Testar criação de transação (verificar se `createdById` é salvo)
- [ ] Testar listagem (verificar se `createdBy` é retornado)

### **FASE 2: Totais por Recepcionista (OPCIONAL)**
- [ ] Criar método `getDailyTransactionsByReceptionist`
- [ ] Criar endpoint `GET /finance/transactions/by-receptionist`
- [ ] Testar agrupamento por recepcionista
- [ ] Testar cálculos de totais

### **FASE 3: Frontend (OPCIONAL)**
- [ ] Atualizar interface `Transaction` para incluir `createdBy`
- [ ] Adicionar coluna "Recepcionista" na tabela
- [ ] Adicionar filtro por recepcionista
- [ ] Criar componente de resumo por recepcionista (se necessário)

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

### **1. Compatibilidade com Dados Existentes**
- Transações antigas terão `createdById = null`
- Frontend deve tratar `createdBy` como opcional
- Exibir "Não identificado" para transações antigas

### **2. Permissões**
- **ADMIN/OWNER**: Podem ver todas as transações e filtrar por recepcionista
- **RECEPTIONIST**: Podem ver apenas suas próprias transações (se implementar filtro automático)

### **3. Caixa Diário**
- **Atual**: Fechamento único por tenant/data (todos os recepcionistas juntos)
- **Futuro (se necessário)**: Permitir fechamento individual por recepcionista
  - Isso exigiria mudança no modelo `DailyClosure` (adicionar `receptionistId`)

### **4. Migração de Dados**
- Transações existentes não terão `createdById`
- Se necessário rastrear retroativamente, seria necessário:
  - Analisar logs (se existirem)
  - Ou marcar como "Não identificado"

---

## 🎯 RECOMENDAÇÃO

### **IMPLEMENTAR AGORA (FASE 1):**
✅ **OBRIGATÓRIO** para rastreabilidade e auditoria
- Baixo risco
- Alto valor (auditoria, responsabilidade)
- Não quebra funcionalidades existentes

### **IMPLEMENTAR DEPOIS (FASE 2 e 3):**
⏸️ **OPCIONAL** dependendo da necessidade do negócio
- Fase 2: Útil se houver necessidade de relatórios por recepcionista
- Fase 3: Melhora UX, mas não é crítico

---

## 📝 PRÓXIMOS PASSOS

1. **Implementar FASE 1** (rastreamento de `createdById`)
2. **Testar** criação e listagem de transações
3. **Atualizar ROTEIRO_FATURAMENTO.md** com a informação de que `createdById` será salvo automaticamente
4. **Decidir** se FASE 2 e 3 são necessárias para o MVP

---

**Última atualização:** 05/01/2026
