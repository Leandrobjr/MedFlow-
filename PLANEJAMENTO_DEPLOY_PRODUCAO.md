# 🚀 Planejamento de Deploy em Produção - MedFlow

**Data:** 21 de Janeiro de 2026  
**Status:** 📋 Planejamento Inicial

---

## 📋 Resumo Executivo

Este documento detalha o passo a passo completo para publicar o MedFlow em produção usando os seguintes serviços:

- **Frontend (Web):** Vercel
- **Backend (API):** Render
- **Banco de Dados:** Supabase (PostgreSQL)
- **E-mails:** Resend
- **Segurança/SSL:** Cloudflare

**Tempo Estimado Total:** 4-6 horas (incluindo testes)  
**Complexidade:** Média (requer configuração de múltiplos serviços)

---

## 🎯 O Que Vamos Fazer (Visão Geral)

Imagine que você tem uma casa (seu aplicativo) e precisa:
1. **Construir a fundação** (banco de dados no Supabase)
2. **Colocar a casa em um terreno** (backend no Render)
3. **Colocar a fachada** (frontend na Vercel)
4. **Configurar a correspondência** (e-mails com Resend)
5. **Colocar segurança** (Cloudflare para SSL e proteção)

Cada etapa é independente, mas precisa ser feita na ordem correta.

---

## 📦 Pré-requisitos

Antes de começar, você precisa ter:

1. ✅ **Conta no GitHub** (seu código já está lá)
2. ✅ **Conta no Supabase** (grátis): https://supabase.com
3. ✅ **Conta no Render** (grátis com limitações): https://render.com
4. ✅ **Conta na Vercel** (grátis): https://vercel.com
5. ✅ **Conta no Resend** (grátis até 3.000 e-mails/mês): https://resend.com
6. ✅ **Conta no Cloudflare** (grátis): https://cloudflare.com
7. ✅ **Domínio próprio** (opcional, mas recomendado): ex: `medflow.com.br`

---

## 🔧 FASE 1: Preparação do Projeto

### **O que vamos fazer:**
Preparar o código para funcionar em produção, ajustando configurações e criando arquivos necessários.

### **Passo 1.1: Criar arquivo de configuração para produção**

**O que é:** Arquivos que dizem aos serviços como construir e rodar sua aplicação.

**Ação:** Criar os seguintes arquivos na raiz do projeto:

#### **A) Arquivo `render.yaml` (para o Render)**

Criar arquivo `render.yaml` na raiz do projeto:

```yaml
services:
  - type: web
    name: medflow-api
    env: node
    buildCommand: cd apps/api && pnpm install && pnpm build
    startCommand: cd apps/api && pnpm start:prod
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false  # Será configurado manualmente
      - key: JWT_SECRET
        sync: false  # Será configurado manualmente
      - key: FRONTEND_URL
        sync: false  # Será configurado manualmente
```

**Explicação:** Este arquivo diz ao Render:
- Como construir o backend (`buildCommand`)
- Como iniciar o backend (`startCommand`)
- Quais variáveis de ambiente são necessárias

#### **B) Arquivo `vercel.json` (para a Vercel)**

Criar arquivo `vercel.json` na raiz do projeto:

```json
{
  "buildCommand": "cd apps/web && pnpm install && pnpm build",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://medflow-api.onrender.com/:path*"
    }
  ],
  "env": {
    "NEXT_PUBLIC_API_URL": "https://medflow-api.onrender.com"
  }
}
```

**Explicação:** Este arquivo diz à Vercel:
- Como construir o frontend
- Para onde redirecionar chamadas de API (para o Render)
- Qual é a URL da API em produção

**⚠️ IMPORTANTE:** Substituir `medflow-api.onrender.com` pela URL real que você receberá do Render depois.

#### **C) Atualizar `next.config.ts`**

Modificar `apps/web/next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remover rewrites em produção (será feito via vercel.json)
  async rewrites() {
    // Só usar rewrites em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:3001/:path*',
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
```

