# 🔐 Guia de Desenvolvimento Multi-Tenant

**Objetivo:** Documentação para desenvolvedores sobre como trabalhar com multi-tenant no MedFlow.

---

## 🎯 Visão Geral

O MedFlow usa **Row Level Security (RLS)** no PostgreSQL para garantir isolamento total entre clínicas (tenants). Cada requisição HTTP é automaticamente associada a um tenant através do `TenantMiddleware`.

---

## 🚀 Como Rodar Localmente

### **FASE 5.7a: Rodar com Header `x-tenant-slug` (DEV)**

**Configuração necessária:**

1. **No frontend (`apps/web/.env.local`):**
```env
# Permitir envio do header x-tenant-slug (apenas DEV)
NEXT_PUBLIC_ALLOW_TENANT_HEADER=true

# Slug do tenant a ser usado (obrigatório se ALLOW_TENANT_HEADER=true)
NEXT_PUBLIC_TENANT_SLUG=medflow
```

2. **No backend:** O header `x-tenant-slug` é aceito automaticamente em desenvolvimento (`NODE_ENV !== 'production'`).

**Como funciona:**
- O frontend envia automaticamente o header `x-tenant-slug` com o valor de `NEXT_PUBLIC_TENANT_SLUG`
- O backend aceita o header apenas em DEV/TEST
- Se `NEXT_PUBLIC_TENANT_SLUG` não estiver definido, o frontend mostra erro no console e não envia header

**Exemplo com curl (backend direto):**
```bash
curl -H "x-tenant-slug: medflow" http://localhost:3001/api/patients
```

**Vantagens:**
- ✅ Não precisa configurar DNS/subdomínio
- ✅ Funciona em desenvolvimento local
- ✅ Fácil de testar diferentes tenants

**⚠️ IMPORTANTE:** 
- Em **PRODUÇÃO**, o header `x-tenant-slug` é **IGNORADO** por segurança (pode ser falsificado pelo client)
- Use apenas em desenvolvimento/teste

---

### **FASE 5.7b: Rodar sem Header (Prod-like)**

**Configuração necessária:**

1. **No frontend (`apps/web/.env.local`):**
```env
# NÃO definir NEXT_PUBLIC_ALLOW_TENANT_HEADER (default: false)
# OU definir explicitamente:
NEXT_PUBLIC_ALLOW_TENANT_HEADER=false
```

2. **O tenant será resolvido por:**
   - **Subdomínio do Host** (produção): `medflow.dominio.com` → tenant: `medflow`
   - **Referer** (apenas DEV, se host for localhost): `http://medflow.localhost:3000` → tenant: `medflow`
   - **Fallback DEV** (apenas desenvolvimento): primeiro tenant do banco

**Como funciona:**
- O frontend **NÃO envia** o header `x-tenant-slug`
- O backend resolve o tenant pelo subdomínio do Host
- Em produção, apenas subdomínio é usado (mais seguro)

**Exemplo de configuração para produção:**
```env
# Frontend (.env.production)
NEXT_PUBLIC_ALLOW_TENANT_HEADER=false
# OU simplesmente não definir (default é false)

# Backend resolve tenant automaticamente pelo subdomínio
# Exemplo: https://medflow.dominio.com → tenant: medflow
```

**Vantagens:**
- ✅ Seguro (não pode ser falsificado pelo client)
- ✅ Comportamento igual à produção
- ✅ Funciona com subdomínios reais

---

### **Resumo das Flags de Ambiente**

| Variável | Descrição | Default | Quando Usar |
|----------|-----------|---------|-------------|
| `NEXT_PUBLIC_ALLOW_TENANT_HEADER` | Permite envio do header `x-tenant-slug` | `false` | Apenas em DEV |
| `NEXT_PUBLIC_TENANT_SLUG` | Slug do tenant (obrigatório se `ALLOW_TENANT_HEADER=true`) | - | Apenas em DEV |
| `NODE_ENV` | Ambiente de execução | `development` | Controla comportamento do backend |

