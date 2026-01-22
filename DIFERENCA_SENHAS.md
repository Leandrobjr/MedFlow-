# 🔑 Diferença entre Senha do Banco e JWT Secret

**Data:** 21 de Janeiro de 2026

---

## ❌ NÃO são a mesma coisa!

São **duas coisas completamente diferentes** com propósitos distintos:

---

## 1️⃣ **Senha do Banco de Dados (Database Password)**

### **O que é:**
- Senha que você **cria** quando cria o projeto no Supabase
- Usada para **conectar ao PostgreSQL**

### **Onde encontrar:**
1. No Supabase: **Settings → Database**
2. Procure por **"Database Password"** ou **"Connection string"**
3. Você **criou esta senha** quando criou o projeto

### **Onde usar:**
- Na `DATABASE_URL` para o Render (backend)
- Formato:
  ```
  postgresql://postgres:SUA_SENHA_AQUI@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
  ```

### **Exemplo:**
```
Senha criada: MedFlow2026!@#Prod
DATABASE_URL: postgresql://postgres:MedFlow2026!@#Prod@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

---

## 2️⃣ **JWT Secret (JWT Keys)**

### **O que é:**
- Chave **gerada automaticamente** pelo Supabase
- Usada para **assinar e verificar tokens JWT** (autenticação)

### **Onde encontrar:**
1. No Supabase: **Settings → API**
2. Procure por **"JWT Settings"** → **"JWT Secret"**
3. É uma chave **longa e aleatória** (ex: `your-super-secret-jwt-token-with-at-least-32-characters-long`)

### **Onde usar:**
- Na variável `JWT_SECRET` no Render (backend)
- Para autenticação de usuários

### **Exemplo:**
```
JWT Secret do Supabase: your-super-secret-jwt-token-with-at-least-32-characters-long
```

**⚠️ IMPORTANTE:** Você pode:
- ✅ **Usar a JWT Secret do Supabase** (mais fácil)
- ✅ **Gerar uma própria** (mais seguro, recomendado)

---

## 📊 Comparação Rápida

| Característica | Senha do Banco | JWT Secret |
|----------------|----------------|------------|
| **Propósito** | Conectar ao PostgreSQL | Assinar tokens JWT |
| **Onde usar** | `DATABASE_URL` | `JWT_SECRET` |
| **Onde encontrar** | Settings → Database | Settings → API |
| **Você cria?** | ✅ Sim (ao criar projeto) | ❌ Não (gerada automaticamente) |
| **Pode mudar?** | ✅ Sim (reset password) | ✅ Sim (mas não recomendado) |

---

## 🎯 O que você precisa fazer

### **Para o Render (Backend):**

Você precisa configurar **AMBAS** as variáveis:

```bash
# 1. DATABASE_URL (usa a SENHA DO BANCO)
DATABASE_URL=postgresql://postgres:SUA_SENHA_DO_BANCO@aws-0-sa-east-1.pooler.supabase.com:6543/postgres

# 2. JWT_SECRET (usa a JWT SECRET do Supabase OU gere uma própria)
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
```

---

## 🔍 Como encontrar cada uma

### **Senha do Banco:**

1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Vá em **Settings** (ícone de engrenagem)
4. Clique em **Database**
5. Role até **"Connection string"**
6. A senha está na URL (substitua `[YOUR-PASSWORD]`)

**OU:**

1. Vá em **Settings → Database**
2. Procure por **"Database Password"**
3. Se não lembrar, clique em **"Reset database password"**

### **JWT Secret:**

1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Vá em **Settings → API**
4. Role até **"JWT Settings"**
5. Copie o **"JWT Secret"**

---

## 💡 Recomendação

### **Para JWT_SECRET:**

**Opção 1: Usar a do Supabase** (Mais fácil)
- Copie a JWT Secret do Supabase
- Use diretamente no Render

**Opção 2: Gerar uma própria** (Mais seguro) ✅ **RECOMENDADO**
- Gere uma chave aleatória:
  ```bash
  # No terminal:
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- Use esta chave no Render
- **Não use** a do Supabase (melhor separar responsabilidades)

---

## ✅ Checklist

- [ ] Senha do banco anotada (criada ao criar projeto)
- [ ] `DATABASE_URL` montada com a senha do banco
- [ ] JWT Secret copiada do Supabase OU gerada própria
- [ ] `JWT_SECRET` configurada no Render

---

## 🎯 Resumo

- **Senha do Banco** = Para conectar ao PostgreSQL (`DATABASE_URL`)
- **JWT Secret** = Para autenticação (`JWT_SECRET`)
- **São diferentes!** Use cada uma no lugar correto.

---

**Dúvidas? Consulte `ENV_EXAMPLE.md` para ver exemplos de configuração.**
