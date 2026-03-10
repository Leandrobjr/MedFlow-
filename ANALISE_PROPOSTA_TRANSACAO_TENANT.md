# 📊 Análise: Proposta de Transação por Request para Multi-Tenant

**Data:** 21 de Janeiro de 2026  
**Objetivo:** Avaliar viabilidade, riscos e benefícios da proposta de envolver cada request em transação com `set_config` para RLS.

---

## 🎯 Resumo Executivo

**Proposta:** Envolver cada requisição HTTP em uma transação do Prisma, configurando o tenant via `set_config(..., true)` dentro da transação e injetando o cliente de transação no request.

**Decisão Recomendada:** ⚠️ **NÃO RECOMENDADO** para implementação imediata. A solução atual funciona e a proposta traz riscos significativos sem benefícios claros para o cenário atual.

**Alternativa Recomendada:** ✅ **SOLUÇÃO HÍBRIDA** - Usar transação apenas para operações que já precisam (mutations) e manter `SET LOCAL` para leituras.

---

## 📋 Situação Atual (Como Funciona Hoje)

### **Arquitetura Atual:**

1. **TenantMiddleware** (`tenant.middleware.ts`):
   - Resolve o tenant pelo subdomínio
   - Chama `prisma.setTenantContext(tenantId)`
   - Executa: `SET LOCAL medflow.current_tenant = 'uuid'`

2. **PrismaService** (`prisma.service.ts`):
   - Método `setTenantContext()` executa `SET LOCAL`
   - Todas as queries seguintes usam o contexto

3. **Services** (15 arquivos):
   - Injetam `PrismaService` no construtor
   - Usam `this.prisma.client.patient.findMany()` etc
   - Passam `tenantId` manualmente nas queries (redundante, mas seguro)

### **Problemas Identificados na Solução Atual:**

- ⚠️ `SET LOCAL` só dura durante a statement/transação atual
- ⚠️ Se uma query não estiver na mesma transação, pode perder o contexto
- ⚠️ Redundância: código passa `tenantId` manualmente mesmo com RLS
- ✅ Mas funciona! Não há evidências de problemas reais

---

## 🔍 Análise da Proposta

### **O Que a Proposta Sugere:**

```typescript
// No TenantMiddleware:
1. Resolver tenantId
2. Abrir transação: prisma.$transaction(async (tx) => { ... })
3. Dentro da transação: set_config('medflow.current_tenant', tenantId, true)
4. Injetar tx no request: req.db = tx
5. Chamar next() dentro da transação
6. Services usam req.db ao invés de this.prisma
```

### **Diferença Técnica:**

| Aspecto | Atual (`SET LOCAL`) | Proposta (`set_config` + transação) |
|---------|---------------------|-------------------------------------|
| **Duração** | Durante statement/transação atual | Durante toda a transação |
| **Escopo** | Statement individual | Request completo |
| **Performance** | Leve (apenas SQL) | Pesado (transação completa) |
| **Rollback** | Não aplicável | Automático em caso de erro |
| **Timeout** | Não aplicável | Risco de timeout em requests longos |

---

## ✅ Benefícios da Proposta

### **1. Garantia de Isolamento Total**
- ✅ Contexto de tenant garantido durante toda a requisição
- ✅ Não há risco de perder contexto entre queries
- ✅ Rollback automático se algo der errado

### **2. Consistência de Dados**
- ✅ Todas as operações do request são atômicas
- ✅ Se uma falhar, todas são revertidas
- ✅ Evita estados inconsistentes

### **3. Segurança Adicional**
- ✅ Impossível esquecer de setar o contexto
- ✅ RLS sempre ativo durante a transação
- ✅ Menos chance de bugs de isolamento

---

## ⚠️ Riscos e Problemas da Proposta

### **1. Performance Crítica** 🔴

**Problema:**
- Transações são **pesadas** e mantêm locks no banco
- Requests simples (GET) não precisam de transação
- Pode causar **deadlocks** e **timeouts**

**Exemplo:**
```
GET /api/patients → Abre transação → Lê pacientes → Fecha transação
```
Isso é **overkill** para uma simples leitura!