---

## 📋 Ordem de Resolução do Tenant

O `TenantMiddleware` resolve o tenant nesta ordem:

### **Em DESENVOLVIMENTO/TESTE (`NODE_ENV !== 'production'`):**

1. **Header `x-tenant-slug`** (prioridade máxima, apenas DEV/TEST)
   - Aceito apenas se `NODE_ENV !== 'production'`
   - Frontend envia apenas se `NEXT_PUBLIC_ALLOW_TENANT_HEADER=true`
2. **Subdomínio do Host** (`medflow.dominio.com` → `medflow`)
3. **Referer** (apenas se host for localhost/127.0.0.1)
4. **Fallback DEV** (primeiro tenant do banco, apenas em desenvolvimento)

### **Em PRODUÇÃO (`NODE_ENV === 'production'`):**

1. **Subdomínio do Host** (`medflow.dominio.com` → `medflow`) - **ÚNICA FONTE**
2. Header `x-tenant-slug` é **IGNORADO** (segurança)
3. Referer é **IGNORADO** (segurança)
4. Fallback é **DESABILITADO**

**Se não encontrar tenant:** Retorna **400 BadRequest** com mensagem clara.

---

## 💻 Como Usar no Código

### **Para Operações Simples (1 query):**

```typescript
// Pode continuar usando this.prisma.client (ainda funciona)
const patient = await this.prisma.client.patient.findFirst({
  where: { id },
});
```

### **Para Operações com Múltiplas Queries (OBRIGATÓRIO):**

```typescript
// Usar tenantPrisma.run para garantir isolamento determinístico
const result = await this.tenantPrisma.run(async (tx) => {
  const patient = await tx.patient.findFirst({ where: { id } });
  const appointment = await tx.appointment.create({ 
    data: { patientId: patient.id, ... } 
  });
  return { patient, appointment };
});
```

**Quando usar `tenantPrisma.run()`:**
- ✅ Métodos que fazem **2+ queries** no banco
- ✅ Operações de **mutação** (create, update, delete)
- ✅ Operações **críticas** (financeiro, prontuário)

**Quando NÃO precisa:**
- ❌ Operações de **leitura simples** (1 query)
- ❌ Endpoints **GET** que já estão funcionando

---

## 🧪 Como Rodar Testes de Isolamento

### **Teste E2E:**

```bash
cd apps/api
pnpm test:e2e tenant-isolation
```

### **O que o teste valida:**

1. ✅ Tenant A só vê dados do tenant A
2. ✅ Tenant B só vê dados do tenant B
3. ✅ Tentativa de acessar dados de outro tenant retorna vazio/null
4. ✅ `TenantPrismaService.run()` funciona corretamente com AsyncLocalStorage

### **Teste Manual:**

```bash
# 1. Criar tenant A e B no banco (via seed ou SQL)
# 2. Criar paciente no tenant A
curl -H "x-tenant-slug: tenant-a" http://localhost:3001/api/patients
# Deve retornar apenas pacientes do tenant A

# 3. Criar paciente no tenant B
curl -H "x-tenant-slug: tenant-b" http://localhost:3001/api/patients
# Deve retornar apenas pacientes do tenant B

# 4. Tentar acessar paciente do tenant B usando header do tenant A
curl -H "x-tenant-slug: tenant-a" http://localhost:3001/api/patients/{id-do-tenant-b}
# Deve retornar 404 ou null
```

---

## 🔍 Debugging

### **Logs Disponíveis:**

O sistema gera logs em vários pontos:

```
[TENANT] Buscando tenant para o slug: medflow | Endpoint: GET /api/patients
[TENANT] ✅ Contexto definido: MedFlow (uuid) | Slug: medflow | Endpoint: GET /api/patients
[TenantPrismaService.run] 🔄 Executando operação com tenant: uuid | Entrou em tenantPrisma.run: true
[TenantPrismaService.run] ✅ Guarda de segurança: contexto de tenant verificado: uuid
[PrismaService.withTenant] ✅ set_config aplicado para tenant: uuid
```