**Explicação:** Em produção, não precisamos redirecionar para localhost. A Vercel fará isso via `vercel.json`.

### **Passo 1.2: Atualizar `package.json` do backend**

Adicionar script de produção em `apps/api/package.json`:

```json
{
  "scripts": {
    "build": "nest build",
    "start:prod": "node dist/main",
    "postinstall": "cd ../../packages/db && pnpm prisma generate"
  }
}
```

**Explicação:** O `postinstall` roda automaticamente após instalar dependências, garantindo que o Prisma esteja pronto.

---

## 🗄️ FASE 2: Configuração do Banco de Dados (Supabase)

### **O que vamos fazer:**
Criar o banco de dados PostgreSQL no Supabase e configurar a conexão.

### **Passo 2.1: Criar projeto no Supabase**

1. Acesse https://supabase.com
2. Clique em **"Start your project"** ou **"New Project"**
3. Faça login com GitHub (recomendado) ou crie uma conta
4. Preencha:
   - **Name:** `medflow-production`
   - **Database Password:** Crie uma senha forte (anote em lugar seguro!)
   - **Region:** Escolha a mais próxima (ex: `South America (São Paulo)`)
   - **Pricing Plan:** Free (para começar)

5. Clique em **"Create new project"**
6. Aguarde 2-3 minutos enquanto o Supabase cria o projeto

### **Passo 2.2: Obter a URL de conexão**

1. No painel do Supabase, vá em **Settings** → **Database**
2. Role até a seção **"Connection string"**
3. Selecione **"URI"** (não "Session mode")
4. Copie a URL que aparece (algo como):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
5. **Substitua `[YOUR-PASSWORD]`** pela senha que você criou
6. **Anote esta URL completa** - você precisará dela depois!

**Exemplo de URL final:**
```
postgresql://postgres:MinhaSenh@123@db.abcdefghijklmnop.supabase.co:5432/postgres
```

### **Passo 2.3: Executar migrações do banco**

**O que é:** Criar todas as tabelas e estruturas no banco de dados.

**Ação:** No seu computador local, execute:

```bash
# 1. Configurar a URL do banco temporariamente
export DATABASE_URL="postgresql://postgres:SUA_SENHA@db.xxxxx.supabase.co:5432/postgres"

# 2. Gerar o cliente Prisma
cd packages/db
pnpm prisma generate

# 3. Executar as migrações
pnpm prisma migrate deploy
```

**Explicação:** Isso cria todas as tabelas (patients, appointments, transactions, etc.) no banco do Supabase.

**⚠️ IMPORTANTE:** Se você já tem dados no banco local, precisará fazer um backup e restaurar no Supabase (isso é mais avançado, podemos fazer depois se necessário).

### **Passo 2.4: Configurar Row Level Security (RLS)**

**O que é:** RLS é uma camada de segurança que impede que uma clínica veja dados de outra.

**Ação:** No Supabase, vá em **SQL Editor** e execute o conteúdo do arquivo `packages/db/prisma/rls.sql`.

**Como fazer:**
1. No painel do Supabase, clique em **SQL Editor**
2. Clique em **"New query"**
3. Abra o arquivo `packages/db/prisma/rls.sql` no seu editor
4. Copie todo o conteúdo
5. Cole no SQL Editor do Supabase
6. Clique em **"Run"** ou pressione `Ctrl+Enter`

**Explicação:** Isso ativa a segurança multi-tenant no banco de dados.

---

## ⚙️ FASE 3: Configuração do Backend (Render)

### **O que vamos fazer:**
Publicar a API NestJS no Render para que ela fique acessível na internet.

### **Passo 3.1: Criar conta e conectar GitHub**

1. Acesse https://render.com
2. Clique em **"Get Started for Free"**
3. Faça login com GitHub (recomendado)
4. Autorize o Render a acessar seus repositórios

