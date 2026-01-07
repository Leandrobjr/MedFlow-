# PROPOSTA: VINCULAR PROCEDIMENTO AO AGENDAMENTO

## 🎯 OBJETIVO

Implementar sistema onde:
1. **Ao cadastrar agendamento:** Buscar procedimentos do profissional e permitir seleção
2. **Ao faturar:** Usar o procedimento cadastrado no agendamento para buscar valor automaticamente

---

## 📊 SITUAÇÃO ATUAL

### **Estrutura de Dados:**
- ✅ `Procedure` existe (nome, valor bruto, observações)
- ✅ `StaffProcedure` existe (relação many-to-many: Staff ↔ Procedure)
- ✅ `Appointment.type` existe (string livre, default: "consultation")
- ❌ `Appointment.procedureId` **NÃO existe** (sem relação direta)

### **Fluxo Atual:**
1. **Criação de Agendamento:**
   - Campo `type` é opcional (string livre)
   - Não há seleção de procedimento
   - Valor padrão: "consultation"

2. **Faturamento:**
   - Busca procedimento por nome (`appointment.type`)
   - Pode não encontrar se nome não corresponder
   - Valor pode não ser pré-preenchido

---

## ✅ PROPOSTA DE IMPLEMENTAÇÃO

### **OPÇÃO A: Adicionar `procedureId` em Appointment (RECOMENDADA)**

#### **Vantagens:**
- ✅ Relação direta e precisa
- ✅ Busca instantânea do valor
- ✅ Dados consistentes
- ✅ Facilita relatórios e análises
- ✅ Evita ambiguidade (múltiplos procedimentos com nomes similares)

#### **Desvantagens:**
- ⚠️ Requer migration do banco
- ⚠️ Agendamentos antigos não terão `procedureId`
- ⚠️ Requer atualização do fluxo de agendamento

---

## 📋 PLANO DE IMPLEMENTAÇÃO DETALHADO

### **FASE 1: Backend - Schema e Migration**

#### **1.1. Adicionar Campo `procedureId` em Appointment**

**Arquivo:** `packages/db/prisma/schema.prisma`

```prisma
model Appointment {
  id          String   @id @default(uuid()) @db.Uuid
  patientId   String   @map("patient_id") @db.Uuid
  staffId     String   @map("staff_id") @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  procedureId String?  @map("procedure_id") @db.Uuid  // ✅ NOVO: Opcional
  startTime   DateTime @map("start_time")
  endTime     DateTime @map("end_time")
  status      String   @default("scheduled")
  type        String   @default("consultation")  // Manter para compatibilidade
  observations String?  @db.Text
  
  googleEventId String? @map("google_event_id")
  
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  patient     Patient  @relation(fields: [patientId], references: [id])
  staff       Staff    @relation(fields: [staffId], references: [id])
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  procedure   Procedure? @relation(fields: [procedureId], references: [id])  // ✅ NOVO
  medicalRecord MedicalRecord?
  transaction   Transaction?

  @@map("appointments")
  @@index([startTime, endTime])
  @@index([staffId, startTime])
}
```

**Adicionar relação em Procedure:**
```prisma
model Procedure {
  // ... campos existentes
  appointments Appointment[]  // ✅ NOVO
}
```

#### **1.2. Criar Migration**

```bash
cd packages/db
pnpm prisma migrate dev --name add_procedure_id_to_appointments
```