### **Verificar Contexto no Banco:**

Se precisar debugar, você pode verificar o contexto atual:

```sql
-- No Supabase SQL Editor
SELECT current_setting('medflow.current_tenant', true);
```

---

## ⚠️ Regras Importantes

### **NUNCA faça:**

1. ❌ **Não passe `tenantId` manualmente** se estiver usando `tenantPrisma.run()` (ele já pega do contexto)
2. ❌ **Não use `this.prisma.client`** em métodos que fazem múltiplas queries (use `tenantPrisma.run()`)
3. ❌ **Não remova o `tenantId` das queries** ainda (mantém como "cinto e suspensório" por enquanto)

### **SEMPRE faça:**

1. ✅ **Use `tenantPrisma.run()`** em métodos críticos com múltiplas queries
2. ✅ **Mantenha logs** para rastreabilidade
3. ✅ **Teste isolamento** após mudanças críticas

---

## 📚 Arquitetura

### **Fluxo de uma Requisição:**

```
1. Request chega → TenantMiddleware intercepta
   ↓
2. Resolve tenant (header/subdomínio/referer)
   ↓
3. Envolve next() com tenantContext.runAsync(tenantId, ...)
   ↓
4. Controller/Service executa
   ↓
5. Se usar tenantPrisma.run():
   - Obtém tenantId do AsyncLocalStorage
   - Chama prisma.withTenant(tenantId, fn)
   - Abre transação
   - Executa set_config('medflow.current_tenant', tenantId, true)
   - Executa fn(tx) com RLS ativo
   ↓
6. RLS filtra automaticamente por tenant
```

---

## 🐛 Troubleshooting

### **Erro: "Tenant não resolvido"**

**Causa:** `TenantMiddleware` não foi executado ou não encontrou tenant.

**Solução:**
- Verifique se o header `x-tenant-slug` está sendo enviado (DEV)
- Verifique se o subdomínio está configurado (PROD)
- Verifique logs do middleware

### **Erro: "Tenant context não setado corretamente"**

**Causa:** Guarda de segurança detectou que o contexto não foi setado na transação.

**Solução:**
- Verifique se `set_config` está sendo executado no `withTenant`
- Verifique logs do `PrismaService.withTenant`
- Verifique se há algum problema com a transação

### **Dados de outro tenant aparecendo**

**Causa:** RLS não está configurado ou método não está usando `tenantPrisma.run()`.

**Solução:**
- Verifique se as políticas RLS estão ativas no Supabase
- Refatore o método para usar `tenantPrisma.run()`
- Verifique se `tenantId` está sendo passado corretamente nas queries

---

## 📝 Exemplos Práticos

### **Exemplo 1: Criar Agendamento (múltiplas queries)**

```typescript
async create(tenantId: string, dto: CreateAppointmentDto) {
  return this.tenantPrisma.run(async (tx) => {
    // Validações dentro da transação
    const patient = await tx.patient.findFirst({
      where: { id: dto.patientId, tenantId },
    });
    
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado');
    }

    // Criar agendamento dentro da mesma transação
    return tx.appointment.create({
      data: {
        ...dto,
        tenantId,
      },
    });
  });
}
```

### **Exemplo 2: Fechar Caixa (múltiplas queries)**

```typescript
async closeBox(tenantId: string, userId: string, dto: CloseBoxDto) {
  return this.tenantPrisma.run(async (tx) => {
    // Buscar transações dentro da transação
    const transactions = await tx.transaction.findMany({
      where: { tenantId, /* filtros */ },
    });

    // Calcular totais
    const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

    // Criar fechamento dentro da mesma transação
    return tx.dailyClosure.create({
      data: {
        tenantId,
        createdById: userId,
        totalIncome: total,
        /* outros campos */
      },
    });
  });
}
```

---