**Impacto:**
- ⚠️ Requests podem ficar mais lentos
- ⚠️ Banco de dados pode ficar sobrecarregado
- ⚠️ Risco de timeout em requests longos (>30s)

### **2. Refatoração Massiva** 🔴

**Problema:**
- **15 services** precisam ser refatorados
- Todos os controllers precisam acessar `req.db`
- Mudança arquitetural significativa

**O que precisa mudar:**
```typescript
// ANTES (atual):
constructor(private readonly prisma: PrismaService) {}
async findAll(tenantId: string) {
  return this.prisma.client.patient.findMany({ ... });
}

// DEPOIS (proposta):
// Não pode mais injetar PrismaService no construtor!
// Precisa receber req no método ou usar decorator
async findAll(req: Request) {
  return req.db.patient.findMany({ ... });
}
```

**Impacto:**
- ⚠️ **169 ocorrências** de `this.prisma` precisam ser alteradas
- ⚠️ Testes precisam ser reescritos
- ⚠️ Risco alto de introduzir bugs

### **3. Complexidade de Debug** 🟡

**Problema:**
- Transações são mais difíceis de debugar
- Logs ficam mais complexos
- Erros podem ser menos claros

**Impacto:**
- ⚠️ Mais difícil identificar problemas
- ⚠️ Stack traces mais complexos

### **4. Timeout em Requests Longos** 🔴

**Problema:**
- Transações têm timeout padrão (geralmente 30s-60s)
- Requests longos (relatórios, exports) podem falhar
- Não é possível aumentar timeout facilmente

**Exemplo:**
```
GET /api/reports/monthly → Pode demorar 45s → Timeout!
```

**Impacto:**
- ⚠️ Funcionalidades podem quebrar
- ⚠️ Usuários podem perder dados

### **5. Deadlocks Potenciais** 🟡

**Problema:**
- Múltiplas transações simultâneas podem causar deadlocks
- PostgreSQL resolve, mas pode causar retries e lentidão

**Impacto:**
- ⚠️ Performance degradada em picos de uso
- ⚠️ Alguns requests podem falhar temporariamente

### **6. Incompatibilidade com Prisma** 🟡

**Problema:**
- Prisma não foi projetado para request-scoped transactions
- Pode haver problemas com connection pooling
- Pode não funcionar bem com Supabase (pooler)

**Impacto:**
- ⚠️ Comportamento imprevisível
- ⚠️ Pode não funcionar em produção

---

## 💡 Alternativas Recomendadas

### **Opção 1: Solução Híbrida (RECOMENDADA)** ✅

**Conceito:** Usar transação apenas para operações que já precisam (mutations) e manter `SET LOCAL` para leituras.

**Como funciona:**
- ✅ **GET requests:** Mantém `SET LOCAL` atual (leve e rápido)
- ✅ **POST/PUT/DELETE requests:** Usa transação com `set_config`
- ✅ **Operações complexas:** Já usam transação quando necessário

**Vantagens:**
- ✅ Melhor dos dois mundos
- ✅ Refatoração mínima (só mutations)
- ✅ Performance mantida para leituras
- ✅ Segurança garantida para escritas

**Implementação:**
```typescript
// Interceptor para mutations
@UseInterceptors(TransactionInterceptor)
@Post('/patients')
async create(@Req() req, @Body() dto) {
  // req.db já é a transação
  return this.patientsService.create(req.db, dto);
}
```

**Risco:** 🟢 Baixo  
**Esforço:** 🟡 Médio (só mutations)  
**Benefício:** 🟢 Alto

---

### **Opção 2: Melhorar Solução Atual** ✅

**Conceito:** Corrigir problemas do `SET LOCAL` sem usar transações.

**O que fazer:**
- ✅ Garantir que `setTenantContext()` é chamado antes de cada query
- ✅ Usar interceptor para garantir contexto sempre setado
- ✅ Remover `tenantId` manual das queries (confiar no RLS)

**Vantagens:**
- ✅ Refatoração mínima
- ✅ Performance mantida
- ✅ Risco baixo

