# ✅ FASE 2: Preparação Automatizada - CONCLUÍDA

**Data:** 21 de Janeiro de 2026  
**Status:** ✅ **Scripts e Documentação Prontos**

---

## 📋 O que foi criado

### ✅ **1. Guia Completo: `FASE2_SUPABASE_GUIA.md`**
- Passo a passo detalhado para configurar o Supabase
- Instruções para criar projeto e obter `DATABASE_URL`
- Comandos prontos para executar migrações
- Troubleshooting de problemas comuns

### ✅ **2. Scripts de Automação**

#### **Windows PowerShell: `scripts/setup-supabase.ps1`**
```powershell
.\scripts\setup-supabase.ps1 -DatabaseUrl "postgresql://postgres:senha@host:port/db"
```

#### **Linux/Mac/Bash: `scripts/setup-supabase.sh`**
```bash
chmod +x scripts/setup-supabase.sh
./scripts/setup-supabase.sh "postgresql://postgres:senha@host:port/db"
```

**O que os scripts fazem:**
- ✅ Configuram `DATABASE_URL`
- ✅ Geram cliente Prisma
- ✅ Executam migrações (com opção de escolha)
- ✅ Aplicam schema ao banco de dados

---

## 🎯 O que você precisa fazer manualmente

### **Passo 1: Criar Projeto no Supabase** (5 minutos)
1. Acesse https://supabase.com
2. Crie conta/login
3. Crie novo projeto:
   - Nome: `medflow-production`
   - Senha: Crie uma senha forte (anote!)
   - Região: Escolha a mais próxima
4. Aguarde criação do projeto

### **Passo 2: Obter DATABASE_URL** (2 minutos)
1. No Supabase: **Settings → Database**
2. Copie a URL do **Connection Pooler** (porta 6543)
3. Substitua `[YOUR-PASSWORD]` pela senha criada
4. Anote a URL completa

### **Passo 3: Executar Scripts** (5 minutos)

**Opção A: Usar Script Automatizado (Recomendado)**

**Windows:**
```powershell
cd d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo
.\scripts\setup-supabase.ps1 -DatabaseUrl "SUA_DATABASE_URL_AQUI"
```

**Linux/Mac:**
```bash
cd /caminho/para/medflow-repo/repo
chmod +x scripts/setup-supabase.sh
./scripts/setup-supabase.sh "SUA_DATABASE_URL_AQUI"
```

**Opção B: Executar Manualmente**

```bash
# 1. Navegar até packages/db
cd packages/db

# 2. Configurar DATABASE_URL
# Windows PowerShell:
$env:DATABASE_URL="SUA_DATABASE_URL_AQUI"

# Linux/Mac:
export DATABASE_URL="SUA_DATABASE_URL_AQUI"

# 3. Gerar cliente Prisma
pnpm prisma generate

# 4. Criar migrações
pnpm prisma migrate dev --name init_production

# OU aplicar schema diretamente:
pnpm prisma db push
```

### **Passo 4: Configurar RLS** (3 minutos)
1. No Supabase: **SQL Editor → New query**
2. Abra o arquivo: `packages/db/prisma/rls.sql`
3. Copie TODO o conteúdo
4. Cole no SQL Editor do Supabase
5. Clique em **Run**

### **Passo 5: Verificar** (2 minutos)
1. No Supabase: **Table Editor**
2. Verifique se todas as tabelas foram criadas
3. Teste conexão: `pnpm prisma studio` (deve abrir)

---

## ✅ Checklist da Fase 2

- [ ] Projeto criado no Supabase
- [ ] `DATABASE_URL` obtida e anotada
- [ ] Script executado OU migrações executadas manualmente
- [ ] RLS configurado (arquivo `rls.sql` executado)
- [ ] Tabelas verificadas no Table Editor
- [ ] Conexão testada

---

## 📚 Documentação

- **Guia Completo:** `FASE2_SUPABASE_GUIA.md`
- **Scripts:** `scripts/setup-supabase.ps1` e `scripts/setup-supabase.sh`
- **RLS:** `packages/db/prisma/rls.sql`

---

## 🔑 Informações Importantes

### **DATABASE_URL - Formato**

Use a URL do **Connection Pooler** (porta 6543):
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**NÃO use a URL direta** (porta 5432) para produção.

### **Segurança**

- ⚠️ **NUNCA** commite a `DATABASE_URL` no Git
- ⚠️ Guarde a senha em lugar seguro
- ⚠️ Use variáveis de ambiente sempre

---

## 🎯 Próximo Passo

Após completar a Fase 2, você terá:
- ✅ Banco de dados configurado
- ✅ `DATABASE_URL` pronta
- ✅ Tabelas criadas
- ✅ RLS configurado

**Próxima Fase:** **FASE 3: Configuração do Backend (Render)**

Você precisará da `DATABASE_URL` para configurar no Render.

---

**Tempo Total Estimado:** 15-20 minutos  
**Dificuldade:** Média (requer atenção aos detalhes)

**Boa sorte! 🚀**
