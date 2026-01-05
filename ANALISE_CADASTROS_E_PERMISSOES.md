# 🔍 Análise Crítica: Cadastros e Sistema de Permissões

**Data:** Janeiro 2025  
**Analista:** Dev Senior  
**Status:** ⚠️ Requer Decisão Arquitetural

---

## 📋 Resumo da Proposta

1. **Reorganizar Menu**: Criar item "CADASTROS" agrupando: Pacientes, Equipe, Procedimentos, Fornecedores
2. **Cadastro de Procedimentos**: Novo módulo com nome, valor bruto, observações
3. **Sistema de Permissões Granulares**: Adicionar permissões individuais na Equipe (Financeiro, Prontuário, Cadastros, etc.)
4. **Cadastro de Fornecedores**: Novo módulo
5. **Staff ↔ Procedimentos**: Relacionamento many-to-many (profissional realiza quais procedimentos)

---

## ✅ Pontos Positivos

### 1. Reorganização do Menu (CADASTROS)
- ✅ **Baixo impacto**: Apenas alteração de estrutura visual
- ✅ **Melhora UX**: Agrupamento lógico facilita navegação
- ✅ **Sem riscos técnicos**: Mudança apenas no frontend

### 2. Cadastro de Procedimentos
- ✅ **Módulo simples**: Estrutura clara (nome, valor, observações)
- ✅ **Alinhado com negócio**: Necessário para faturamento futuro
- ✅ **Baixa complexidade técnica**: CRUD padrão

### 3. Cadastro de Fornecedores
- ✅ **Módulo simples**: Similar a outros cadastros
- ✅ **Baixa complexidade técnica**: CRUD padrão

### 4. Staff ↔ Procedimentos (Many-to-Many)
- ✅ **Relacionamento claro**: Um profissional realiza múltiplos procedimentos
- ✅ **Padrão conhecido**: Many-to-many é comum no Prisma
- ✅ **Baixa complexidade técnica**: Tabela de relacionamento simples

---

## 🔴 Problemas Críticos Identificados

### ⚠️ PROBLEMA #1: Sistema de Permissões Granulares vs RBAC Atual

**Situação Atual:**
- Sistema usa **RBAC (Role-Based Access Control)** baseado em 4 roles fixas:
  - `OWNER`, `ADMIN`, `DOCTOR`, `RECEPTIONIST`
- Proteção de rotas via decorator `@Roles(UserRole.ADMIN, UserRole.OWNER)`
- Guards verificam role do usuário (não permissões individuais)

**Proposta:**
- Adicionar permissões granulares no cadastro de Equipe:
  - Financeiro
  - Prontuário
  - Cadastros de pacientes
  - Equipe
  - Cadastro Procedimentos
  - Faturamento (só recepção)
  - Cadastro de fornecedores

**Problemas Identificados:**

1. **Mudança Arquitetural Significativa**
   - Sistema atual é **Role-Based**, proposta é **Permission-Based**
   - Requer refatoração de toda camada de autorização
   - Impacto em: Guards, Decorators, Controllers, Frontend

2. **Onde Armazenar Permissões?**
   - Opção A: Campo JSON no Staff (rápido, mas pouco flexível)
   - Opção B: Tabela de Permissões separada (mais robusto, mais complexo)
   - Opção C: Tabela UserPermissions (many-to-many User ↔ Permission)

3. **Como Validar Permissões?**
   - Precisa criar novo decorator `@Permissions('financeiro', 'prontuario')`
   - Precisa refatorar `RolesGuard` para `PermissionsGuard`
   - Precisa verificar permissões em cada endpoint

4. **Compatibilidade com Roles Existentes**
   - Como mapear roles atuais para permissões?
   - OWNER deve ter todas as permissões?
   - O que acontece com usuários existentes?

5. **Complexidade no Frontend**
   - Precisa verificar permissões para mostrar/ocultar menus
   - Precisa verificar permissões antes de chamar APIs
   - Duplicação de lógica (backend + frontend)

**Estimativa de Impacto:**
- **Tempo**: 3-5 dias de desenvolvimento
- **Arquivos afetados**: ~30-40 arquivos
- **Risco**: Alto (pode quebrar funcionalidades existentes)
- **Complexidade**: Alta

**Recomendação Crítica:**

💡 **ALTERNATIVA PROPOSTA**: Manter RBAC e criar mapeamento role → permissões

**Solução Híbrida (Recomendada):**
1. Manter roles existentes (OWNER, ADMIN, DOCTOR, RECEPTIONIST)
2. Criar enum/mapa de permissões:
   ```typescript
   enum Permission {
     FINANCIAL = 'financial',
     MEDICAL_RECORD = 'medical_record',
     PATIENT_CADASTRO = 'patient_cadastro',
     STAFF_CADASTRO = 'staff_cadastro',
     PROCEDURE_CADASTRO = 'procedure_cadastro',
     BILLING = 'billing',
     SUPPLIER_CADASTRO = 'supplier_cadastro',
   }
   
   const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
     [UserRole.OWNER]: [/* todas */],
     [UserRole.ADMIN]: [Permission.FINANCIAL, Permission.PATIENT_CADASTRO, ...],
     [UserRole.DOCTOR]: [Permission.MEDICAL_RECORD, ...],
     [UserRole.RECEPTIONIST]: [Permission.BILLING, Permission.PATIENT_CADASTRO, ...],
   }
   ```