**Risco:** 🟢 Baixo  
**Esforço:** 🟢 Baixo  
**Benefício:** 🟡 Médio

---

### **Opção 3: Implementar Proposta Completa** ⚠️

**Conceito:** Implementar exatamente como proposto.

**Quando fazer:**
- ⚠️ Apenas se houver problemas reais com a solução atual
- ⚠️ Apenas após validar que não há problemas de performance
- ⚠️ Apenas com testes extensivos

**Risco:** 🔴 Alto  
**Esforço:** 🔴 Muito Alto  
**Benefício:** 🟡 Médio (não resolve problemas reais)

---

## 📊 Comparação: Atual vs Proposta vs Híbrida

| Critério | Atual | Proposta Completa | Híbrida |
|----------|-------|-------------------|---------|
| **Performance (GET)** | ✅ Excelente | ❌ Ruim | ✅ Excelente |
| **Performance (POST)** | ✅ Boa | ✅ Boa | ✅ Boa |
| **Segurança** | ✅ Boa | ✅ Excelente | ✅ Excelente |
| **Refatoração** | ✅ Nenhuma | ❌ Massiva | 🟡 Média |
| **Risco** | ✅ Baixo | ❌ Alto | 🟡 Médio |
| **Manutenibilidade** | ✅ Simples | ❌ Complexa | ✅ Simples |
| **Escalabilidade** | ✅ Boa | ⚠️ Limitada | ✅ Boa |

---

## 🎯 Recomendação Final

### **NÃO implementar a proposta completa agora** pelos seguintes motivos:

1. ❌ **Não há problemas reais** com a solução atual
2. ❌ **Risco muito alto** de introduzir bugs
3. ❌ **Performance degradada** sem benefício claro
4. ❌ **Refatoração massiva** desnecessária

### **Implementar Solução Híbrida** quando:

1. ✅ Precisar de garantia de atomicidade em mutations
2. ✅ Tiver tempo para refatorar apenas mutations
3. ✅ Quiser melhorar segurança sem sacrificar performance

### **Melhorar Solução Atual** agora:

1. ✅ Adicionar interceptor para garantir contexto sempre setado
2. ✅ Remover `tenantId` manual das queries (confiar no RLS)
3. ✅ Adicionar testes para validar isolamento

---

## 📝 Passo a Passo para Aprovação

### **Fase 1: Validação (ANTES de qualquer implementação)**

#### **Passo 1.1: Validar Problemas Atuais**
- [ ] Verificar logs de produção para erros de isolamento
- [ ] Testar cenários de concorrência
- [ ] Validar se RLS está funcionando corretamente
- [ ] Documentar problemas encontrados (se houver)

**Tempo estimado:** 2-4 horas  
**Responsável:** Desenvolvedor sênior

#### **Passo 1.2: Teste de Performance**
- [ ] Criar benchmark comparando `SET LOCAL` vs transação
- [ ] Testar com carga simulada (100+ requests simultâneos)
- [ ] Medir latência e throughput
- [ ] Documentar resultados

**Tempo estimado:** 4-6 horas  
**Responsável:** Desenvolvedor sênior

#### **Passo 1.3: Análise de Impacto**
- [ ] Listar todos os endpoints que seriam afetados
- [ ] Identificar endpoints críticos (relatórios, exports)
- [ ] Estimar tempo de refatoração
- [ ] Criar plano de rollback

**Tempo estimado:** 2-3 horas  
**Responsável:** Tech Lead

---

### **Fase 2: Decisão**

#### **Passo 2.1: Revisão dos Resultados**
- [ ] Apresentar resultados da Fase 1
- [ ] Discutir prós e contras com time
- [ ] Decidir: Atual, Híbrida ou Completa

**Tempo estimado:** 1 hora (reunião)  
**Responsável:** Tech Lead + Time

#### **Passo 2.2: Aprovação Formal**
- [ ] Documentar decisão
- [ ] Criar PRD da solução escolhida
- [ ] Obter aprovação do stakeholder

**Tempo estimado:** 1-2 horas  
**Responsável:** Product Owner

---

### **Fase 3: Implementação (SE APROVADO)**

