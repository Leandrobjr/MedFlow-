# 🔍 Análise: Fluxo de Atendimento e Status de Agendamentos

**Data:** Janeiro 2025  
**Objetivo:** Implementar fluxo completo: AGENDADO → AGUARDANDO → EM ATENDIMENTO → FINALIZADO

---

## 📋 Estado Atual do Sistema

### ✅ O QUE JÁ ESTÁ PRONTO

#### 1. **Estrutura de Status no Banco de Dados**
- ✅ Modelo `Appointment` tem campo `status` (String)
- ✅ Valores atuais suportados: `scheduled`, `confirmed`, `in_progress`, `completed`, `cancelled`
- ✅ Backend valida status permitidos no `updateStatus`

#### 2. **Criação de Agendamentos**
- ✅ Endpoint `POST /appointments` funcional
- ✅ Status inicial: `scheduled` (AGENDADO)
- ✅ Permissões: ADMIN, OWNER, RECEPTIONIST
- ✅ Frontend: Formulário de criação funcional

#### 3. **Visualização de Agendamentos**
- ✅ Dashboard home mostra consultas do dia
- ✅ Página de Agenda mostra agendamentos
- ✅ Filtragem por profissional (não-admin vê apenas os seus)
- ✅ Badges de status com cores diferentes

#### 4. **Finalização de Prontuário**
- ✅ Endpoint `PATCH /pep/:id/finalize` funcional
- ✅ Ao finalizar prontuário, status do appointment muda para `completed`
- ✅ Validação: diagnóstico obrigatório antes de finalizar
- ✅ Frontend: Botão "Finalizar e Assinar" no PEP

#### 5. **Sistema de Pagamento/Faturamento**
- ✅ Modelo `Transaction` com relacionamento com `Appointment`
- ✅ Endpoint `POST /finance/transactions` funcional
- ✅ Campo `appointmentId` na transação
- ⚠️ **FALTA**: Atualizar status do appointment para `confirmed` quando pagamento é efetuado

#### 6. **Botão "INICIAR ATENDIMENTO" (Parcial)**
- ✅ Existe no dashboard home (`handleStartAppointment`)
- ✅ Muda status para `in_progress`
- ❌ **FALTA**: Redirecionar para prontuário do paciente
- ❌ **FALTA**: Criar prontuário automaticamente se não existir

---

## ❌ O QUE FALTA IMPLEMENTAR

### 1. **Integração Pagamento → Status AGUARDANDO** 🔴 CRÍTICO

**Situação Atual:**
- Quando uma transação é criada com `appointmentId`, o sistema não atualiza o status do appointment
- Status permanece `scheduled` mesmo após pagamento

**O que precisa:**
- No `FinanceService.createTransaction`, após criar a transação:
  - Se `dto.appointmentId` existir e transação for do tipo `INCOME`:
    - Atualizar status do appointment para `confirmed` (AGUARDANDO)

**Viabilidade:** ✅ ALTA  
**Dificuldade:** 🟢 BAIXA (1-2 horas)  
**Risco:** 🟢 BAIXO (mudança isolada, fácil de testar)

**Código necessário:**
```typescript
// Em FinanceService.createTransaction, após criar transaction:
if (dto.appointmentId && dto.type === TransactionType.INCOME) {
  await this.prisma.client.appointment.update({
    where: { id: dto.appointmentId },
    data: { status: 'confirmed' },
  });
}
```

---

### 2. **Botão "INICIAR ATENDIMENTO" com Redirecionamento** 🔴 CRÍTICO

**Situação Atual:**
- Botão existe no dashboard home
- Apenas muda status para `in_progress`
- Não redireciona para prontuário

**O que precisa:**
- Ao clicar em "INICIAR ATENDIMENTO":
  1. Mudar status para `in_progress`
  2. Verificar se existe prontuário para o appointment
  3. Se não existir, criar prontuário automaticamente
  4. Redirecionar para `/dashboard/pep?appointmentId=xxx` ou `/dashboard/pep?patientId=xxx&appointmentId=xxx`

**Viabilidade:** ✅ ALTA  
**Dificuldade:** 🟡 MÉDIA (3-4 horas)  
**Risco:** 🟡 MÉDIO (precisa criar prontuário se não existir, validar permissões)

**Código necessário:**
```typescript
// Em dashboard/page.tsx, handleStartAppointment:
const handleStartAppointment = async (appointmentId: string) => {
  // 1. Atualizar status
  await appointmentService.updateStatus(appointmentId, 'in_progress');
  
  // 2. Buscar appointment para pegar patientId
  const appointment = await appointmentService.getById(appointmentId);
  
  // 3. Verificar se prontuário existe, criar se não existir
  // 4. Redirecionar para PEP
  router.push(`/dashboard/pep?patientId=${appointment.patientId}&appointmentId=${appointmentId}`);
};
```

**Dependências:**
- Criar endpoint `GET /appointments/:id` se não existir (já existe)
- Criar endpoint `POST /pep` para criar prontuário (já existe)
- Atualizar página PEP para aceitar query params `appointmentId`

---

### 3. **Renomeação de Status (Labels)** 🟡 IMPORTANTE

**Situação Atual:**
- Status técnicos: `scheduled`, `confirmed`, `in_progress`, `completed`
- Labels no frontend: "AGENDADO", "CONFIRMADO", "Em Atendimento", "REALIZADO"

**O que precisa:**
- Manter status técnicos no banco (não mudar)
- Atualizar labels no frontend:
  - `scheduled` → "AGENDADO"
  - `confirmed` → "AGUARDANDO"
  - `in_progress` → "EM ATENDIMENTO"
  - `completed` → "FINALIZADO"

