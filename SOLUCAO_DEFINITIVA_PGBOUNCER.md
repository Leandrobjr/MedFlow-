# 🔧 Solução Definitiva: Prisma + PgBouncer

**Problema:** O erro "prepared statement 's1' already exists" ocorre porque o Prisma usa prepared statements que não são totalmente compatíveis com o PgBouncer em modo Session.

---

## 🎯 Solução: Usar Transaction Mode

O **Transaction Mode** do PgBouncer é mais compatível com o Prisma porque:
- ✅ Suporta prepared statements
- ✅ Funciona com IPv4
- ✅ É recomendado pelo Supabase para ORMs como Prisma

---

## 📋 Passo a Passo

### **1. Acesse o Supabase**

1. Vá para: https://app.supabase.com
2. Selecione seu projeto
3. Vá em **Settings → Database**

---

### **2. Configure para Transaction Mode**

1. Role até **"Connection string"**
2. Configure os dropdowns:
   - **Type:** `URI`
   - **Source:** `Connection Pooler` (ou `Primary Database`)
   - **Method:** `Transaction mode` ⚠️ **IMPORTANTE: Transaction mode, NÃO Session mode!**

---

### **3. Copie a URL**

A URL deve ter este formato:
```
postgresql://postgres.ojrbkxaeccafwklnkdfr:[YOUR-PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Características:**
- Porta: `6543` (pooler)
- Host: `pooler.supabase.com`
- Parâmetro: `?pgbouncer=true` no final

---

### **4. Substitua a Senha**

1. Se a URL mostrar `[YOUR-PASSWORD]`, você precisa:
   - Resetar a senha: **Settings → Database → Reset database password**
   - Copiar a senha IMEDIATAMENTE quando aparecer
   - Substituir `[YOUR-PASSWORD]` na URL

2. **Se a senha tiver caracteres especiais**, codifique-os:
   - `#` → `%23`
   - `*` → `%2A`
   - `@` → `%40`
   - `!` → `%21`

---

### **5. Atualize o `.env`**

1. Abra: `packages/db/.env`
2. Substitua a linha `DATABASE_URL`:

```env
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:SUA_SENHA@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

---

### **6. Teste**

```powershell
cd d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\packages\db
pnpm prisma db pull
```

---

## 🔍 Diferenças entre Modos

### **Session Mode** ❌ (Não funciona bem com Prisma)
- Usa conexões persistentes
- Não suporta prepared statements bem
- Erro: "prepared statement 's1' already exists"

### **Transaction Mode** ✅ (Recomendado para Prisma)
- Cada transação usa uma conexão
- Suporta prepared statements
- Compatível com ORMs como Prisma

---

## 🆘 Se Ainda Não Funcionar

### **Opção 1: Usar Conexão Direta (se IPv6 disponível)**

Se você tiver IPv6 disponível, pode usar a conexão direta:

```
postgresql://postgres.ojrbkxaeccafwklnkdfr:SENHA@db.ojrbkxaeccafwklnkdfr.supabase.co:5432/postgres
```

**Características:**
- Porta: `5432` (direta)
- Host: `db.ojrbkxaeccafwklnkdfr.supabase.co`
- Sem parâmetros

### **Opção 2: Configurar Prisma para Não Usar Prepared Statements**

Adicione ao `schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // URL direta para migrations
}
```

E configure o Prisma Client:

```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Desabilitar prepared statements
  __internal: {
    engine: {
      connectTimeout: 10000,
    },
  },
});
```

---

## ✅ Checklist

- [ ] Configurei para **Transaction mode** no Supabase
- [ ] Copiei a URL completa
- [ ] Substitui `[YOUR-PASSWORD]` pela senha real
- [ ] Codifiquei caracteres especiais (se houver)
- [ ] Verifiquei que a porta é `6543`
- [ ] Verifiquei que tem `?pgbouncer=true` no final
- [ ] Colei no arquivo `packages/db/.env`
- [ ] Testei com `pnpm prisma db pull`
- [ ] Funcionou! ✅

---

**Lembre-se:** Transaction Mode é a solução recomendada para Prisma com Supabase! 🚀
