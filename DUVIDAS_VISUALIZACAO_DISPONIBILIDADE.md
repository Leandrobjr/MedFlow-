# Dúvidas sobre Visualização de Disponibilidade

## O que foi implementado até agora:

1. ✅ **Utilitário de cálculo de disponibilidade** (`availability-utils.ts`)
   - Calcula horários disponíveis baseado em configurações, bloqueios e agendamentos

2. ✅ **Visualização DIÁRIA**
   - Mostra horários disponíveis abaixo dos agendamentos
   - Agrupados por profissional
   - Botões clicáveis para agendar diretamente

3. ❌ **Visualização SEMANAL** - NÃO IMPLEMENTADO
4. ❌ **Visualização MENSAL** - NÃO IMPLEMENTADO

## Pontos que precisam de esclarecimento:

### 1. Visualização DIÁRIA (já implementada, mas precisa confirmar):
- [ ] Está aparecendo a seção "Horários Disponíveis"?
- [ ] Os horários estão sendo calculados corretamente?
- [ ] Os botões estão funcionando ao clicar?

### 2. Visualização SEMANAL (como deve aparecer?):
- Opção A: Mostrar disponibilidade como indicadores visuais na grade (ex: células verdes para disponível, vermelhas para ocupado)?
- Opção B: Mostrar uma legenda/lista separada com horários disponíveis por profissional?
- Opção C: Mostrar apenas quando passar o mouse sobre um horário?
- Opção D: Outra forma?

### 3. Visualização MENSAL (como deve aparecer?):
- Opção A: Mostrar quantidade de horários disponíveis em cada dia (ex: "5 slots disponíveis")?
- Opção B: Mostrar indicador visual de disponibilidade (ex: cor diferente nos dias)?
- Opção C: Mostrar quando clicar em um dia específico?
- Opção D: Outra forma?

### 4. Comportamento geral:
- [ ] Quando há filtro por profissional selecionado, deve mostrar disponibilidade apenas desse profissional?
- [ ] Ou sempre mostrar de todos os profissionais?
- [ ] Deve considerar o filtro atual de profissional?

### 5. Problemas possíveis (verificar):
- [ ] Não há configurações de agenda cadastradas?
- [ ] As configurações não estão sendo carregadas?
- [ ] Os bloqueios não estão sendo carregados?
- [ ] Erro no cálculo de disponibilidade?
- [ ] A seção não está aparecendo na interface?

## Para diagnosticar, preciso saber:

1. **O que você está vendo na tela?**
   - A seção "Horários Disponíveis" aparece?
   - Aparece mas está vazia?
   - Não aparece nada?

2. **Há configurações de agenda cadastradas?**
   - Você já configurou agendas para algum profissional?
   - Em qual data você está tentando ver os horários?

3. **O que você esperava ver que não está aparecendo?**
   - Descrição detalhada do comportamento esperado