### **Passo 3.2: Criar novo serviço Web**

1. No painel do Render, clique em **"New +"** → **"Web Service"**
2. Conecte seu repositório GitHub:
   - Selecione o repositório `medflow-repo` (ou o nome do seu repo)
   - Clique em **"Connect"**
3. Preencha as configurações:

   **Basic Settings:**
   - **Name:** `medflow-api`
   - **Region:** Escolha a mais próxima (ex: `Oregon (US West)` ou `Frankfurt (EU Central)`)
   - **Branch:** `main` (ou `master`, dependendo do seu repo)
   - **Root Directory:** Deixe vazio (raiz do projeto)
   - **Runtime:** `Node`
   - **Build Command:** `cd apps/api && pnpm install && pnpm build && cd ../../packages/db && pnpm prisma generate`
   - **Start Command:** `cd apps/api && pnpm start:prod`

   **Explicação dos comandos:**
   - **Build Command:** Instala dependências, constrói a API e gera o cliente Prisma
   - **Start Command:** Inicia a API em modo produção

### **Passo 3.3: Configurar variáveis de ambiente**

No Render, vá em **"Environment"** e adicione:

| Variável | Valor | Onde encontrar |
|----------|-------|----------------|
| `NODE_ENV` | `production` | Fixo |
| `PORT` | `10000` | Fixo (Render usa esta porta) |
| `DATABASE_URL` | `postgresql://postgres:...` | Copiado do Supabase (Passo 2.2) |
| `JWT_SECRET` | `[GERAR SENHA ALEATÓRIA]` | Veja abaixo |
| `FRONTEND_URL` | `https://medflow.vercel.app` | Será atualizado depois (URL da Vercel) |

**Como gerar JWT_SECRET seguro:**
No terminal, execute:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copie o resultado e cole como valor de `JWT_SECRET`.

**⚠️ IMPORTANTE:** 
- Não compartilhe essas senhas publicamente
- Guarde-as em lugar seguro
- Você pode atualizar `FRONTEND_URL` depois que a Vercel estiver pronta

### **Passo 3.4: Deploy inicial**

1. Clique em **"Create Web Service"**
2. O Render começará a fazer o deploy automaticamente
3. Aguarde 5-10 minutos (primeira vez é mais lento)
4. Você verá logs em tempo real do processo

**O que esperar:**
- ✅ Build iniciando
- ✅ Instalando dependências
- ✅ Compilando TypeScript
- ✅ Gerando Prisma Client
- ✅ Serviço iniciado

### **Passo 3.5: Obter URL da API**

Após o deploy concluir:

1. No painel do Render, você verá uma URL como: `https://medflow-api.onrender.com`
2. **Anote esta URL** - você precisará dela para configurar a Vercel
3. Teste acessando: `https://medflow-api.onrender.com` (deve retornar algo ou erro 404, mas não erro de conexão)

**⚠️ IMPORTANTE:** 
- A primeira requisição pode demorar alguns segundos (Render "acorda" o serviço)
- Serviços gratuitos do Render "dormem" após 15 minutos de inatividade

---

## 🌐 FASE 4: Configuração do Frontend (Vercel)

### **O que vamos fazer:**
Publicar o frontend Next.js na Vercel para que os usuários possam acessar.

### **Passo 4.1: Criar conta e conectar GitHub**

1. Acesse https://vercel.com
2. Clique em **"Sign Up"**
3. Faça login com GitHub
4. Autorize a Vercel a acessar seus repositórios

### **Passo 4.2: Importar projeto**

1. No painel da Vercel, clique em **"Add New..."** → **"Project"**
2. Selecione o repositório `medflow-repo`
3. Clique em **"Import"**

### **Passo 4.3: Configurar build**

A Vercel detectará automaticamente que é um projeto Next.js, mas precisamos ajustar:

