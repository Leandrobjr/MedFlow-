# 🚀 Guia Rápido de Deploy - MedFlow

Este é um resumo executivo. Para detalhes completos, consulte `PLANEJAMENTO_DEPLOY_PRODUCAO.md`.

---

## 📋 Checklist Rápido

### 1. Preparação (15 min)
- [ ] Criar arquivos `render.yaml` e `vercel.json` (já criados)
- [ ] Atualizar `next.config.ts` (já atualizado)
- [ ] Adicionar `postinstall` no `package.json` do backend (já adicionado)

### 2. Supabase - Banco de Dados (20 min)
- [ ] Criar projeto em https://supabase.com
- [ ] Copiar `DATABASE_URL` (substituir `[YOUR-PASSWORD]`)
- [ ] Executar migrações: `cd packages/db && pnpm prisma migrate deploy`
- [ ] Executar RLS: Copiar conteúdo de `packages/db/prisma/rls.sql` no SQL Editor

### 3. Render - Backend (30 min)
- [ ] Criar conta em https://render.com
- [ ] Criar Web Service conectando ao GitHub
- [ ] Configurar:
  - Build: `cd apps/api && pnpm install && pnpm build && cd ../../packages/db && pnpm prisma generate`
  - Start: `cd apps/api && pnpm start:prod`
- [ ] Adicionar variáveis:
  - `DATABASE_URL` (do Supabase)
  - `JWT_SECRET` (gerar: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
  - `FRONTEND_URL` (atualizar depois com URL da Vercel)
  - `NODE_ENV=production`
  - `PORT=10000`
- [ ] Aguardar deploy e anotar URL (ex: `https://medflow-api.onrender.com`)

### 4. Vercel - Frontend (20 min)
- [ ] Criar conta em https://vercel.com
- [ ] Importar projeto do GitHub
- [ ] Configurar:
  - Build: `cd apps/web && pnpm install && pnpm build`
  - Root: raiz do projeto
- [ ] Adicionar variável:
  - `NEXT_PUBLIC_API_URL` = URL do Render (ex: `https://medflow-api.onrender.com`)
- [ ] Atualizar `vercel.json` com URL real do Render
- [ ] Aguardar deploy e anotar URL (ex: `https://medflow-repo-xxxxx.vercel.app`)

### 5. Resend - E-mails (15 min) - Opcional
- [ ] Criar conta em https://resend.com
- [ ] Gerar API Key
- [ ] Adicionar no Render:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`

### 6. Cloudflare - SSL/Segurança (30 min) - Opcional (se tiver domínio)
- [ ] Criar conta em https://cloudflare.com
- [ ] Adicionar domínio
- [ ] Atualizar nameservers no registrador
- [ ] Configurar DNS:
  - `@` → CNAME para Vercel (proxy ON)
  - `api` → CNAME para Render (proxy OFF)
- [ ] SSL: Modo "Full"

### 7. Atualizar Configurações (10 min)
- [ ] Atualizar `FRONTEND_URL` no Render com URL da Vercel
- [ ] Atualizar `NEXT_PUBLIC_API_URL` na Vercel (se necessário)
- [ ] Fazer redeploy se necessário

### 8. Testes (30 min)
- [ ] Testar acesso ao frontend
- [ ] Testar login/cadastro
- [ ] Testar chamadas de API (DevTools → Network)
- [ ] Verificar logs no Render e Vercel
- [ ] Testar SSL (se configurado)

---

## 🔑 Variáveis de Ambiente Necessárias

### Render (Backend)
```
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://postgres:SENHA@db.xxxxx.supabase.co:5432/postgres
JWT_SECRET=[gerar com comando acima]
FRONTEND_URL=https://medflow-repo-xxxxx.vercel.app
RESEND_API_KEY=re_xxxxx (opcional)
RESEND_FROM_EMAIL=onboarding@resend.dev (opcional)
```

### Vercel (Frontend)
```
NEXT_PUBLIC_API_URL=https://medflow-api.onrender.com
```

---

## ⚠️ Problemas Comuns

1. **Erro de conexão com banco:** Verificar `DATABASE_URL` e senha
2. **CORS Error:** Verificar `FRONTEND_URL` no Render e `NEXT_PUBLIC_API_URL` na Vercel
3. **Prisma não encontrado:** Verificar se `postinstall` está no `package.json`
4. **Build falha:** Verificar logs completos, testar build local primeiro

---

## 📞 URLs Importantes

- **Render Dashboard:** https://dashboard.render.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://app.supabase.com
- **Resend Dashboard:** https://resend.com/emails
- **Cloudflare Dashboard:** https://dash.cloudflare.com

---

**Tempo Total Estimado:** 2-3 horas  
**Dificuldade:** Média

Para detalhes completos, consulte `PLANEJAMENTO_DEPLOY_PRODUCAO.md`.