#### **Opção A: Solução Híbrida (Recomendada)**

**Passo 3.1: Criar Transaction Interceptor**
- [ ] Criar `TransactionInterceptor` para mutations
- [ ] Implementar lógica de `set_config` dentro da transação
- [ ] Testar isoladamente

**Tempo estimado:** 4-6 horas

**Passo 3.2: Refatorar Mutations**
- [ ] Identificar todos os endpoints POST/PUT/DELETE
- [ ] Adicionar `@UseInterceptors(TransactionInterceptor)`
- [ ] Alterar services para receber `tx` ao invés de usar `this.prisma`
- [ ] Testar cada endpoint

**Tempo estimado:** 8-12 horas (depende do número de endpoints)

**Passo 3.3: Testes e Validação**
- [ ] Testes unitários para cada mutation
- [ ] Testes de integração
- [ ] Testes de carga
- [ ] Validação de isolamento

**Tempo estimado:** 6-8 horas

**Total:** 18-26 horas

---

#### **Opção B: Melhorar Solução Atual**

**Passo 3.1: Criar Context Interceptor**
- [ ] Criar interceptor que garante `setTenantContext()` sempre executado
- [ ] Adicionar logs para debug
- [ ] Testar isoladamente

**Tempo estimado:** 2-3 horas

**Passo 3.2: Remover tenantId Manual**
- [ ] Identificar queries que passam `tenantId` manualmente
- [ ] Remover (confiar no RLS)
- [ ] Testar cada endpoint

**Tempo estimado:** 4-6 horas

**Passo 3.3: Testes e Validação**
- [ ] Testes de isolamento
- [ ] Validação de segurança
- [ ] Testes de regressão

**Tempo estimado:** 3-4 horas

**Total:** 9-13 horas

---

#### **Opção C: Proposta Completa (NÃO RECOMENDADO)**

**Passo 3.1: Refatorar TenantMiddleware**
- [ ] Implementar transação no middleware
- [ ] Implementar `set_config` dentro da transação
- [ ] Injetar `tx` no request

**Tempo estimado:** 4-6 horas

**Passo 3.2: Refatorar TODOS os Services**
- [ ] Alterar 15 services para não usar `this.prisma`
- [ ] Modificar 169 ocorrências de queries
- [ ] Atualizar todos os controllers

**Tempo estimado:** 20-30 horas

**Passo 3.3: Refatorar TODOS os Testes**
- [ ] Reescrever testes unitários
- [ ] Reescrever testes de integração
- [ ] Validar tudo funciona

**Tempo estimado:** 15-20 horas

**Passo 3.4: Testes Extensivos**
- [ ] Testes de performance
- [ ] Testes de carga
- [ ] Testes de isolamento
- [ ] Testes de timeout

**Tempo estimado:** 8-10 horas

**Total:** 47-66 horas (1-2 semanas de trabalho)

---

## ✅ Checklist de Aprovação

Antes de aprovar qualquer implementação, confirme:

- [ ] **Problema real identificado:** Há evidências de problemas com a solução atual?
- [ ] **Benchmark realizado:** Performance foi testada e comparada?
- [ ] **Impacto avaliado:** Todos os riscos foram mapeados?
- [ ] **Plano de rollback:** Como voltar atrás se der errado?
- [ ] **Tempo disponível:** Há tempo suficiente para implementação e testes?
- [ ] **Prioridade justificada:** Isso é mais importante que outras features?

---

## 🎯 Conclusão

A proposta é **tecnicamente viável**, mas **não recomendada** para implementação imediata porque:

1. ❌ Não resolve problemas reais
2. ❌ Introduz riscos significativos
3. ❌ Requer refatoração massiva
4. ❌ Pode degradar performance

**Recomendação:** Implementar **Solução Híbrida** quando houver necessidade real de garantias de atomicidade, ou **Melhorar Solução Atual** para garantir contexto sempre setado.

**Próximo passo:** Executar Fase 1 (Validação) antes de qualquer decisão.

---

**Documento criado por:** Análise técnica sênior  
**Data:** 21 de Janeiro de 2026  
**Status:** Aguardando aprovação para Fase 1