**Project Settings:**
- **Framework Preset:** Next.js (já detectado)
- **Root Directory:** Deixe vazio (raiz do projeto)
- **Build Command:** `cd apps/web && pnpm install && pnpm build`
- **Output Directory:** `apps/web/.next` (deixe vazio, a Vercel detecta automaticamente)
- **Install Command:** `pnpm install`

**Environment Variables:**
Adicione:
- `NEXT_PUBLIC_API_URL` = `https://medflow-api.onrender.com` (URL do Render do Passo 3.5)

**⚠️ IMPORTANTE:** Substitua `medflow-api.onrender.com` pela URL real do seu backend no Render.

### **Passo 4.4: Atualizar `vercel.json`**

Se você criou o arquivo `vercel.json` no Passo 1.1, certifique-se de que a URL da API está correta:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://SUA-URL-DO-RENDER.onrender.com/:path*"
    }
  ],
  "env": {
    "NEXT_PUBLIC_API_URL": "https://SUA-URL-DO-RENDER.onrender.com"
  }
}
```

### **Passo 4.5: Deploy**

1. Clique em **"Deploy"**
2. Aguarde 3-5 minutos
3. A Vercel mostrará logs do processo de build

**O que esperar:**
- ✅ Instalando dependências
- ✅ Compilando Next.js
- ✅ Otimizando imagens e assets
- ✅ Deploy concluído

### **Passo 4.6: Obter URL do frontend**

Após o deploy:

1. Você receberá uma URL como: `https://medflow-repo-xxxxx.vercel.app`
2. **Anote esta URL**
3. Teste acessando no navegador

**⚠️ IMPORTANTE:** 
- Agora você precisa voltar ao Render e atualizar `FRONTEND_URL` com esta URL da Vercel
- Isso permite que o backend aceite requisições do frontend (CORS)

---

## 📧 FASE 5: Configuração de E-mails (Resend)

### **O que vamos fazer:**
Configurar o Resend para enviar e-mails do sistema (recuperação de senha, notificações, etc.).

### **Passo 5.1: Criar conta no Resend**

1. Acesse https://resend.com
2. Clique em **"Get Started"**
3. Faça login com GitHub ou crie uma conta
4. Verifique seu e-mail

### **Passo 5.2: Criar API Key**

1. No painel do Resend, vá em **"API Keys"**
2. Clique em **"Create API Key"**
3. Dê um nome: `medflow-production`
4. Selecione permissões: **"Sending access"**
5. Clique em **"Add"**
6. **Copie a API Key** (ela só aparece uma vez!)

**Exemplo:** `re_1234567890abcdefghijklmnopqrstuvwxyz`

### **Passo 5.3: Verificar domínio (Opcional, mas recomendado)**

**O que é:** Para enviar e-mails de um domínio próprio (ex: `noreply@medflow.com.br`), você precisa verificar o domínio.

**Se você tem domínio próprio:**
1. No Resend, vá em **"Domains"**
2. Clique em **"Add Domain"**
3. Digite seu domínio: `medflow.com.br`
4. O Resend fornecerá registros DNS para adicionar no Cloudflare (ver Fase 6)
5. Após adicionar os registros, clique em **"Verify"**

**Se você não tem domínio:**
- Você pode usar o domínio do Resend: `onboarding@resend.dev` (limitado, mas funciona para testes)

### **Passo 5.4: Adicionar variáveis no Render**

Volte ao Render e adicione as seguintes variáveis de ambiente:

| Variável | Valor |
|----------|-------|
| `RESEND_API_KEY` | `re_xxxxx` (API Key do Passo 5.2) |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` (ou seu domínio verificado) |

### **Passo 5.5: Integrar Resend no código (se ainda não estiver)**

**Nota:** Se o código já tiver integração com Resend, pule este passo. Caso contrário, será necessário implementar.

**O que fazer:**
1. Instalar SDK do Resend no backend:
   ```bash
   cd apps/api
   pnpm add resend
   ```

2. Criar serviço de e-mail (exemplo básico):
   ```typescript
   // apps/api/src/email/email.service.ts
   import { Injectable } from '@nestjs/common';
   import { Resend } from 'resend';

   @Injectable()
   export class EmailService {
     private resend: Resend;

     constructor() {
       this.resend = new Resend(process.env.RESEND_API_KEY);
     }

     async sendPasswordReset(email: string, token: string) {
       await this.resend.emails.send({
         from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
         to: email,
         subject: 'Recuperação de Senha - MedFlow',
         html: `<p>Clique aqui para redefinir sua senha: ${token}</p>`,
       });
     }
   }
   ```

**⚠️ IMPORTANTE:** Esta é uma implementação básica. Você precisará adaptar conforme suas necessidades.

---

## 🔒 FASE 6: Configuração de Segurança e SSL (Cloudflare)

### **O que vamos fazer:**
Configurar o Cloudflare para:
- Proteger o site de ataques
- Fornecer SSL/HTTPS gratuito
- Acelerar o carregamento (CDN)

### **Passo 6.1: Criar conta no Cloudflare**

1. Acesse https://cloudflare.com
2. Clique em **"Sign Up"**
3. Crie uma conta (grátis)
4. Escolha o plano **"Free"**

### **Passo 6.2: Adicionar site (se você tem domínio)**

**Se você tem um domínio próprio (ex: `medflow.com.br`):**

1. No painel do Cloudflare, clique em **"Add a Site"**
2. Digite seu domínio: `medflow.com.br`
3. Escolha o plano **"Free"**
4. Cloudflare escaneará seus registros DNS atuais
5. Revise e clique em **"Continue"**
6. Você receberá **nameservers** (ex: `ns1.cloudflare.com`, `ns2.cloudflare.com`)

**Passo 6.2.1: Atualizar nameservers no registrador**

1. Acesse o painel do seu registrador de domínio (onde você comprou o domínio)
2. Vá em configurações DNS
3. Substitua os nameservers pelos fornecidos pelo Cloudflare
4. Aguarde 24-48 horas para propagação (geralmente leva menos)

**Passo 6.2.2: Configurar DNS no Cloudflare**

No painel do Cloudflare, adicione os seguintes registros:

| Tipo | Nome | Conteúdo | Proxy |
|------|------|----------|-------|
| A | `@` | IP da Vercel (ou use CNAME) | ✅ (laranja) |
| CNAME | `www` | `medflow-repo-xxxxx.vercel.app` | ✅ (laranja) |
| CNAME | `api` | `medflow-api.onrender.com` | ❌ (cinza) |

**Explicação:**
- `@` = domínio raiz (medflow.com.br)
- `www` = www.medflow.com.br
- `api` = api.medflow.com.br (aponta para o backend)

**⚠️ IMPORTANTE:** 
- Para o frontend, use CNAME apontando para a URL da Vercel
- Para o backend, use CNAME apontando para a URL do Render
- Ative o proxy (laranja) apenas para o frontend (melhora segurança e velocidade)

### **Passo 6.3: Configurar SSL**

1. No Cloudflare, vá em **SSL/TLS**
2. Selecione **"Full"** (modo completo)
3. Isso força HTTPS em todas as conexões

### **Passo 6.4: Configurar regras de segurança (Opcional)**

No Cloudflare, vá em **Security** → **WAF** e ative:
- ✅ **Bot Fight Mode** (proteção básica contra bots)
- ✅ **Security Level: Medium** (proteção contra ataques)

### **Passo 6.5: Se você NÃO tem domínio próprio**

**Sem domínio próprio, você ainda pode usar Cloudflare:**

1. Use as URLs fornecidas pela Vercel e Render diretamente
2. Ambas já fornecem SSL/HTTPS gratuito
3. Você pode adicionar Cloudflare depois quando tiver um domínio

**Limitação:** URLs serão do tipo:
- Frontend: `medflow-repo-xxxxx.vercel.app`
- Backend: `medflow-api.onrender.com`

---

## 🔄 FASE 7: Atualizar Configurações Cruzadas

### **O que vamos fazer:**
Agora que tudo está funcionando, precisamos garantir que todos os serviços se conheçam.

### **Passo 7.1: Atualizar FRONTEND_URL no Render**

1. Volte ao Render
2. Vá em **Environment**
3. Atualize `FRONTEND_URL` com a URL final da Vercel:
   - Se você tem domínio: `https://medflow.com.br`
   - Se não tem: `https://medflow-repo-xxxxx.vercel.app`