**SQL gerado:**
```sql
ALTER TABLE "appointments" ADD COLUMN "procedure_id" UUID;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_procedure_id_fkey" 
  FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

**Observações:**
- Campo é **opcional** (`String?`) - agendamentos antigos continuam funcionando
- `ON DELETE SET NULL` - se procedimento for deletado, agendamento não quebra
- Não requer dados de migração (campo opcional)

---

### **FASE 2: Backend - DTOs e Services**

#### **2.1. Atualizar DTO de Criação**

**Arquivo:** `apps/api/src/appointments/dto/create-appointment.dto.ts`

```typescript
export class CreateAppointmentDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Paciente é obrigatório' })
  patientId: string;

  @IsUUID()
  @IsNotEmpty({ message: 'Profissional/Médico é obrigatório' })
  staffId: string;

  @IsDateString({}, { message: 'Data/Hora de início inválida' })
  @IsNotEmpty({ message: 'Horário de início é obrigatório' })
  startTime: string;

  @IsDateString({}, { message: 'Data/Hora de término inválida' })
  @IsNotEmpty({ message: 'Horário de término é obrigatório' })
  endTime: string;

  @IsUUID()
  @IsOptional()  // ✅ NOVO: Opcional
  procedureId?: string;

  @IsString()
  @IsOptional()
  type?: string;  // Manter para compatibilidade

  @IsString()
  @IsOptional()
  observations?: string;
}
```

#### **2.2. Atualizar Service de Criação**

**Arquivo:** `apps/api/src/appointments/appointments.service.ts`

```typescript
async create(tenantId: string, createAppointmentDto: CreateAppointmentDto) {
  const { patientId, staffId, startTime, endTime, procedureId } = createAppointmentDto;
  const start = new Date(startTime);
  const end = new Date(endTime);

  // 1. Validar se o horário de término é após o de início
  if (end <= start) {
    throw new BadRequestException('O horário de término deve ser após o início.');
  }

  // 2. ✅ NOVO: Validar procedureId se fornecido
  if (procedureId) {
    // Verificar se procedimento existe e pertence ao tenant
    const procedure = await this.prisma.client.procedure.findUnique({
      where: { id: procedureId },
    });

    if (!procedure || procedure.tenantId !== tenantId) {
      throw new BadRequestException('Procedimento não encontrado ou não pertence a este tenant.');
    }

    // Verificar se procedimento está vinculado ao profissional
    const staffProcedure = await this.prisma.client.staffProcedure.findUnique({
      where: {
        staffId_procedureId: {
          staffId,
          procedureId,
        },
      },
    });

    if (!staffProcedure) {
      throw new BadRequestException('Este procedimento não está vinculado ao profissional selecionado.');
    }

    // Se procedureId foi fornecido, usar nome do procedimento como type
    createAppointmentDto.type = procedure.name;
  }

  // 3. Verificar conflitos de agenda (código existente)
  // ...

  // 4. Criar agendamento
  return this.prisma.client.appointment.create({
    data: {
      ...createAppointmentDto,
      startTime: start,
      endTime: end,
      tenantId,
    },
    include: {
      patient: { select: { name: true } },
      staff: { select: { name: true, specialty: true } },
      procedure: { select: { id: true, name: true, grossAmount: true } },  // ✅ NOVO
    },
  });
}
```

#### **2.3. Criar Endpoint para Buscar Procedimentos do Profissional**

**Arquivo:** `apps/api/src/staff/staff.controller.ts`

```typescript
@Get(':id/procedures')
@Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
async getStaffProcedures(@Req() req: any, @Param('id') id: string) {
  return this.staffService.getStaffProcedures(req.tenantId, id);
}
```

**Arquivo:** `apps/api/src/staff/staff.service.ts`

```typescript
async getStaffProcedures(tenantId: string, staffId: string) {
  // Verificar se staff pertence ao tenant
  const staff = await this.prisma.client.staff.findUnique({
    where: { id: staffId },
  });

  if (!staff || staff.tenantId !== tenantId) {
    throw new NotFoundException('Profissional não encontrado.');
  }

  // Buscar procedimentos vinculados
  const staffProcedures = await this.prisma.client.staffProcedure.findMany({
    where: { staffId },
    include: {
      procedure: {
        select: {
          id: true,
          name: true,
          grossAmount: true,
          observations: true,
        },
      },
    },
    orderBy: {
      procedure: {
        name: 'asc',
      },
    },
  });

  return staffProcedures.map(sp => ({
    id: sp.procedure.id,
    name: sp.procedure.name,
    grossAmount: Number(sp.procedure.grossAmount),
    observations: sp.procedure.observations,
  }));
}
```

#### **2.4. Atualizar `checkAppointmentBilling`**

**Arquivo:** `apps/api/src/finance/finance.service.ts`

```typescript
async checkAppointmentBilling(tenantId: string, appointmentId: string) {
  // ... código existente de verificação ...

  // Buscar dados do appointment
  const appointment = await this.prisma.client.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { select: { id: true, name: true } },
      staff: { select: { id: true, name: true } },
      procedure: { select: { id: true, name: true, grossAmount: true } },  // ✅ NOVO
    },
  });

  // ... validações existentes ...

  // ✅ NOVO: Se tiver procedureId, usar procedimento diretamente
  let procedure = null;
  let procedureName = appointment.type || 'Consulta';

  if (appointment.procedureId && appointment.procedure) {
    // Procedimento já está carregado no include
    procedure = appointment.procedure;
    procedureName = procedure.name;
  } else {
    // Fallback: Busca por nome (lógica existente)
    // ... código de busca existente ...
  }

  return {
    appointment: {
      id: appointment.id,
      patient: appointment.patient,
      staff: appointment.staff,
      type: appointment.type,
      procedureName: procedureName,
      procedureId: appointment.procedureId,  // ✅ NOVO
      startTime: appointment.startTime,
      status: appointment.status,
    },
    alreadyBilled: !!existingTransaction,
    existingTransaction: existingTransaction || null,
    suggestedAmount: procedure ? Number(procedure.grossAmount) : null,
    procedure: procedure ? {
      id: procedure.id,
      name: procedure.name,
      grossAmount: Number(procedure.grossAmount),
    } : null,
  };
}
```

---

### **FASE 3: Frontend - Service e Interface**

#### **3.1. Adicionar Método no Service**

**Arquivo:** `apps/web/src/services/data-service.ts`

```typescript
export const staffService = {
  // ... métodos existentes ...

  getStaffProcedures: async (staffId: string) => {
    const response = await api.get<Procedure[]>(`/staff/${staffId}/procedures`);
    return response.data;
  },
};
```

#### **3.2. Atualizar Interface Appointment**

**Arquivo:** `apps/web/src/services/appointment-service.ts`

```typescript
export interface Appointment {
  id: string;
  patientId: string;
  staffId: string;
  doctorId?: string;
  startTime: string;
  endTime: string;
  status: string;
  type?: string;
  procedureId?: string;  // ✅ NOVO
  procedure?: {          // ✅ NOVO
    id: string;
    name: string;
    grossAmount: number;
  };
  notes?: string;
  observations?: string;
  patient?: {
    id?: string;
    name: string;
    phone?: string;
  };
  staff?: {
    id: string;
    name: string;
    specialty?: string;
  };
  doctor?: {
    name: string;
  };
}
```

#### **3.3. Atualizar Formulário de Agendamento**

**Arquivo:** `apps/web/src/app/dashboard/agenda/page.tsx`

**Adicionar estado:**
```typescript
const [formData, setFormData] = useState({
  patientId: '',
  doctorId: '',
  procedureId: '',  // ✅ NOVO
  startTime: '',
  endTime: '',
  notes: '',
});

