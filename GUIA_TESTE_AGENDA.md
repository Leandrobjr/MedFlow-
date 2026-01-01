# Guia de Teste - Módulo de Agenda

## Pré-requisitos

1. **Backend rodando** na porta 3001
2. **Frontend rodando** na porta 3000
3. **Banco de dados** PostgreSQL ativo
4. **Usuário logado** no sistema

## Como Iniciar os Servidores

Se os servidores não estiverem rodando:

```bash
# No diretório raiz do projeto
cd D:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo

# Iniciar backend e frontend
pnpm dev
```

Ou em terminais separados:

```bash
# Terminal 1 - Backend
cd apps/api
pnpm start:dev

# Terminal 2 - Frontend
cd apps/web
pnpm dev
```

## Checklist de Testes

### Parte 1: Configuração Básica de Agenda

- [ ] **Acessar página de configuração**
  - Ir em: Agenda → Configurar Agenda
  - Verificar se a página carrega corretamente

- [ ] **Selecionar profissional**
  - Verificar se a lista de profissionais aparece
  - Selecionar um profissional
  - Verificar se o formulário aparece

- [ ] **Configurar duração padrão**
  - Inserir valor entre 5 e 240 minutos
  - Testar valores inválidos (menor que 5, maior que 240)
  - Verificar mensagens de erro

- [ ] **Selecionar dias da semana**
  - Marcar/desmarcar dias
  - Verificar se pelo menos um dia é obrigatório ao salvar

- [ ] **Salvar configuração**
  - Clicar em "Salvar Configuração"
  - Verificar mensagem de sucesso
  - Verificar se a configuração foi salva

- [ ] **Carregar configuração existente**
  - Selecionar profissional que já tem configuração
  - Verificar se os dados são carregados corretamente

### Parte 2: Períodos de Disponibilidade

- [ ] **Adicionar períodos**
  - Com um dia marcado, clicar em "Adicionar Período"
  - Verificar se o período aparece
  - Adicionar múltiplos períodos

- [ ] **Configurar horários**
  - Definir horário de início e término
  - Testar horário inválido (início >= término)
  - Verificar mensagem de erro

- [ ] **Validar sobreposição**
  - Criar dois períodos que se sobrepõem
  - Tentar salvar
  - Verificar mensagem de erro

- [ ] **Remover períodos**
  - Clicar no botão de remover período
  - Verificar se o período é removido

- [ ] **Salvar com períodos**
  - Adicionar períodos para cada dia marcado
  - Salvar configuração
  - Verificar se os períodos foram salvos

### Parte 3: Bloqueios de Agenda

- [ ] **Acessar aba de bloqueios**
  - Na página de configuração, clicar na aba "Bloqueios"
  - Verificar se a aba muda

- [ ] **Criar bloqueio de dia inteiro**
  - Clicar em "Novo Bloqueio"
  - Selecionar tipo "Dia Inteiro"
  - Preencher data
  - Adicionar motivo (opcional)
  - Salvar
  - Verificar se aparece na lista

- [ ] **Criar bloqueio de período**
  - Criar novo bloqueio
  - Selecionar tipo "Período Específico"
  - Preencher data, horário de início e término
  - Salvar
  - Verificar se aparece na lista

- [ ] **Editar bloqueio**
  - Clicar no botão de editar
  - Modificar dados
  - Salvar
  - Verificar se foi atualizado

- [ ] **Excluir bloqueio**
  - Clicar no botão de excluir
  - Confirmar exclusão
  - Verificar se foi removido

- [ ] **Validar bloqueios**
  - Testar horário inválido (início >= término)
  - Verificar mensagem de erro

### Parte 4: Visualizações de Agenda

- [ ] **Visualização Diária**
  - Na página de Agenda, verificar se está em modo "Dia"
  - Navegar entre dias (anterior/próximo)
  - Clicar em "Ir para Hoje"
  - Verificar se os agendamentos aparecem ordenados por horário

- [ ] **Visualização Semanal**
  - Clicar no botão "Semana"
  - Verificar se a grade semanal aparece
  - Verificar se os dias da semana estão corretos
  - Verificar se os agendamentos aparecem nos horários corretos
  - Navegar entre semanas

- [ ] **Visualização Mensal**
  - Clicar no botão "Mês"
  - Verificar se o calendário aparece
  - Verificar se os agendamentos aparecem nos dias corretos
  - Clicar em um dia para abrir visualização diária
  - Navegar entre meses

- [ ] **Filtro por Profissional**
  - Selecionar um profissional no filtro
  - Verificar se apenas agendamentos desse profissional aparecem
  - Selecionar "Todos os profissionais"
  - Verificar se todos os agendamentos aparecem

- [ ] **Criar agendamento**
  - Clicar em "Novo Agendamento"
  - Preencher formulário
  - Salvar
  - Verificar se aparece na visualização atual

- [ ] **Ações nos agendamentos**
  - Confirmar agendamento
  - Cancelar agendamento
  - Marcar como realizado
  - Excluir agendamento
  - Verificar se as ações funcionam em todas as visualizações

## Problemas Comuns e Soluções

### Backend não está rodando
- Verificar se a porta 3001 está livre
- Verificar se o banco de dados está ativo
- Verificar logs do backend para erros

### Frontend não carrega
- Verificar se a porta 3000 está livre
- Verificar console do navegador para erros
- Verificar se o backend está acessível

### Erro ao salvar configuração
- Verificar se o profissional foi selecionado
- Verificar se pelo menos um dia foi marcado
- Verificar se os períodos estão configurados corretamente
- Verificar console do navegador para erros detalhados

### Agendamentos não aparecem
- Verificar se há agendamentos cadastrados
- Verificar se o filtro de profissional não está ativo
- Verificar se a data selecionada está correta
- Verificar console do navegador para erros de API

## Dados de Teste Sugeridos

1. **Criar profissionais** (se ainda não existirem)
   - Médico 1: Dr. João Silva - Cardiologia
   - Médico 2: Dra. Maria Santos - Pediatria

2. **Criar pacientes** (se ainda não existirem)
   - Paciente 1: João da Silva - CPF: 123.456.789-00
   - Paciente 2: Maria Santos - CPF: 987.654.321-00

3. **Configurar agenda para um profissional**
   - Duração: 30 minutos
   - Dias: Segunda a Sexta
   - Períodos: Manhã (08:00-12:00) e Tarde (14:00-18:00)

4. **Criar bloqueios**
   - Dia inteiro: 15/01/2025 - Motivo: Feriado
   - Período: 20/01/2025 - 14:00 às 16:00 - Motivo: Reunião

5. **Criar agendamentos**
   - Paciente 1 com Médico 1 - 10/01/2025 - 09:00
   - Paciente 2 com Médico 1 - 10/01/2025 - 10:00
   - Paciente 1 com Médico 2 - 11/01/2025 - 14:00

## Resultados Esperados

Após completar todos os testes, você deve ter:

✅ Configuração de agenda funcionando para múltiplos profissionais
✅ Períodos de disponibilidade configurados e validados
✅ Bloqueios de agenda criados, editados e excluídos
✅ Visualizações diária, semanal e mensal funcionando
✅ Filtro por profissional funcionando
✅ Criação e gerenciamento de agendamentos funcionando

## Próximos Passos

Após validar todas as funcionalidades, podemos:
- Integrar validações de configuração na criação de agendamentos
- Adicionar validação de bloqueios na criação de agendamentos
- Melhorar a UX com mais feedback visual
- Adicionar mais funcionalidades conforme necessário
