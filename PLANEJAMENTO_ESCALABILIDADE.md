# 📊 Planejamento: Escalabilidade e Manutenibilidade
## Análise Técnica para Leigos

---

## 🎯 **O Problema que Estamos Resolvendo**

Imagine que o MedFlow está crescendo:
- **Hoje:** 1 clínica, 50 agendamentos por dia
- **Em 6 meses:** 10 clínicas, 500 agendamentos por dia
- **Em 1 ano:** 50 clínicas, 2.500 agendamentos por dia

Sem otimizações, o sistema ficará **lento** e **caro** de manter. É como tentar encontrar um livro em uma biblioteca sem organização: você precisa verificar **todos** os livros até encontrar o que precisa.

---

## 🔍 **1. ÍNDICES COMPOSTOS (Database Indexes)**

### **O que é um Índice?**

Pense em um **índice de livro**:
- **Sem índice:** Você precisa ler todas as páginas para encontrar "diabetes" (lento!)
- **Com índice:** Você vai direto na página 245 onde está "diabetes" (rápido!)

No banco de dados, é a mesma coisa. Um **índice** é uma "tabela de referência rápida" que o PostgreSQL cria para encontrar dados sem precisar varrer todas as linhas.

### **O que é um Índice Composto?**

É um índice que usa **múltiplas colunas juntas**. Por exemplo:

**Cenário Real:**
```
"Quero ver todas as transações do Dr. João entre 01/01/2026 e 31/01/2026"
```

**Sem índice composto:**
1. PostgreSQL busca TODAS as transações (10.000 registros)
2. Filtra por `staffId = 'Dr. João'` (fica com 500)
3. Filtra por `createdAt entre 01/01 e 31/01` (fica com 50)
4. **Tempo:** 2-3 segundos ⏱️

**Com índice composto `(staffId, createdAt)`:**
1. PostgreSQL vai DIRETO nas transações do Dr. João
2. Dentro dessas, vai DIRETO no período de janeiro
3. **Tempo:** 0,1 segundos ⚡

### **Onde Vamos Aplicar?**

#### **A) Tabela `Transaction` (Transações Financeiras)**

**Problema Atual:**
- Relatórios anuais buscam transações por `tenantId + createdAt`
- Sem índice, busca em **milhares** de registros toda vez

**Solução:**
```prisma
model Transaction {
  // ... campos existentes ...
  
  @@index([tenantId, createdAt])  // Índice composto
  @@index([tenantId, staffId, createdAt])  // Para relatórios por médico
  @@index([tenantId, type, createdAt])  // Para relatórios de entradas/saídas
}
```

**Benefício:**
- Relatório anual: **de 5 segundos → 0,3 segundos** ⚡
- Relatório mensal: **de 1 segundo → 0,1 segundos** ⚡

#### **B) Tabela `MedicalFee` (Repasses Médicos)**

**Problema Atual:**
- Buscar repasses pendentes de um médico: sem índice, varre todos os repasses
- Fechamento de repasse: busca todos os repasses do médico sem filtro eficiente

**Solução:**
```prisma
model MedicalFee {
  // ... campos existentes ...
  
  @@index([tenantId, staffId, status, createdAt])  // Para buscar repasses pendentes
  @@index([tenantId, status, createdAt])  // Para relatórios gerais
  @@index([paymentId])  // Para buscar repasses de um fechamento específico
}
```

**Benefício:**
- Listar repasses pendentes: **de 2 segundos → 0,2 segundos** ⚡
- Fechamento de repasse: **de 3 segundos → 0,5 segundos** ⚡

### **Custo vs Benefício**

- **Custo:** 
  - Espaço extra no banco: ~5-10% a mais
  - Tempo de criação: 1-2 minutos (uma vez só)
  
- **Benefício:**
  - Relatórios **10-50x mais rápidos**
  - Menos carga no servidor
  - Melhor experiência do usuário

---

## ⚡ **2. CACHE COM REDIS (Para Agendas)**

### **O que é Cache?**

Pense em um **armário na cozinha**:
- **Sem cache (banco de dados):** Toda vez que você quer um prato, vai até o depósito no porão (lento!)
- **Com cache (Redis):** Os pratos mais usados ficam no armário da cozinha (rápido!)

**Cache** é uma memória temporária que guarda dados **frequentemente acessados** para não precisar buscar no banco toda vez.

### **O que é Redis?**

**Redis** é como um "armário super rápido" na memória do servidor. É **100-1000x mais rápido** que buscar no banco de dados.

### **Por que Agendas Precisam de Cache?**

**Cenário Real:**
```
A recepcionista abre a agenda 50 vezes por dia
Cada vez que abre, o sistema busca:
- Todos os agendamentos do dia
- Configurações de horário de cada médico
- Bloqueios de agenda
- Disponibilidade de horários

Sem cache: 50 buscas no banco = 50 x 0,5s = 25 segundos de espera total
Com cache: 50 buscas, mas 48 vêm do cache = 2 x 0,5s + 48 x 0,01s = 1,5 segundos total
```

**Resultado:** Sistema **16x mais rápido** para o usuário! 🚀

### **Como Funciona o Cache de Agendas?**