## ✅ Checklist para Novos Métodos (FASE 5.7c)

Antes de criar um novo método que acessa o banco, siga este checklist:

### **1. Analise o método:**

- [ ] **Quantas queries o método faz?**
  - 1 query simples → Pode usar `this.prisma.client` diretamente
  - 2+ queries → **OBRIGATÓRIO** usar `tenantPrisma.run()`

- [ ] **O método faz mutations (create/update/delete)?**
  - Sim → **OBRIGATÓRIO** usar `tenantPrisma.run()`
  - Não → Verificar outras condições

- [ ] **O método é crítico (financeiro/prontuário)?**
  - Sim → **OBRIGATÓRIO** usar `tenantPrisma.run()` (mesmo para leituras)
  - Não → Verificar outras condições

- [ ] **O método precisa de isolamento determinístico?**
  - Sim → **OBRIGATÓRIO** usar `tenantPrisma.run()`
  - Não → Pode usar `this.prisma.client`

### **2. Decisão:**

| Cenário | Usar | Motivo |
|---------|------|--------|
| 1 query de leitura simples | `this.prisma.client` | RLS já ativo via TenantMiddleware |
| 2+ queries | `tenantPrisma.run()` | Garante isolamento determinístico |
| Mutations (create/update/delete) | `tenantPrisma.run()` | Garante atomicidade e isolamento |
| Endpoints críticos (financeiro/prontuário) | `tenantPrisma.run()` | Máxima segurança, mesmo para leituras |
| Operações que precisam de contexto garantido | `tenantPrisma.run()` | Garante que RLS está ativo na transação |

### **3. Exemplos práticos:**

**✅ CORRETO - Usar `this.prisma.client`:**
```typescript
// 1 query simples de leitura
async findOne(id: string) {
  return this.prisma.client.patient.findFirst({
    where: { id },
  });
}
```

**✅ CORRETO - Usar `tenantPrisma.run()`:**
```typescript
// 2+ queries ou mutation
async create(dto: CreateDto) {
  return this.tenantPrisma.run(async (tx) => {
    const existing = await tx.patient.findFirst({ where: { cpf: dto.cpf } });
    if (existing) throw new ConflictException('CPF já existe');
    return tx.patient.create({ data: dto });
  });
}
```

**❌ ERRADO - Não usar `this.prisma.client` em múltiplas queries:**
```typescript
// ERRADO: múltiplas queries sem tenantPrisma.run()
async create(dto: CreateDto) {
  const existing = await this.prisma.client.patient.findFirst({ where: { cpf: dto.cpf } });
  if (existing) throw new ConflictException('CPF já existe');
  return this.prisma.client.patient.create({ data: dto });
  // ❌ Risco de race condition e isolamento não garantido
}
```

### **4. Regra de ouro:**

> **"Quando em dúvida, use `tenantPrisma.run()`"**
> 
> É melhor garantir isolamento do que correr risco de vazamento de dados entre tenants.

---

## 📖 Referência Rápida

### **Configuração Rápida para DEV:**

**Frontend (`apps/web/.env.local`):**
```env
NEXT_PUBLIC_ALLOW_TENANT_HEADER=true
NEXT_PUBLIC_TENANT_SLUG=medflow
```

**Backend:** Funciona automaticamente em desenvolvimento.

### **Configuração para Produção:**

**Frontend (`apps/web/.env.production`):**
```env
# Não definir NEXT_PUBLIC_ALLOW_TENANT_HEADER (default: false)
```

**Backend:** Resolve tenant automaticamente pelo subdomínio.

### **Comandos Úteis:**

```bash
# Rodar testes de isolamento
cd apps/api && pnpm test:e2e tenant-isolation

# Testar com curl (DEV)
curl -H "x-tenant-slug: medflow" http://localhost:3001/api/patients

# Verificar contexto no banco (Supabase SQL Editor)
SELECT current_setting('medflow.current_tenant', true);
```

---

**Última atualização:** 21 de Janeiro de 2026