4. Clique em **"Save Changes"**
5. O Render fará um redeploy automático

**Por quê:** Isso permite que o backend aceite requisições do frontend (CORS).

### **Passo 7.2: Atualizar NEXT_PUBLIC_API_URL na Vercel**

1. Volte à Vercel
2. Vá em **Settings** → **Environment Variables**
3. Atualize `NEXT_PUBLIC_API_URL`:
   - Se você tem domínio: `https://api.medflow.com.br`
   - Se não tem: `https://medflow-api.onrender.com`
4. Clique em **"Save"**
5. Faça um novo deploy (ou aguarde o próximo commit)

**Por quê:** Isso faz o frontend saber onde está o backend.

### **Passo 7.3: Atualizar vercel.json (se necessário)**

Se você configurou um domínio próprio, atualize `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.medflow.com.br/:path*"
    }
  ]
}
```

---

## ✅ FASE 8: Testes e Validação

### **O que vamos fazer:**
Testar se tudo está funcionando corretamente.

### **Checklist de Testes:**

#### **8.1: Teste do Banco de Dados**

- [ ] Conectar ao Supabase e verificar se as tabelas foram criadas
- [ ] Tentar criar um registro de teste (ex: criar um paciente)
- [ ] Verificar se Row Level Security está ativo

**Como testar:**
1. No Supabase, vá em **Table Editor**
2. Verifique se as tabelas aparecem (patients, appointments, etc.)
3. Tente inserir um registro manualmente

#### **8.2: Teste do Backend (Render)**

- [ ] Acessar URL do Render e verificar se responde
- [ ] Testar endpoint de saúde: `https://medflow-api.onrender.com` (deve retornar algo)
- [ ] Verificar logs no Render (não deve ter erros)

**Como testar:**
```bash
# No terminal
curl https://medflow-api.onrender.com
```

#### **8.3: Teste do Frontend (Vercel)**

- [ ] Acessar URL da Vercel no navegador
- [ ] Verificar se a página carrega
- [ ] Tentar fazer login (se tiver usuário de teste)
- [ ] Verificar se as chamadas de API funcionam (abrir DevTools → Network)

**Como testar:**
1. Abra `https://medflow-repo-xxxxx.vercel.app` no navegador
2. Abra DevTools (F12) → aba **Network**
3. Tente fazer login ou navegar
4. Verifique se as requisições para a API estão sendo feitas corretamente

#### **8.4: Teste de E-mails (Resend)**

- [ ] Tentar recuperar senha (se implementado)
- [ ] Verificar se o e-mail chega na caixa de entrada
- [ ] Verificar logs no Resend (Dashboard → Logs)

**Como testar:**
1. No sistema, tente recuperar senha
2. Verifique seu e-mail (incluindo spam)
3. No Resend, vá em **Logs** e verifique se o e-mail foi enviado

#### **8.5: Teste de SSL/HTTPS**

- [ ] Verificar se o site carrega com HTTPS (não HTTP)
- [ ] Verificar se o certificado SSL é válido (cadeado verde no navegador)
- [ ] Testar em diferentes navegadores (Chrome, Firefox, Safari)

**Como testar:**
1. Acesse o site
2. Verifique se a URL começa com `https://`
3. Clique no cadeado ao lado da URL
4. Verifique se diz "Conexão segura"

