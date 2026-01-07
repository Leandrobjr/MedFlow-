# ROTEIRO DE FATURAMENTO - RECEPÇÃO/ADMIN/OWNER

## 📋 SITUAÇÃO ATUAL

### ✅ O QUE JÁ ESTÁ IMPLEMENTADO

#### **Backend (API)**
1. **Módulo Financeiro** (`apps/api/src/finance/`)
   - ✅ Endpoint `POST /finance/transactions` para criar transações
   - ✅ Endpoint `GET /finance/transactions` para listar transações do dia
   - ✅ Proteção de rota: apenas `ADMIN`, `OWNER`, `RECEPTIONIST` podem criar transações
   - ✅ Integração automática: quando uma transação é criada com `appointmentId` e `type: INCOME`, o status do agendamento muda automaticamente para `confirmed` (AGUARDANDO)

2. **Modelo de Dados**
   - ✅ Tabela `transactions` com campo `appointmentId` (único, opcional)
   - ✅ Relação `Transaction.appointment` → `Appointment`
   - ✅ Campo `type` (INCOME/EXPENSE), `category`, `amount`, `method`, `description`
   - ✅ Campo `staffId` para vincular ao profissional (necessário para cálculo de repasse)

#### **Frontend**
1. **Página Financeiro** (`apps/web/src/app/dashboard/financeiro/page.tsx`)
   - ✅ Interface para criar transações manualmente
   - ✅ Formulário permite preencher `appointmentId` manualmente
   - ✅ Listagem de transações do dia
   - ✅ Cálculo de totais (entradas, saídas, saldo)

### ❌ O QUE FALTA IMPLEMENTAR

1. **Botão "Faturar" na Página de Agenda**
   - Não existe botão para faturar diretamente de um agendamento
   - Usuário precisa ir até a página Financeiro e preencher manualmente

2. **Modal de Faturamento Integrado**
   - Não há modal que pré-preenche dados do agendamento
   - Não busca automaticamente o valor do procedimento (`Procedure.grossAmount`)
   - Não valida se já existe transação para o agendamento

3. **Integração com Valor do Procedimento**
   - O campo `type` do `Appointment` armazena o nome do procedimento (string)
   - Não há relação direta `Appointment.procedureId` → `Procedure.id`
   - Valor precisa ser buscado manualmente ou através do `type`

---

## 🎯 PASSO A PASSO ATUAL (MANUAL)

### **Como fazer faturamento hoje:**

1. **Acessar Página Financeiro**
   - Navegar para `/dashboard/financeiro`
   - Clicar em "Nova Transação" (botão "+")

2. **Preencher Formulário Manualmente**
   - Tipo: `INCOME` (Entrada)
   - Categoria: Selecionar (ex: "Consulta", "Exame", "Procedimento")
   - Valor: Preencher manualmente
   - Método de Pagamento: Selecionar (Dinheiro, Cartão, PIX, etc.)
   - Paciente: Selecionar da lista (opcional)
   - **Appointment ID**: Preencher manualmente (UUID do agendamento)
   - Profissional: Selecionar da lista (opcional, necessário para repasse)

3. **Salvar Transação**
   - Clicar em "Salvar"
   - Sistema automaticamente atualiza status do agendamento para `confirmed` (AGUARDANDO)

### **Problemas do Fluxo Atual:**
- ❌ Muito manual e propenso a erros
- ❌ Não há validação se já foi faturado
- ❌ Valor precisa ser digitado manualmente
- ❌ Não há acesso direto da agenda

---

## 🚀 ROTEIRO DE IMPLEMENTAÇÃO

### **FASE 1: Backend - Validações e Melhorias**

#### **1.1. Endpoint para Verificar Status de Faturamento**
**Arquivo:** `apps/api/src/finance/finance.controller.ts`

```typescript
@Get('transactions/check-appointment/:appointmentId')
@Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
async checkAppointmentBilling(@Param('appointmentId') appointmentId: string) {
  return this.financeService.checkAppointmentBilling(appointmentId);
}
```

**Arquivo:** `apps/api/src/finance/finance.service.ts`

