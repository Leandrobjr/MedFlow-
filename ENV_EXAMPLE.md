# 📝 Exemplo de Variáveis de Ambiente

Este arquivo mostra exemplos de como configurar as variáveis de ambiente em cada serviço.

---

## 🔧 Render (Backend)

Configure estas variáveis no painel do Render: **Settings → Environment**

```bash
# Ambiente
NODE_ENV=production
PORT=10000

# Banco de Dados (Supabase)
DATABASE_URL=postgresql://postgres:SUA_SENHA_AQUI@db.abcdefghijklmnop.supabase.co:5432/postgres

# Autenticação JWT (gerar senha aleatória)
JWT_SECRET=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567abc890def123ghi456jkl789mno012pqr345stu678vwx901yz234

# Frontend URL (atualizar após deploy na Vercel)
FRONTEND_URL=https://medflow-repo-xxxxx.vercel.app

# E-mails (Resend) - Opcional
RESEND_API_KEY=re_1234567890abcdefghijklmnopqrstuvwxyz
RESEND_FROM_EMAIL=onboarding@resend.dev
```

**Como gerar JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 🌐 Vercel (Frontend)

Configure estas variáveis no painel da Vercel: **Settings → Environment Variables**

```bash
# URL da API (Render)
NEXT_PUBLIC_API_URL=https://medflow-api.onrender.com
```

**⚠️ IMPORTANTE:** 
- Substitua `medflow-api.onrender.com` pela URL real do seu backend no Render
- Variáveis que começam com `NEXT_PUBLIC_` são expostas ao navegador (não coloque segredos aqui!)

---

## 🗄️ Supabase (Banco de Dados)

A `DATABASE_URL` é obtida automaticamente no Supabase:

1. Vá em **Settings → Database**
2. Role até **"Connection string"**
3. Selecione **"URI"**
4. Copie a URL e substitua `[YOUR-PASSWORD]` pela senha do projeto

**Formato:**
```
postgresql://postgres:SENHA@db.xxxxx.supabase.co:5432/postgres
```

---

## 📧 Resend (E-mails)

A `RESEND_API_KEY` é obtida no Resend:

1. Vá em **API Keys**
2. Clique em **"Create API Key"**
3. Copie a chave gerada

**Formato:**
```
re_1234567890abcdefghijklmnopqrstuvwxyz
```

---

## ⚠️ Segurança

1. **NUNCA** commite essas variáveis no Git
2. **SEMPRE** use variáveis de ambiente nos serviços
3. **NÃO** compartilhe senhas ou API keys publicamente
4. **ROTE** senhas periodicamente (especialmente `JWT_SECRET`)

---

## 🔄 Atualizando Variáveis

### Render
1. Vá em **Settings → Environment**
2. Edite ou adicione variáveis
3. Clique em **"Save Changes"**
4. O serviço será redeployado automaticamente

### Vercel
1. Vá em **Settings → Environment Variables**
2. Edite ou adicione variáveis
3. Clique em **"Save"**
4. Faça um novo deploy ou aguarde o próximo commit

---

## ✅ Verificação

Após configurar, verifique:

1. **Render:** Logs devem mostrar conexão com banco OK
2. **Vercel:** Build deve completar sem erros
3. **Frontend:** Deve conseguir fazer requisições para o backend
4. **Backend:** Deve aceitar requisições do frontend (sem erro CORS)

---

**Para mais detalhes, consulte `PLANEJAMENTO_DEPLOY_PRODUCAO.md`**