#### **8.6: Teste de Performance**

- [ ] Verificar tempo de carregamento inicial
- [ ] Testar em dispositivo móvel
- [ ] Verificar se imagens e assets carregam corretamente

**Ferramentas úteis:**
- Google PageSpeed Insights: https://pagespeed.web.dev
- GTmetrix: https://gtmetrix.com

---

## 🐛 FASE 9: Resolução de Problemas Comuns

### **Problema 1: "Cannot connect to database"**

**Sintomas:** Backend não consegue conectar ao Supabase

**Soluções:**
1. Verificar se `DATABASE_URL` está correta no Render
2. Verificar se a senha no `DATABASE_URL` está correta
3. Verificar se o Supabase permite conexões externas (Settings → Database → Connection pooling)
4. Verificar se o IP do Render não está bloqueado (Supabase → Settings → Database → Network Restrictions)

### **Problema 2: "CORS Error"**

**Sintomas:** Frontend não consegue fazer requisições para o backend

**Soluções:**
1. Verificar se `FRONTEND_URL` no Render está correta
2. Verificar se `NEXT_PUBLIC_API_URL` na Vercel está correta
3. Verificar configuração de CORS em `apps/api/src/main.ts`
4. Fazer redeploy do backend após alterar variáveis

### **Problema 3: "Prisma Client not generated"**

**Sintomas:** Erro sobre Prisma Client não encontrado

**Soluções:**
1. Verificar se `postinstall` está configurado no `package.json` do backend
2. Verificar se o build command no Render inclui `pnpm prisma generate`
3. Verificar logs do Render para ver se o Prisma foi gerado

### **Problema 4: "Build failed"**

**Sintomas:** Deploy falha durante o build

**Soluções:**
1. Verificar logs completos no Render/Vercel
2. Verificar se todas as dependências estão no `package.json`
3. Verificar se não há erros de TypeScript (`pnpm build` localmente primeiro)
4. Verificar se o Node.js version está compatível (Render usa Node 20 por padrão)

### **Problema 5: "Service sleeping" (Render)**

**Sintomas:** Primeira requisição demora muito (15+ segundos)

**Soluções:**
- Isso é normal no plano gratuito do Render
- Serviços "dormem" após 15 minutos de inatividade
- Considere fazer upgrade para plano pago se isso for um problema

### **Problema 6: "Domain not working"**

**Sintomas:** Domínio próprio não está funcionando

**Soluções:**
1. Verificar se nameservers foram atualizados no registrador
2. Aguardar propagação DNS (pode levar até 48 horas)
3. Verificar registros DNS no Cloudflare
4. Verificar se SSL está configurado como "Full" no Cloudflare

---

## 📋 Checklist Final de Deploy

Use este checklist para garantir que tudo foi feito:

### **Preparação**
- [ ] Arquivo `render.yaml` criado
- [ ] Arquivo `vercel.json` criado
- [ ] `next.config.ts` atualizado
- [ ] Scripts de build configurados

### **Banco de Dados (Supabase)**
- [ ] Projeto criado no Supabase
- [ ] `DATABASE_URL` obtida e anotada
- [ ] Migrações executadas
- [ ] RLS configurado

### **Backend (Render)**
- [ ] Conta criada no Render
- [ ] Serviço Web criado
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy concluído com sucesso
- [ ] URL do backend anotada

### **Frontend (Vercel)**
- [ ] Conta criada na Vercel
- [ ] Projeto importado
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy concluído com sucesso
- [ ] URL do frontend anotada

### **E-mails (Resend)**
- [ ] Conta criada no Resend
- [ ] API Key gerada
- [ ] Domínio verificado (se aplicável)
- [ ] Variáveis configuradas no Render
- [ ] Integração implementada no código

### **Segurança (Cloudflare)**
- [ ] Conta criada no Cloudflare
- [ ] Domínio adicionado (se aplicável)
- [ ] DNS configurado
- [ ] SSL configurado como "Full"
- [ ] Regras de segurança ativadas