```typescript
async checkAppointmentBilling(appointmentId: string) {
  // Verificar se já existe transação para este appointment
  const existingTransaction = await this.prisma.client.transaction.findUnique({
    where: { appointmentId },
    select: { id: true, amount: true, createdAt: true, method: true },
  });

  // Buscar dados do appointment
  const appointment = await this.prisma.client.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { select: { id: true, name: true } },
      staff: { select: { id: true, name: true } },
    },
  });

  if (!appointment) {
    throw new NotFoundException('Agendamento não encontrado');
  }

  // Tentar buscar valor do procedimento através do campo 'type'
  // Nota: Como não há relação direta, precisamos buscar por nome
  let procedureAmount = null;
  if (appointment.type) {
    const procedure = await this.prisma.client.procedure.findFirst({
      where: {
        tenantId: appointment.tenantId,
        name: { equals: appointment.type, mode: 'insensitive' },
      },
      select: { grossAmount: true },
    });
    if (procedure) {
      procedureAmount = Number(procedure.grossAmount);
    }
  }

  return {
    appointment: {
      id: appointment.id,
      patient: appointment.patient,
      staff: appointment.staff,
      type: appointment.type,
      startTime: appointment.startTime,
      status: appointment.status,
    },
    alreadyBilled: !!existingTransaction,
    existingTransaction: existingTransaction || null,
    suggestedAmount: procedureAmount,
  };
}
```

#### **1.2. Validação ao Criar Transação**
**Arquivo:** `apps/api/src/finance/finance.service.ts` (método `createTransaction`)

```typescript
// Adicionar no início do método createTransaction:
if (dto.appointmentId) {
  // Verificar se já existe transação para este appointment
  const existing = await this.prisma.client.transaction.findUnique({
    where: { appointmentId: dto.appointmentId },
  });

  if (existing) {
    throw new BadRequestException('Este agendamento já foi faturado.');
  }

  // Verificar se o appointment existe e pertence ao tenant
  const appointment = await this.prisma.client.appointment.findUnique({
    where: { id: dto.appointmentId },
  });

  if (!appointment || appointment.tenantId !== tenantId) {
    throw new NotFoundException('Agendamento não encontrado ou não pertence a este tenant.');
  }

  // Se não foi passado staffId, usar o do appointment
  if (!dto.staffId && appointment.staffId) {
    dto.staffId = appointment.staffId;
  }

  // Se não foi passado patientId, usar o do appointment
  if (!dto.patientId && appointment.patientId) {
    dto.patientId = appointment.patientId;
  }
}
```

---

### **FASE 2: Frontend - Botão e Modal de Faturamento**

#### **2.1. Adicionar Botão "Faturar" na Página de Agenda**
**Arquivo:** `apps/web/src/app/dashboard/agenda/page.tsx`

**Localização:** Na renderização dos agendamentos (linha ~444), adicionar botão após os botões de status:

```typescript
// Importar ícone
import { DollarSign } from 'lucide-react';

// Adicionar estado para modal de faturamento
const [billingModalOpen, setBillingModalOpen] = useState(false);
const [selectedAppointmentForBilling, setSelectedAppointmentForBilling] = useState<Appointment | null>(null);

// Função para abrir modal de faturamento
const handleOpenBillingModal = (appointment: Appointment) => {
  setSelectedAppointmentForBilling(appointment);
  setBillingModalOpen(true);
};

// Adicionar botão na renderização (apenas para ADMIN, OWNER, RECEPTIONIST)
{(user?.role === 'admin' || user?.role === 'owner' || user?.role === 'receptionist') && 
 apt.status !== 'cancelled' && apt.status !== 'canceled' && (
  <button
    onClick={() => handleOpenBillingModal(apt)}
    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
    title="Faturar"
  >
    <DollarSign className="h-5 w-5" />
  </button>
)}
```

#### **2.2. Criar Modal de Faturamento**
**Arquivo:** `apps/web/src/app/dashboard/agenda/page.tsx`