#### **Fluxo Sem Cache (Atual):**
```
1. Usuário abre agenda
2. Sistema busca no banco: "Quais agendamentos do dia 19/01?"
3. Sistema busca no banco: "Quais horários disponíveis do Dr. João?"
4. Sistema busca no banco: "Há bloqueios hoje?"
5. Retorna resultado (0,5 segundos)
```

#### **Fluxo Com Cache:**
```
1. Usuário abre agenda
2. Sistema verifica Redis: "Já tenho os agendamentos de 19/01 em cache?"
   - ✅ SIM: Retorna do cache (0,01 segundos) ⚡
   - ❌ NÃO: Busca no banco, salva no cache, retorna (0,5 segundos)
```

### **O que Vamos Cachear?**

#### **A) Agendamentos do Dia**
```typescript
// Chave do cache: "appointments:tenant-123:2026-01-19"
// Valor: Lista de agendamentos (JSON)
// Tempo de expiração: 5 minutos
```

**Por quê 5 minutos?**
- Se alguém criar um agendamento, em até 5 minutos ele aparece
- Balanceia velocidade vs atualização

#### **B) Configurações de Agenda (ScheduleConfig)**
```typescript
// Chave: "schedule-config:staff-456"
// Valor: Horários de trabalho do médico
// Tempo de expiração: 1 hora
```

**Por quê 1 hora?**
- Configurações mudam raramente
- Pode cachear por mais tempo

#### **C) Bloqueios de Agenda (ScheduleBlocks)**
```typescript
// Chave: "schedule-blocks:staff-456:2026-01"
// Valor: Bloqueios do mês
// Tempo de expiração: 30 minutos
```

### **Quando Invalidar o Cache?**

O cache precisa ser **atualizado** quando:
- ✅ Novo agendamento criado → Limpa cache do dia
- ✅ Agendamento cancelado → Limpa cache do dia
- ✅ Configuração de agenda alterada → Limpa cache do médico
- ✅ Bloqueio adicionado → Limpa cache do mês

**Exemplo de Código:**
```typescript
// Ao criar agendamento
async create(tenantId: string, dto: CreateAppointmentDto) {
  const appointment = await this.prisma.client.appointment.create({...});
  
  // Invalidar cache do dia
  await this.redis.del(`appointments:${tenantId}:${format(dto.startTime, 'yyyy-MM-dd')}`);
  
  return appointment;
}
```

### **Custo vs Benefício**

- **Custo:**
  - Serviço Redis: ~$5-10/mês (ou gratuito no início com Redis Cloud)
  - Memória extra: ~50-100MB
  - Complexidade: Média (precisa gerenciar invalidação)
  
- **Benefício:**
  - Agendas **10-50x mais rápidas**
  - Menos carga no banco de dados
  - Suporta **muito mais usuários simultâneos**
  - Melhor experiência (sem "loading...")

---

## 📋 **Plano de Implementação**

### **Fase 1: Índices Compostos (Prioridade ALTA)**
**Tempo estimado:** 2-3 horas
**Risco:** Baixo (não quebra nada existente)

1. ✅ Adicionar índices no `schema.prisma`
2. ✅ Executar migração (`prisma migrate dev`)
3. ✅ Testar relatórios (verificar velocidade)
4. ✅ Monitorar espaço no banco

**Impacto:** Imediato e permanente

### **Fase 2: Cache Redis (Prioridade MÉDIA)**
**Tempo estimado:** 4-6 horas
**Risco:** Médio (precisa testar bem a invalidação)

1. ✅ Instalar Redis localmente (desenvolvimento)
2. ✅ Configurar Redis no NestJS
3. ✅ Implementar cache em `AppointmentsService`
4. ✅ Implementar invalidação de cache
5. ✅ Testar cenários de atualização
6. ✅ Configurar Redis em produção (quando for deploy)

**Impacto:** Gradual (melhora conforme uso)

---

## 🎯 **Resultado Esperado**

### **Antes das Otimizações:**
- Relatório anual: **5-10 segundos** ⏱️
- Abrir agenda: **0,5-1 segundo** ⏱️
- Sistema lento com 10+ usuários simultâneos

### **Depois das Otimizações:**
- Relatório anual: **0,3-0,5 segundos** ⚡
- Abrir agenda: **0,05-0,1 segundos** ⚡
- Sistema rápido com 50+ usuários simultâneos

---

## 💡 **Analogia Final**

Pense no MedFlow como uma **biblioteca médica**:

**Sem otimizações:**
- Livros espalhados sem organização
- Toda busca leva minutos
- Só 1 pessoa pode usar por vez

**Com otimizações:**
- Livros organizados por índice (índices compostos)
- Livros mais usados na prateleira próxima (cache Redis)
- Buscas instantâneas
- Muitas pessoas podem usar simultaneamente

---

## ✅ **Próximos Passos**

1. **Aguardar seu teste** dos relatórios de caixa
2. **Implementar índices compostos** (quando você aprovar)
3. **Implementar cache Redis** (quando você aprovar)
4. **Monitorar performance** após implementação

**Deseja que eu implemente os índices compostos agora ou prefere testar primeiro os relatórios?**