### **Configurações Finais**
- [ ] `FRONTEND_URL` atualizada no Render
- [ ] `NEXT_PUBLIC_API_URL` atualizada na Vercel
- [ ] `vercel.json` atualizado com URLs corretas

### **Testes**
- [ ] Banco de dados testado
- [ ] Backend testado
- [ ] Frontend testado
- [ ] E-mails testados
- [ ] SSL testado
- [ ] Performance testada

---

## 🎯 Próximos Passos Após Deploy

### **Curto Prazo (Primeira Semana)**

1. **Monitorar logs:**
   - Render: Verificar logs diariamente
   - Vercel: Verificar analytics e logs
   - Supabase: Verificar uso do banco

2. **Configurar alertas:**
   - Render: Configurar notificações de erro
   - Vercel: Configurar alertas de build falhado
   - Resend: Configurar alertas de quota

3. **Backup do banco:**
   - Configurar backups automáticos no Supabase
   - Testar restauração de backup

### **Médio Prazo (Primeiro Mês)**

1. **Otimizações:**
   - Implementar índices compostos (ver `PLANEJAMENTO_ESCALABILIDADE.md`)
   - Configurar cache Redis (se necessário)
   - Otimizar imagens e assets

2. **Segurança:**
   - Revisar logs de segurança no Cloudflare
   - Configurar rate limiting mais rigoroso
   - Implementar 2FA para usuários admin

3. **Monitoramento:**
   - Configurar ferramentas de monitoramento (ex: Sentry)
   - Configurar uptime monitoring (ex: UptimeRobot)

### **Longo Prazo**

1. **Escalabilidade:**
   - Planejar upgrade de planos conforme crescimento
   - Implementar CDN para assets estáticos
   - Considerar migração para infraestrutura própria (se necessário)

2. **Melhorias:**
   - Implementar CI/CD completo
   - Configurar testes automatizados
   - Documentar processos de deploy

---

## 📚 Recursos e Documentação

### **Documentação Oficial:**

- **Vercel:** https://vercel.com/docs
- **Render:** https://render.com/docs
- **Supabase:** https://supabase.com/docs
- **Resend:** https://resend.com/docs
- **Cloudflare:** https://developers.cloudflare.com

### **Comunidades e Suporte:**

- **Vercel Community:** https://github.com/vercel/vercel/discussions
- **Render Community:** https://community.render.com
- **Supabase Discord:** https://discord.supabase.com
- **Cloudflare Community:** https://community.cloudflare.com

---

## ⚠️ Avisos Importantes

1. **Planos Gratuitos têm Limitações:**
   - Render: Serviços "dormem" após inatividade
   - Vercel: Limite de bandwidth e builds
   - Supabase: Limite de espaço e requisições
   - Resend: Limite de e-mails por mês

2. **Backup é Essencial:**
   - Configure backups automáticos do banco de dados
   - Faça backup antes de migrações importantes
   - Teste restauração periodicamente

3. **Segurança:**
   - Nunca commite senhas ou API keys no Git
   - Use variáveis de ambiente sempre
   - Revise permissões regularmente

4. **Monitoramento:**
   - Monitore logs regularmente
   - Configure alertas para erros críticos
   - Acompanhe uso de recursos

---

## ✅ Conclusão

Este documento fornece um guia completo para fazer o deploy do MedFlow em produção. Siga os passos na ordem apresentada e use o checklist final para garantir que nada foi esquecido.

**Tempo estimado total:** 4-6 horas (dependendo da experiência e possíveis problemas)

**Dificuldade:** Média (requer conhecimento básico de serviços cloud, mas os passos são detalhados)

**Suporte:** Em caso de dúvidas, consulte a documentação oficial de cada serviço ou a seção de resolução de problemas.

---

**Boa sorte com o deploy! 🚀**