```typescript
// Adicionar estado para dados do faturamento
const [billingData, setBillingData] = useState({
  amount: '',
  method: 'Dinheiro',
  description: '',
});

// Função para buscar dados do agendamento ao abrir modal
const fetchBillingData = async (appointmentId: string) => {
  try {
    const response = await api.get(`/finance/transactions/check-appointment/${appointmentId}`);
    const data = response.data;
    
    if (data.alreadyBilled) {
      toast.error('Este agendamento já foi faturado.');
      setBillingModalOpen(false);
      return;
    }

    // Pré-preencher valor sugerido se disponível
    if (data.suggestedAmount) {
      setBillingData(prev => ({
        ...prev,
        amount: data.suggestedAmount.toString(),
      }));
    }
  } catch (error: any) {
    toast.error('Erro ao carregar dados do agendamento');
    console.error(error);
  }
};

// Função para processar faturamento
const handleProcessBilling = async () => {
  if (!selectedAppointmentForBilling) return;

  if (!billingData.amount || Number(billingData.amount) <= 0) {
    toast.error('Valor inválido');
    return;
  }

  try {
    await financeService.createTransaction({
      type: 'INCOME',
      category: 'Consulta', // ou buscar do appointment.type
      amount: Number(billingData.amount),
      method: billingData.method,
      description: billingData.description || undefined,
      appointmentId: selectedAppointmentForBilling.id,
      patientId: selectedAppointmentForBilling.patientId,
      staffId: selectedAppointmentForBilling.staffId,
    });

    toast.success('Faturamento realizado com sucesso!');
    setBillingModalOpen(false);
    setBillingData({ amount: '', method: 'Dinheiro', description: '' });
    fetchAppointments(); // Recarregar lista
  } catch (error: any) {
    const message = error.response?.data?.message || 'Erro ao processar faturamento';
    toast.error(message);
  }
};

// Renderizar modal
{billingModalOpen && selectedAppointmentForBilling && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Faturar Agendamento</h3>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-500">Paciente</p>
          <p className="font-semibold text-gray-900">{selectedAppointmentForBilling.patient.name}</p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Profissional</p>
          <p className="font-semibold text-gray-900">
            {selectedAppointmentForBilling.staff?.name || selectedAppointmentForBilling.doctor?.name}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Procedimento</p>
          <p className="font-semibold text-gray-900">{selectedAppointmentForBilling.type || 'Consulta'}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Valor <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            value={billingData.amount}
            onChange={(e) => setBillingData(prev => ({ ...prev, amount: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="0,00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Método de Pagamento <span className="text-red-500">*</span>
          </label>
          <select
            value={billingData.method}
            onChange={(e) => setBillingData(prev => ({ ...prev, method: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="Dinheiro">Dinheiro</option>
            <option value="Cartão de Débito">Cartão de Débito</option>
            <option value="Cartão de Crédito">Cartão de Crédito</option>
            <option value="PIX">PIX</option>
            <option value="Transferência">Transferência</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observações (opcional)
          </label>
          <textarea
            value={billingData.description}
            onChange={(e) => setBillingData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Observações sobre o pagamento..."
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => {
            setBillingModalOpen(false);
            setBillingData({ amount: '', method: 'Dinheiro', description: '' });
          }}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleProcessBilling}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Confirmar Faturamento
        </button>
      </div>
    </div>
  </div>
)}
```

#### **2.3. Adicionar Serviço no Frontend**
**Arquivo:** `apps/web/src/services/finance-service.ts`

```typescript
checkAppointmentBilling: async (appointmentId: string) => {
  const response = await api.get(`/finance/transactions/check-appointment/${appointmentId}`);
  return response.data;
},
```

---

### **FASE 3: Melhorias Futuras (Opcional)**

#### **3.1. Relação Appointment → Procedure**
**Problema:** Atualmente `Appointment.type` é uma string, não há relação com `Procedure`.

**Solução:** Adicionar campo `procedureId` opcional em `Appointment`:

```prisma
model Appointment {
  // ... campos existentes
  procedureId String? @map("procedure_id") @db.Uuid
  procedure   Procedure? @relation(fields: [procedureId], references: [id])
}
```

**Benefícios:**
- Busca automática do valor do procedimento
- Validação de procedimentos disponíveis
- Relatórios mais precisos

#### **3.2. Indicador Visual na Agenda**
- Mostrar badge "Faturado" nos agendamentos já faturados
- Desabilitar botão "Faturar" se já foi faturado
- Mostrar valor faturado ao passar o mouse

#### **3.3. Histórico de Faturamento**
- Adicionar aba na página Financeiro para ver histórico por agendamento
- Filtrar transações por paciente/profissional/data

---

## 📝 CHECKLIST DE IMPLEMENTAÇÃO

