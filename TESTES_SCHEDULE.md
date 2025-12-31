# Testes do Módulo Schedule

## Status dos Endpoints

### ✅ Endpoints Criados

1. **POST /schedule/config** - Criar configuração de agenda
   - Requer: ADMIN, OWNER ou DOCTOR
   - Valida: staffId existe e pertence ao tenant
   - Valida: não existe configuração duplicada

2. **GET /schedule/config/staff/:staffId** - Buscar configuração
   - Requer: Autenticação (qualquer role)
   - Retorna: null se não existir

3. **PATCH /schedule/config/staff/:staffId** - Atualizar configuração
   - Requer: ADMIN, OWNER ou DOCTOR
   - Valida: configuração existe

4. **POST /schedule/blocks** - Criar bloqueio
   - Requer: ADMIN, OWNER ou DOCTOR
   - Valida: staffId existe
   - Valida: datas e horários

5. **GET /schedule/blocks/staff/:staffId** - Listar bloqueios
   - Requer: Autenticação
   - Suporta filtros: startDate, endDate

6. **PATCH /schedule/blocks/:id** - Atualizar bloqueio
   - Requer: ADMIN, OWNER ou DOCTOR

7. **DELETE /schedule/blocks/:id** - Deletar bloqueio
   - Requer: ADMIN, OWNER ou DOCTOR

## Como Testar

### 1. Preparação
- Certifique-se de que o backend está rodando na porta 3001
- Faça login para obter o token de autenticação
- Obtenha um `staffId` válido (listar profissionais)

### 2. Teste Manual via HTTP

Use o arquivo `apps/api/test-schedule.http` com a extensão REST Client do VS Code ou similar.

**Passos:**
1. Fazer login e copiar o token
2. Listar profissionais para obter um `staffId`
3. Criar configuração de agenda
4. Buscar configuração
5. Atualizar configuração
6. Criar bloqueios (dia inteiro e período)
7. Listar bloqueios
8. Atualizar e deletar bloqueios

### 3. Validações Implementadas

✅ **ScheduleConfig:**
- Staff deve existir e pertencer ao tenant
- Não permite configuração duplicada
- `weeklySchedule` é armazenado como JSON e parseado no retorno
- `defaultDuration` em minutos

✅ **ScheduleBlock:**
- Staff deve existir
- Validação de datas (endDate >= startDate)
- Para `blockType = "period"`, valida horários obrigatórios
- Suporta bloqueios recorrentes

## Próximos Passos

1. ✅ Backend completo e testado
2. ⏳ Interface de configuração no frontend (dividir em partes)
3. ⏳ Integração com validação de agendamentos
4. ⏳ Visualizações de agenda (mensal, semanal, diária)

## Notas

- O `weeklySchedule` é armazenado como JSON string no banco
- O serviço parseia automaticamente no retorno
- Todos os endpoints respeitam multi-tenancy via `tenantId`
- Bloqueios podem ser de dia inteiro (`date`) ou período específico (`period`)

