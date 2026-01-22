# 🔧 Usar Session Pooler do Supabase (Solução IPv4)

**Problema:** A conexão direta mostra "Not IPv4 compatible" e não funciona.

**Solução:** Usar o **Session Pooler** que é compatível com IPv4.

---

## 🎯 Passo a Passo Detalhado

### **1. Acesse o Supabase**

1. Vá para: https://app.supabase.com
2. Selecione seu projeto: **MedFlow**
3. Vá em **Settings → Database**

---

### **2. Encontre a Seção "Connection String"**

1. Role a página para BAIXO
2. Procure pela seção **"Connection string"** ou **"Connect to your project"**
3. Você verá várias abas: **"URI"**, **"Session mode"**, **"Transaction mode"**

---

### **3. Clique na Aba "Session mode"**

⚠️ **IMPORTANTE:** NÃO use "Direct connection" (mostra "Not IPv4 compatible")

1. Clique na aba **"Session mode"**
2. Você verá uma URL com o formato:
   ```
   postgresql://postgres.ojrbkxaeccafwklnkdfr:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

---

### **4. Configure o Tipo e Método**

Na seção "Connection string", verifique:

1. **Type:** Deve estar em **"URI"**
2. **Source:** Pode ser **"Primary Database"** ou **"Connection Pooler"**
3. **Method:** Deve estar em **"Session mode"** (NÃO "Direct connection")

---

### **5. Copie a URL Completa**

1. A URL já deve ter a senha preenchida (não deve mostrar `[YOUR-PASSWORD]`)
2. Se ainda mostrar `[YOUR-PASSWORD]`, você precisa:
   - Clicar em **"Reset database password"** (mais abaixo na página)
   - Copiar a nova senha
   - A URL será atualizada automaticamente

3. Clique no botão **"Copy"** ao lado da URL
4. A URL deve ter este formato:
   ```
   postgresql://postgres.ojrbkxaeccafwklnkdfr:SUA_SENHA_AQUI@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

---

### **6. Se a Senha Não Estiver na URL**

Se a URL ainda mostrar `[YOUR-PASSWORD]`:

1. Role até **"Reset your database password"**
2. Clique em **"Reset database password"**
3. **COPIE A SENHA IMEDIATAMENTE** (ela só aparece uma vez!)
4. Volte para a seção "Connection string"
5. Substitua `[YOUR-PASSWORD]` pela senha que você copiou
6. **IMPORTANTE:** Se a senha tiver caracteres especiais (`#`, `*`, `@`, etc.), você precisa codificá-los:
   - `#` → `%23`
   - `*` → `%2A`
   - `@` → `%40`
   - `!` → `%21`
   - `$` → `%24`

---

### **7. Atualizar o arquivo `.env`**

1. Abra: `packages/db/.env`
2. Substitua a linha `DATABASE_URL` pela URL que você copiou
3. **MANTENHA as aspas** ao redor da URL:

```env
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

4. **IMPORTANTE:** A URL DEVE terminar com `?pgbouncer=true` - isso é essencial para o Prisma funcionar com o pooler!

---

### **8. Verificar se o Pooler Está Habilitado**

1. No Supabase, vá em **Settings → Database**
2. Role até **"Connection Pooler"** ou **"Pooler settings"**
3. Verifique se está **habilitado**
4. Se não estiver, habilite-o

---

### **9. Testar**

```powershell
cd d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\packages\db
pnpm prisma db pull
```

---

## 🔍 Diferenças Importantes

### **❌ NÃO Funciona (IPv4):**
```
postgresql://postgres.ojrbkxaeccafwklnkdfr:SENHA@db.ojrbkxaeccafwklnkdfr.supabase.co:5432/postgres
```
- Porta: `5432`
- Host: `db.ojrbkxaeccafwklnkdfr.supabase.co`
- **Mostra:** "Not IPv4 compatible"

### **✅ Funciona (IPv4):**
```
postgresql://postgres.ojrbkxaeccafwklnkdfr:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```
- Porta: `6543`
- Host: `aws-0-sa-east-1.pooler.supabase.com`
- **Tem:** `?pgbouncer=true` no final

---

## 📋 Checklist

- [ ] Acessei Settings → Database no Supabase
- [ ] Cliquei na aba **"Session mode"** (NÃO "Direct connection")
- [ ] Copiei a URL COMPLETA com a senha preenchida
- [ ] Verifiquei que a URL termina com `?pgbouncer=true`
- [ ] Verifiquei que a porta é `6543` (não `5432`)
- [ ] Verifiquei que o host é `pooler.supabase.com` (não `db.supabase.co`)
- [ ] Colei no arquivo `packages/db/.env`
- [ ] Testei com `pnpm prisma db pull`
- [ ] Funcionou! ✅

---

## 🆘 Se Ainda Não Funcionar

### **1. Verificar Network Restrictions**

1. No Supabase: **Settings → Database**
2. Role até **"Network Restrictions"**
3. Verifique se está permitindo conexões de todos os IPs
4. Se não, clique em **"Manage IP Addresses"** e permita `0.0.0.0/0`

### **2. Verificar se o Pooler Está Ativo**

1. No Supabase: **Settings → Database**
2. Procure por **"Connection Pooler"** ou **"Pooler settings"**
3. Verifique se está **"Enabled"** ou **"Active"**
4. Se não estiver, habilite-o

### **3. Tentar Transaction Mode**

Se Session Mode não funcionar:

1. Na seção "Connection string"
2. Clique na aba **"Transaction mode"**
3. Copie essa URL
4. Use no `.env`

### **4. Verificar a Senha**

1. Resete a senha novamente: **Settings → Database → Reset database password**
2. Copie a senha COMPLETA
3. Se tiver caracteres especiais, codifique-os
4. Atualize a URL manualmente

---

## 🎯 O Que Fazer Agora

1. ✅ Acesse o Supabase
2. ✅ Vá em Settings → Database
3. ✅ Clique na aba **"Session mode"** (NÃO "Direct connection")
4. ✅ Copie a URL COMPLETA (deve terminar com `?pgbouncer=true`)
5. ✅ Cole no arquivo `packages/db/.env`
6. ✅ Teste com `pnpm prisma db pull`

---

**Lembre-se:** A URL do Session Mode é diferente da Direct Connection e é a única que funciona com IPv4! 🚀
