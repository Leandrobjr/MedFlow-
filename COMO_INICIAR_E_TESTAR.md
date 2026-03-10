# 🚀 Como Iniciar e Testar o Aplicativo

## 📋 Pré-requisitos

- Node.js e pnpm instalados
- Banco de dados configurado (Supabase)
- Variáveis de ambiente configuradas

---

## 🎯 Iniciar o Aplicativo

### **Opção 1: Iniciar API e Web Separadamente (Recomendado)**

#### **Terminal 1 - API (Backend):**

```powershell
cd "d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\apps\api"
pnpm start:dev
```

**O que vai acontecer:**
- API iniciará na porta `3001`
- Você verá: `Nest application successfully started`
- Logs: `API rodando em http://0.0.0.0:3001`

#### **Terminal 2 - Web (Frontend):**

```powershell
cd "d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\apps\web"
pnpm dev
```

**O que vai acontecer:**
- Web iniciará na porta `3000`
- Você verá: `Local: http://localhost:3000`
- Abra o navegador em: `http://localhost:3000`

---

### **Opção 2: Usar Scripts Batch (Mais Rápido)**

#### **Para API:**

```powershell
cd "d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\apps\api"
.\start-dev.bat
```

#### **Para Web:**

```powershell
cd "d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\apps\web"
.\start-web.bat
```

---

## ⚙️ Configuração do Frontend (Importante!)

Antes de iniciar o Web, configure o arquivo `apps/web/.env.local`:

```env
# Permitir header x-tenant-slug (apenas DEV)
NEXT_PUBLIC_ALLOW_TENANT_HEADER=true

# Slug do tenant (obrigatório se ALLOW_TENANT_HEADER=true)
NEXT_PUBLIC_TENANT_SLUG=medflow
```

**Ou, se preferir comportamento de produção (sem header):**

```env
# Não definir NEXT_PUBLIC_ALLOW_TENANT_HEADER (default: false)
# O tenant será resolvido pelo subdomínio
```

---

## 🧪 Como Testar

### **1. Testar Login no Navegador:**

1. Abra: `http://localhost:3000/login`
2. Use as credenciais:
   - **Email:** `admin@medflow.local`
   - **Senha:** (a senha configurada no seed)
3. Clique em "Entrar no sistema"

**O que verificar:**
- ✅ Login bem-sucedido
- ✅ Redirecionamento para dashboard
- ✅ Sem erros no console do navegador

---

### **2. Testar API Diretamente (curl/Postman):**

#### **Teste de Health Check:**

```powershell
curl http://localhost:3001/health
```

**Resposta esperada:** `{"status":"ok"}`

#### **Teste com Tenant Header (DEV):**

```powershell
curl -H "x-tenant-slug: medflow" http://localhost:3001/api/patients
```

**Resposta esperada:** Lista de pacientes do tenant `medflow`

#### **Teste de Login via API:**

```powershell
curl -X POST http://localhost:3001/auth/login `
  -H "Content-Type: application/json" `
  -H "x-tenant-slug: medflow" `
  -d '{\"email\":\"admin@medflow.local\",\"password\":\"sua_senha\"}'
```

**Resposta esperada:** Token JWT e dados do usuário

---

### **3. Testar Isolamento Multi-Tenant:**

#### **Criar pacientes em tenants diferentes:**

```powershell
# Tenant A
curl -X POST http://localhost:3001/api/patients `
  -H "Content-Type: application/json" `
  -H "x-tenant-slug: medflow" `
  -d '{\"name\":\"Paciente A\",\"cpf\":\"12345678901\"}'

# Tenant B (se existir medflow1)
curl -X POST http://localhost:3001/api/patients `
  -H "Content-Type: application/json" `
  -H "x-tenant-slug: medflow1" `
  -d '{\"name\":\"Paciente B\",\"cpf\":\"98765432109\"}'
```

#### **Verificar isolamento:**

```powershell
# Listar pacientes do Tenant A
curl -H "x-tenant-slug: medflow" http://localhost:3001/api/patients

# Listar pacientes do Tenant B
curl -H "x-tenant-slug: medflow1" http://localhost:3001/api/patients
```

**Resultado esperado:**
- Cada tenant vê apenas seus próprios pacientes
- Não há vazamento de dados entre tenants

---

## 🔍 Verificar se Está Funcionando

### **Checklist Rápido:**

- [ ] API iniciou sem erros (porta 3001)
- [ ] Web iniciou sem erros (porta 3000)
- [ ] Login funciona no navegador
- [ ] Dashboard carrega corretamente
- [ ] Sem erros no console do navegador
- [ ] Sem erros no terminal da API

---

## 🐛 Troubleshooting

### **Erro: "Porta já em uso"**

**Solução:**
```powershell
# Verificar processos usando as portas
netstat -ano | findstr :3001
netstat -ano | findstr :3000

# Matar processo (substitua PID pelo número encontrado)
taskkill /PID <PID> /F
```

### **Erro: "Tenant não identificado"**

**Solução:**
1. Verifique se `apps/web/.env.local` está configurado
2. Verifique se `NEXT_PUBLIC_TENANT_SLUG=medflow` está definido
3. Verifique se o tenant `medflow` existe no banco de dados

### **Erro: "Cannot connect to database"**

**Solução:**
1. Verifique se o Supabase está acessível
2. Verifique as variáveis de ambiente (`.env` na raiz ou `apps/api/.env`)
3. Verifique se `DATABASE_URL` está configurada corretamente

### **Erro: "401 Unauthorized" no login**

**Solução:**
1. Verifique se o usuário existe no banco para o tenant correto
2. Verifique se o header `x-tenant-slug` está sendo enviado
3. Verifique os logs da API para mais detalhes

---

## 📝 Comandos Rápidos de Referência

### **Iniciar API:**
```powershell
cd apps/api
pnpm start:dev
```

### **Iniciar Web:**
```powershell
cd apps/web
pnpm dev
```

### **Build da API:**
```powershell
cd apps/api
pnpm build
```

### **Testes E2E:**
```powershell
cd apps/api
pnpm test:e2e tenant-isolation
```

### **Verificar Status do Git:**
```powershell
git status
```

---

## ✅ Ordem Recomendada de Inicialização

1. **Primeiro:** Inicie a API (Terminal 1)
   ```powershell
   cd apps/api
   pnpm start:dev
   ```
   Aguarde: `Nest application successfully started`

2. **Depois:** Inicie o Web (Terminal 2)
   ```powershell
   cd apps/web
   pnpm dev
   ```
   Aguarde: `Ready in Xs`

3. **Por último:** Abra o navegador
   - Acesse: `http://localhost:3000/login`

---

**Data:** 21 de Janeiro de 2026
