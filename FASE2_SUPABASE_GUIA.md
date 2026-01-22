# 🗄️ FASE 2: Configuração do Banco de Dados (Supabase) - Guia Prático

**Data:** 21 de Janeiro de 2026  
**Status:** 📋 **Guia de Execução**

---

## 🎯 Objetivo

Configurar o banco de dados PostgreSQL no Supabase e preparar todas as tabelas e políticas de segurança necessárias para o MedFlow.

---

## 📋 Passo a Passo Detalhado

### **Passo 2.1: Criar Conta e Projeto no Supabase**

1. **Acesse:** https://supabase.com
2. **Clique em:** "Start your project" ou "Sign Up"
3. **Escolha método de login:**
   - ✅ **Recomendado:** Login com GitHub (mais rápido)
   - Ou crie conta com e-mail
4. **Após login, clique em:** "New Project"

### **Passo 2.2: Configurar o Projeto**

Preencha os seguintes campos:

| Campo | Valor Sugerido | Observações |
|-------|----------------|-------------|
| **Name** | `medflow-production` | Nome do projeto |
| **Database Password** | `[CRIAR SENHA FORTE]` | ⚠️ **ANOTE EM LUGAR SEGURO!** |
| **Region** | `South America (São Paulo)` | Ou mais próxima de você |
| **Pricing Plan** | `Free` | Para começar |

**Como criar senha forte:**
- Mínimo 12 caracteres
- Use letras maiúsculas, minúsculas, números e símbolos
- Exemplo: `MedFlow2026!@#Prod`

5. **Clique em:** "Create new project"
6. **Aguarde:** 2-3 minutos enquanto o Supabase cria o projeto

---

### **Passo 2.3: Obter a URL de Conexão (DATABASE_URL)**

1. No painel do Supabase, vá em **Settings** (ícone de engrenagem no menu lateral)
2. Clique em **Database**
3. Role até a seção **"Connection string"**
4. Selecione a aba **"URI"** (não "Session mode")
5. Você verá algo como:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
   
   **OU** (formato antigo):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```

6. **Copie esta URL**
7. **Substitua `[YOUR-PASSWORD]`** pela senha que você criou no Passo 2.2
8. **Anote a URL completa** - você precisará dela para o Render!

**Exemplo de URL final:**
```
postgresql://postgres.abcdefghijklmnop:MedFlow2026!@#Prod@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

**⚠️ IMPORTANTE:** 
- Use a URL com **pooler** (porta 6543) para aplicações serverless como Render
- Guarde esta URL em lugar seguro (não commite no Git!)

---

### **Passo 2.4: Executar Migrações do Prisma**

Agora você precisa criar todas as tabelas no banco de dados.

#### **Opção A: Usando Prisma Migrate (Recomendado)**

No terminal, execute os seguintes comandos:

```bash
# 1. Navegar até a pasta do banco de dados
cd d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\packages\db

# 2. Configurar a DATABASE_URL temporariamente
# Windows PowerShell:
$env:DATABASE_URL="postgresql://postgres.SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"

# Windows CMD:
set DATABASE_URL=postgresql://postgres.SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres

# Linux/Mac:
export DATABASE_URL="postgresql://postgres.SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"

# 3. Gerar o cliente Prisma
pnpm prisma generate

# 4. Criar e aplicar migrações
pnpm prisma migrate dev --name init_production

# OU se já existirem migrações:
pnpm prisma migrate deploy
```

**O que acontece:**
- Prisma cria todas as tabelas no banco do Supabase
- Cria índices e relacionamentos
- Aplica todas as estruturas do `schema.prisma`

#### **Opção B: Usando Prisma DB Push (Mais Rápido, mas sem histórico)**

```bash
# 1. Navegar até a pasta do banco de dados
cd d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\packages\db

# 2. Configurar DATABASE_URL (mesmo processo acima)

# 3. Gerar cliente Prisma
pnpm prisma generate

# 4. Enviar schema diretamente para o banco
pnpm prisma db push
```

**⚠️ Diferença:**
- `migrate dev`: Cria histórico de migrações (recomendado para produção)
- `db push`: Aplica schema diretamente (mais rápido, mas sem histórico)

---

### **Passo 2.5: Configurar Row Level Security (RLS)**

O RLS garante que cada clínica só veja seus próprios dados.

1. No painel do Supabase, vá em **SQL Editor** (ícone de banco de dados no menu lateral)
2. Clique em **"New query"**
3. Abra o arquivo `packages/db/prisma/rls.sql` no seu editor de código
4. **Copie TODO o conteúdo** do arquivo
5. **Cole no SQL Editor** do Supabase
6. Clique em **"Run"** ou pressione `Ctrl+Enter` (ou `Cmd+Enter` no Mac)