3. Adicionar campo opcional `customPermissions?: Permission[]` no Staff (para customizações futuras)
4. Usar decorator `@Permissions()` que verifica role + customPermissions

**Vantagens:**
- ✅ Compatível com sistema atual
- ✅ Permite customizações futuras
- ✅ Menor impacto (refatoração menor)
- ✅ Mantém segurança (role continua sendo base)

**Desvantagens:**
- ⚠️ Não é totalmente Permission-Based puro
- ⚠️ Ainda depende de roles

---

## 📊 Análise de Impacto por Item

| Item | Complexidade | Impacto | Risco | Tempo Estimado |
|------|-------------|---------|-------|----------------|
| Menu CADASTROS | Baixa | Baixo | Baixo | 2-3 horas |
| Cadastro Procedimentos | Média | Médio | Baixo | 1-2 dias |
| Permissões Granulares | **ALTA** | **ALTO** | **ALTO** | 3-5 dias |
| Cadastro Fornecedores | Média | Médio | Baixo | 1-2 dias |
| Staff ↔ Procedimentos | Média | Médio | Baixo | 1 dia |

**Total Estimado (com permissões granulares)**: 7-11 dias  
**Total Estimado (com solução híbrida)**: 5-7 dias

---

## 🎯 Recomendações

### ✅ IMPLEMENTAR AGORA (Baixo Risco)

1. **Menu CADASTROS**
   - Implementação simples
   - Melhora UX
   - Sem riscos

2. **Cadastro de Procedimentos**
   - Módulo necessário para o negócio
   - Complexidade controlada
   - Base para outras funcionalidades

3. **Staff ↔ Procedimentos**
   - Relacionamento claro
   - Necessário para agendamentos/faturamento
   - Complexidade controlada

4. **Cadastro de Fornecedores**
   - Módulo simples
   - Necessário para expansão futura
   - Complexidade controlada

### ⚠️ DECIDIR ANTES DE IMPLEMENTAR (Alto Risco)

**Sistema de Permissões Granulares**

**Opções:**

#### Opção A: Implementação Completa Permission-Based (3-5 dias)
- ✅ Máxima flexibilidade
- ✅ Permissões totalmente customizáveis
- ❌ Alto risco de quebrar funcionalidades existentes
- ❌ Refatoração extensiva
- ❌ Alto esforço de teste

#### Opção B: Solução Híbrida Recomendada (2-3 dias)
- ✅ Compatível com sistema atual
- ✅ Permite customizações futuras
- ✅ Menor risco
- ✅ Menor refatoração
- ⚠️ Não é 100% Permission-Based puro

#### Opção C: Manter Apenas Roles (0 dias)
- ✅ Sem mudanças
- ✅ Zero risco
- ❌ Não atende requisito de permissões granulares
- ❌ Limitado a 4 roles fixas

**Minha Recomendação**: **Opção B (Solução Híbrida)**

---

## 📝 Plano de Implementação Sugerido

### Fase 1: Itens de Baixo Risco (3-4 dias)
1. Menu CADASTROS (2-3 horas)
2. Cadastro de Procedimentos (1-2 dias)
3. Staff ↔ Procedimentos (1 dia)
4. Cadastro de Fornecedores (1 dia)

### Fase 2: Sistema de Permissões (2-3 dias) - APÓS DECISÃO
1. Decidir abordagem (A, B ou C)
2. Implementar solução escolhida
3. Testes extensivos
4. Migração de dados (se necessário)

---

## ❓ Perguntas para Decisão

1. **Sobre Permissões Granulares:**
   - A flexibilidade de permissões individuais é **essencial agora** ou pode ser **futura**?
   - Os 4 roles atuais (OWNER, ADMIN, DOCTOR, RECEPTIONIST) cobrem 80% dos casos?
   - Há necessidade real de um ADMIN sem acesso a Financeiro, por exemplo?

2. **Sobre Faturamento:**
   - "Só recepção pode faturar" - isso já não está coberto pelo role RECEPTIONIST?
   - Ou há casos onde outros roles também precisam faturar?

3. **Sobre Priorização:**
   - Estas funcionalidades são **bloqueadoras** para o MVP?
   - Ou podem ser implementadas após validação do MVP?

---

## 🚨 Riscos Identificados

1. **Alto**: Refatoração do sistema de autorização pode introduzir bugs de segurança
2. **Médio**: Mudança de permissões pode quebrar funcionalidades existentes
3. **Baixo**: Novos módulos (Procedimentos, Fornecedores) são isolados, baixo risco

---

**Última atualização**: Janeiro 2025  

---

## ✅ DECISÃO TOMADA (Após análise com usuário)

**Respostas:**
1. Permissões granulares: **Futuras** (não bloqueador para MVP)
2. OWNER vs ADMIN: **Não precisa diferenciação** (podem ser iguais)
3. ADMIN sem acesso Financeiro: **Não necessário**
4. ADMIN faturar: **Já está implementado!** (FinanceController já permite ADMIN)

**Plano Final para MVP:**
- ✅ **Implementar AGORA**: Menu CADASTROS, Procedimentos, Fornecedores, Staff ↔ Procedimentos
- ⏸️ **Adiar para pós-MVP**: Sistema de permissões granulares
- ✅ **Verificado**: ADMIN já pode faturar (sem alterações necessárias)

**Estimativa Final (apenas itens necessários)**: 4-5 dias