const [availableProcedures, setAvailableProcedures] = useState<Procedure[]>([]);
const [loadingProcedures, setLoadingProcedures] = useState(false);
```

**Adicionar função para buscar procedimentos:**
```typescript
const fetchProceduresForStaff = async (staffId: string) => {
  if (!staffId) {
    setAvailableProcedures([]);
    return;
  }

  setLoadingProcedures(true);
  try {
    const procedures = await staffService.getStaffProcedures(staffId);
    setAvailableProcedures(procedures);
    
    // Se houver apenas um procedimento, selecionar automaticamente
    if (procedures.length === 1) {
      setFormData(prev => ({ ...prev, procedureId: procedures[0].id }));
    }
  } catch (error) {
    console.error('Erro ao carregar procedimentos:', error);
    setAvailableProcedures([]);
  } finally {
    setLoadingProcedures(false);
  }
};
```

**Adicionar useEffect para buscar procedimentos quando médico for selecionado:**
```typescript
useEffect(() => {
  if (formData.doctorId) {
    fetchProceduresForStaff(formData.doctorId);
  } else {
    setAvailableProcedures([]);
    setFormData(prev => ({ ...prev, procedureId: '' }));
  }
}, [formData.doctorId]);
```

**Atualizar formulário:**
```typescript
// Adicionar campo de procedimento após seleção do médico
{formData.doctorId && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Procedimento {availableProcedures.length === 0 && '(Nenhum procedimento cadastrado)'}
    </label>
    {loadingProcedures ? (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando procedimentos...
      </div>
    ) : availableProcedures.length > 0 ? (
      <select
        value={formData.procedureId}
        onChange={(e) => setFormData({ ...formData, procedureId: e.target.value })}
        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
      >
        <option value="">Selecione um procedimento (opcional)</option>
        {availableProcedures.map(p => (
          <option key={p.id} value={p.id}>
            {p.name} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.grossAmount)}
          </option>
        ))}
      </select>
    ) : (
      <div className="text-sm text-gray-500 italic">
        Este profissional não possui procedimentos cadastrados. 
        Cadastre procedimentos em <Link href="/dashboard/equipe" className="text-blue-600 hover:underline">Equipe</Link>.
      </div>
    )}
  </div>
)}
```

**Atualizar payload de criação:**
```typescript
const payload = {
  patientId: formData.patientId,
  staffId: formData.doctorId,
  procedureId: formData.procedureId || undefined,  // ✅ NOVO
  startTime: new Date(`${dateStr}T${formData.startTime}:00`).toISOString(),
  endTime: new Date(`${dateStr}T${formData.endTime}:00`).toISOString(),
  observations: formData.notes || undefined,
};
```

#### **3.4. Atualizar Modal de Faturamento**

**Arquivo:** `apps/web/src/app/dashboard/agenda/page.tsx`

```typescript
// Se appointment tiver procedureId, usar procedimento diretamente
const procedureName = selectedAppointmentForBilling.procedure?.name || 
                      billingInfo?.procedureName || 
                      selectedAppointmentForBilling.type || 
                      'Consulta';