### **Backend**
- [ ] Criar endpoint `GET /finance/transactions/check-appointment/:appointmentId`
- [ ] Adicionar método `checkAppointmentBilling` no `FinanceService`
- [ ] Adicionar validação no `createTransaction` para evitar faturamento duplicado
- [ ] Adicionar validação de tenant no `checkAppointmentBilling`
- [ ] Testar endpoint com agendamento inexistente
- [ ] Testar endpoint com agendamento já faturado
- [ ] Testar endpoint com agendamento de outro tenant

### **Frontend**
- [ ] Adicionar botão "Faturar" na página de agenda (apenas para ADMIN/OWNER/RECEPTIONIST)
- [ ] Criar modal de faturamento com dados pré-preenchidos
- [ ] Adicionar função `checkAppointmentBilling` no `finance-service.ts`
- [ ] Implementar busca automática de valor do procedimento
- [ ] Adicionar validação de campos obrigatórios
- [ ] Adicionar feedback visual (loading, sucesso, erro)
- [ ] Recarregar lista de agendamentos após faturamento
- [ ] Testar fluxo completo: abrir modal → preencher → salvar → verificar status

### **Testes**
- [ ] Testar faturamento de agendamento novo
- [ ] Testar tentativa de faturamento duplicado (deve bloquear)
- [ ] Testar com diferentes métodos de pagamento
- [ ] Verificar atualização automática do status para "AGUARDANDO"
- [ ] Verificar criação de repasse médico (se aplicável)

---

## 🔒 PERMISSÕES

**Quem pode faturar:**
- ✅ `ADMIN`
- ✅ `OWNER`
- ✅ `RECEPTIONIST`

**Quem NÃO pode faturar:**
- ❌ `DOCTOR` (médico não pode faturar seus próprios agendamentos)

---

## 📊 FLUXO COMPLETO APÓS IMPLEMENTAÇÃO

1. **Recepção/Admin acessa Agenda**
   - Visualiza agendamentos do dia/semana/mês

2. **Clica em "Faturar" em um agendamento**
   - Sistema busca dados do agendamento
   - Verifica se já foi faturado (bloqueia se sim)
   - Busca valor sugerido do procedimento (se disponível)
   - Abre modal com dados pré-preenchidos

3. **Preenche dados do pagamento**
   - Valor (pré-preenchido se disponível)
   - Método de pagamento
   - Observações (opcional)

4. **Confirma faturamento**
   - Sistema cria transação
   - Atualiza status do agendamento para `confirmed` (AGUARDANDO)
   - Cria repasse médico (se aplicável)
   - Mostra mensagem de sucesso
   - Recarrega lista de agendamentos

5. **Resultado**
   - Agendamento aparece como "AGUARDANDO" na agenda
   - Transação aparece na página Financeiro
   - Repasse médico criado (se configurado)

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

1. **Valor do Procedimento:**
   - Atualmente não há relação direta `Appointment` → `Procedure`
   - O valor precisa ser buscado por nome (`Procedure.name` ≈ `Appointment.type`)
   - Solução temporária: buscar por nome (case-insensitive)
   - Solução ideal: adicionar `procedureId` em `Appointment` (Fase 3)

2. **Faturamento Duplicado:**
   - Campo `appointmentId` em `Transaction` é único (`@unique`)
   - Banco de dados já previne duplicação
   - Validação adicional no backend para melhor UX

3. **Status do Agendamento:**
   - Após faturamento: `scheduled` → `confirmed` (AGUARDANDO)
   - Após iniciar atendimento: `confirmed` → `in_progress` (EM ATENDIMENTO)
   - Após finalizar PEP: `in_progress` → `completed` (FINALIZADO)

4. **Repasse Médico:**
   - Criado automaticamente se `staffId` tiver `commissionRate > 0`
   - Cálculo: `feeAmount = grossAmount * (commissionRate / 100)`
   - Status inicial: `pending`

---

## 📚 ARQUIVOS ENVOLVIDOS

### **Backend**
- `apps/api/src/finance/finance.controller.ts`
- `apps/api/src/finance/finance.service.ts`
- `apps/api/src/finance/dto/finance.dto.ts`

### **Frontend**
- `apps/web/src/app/dashboard/agenda/page.tsx`
- `apps/web/src/services/finance-service.ts`

### **Database**
- `packages/db/prisma/schema.prisma` (modelos `Transaction`, `Appointment`, `Procedure`)

---

**Última atualização:** 05/01/2026