**Viabilidade:** ✅ ALTA  
**Dificuldade:** 🟢 BAIXA (1-2 horas)  
**Risco:** 🟢 BAIXO (apenas mudança de texto)

**Arquivos a alterar:**
- `apps/web/src/app/dashboard/page.tsx` (getStatusBadge)
- `apps/web/src/app/dashboard/agenda/page.tsx` (badges de status)
- Qualquer outro lugar que exiba status

---

### 4. **Atualizar Página PEP para Aceitar appointmentId** 🟡 IMPORTANTE

**Situação Atual:**
- PEP aceita apenas `patientId` via query params
- Não há forma de abrir prontuário diretamente de um appointment

**O que precisa:**
- Aceitar query param `appointmentId`
- Se `appointmentId` fornecido:
  - Buscar appointment
  - Buscar/criar prontuário para aquele appointment
  - Abrir prontuário automaticamente
  - Mostrar informações do appointment no cabeçalho

**Viabilidade:** ✅ ALTA  
**Dificuldade:** 🟡 MÉDIA (2-3 horas)  
**Risco:** 🟡 MÉDIO (precisa validar se appointment pertence ao profissional logado)

---

### 5. **Criar Prontuário Automaticamente ao Iniciar Atendimento** 🟡 IMPORTANTE

**Situação Atual:**
- Prontuário precisa ser criado manualmente
- Não há criação automática ao iniciar atendimento

**O que precisa:**
- No `handleStartAppointment`:
  - Verificar se prontuário existe para o appointment
  - Se não existir, criar com dados básicos:
    - `appointmentId`
    - `patientId`
    - `staffId` (do appointment)
    - Campos vazios (anamnesis, physicalExam, etc.)

**Viabilidade:** ✅ ALTA  
**Dificuldade:** 🟢 BAIXA (1-2 horas)  
**Risco:** 🟢 BAIXO (apenas criar registro vazio)

---

## 📊 Resumo de Implementação

| Item | Prioridade | Dificuldade | Risco | Tempo Estimado |
|------|-----------|-------------|-------|----------------|
| 1. Pagamento → AGUARDANDO | 🔴 CRÍTICO | 🟢 BAIXA | 🟢 BAIXO | 1-2 horas |
| 2. Botão INICIAR com redirecionamento | 🔴 CRÍTICO | 🟡 MÉDIA | 🟡 MÉDIO | 3-4 horas |
| 3. Renomeação de labels | 🟡 IMPORTANTE | 🟢 BAIXA | 🟢 BAIXO | 1-2 horas |
| 4. PEP aceitar appointmentId | 🟡 IMPORTANTE | 🟡 MÉDIA | 🟡 MÉDIO | 2-3 horas |
| 5. Criar prontuário automático | 🟡 IMPORTANTE | 🟢 BAIXA | 🟢 BAIXO | 1-2 horas |

**TOTAL ESTIMADO:** 8-13 horas (1-2 dias de trabalho)

---

## 🔄 Fluxo Completo Proposto

### Fluxo de Status:
1. **AGENDADO** (`scheduled`)
   - Quando: Recepção/Admin cria agendamento
   - Ação: `POST /appointments` → status = `scheduled`

2. **AGUARDANDO** (`confirmed`)
   - Quando: Pagamento é efetuado no sistema
   - Ação: `POST /finance/transactions` com `appointmentId` → atualiza status para `confirmed`

3. **EM ATENDIMENTO** (`in_progress`)
   - Quando: Médico clica em "INICIAR ATENDIMENTO"
   - Ação: `PATCH /appointments/:id/status` → status = `in_progress`
   - Ação adicional: Criar prontuário se não existir
   - Ação adicional: Redirecionar para `/dashboard/pep?appointmentId=xxx`

4. **FINALIZADO** (`completed`)
   - Quando: Médico clica em "FINALIZAR" no prontuário
   - Ação: `PATCH /pep/:id/finalize` → atualiza appointment status para `completed`

---

## ⚠️ Riscos e Considerações

### Riscos Identificados:

1. **Criação automática de prontuário:**
   - Risco: Criar prontuário duplicado se já existir
   - Mitigação: Verificar existência antes de criar

2. **Redirecionamento para PEP:**
   - Risco: PEP pode não estar preparado para receber `appointmentId`
   - Mitigação: Implementar suporte a query params no PEP

3. **Atualização de status no pagamento:**
   - Risco: Transação pode ser criada sem `appointmentId` (outras transações)
   - Mitigação: Validar se `appointmentId` existe antes de atualizar

4. **Permissões:**
   - Risco: Médico pode tentar iniciar atendimento de outro médico
   - Mitigação: Validar `staffId` do appointment vs `staffId` do usuário logado

---

## Recomendações

### Ordem de Implementação Recomendada:

1. **FASE 1 (Crítico - 4-6 horas):**
   - Item 1: Pagamento → AGUARDANDO
   - Item 2: Botão INICIAR com redirecionamento (parcial, sem criar prontuário ainda)

2. **FASE 2 (Importante - 4-7 horas):**
   - Item 5: Criar prontuário automático
   - Item 4: PEP aceitar appointmentId
   - Item 3: Renomeação de labels

### Decisões Necessárias:

1. **Criação automática de prontuário:**
   - Criar sempre ao iniciar atendimento?
   - Ou apenas se não existir?
   - **Recomendação:** Criar apenas se não existir (verificar antes)

2. **Redirecionamento:**
   - Redirecionar para PEP com `appointmentId`?
   - Ou com `patientId` + `appointmentId`?
   - **Recomendação:** Ambos (mais flexível)

3. **Validação de permissões:**
   - Médico pode iniciar atendimento de outro médico?
   - **Recomendação:** NÃO (validar `staffId`)

---

**Última atualização:** Janeiro 2025  
**Status:** Aguardando aprovação para implementação