**O que acontece:**
- Habilita RLS em todas as tabelas sensíveis
- Cria políticas de isolamento por `tenant_id`
- Garante segurança multi-tenant no banco de dados

**Verificação:**
- Após executar, você deve ver mensagem de sucesso
- Se houver erros, verifique se as tabelas foram criadas primeiro (Passo 2.4)

---

### **Passo 2.6: Verificar se Tudo Funcionou**

#### **Verificar Tabelas:**

1. No Supabase, vá em **Table Editor** (menu lateral)
2. Você deve ver todas as tabelas:
   - ✅ `tenants`
   - ✅ `users`
   - ✅ `patients`
   - ✅ `staff`
   - ✅ `appointments`
   - ✅ `medical_records`
   - ✅ `transactions`
   - ✅ `daily_closures`
   - ✅ `medical_fees`
   - ✅ E outras...

#### **Verificar RLS:**

1. No Supabase, vá em **Authentication** → **Policies**
2. Ou vá em **SQL Editor** e execute:
   ```sql
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```
3. Você deve ver políticas para todas as tabelas sensíveis

#### **Testar Conexão:**

No terminal, teste a conexão:

```bash
cd packages/db
pnpm prisma studio
```

Isso abre o Prisma Studio. Se conectar, está tudo OK!

---

## ✅ Checklist da Fase 2

- [ ] Conta criada no Supabase
- [ ] Projeto criado (`medflow-production`)
- [ ] Senha do banco anotada em lugar seguro
- [ ] `DATABASE_URL` obtida e anotada
- [ ] Migrações executadas (tabelas criadas)
- [ ] RLS configurado (arquivo `rls.sql` executado)
- [ ] Tabelas verificadas no Table Editor
- [ ] Conexão testada com Prisma Studio

---

## 🔑 Informações Importantes

### **DATABASE_URL - Formato Correto**

O Supabase oferece duas URLs:

1. **Direct Connection** (porta 5432):
   ```
   postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
   - Limite de conexões simultâneas
   - Não recomendado para produção

2. **Connection Pooler** (porta 6543) ✅ **USE ESTA:**
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
   - Suporta muitas conexões simultâneas
   - Ideal para aplicações serverless (Render)
   - **Recomendado para produção**

### **Segurança**

- ⚠️ **NUNCA** commite a `DATABASE_URL` no Git
- ⚠️ **NUNCA** compartilhe a senha do banco
- ⚠️ Use variáveis de ambiente sempre
- ⚠️ Rote a senha periodicamente

---

## 🐛 Problemas Comuns

### **Erro: "relation does not exist"**

**Causa:** Tabelas não foram criadas ainda.

**Solução:**
1. Execute as migrações primeiro (Passo 2.4)
2. Verifique se a `DATABASE_URL` está correta

### **Erro: "password authentication failed"**

**Causa:** Senha incorreta na `DATABASE_URL`.

**Solução:**
1. Verifique se substituiu `[YOUR-PASSWORD]` corretamente
2. Verifique se não há espaços extras na URL
3. Tente resetar a senha no Supabase (Settings → Database → Reset database password)

### **Erro: "could not connect to server"**

**Causa:** URL incorreta ou região errada.

**Solução:**
1. Verifique se está usando a URL do Connection Pooler (porta 6543)
2. Verifique se a região está correta
3. Tente usar a URL direta (porta 5432) para testes

### **RLS não funciona**

**Causa:** Políticas não foram criadas ou tabelas não têm RLS habilitado.

**Solução:**
1. Execute o arquivo `rls.sql` novamente
2. Verifique se todas as tabelas têm RLS habilitado:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```

---

## 📚 Próximos Passos

Após completar a Fase 2, você terá:

- ✅ Banco de dados PostgreSQL funcionando
- ✅ Todas as tabelas criadas
- ✅ RLS configurado
- ✅ `DATABASE_URL` pronta para usar no Render

**Próxima Fase:** **FASE 3: Configuração do Backend (Render)**

Você precisará da `DATABASE_URL` para configurar as variáveis de ambiente no Render.

---

## 📞 Links Úteis

- **Supabase Dashboard:** https://app.supabase.com
- **Documentação Supabase:** https://supabase.com/docs
- **Prisma Docs:** https://www.prisma.io/docs

---

**Boa sorte! 🚀**
