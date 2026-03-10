# TestSprite AI Testing Report (MCP) — Frontend

## 1️⃣ Document Metadata
- **Project Name:** `repo` (MedFlow Web)
- **Date:** 2026-03-04
- **Prepared by:** TestSprite (via MCP) + análise consolidada
- **Target:** `http://localhost:3000` (túnel TestSprite)

## 2️⃣ Requirement Validation Summary

### Autenticação & sessão
- **TC001 (FAILED)**: login ficou preso em **"Carregando..."** (hidratação/render do client não concluiu; formulário não apareceu).  
  - **Impacto:** bloqueia toda a suíte E2E que depende de autenticação.
- **TC013 (FAILED)**: formulário existe, mas **login não redireciona** para `/dashboard` após submit (spinner persistente após submit).
- **Análise:** o `LoginPage` bloqueia render do formulário enquanto `authLoading` está `true` e a primeira renderização SSR já mostra o spinner. Se a hidratação / bundle `_next/*` falha ou atrasa via túnel (dev server), o teste fica travado no estado inicial.

### Agenda (Agendamentos)
- **TC001 (FAILED)**: não chegou a criar agendamento por bloqueio no login (spinner).
- **TC002 (FAILED)**: pré-condição ausente — não havia slot/bloqueio **"Ocupado"** visível para validar conflito.
  - **Análise:** faltam dados seed/sincronização de bloqueios externos para validar esse cenário.

### Configuração de agenda / Bloqueios
- **TC005 (FAILED)**: salvou configuração, mas **não houve confirmação de sucesso visível** (o teste procurou texto “success/sucesso/salvo/atualizado”).
- **TC007/TC008 (FAILED)**: bloqueio no login (spinner).
  - **Análise:** provável divergência entre o que a UI exibe (toast em PT-BR) e o que o teste procura; e/ou fluxo de autenticação instável via túnel.

### Cadastros (Pacientes / Equipe / Procedimentos / Fornecedores)
- **TC009 (PASSED)**: criação de paciente funcionou (login + CRUD básico).
- **TC011 (FAILED)**: bloqueio no login (spinner).
- **TC015 (FAILED)**: login não redireciona; impede CRUD de fornecedores.

### PEP (Prontuário)
- **TC017/TC018/TC020 (FAILED)**: bloqueio no login (spinner).

### Financeiro (Lançamentos / validações)
- **TC022/TC023 (FAILED)**: bloqueio no login (spinner).
- **TC024 (PASSED)**: validações do formulário de transação (submit vazio) apareceram como esperado.

## 3️⃣ Coverage & Matching Metrics
- **Total de testes executados:** 15
- **✅ Passaram:** 2
- **❌ Falharam:** 13

| Requisito | Total | ✅ | ❌ | Observação |
|---|---:|---:|---:|---|
| Autenticação & sessão | 2 | 0 | 2 | Spinner “Carregando…” / redirecionamento inconsistente |
| Agenda | 2 | 0 | 2 | Login bloqueado + pré-condição “Ocupado” ausente |
| Configuração agenda/bloqueios | 4 | 0 | 4 | Login bloqueado + confirmação de sucesso não detectada |
| Cadastros | 3 | 1 | 2 | Pacientes OK; Equipe/Fornecedores bloqueados por login |
| PEP | 3 | 0 | 3 | Login bloqueado |
| Financeiro | 2 | 1 | 1 | Validação do formulário OK; criação de transação bloqueada por login |

## 4️⃣ Key Gaps / Risks
- **Risco crítico (bloqueio de suíte):** a tela `/login` frequentemente não hidrata no ambiente de testes via túnel e fica presa em `authLoading` (spinner SSR).
- **Risco de confiabilidade:** comportamento **intermitente** (alguns testes logam e seguem; outros travam).
- **Dependência de seed/dados:** cenários de conflito “Ocupado” e vários fluxos exigem dados existentes (profissionais/pacientes/procedimentos/bloqueios) para validar corretamente.
- **Observabilidade de UI:** confirmações (toasts) não são determinísticas para testes (textos/seletores); testes precisam de indicadores estáveis (ex.: `data-testid`).