const suggestedAmount = selectedAppointmentForBilling.procedure?.grossAmount || 
                        billingInfo?.suggestedAmount || 
                        null;
```

---

## ⚠️ RISCOS E DESAFIOS

### **RISCO 1: Agendamentos Antigos Sem `procedureId`**

**Problema:**
- Agendamentos criados antes da implementação não terão `procedureId`
- Faturamento pode não encontrar procedimento

**Mitigação:**
- Campo é **opcional** - sistema continua funcionando
- Manter lógica de busca por nome como fallback
- Não quebra funcionalidade existente

**Impacto:** Baixo (compatibilidade mantida)

---

### **RISCO 2: Profissional Sem Procedimentos Cadastrados**

**Problema:**
- Se profissional não tiver procedimentos vinculados, campo fica vazio
- Usuário pode não saber que precisa cadastrar

**Mitigação:**
- Campo de procedimento é **opcional** no agendamento
- Mostrar mensagem informativa se não houver procedimentos
- Link para página de cadastro de equipe
- Sistema funciona sem procedimento (usa `type` como antes)

**Impacto:** Baixo (campo opcional)

---

### **RISCO 3: Migration em Produção**

**Problema:**
- Adicionar coluna em tabela com dados pode ser lento
- Pode causar lock da tabela durante migration

**Mitigação:**
- Campo é opcional (não requer dados)
- Migration é rápida (apenas `ALTER TABLE ADD COLUMN`)
- Testar em ambiente de desenvolvimento primeiro
- Fazer backup antes da migration

**Impacto:** Médio (requer cuidado, mas migration é simples)

---

### **RISCO 4: Validação de Relação Staff-Procedure**

**Problema:**
- Se `procedureId` for passado mas não estiver vinculado ao profissional
- Pode criar inconsistência

**Mitigação:**
- Validar no backend se procedimento está vinculado ao profissional
- Retornar erro claro se não estiver vinculado
- Frontend só mostra procedimentos do profissional selecionado

**Impacto:** Baixo (validação no backend)

---

### **RISCO 5: Performance - Múltiplas Queries**

**Problema:**
- Buscar procedimentos do profissional a cada mudança de médico
- Pode ser lento se houver muitos procedimentos

**Mitigação:**
- Cachear procedimentos por profissional (opcional)
- Query é simples (join em `StaffProcedure`)
- Limitar a profissionais com muitos procedimentos (raros)

**Impacto:** Baixo (query simples e rápida)

---

### **RISCO 6: Compatibilidade com Dados Existentes**

**Problema:**
- Agendamentos antigos usam `type` como string livre
- Pode não corresponder a nenhum procedimento cadastrado

**Mitigação:**
- Manter campo `type` (não remover)
- Se `procedureId` existir, usar procedimento
- Se não existir, usar `type` como fallback
- Sistema funciona em ambos os casos

**Impacto:** Baixo (compatibilidade total)

---

## 📊 COMPARAÇÃO: OPÇÃO A vs OPÇÃO B

### **OPÇÃO A: Adicionar `procedureId` (RECOMENDADA)**
✅ Relação direta e precisa  
✅ Busca instantânea do valor  
✅ Dados consistentes  
✅ Facilita relatórios  
⚠️ Requer migration  
⚠️ Requer atualização do fluxo  

### **OPÇÃO B: Melhorar Busca por Nome (ATUAL)**
✅ Não requer migration  
✅ Funciona com dados existentes  
❌ Pode não encontrar procedimento  
❌ Ambiguidade em nomes similares  
❌ Requer lógica complexa de busca  

**Recomendação:** Implementar **OPÇÃO A** (mais robusta e escalável)

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### **Backend:**
- [ ] Adicionar campo `procedureId` em `Appointment` (schema.prisma)
- [ ] Adicionar relação `appointments` em `Procedure`
- [ ] Criar migration do Prisma
- [ ] Atualizar `CreateAppointmentDto` (adicionar `procedureId?`)
- [ ] Atualizar `AppointmentsService.create` (validação de `procedureId`)
- [ ] Criar endpoint `GET /staff/:id/procedures`
- [ ] Criar método `getStaffProcedures` no `StaffService`
- [ ] Atualizar `checkAppointmentBilling` para usar `procedureId` se disponível
- [ ] Atualizar `findAll` para incluir `procedure` no include
- [ ] Testar criação de agendamento com `procedureId`
- [ ] Testar criação sem `procedureId` (compatibilidade)
- [ ] Testar validação de procedimento não vinculado ao profissional

### **Frontend:**
- [ ] Adicionar método `getStaffProcedures` no `staffService`
- [ ] Atualizar interface `Appointment` (adicionar `procedureId?` e `procedure?`)
- [ ] Adicionar estado `procedureId` no formulário de agendamento
- [ ] Adicionar estado `availableProcedures`
- [ ] Criar função `fetchProceduresForStaff`
- [ ] Adicionar `useEffect` para buscar procedimentos quando médico for selecionado
- [ ] Adicionar campo de seleção de procedimento no formulário
- [ ] Atualizar payload de criação para incluir `procedureId`
- [ ] Atualizar modal de faturamento para usar `procedure` do appointment
- [ ] Testar fluxo completo: selecionar médico → ver procedimentos → selecionar → agendar → faturar
- [ ] Testar com profissional sem procedimentos
- [ ] Testar com agendamento antigo (sem `procedureId`)

### **Testes:**
- [ ] Testar criação de agendamento com procedimento
- [ ] Testar criação sem procedimento (deve funcionar)
- [ ] Testar faturamento com `procedureId` (deve buscar valor automaticamente)
- [ ] Testar faturamento sem `procedureId` (deve usar busca por nome)
- [ ] Testar validação de procedimento não vinculado
- [ ] Testar com profissional sem procedimentos cadastrados
- [ ] Testar migration em ambiente de desenvolvimento

---

## 🎯 BENEFÍCIOS ESPERADOS

### **Curto Prazo:**
- ✅ Valor do procedimento sempre pré-preenchido no faturamento
- ✅ Nome correto do procedimento sempre exibido
- ✅ Redução de erros manuais
- ✅ Melhor UX (menos campos para preencher)

### **Longo Prazo:**
- ✅ Dados mais consistentes
- ✅ Facilita relatórios por procedimento
- ✅ Facilita análise de receita por procedimento
- ✅ Base para funcionalidades futuras (pacotes, descontos, etc.)

---

## ⏱️ ESTIMATIVA DE TEMPO

- **FASE 1 (Backend - Schema):** 30 minutos
- **FASE 2 (Backend - Services):** 2-3 horas
- **FASE 3 (Frontend):** 2-3 horas
- **Testes e Ajustes:** 1-2 horas

**Total:** 5-8 horas

---

## 🚀 DECISÃO RECOMENDADA

**Implementar OPÇÃO A (Adicionar `procedureId`):**

**Justificativa:**
1. Solução mais robusta e escalável
2. Resolve o problema de forma definitiva
3. Compatível com dados existentes (campo opcional)
4. Facilita funcionalidades futuras
5. Risco controlado (migration simples, campo opcional)

**Próximos Passos:**
1. Revisar proposta
2. Aprovar implementação
3. Executar FASE 1 (migration)
4. Executar FASE 2 (backend)
5. Executar FASE 3 (frontend)
6. Testar fluxo completo

---

**Data:** 06/01/2026  
**Status:** Aguardando aprovação para implementação
