# 🔑 Substituir Senha Manualmente na URL

**Problema:** O Supabase sempre mostra `[YOUR-PASSWORD]` na URL por segurança, mesmo após resetar a senha.

**Solução:** Copiar a senha quando ela aparecer e substituir manualmente na URL.

---

## ⚠️ IMPORTANTE: Sobre as Configurações do Supabase

**As configurações no Supabase (Type, Source, Method) NÃO são salvas!**

- Essas configurações são apenas para **visualizar** a URL no formato correto
- Elas voltam ao padrão quando você fecha e reabre - **isso é normal!**
- **O importante é:** Copiar a URL correta e salvá-la no arquivo `.env` local
- **O arquivo `.env` é onde a configuração fica salva permanentemente**

Você só precisa configurar os dropdowns uma vez para copiar a URL. Depois disso, a URL fica salva no seu `.env` e você não precisa mais mexer nos dropdowns do Supabase.

---

## 🎯 Passo a Passo Detalhado

### **1. Resetar a Senha no Supabase**

1. No Supabase: **Settings → Database**
2. Role até **"Reset your database password"**
3. Clique em **"Reset database password"**
4. **⚠️ IMPORTANTE:** Uma senha será gerada e exibida na tela
5. **COPIE A SENHA IMEDIATAMENTE** - ela só aparece uma vez!
6. Cole em um editor de texto (Bloco de Notas) para não perder

---

### **2. Copiar a URL Base do Supabase**

⚠️ **IMPORTANTE:** As configurações abaixo (Type, Source, Method) são apenas para **visualizar** a URL no formato correto. Elas **NÃO são salvas** no Supabase - isso é normal! O importante é copiar a URL e salvá-la no seu arquivo `.env` local.

1. Ainda em **Settings → Database**
2. Role até **"Connection string"**
3. Configure os dropdowns para ver a URL no formato correto:
   - **Type:** `URI`
   - **Source:** `Primary Database`
   - **Method:** `Session pooler` ⚠️ **SEMPRE configure este para Session pooler** (compatível com IPv4)
4. Você verá uma URL como:
   ```
   postgresql://postgres.ojrbkxaeccafwklnkdfr:[YOUR-PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
   ```
   **OU** (dependendo da região):
   ```
   postgresql://postgres.ojrbkxaeccafwklnkdfr:[YOUR-PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres
   ```
5. **COPIE ESSA URL COMPLETA** (com `[YOUR-PASSWORD]`)
6. **⚠️ NÃO se preocupe se as configurações voltarem ao padrão quando você fechar** - isso é normal! O importante é ter copiado a URL correta.

---

### **3. Substituir `[YOUR-PASSWORD]` pela Senha Real**

1. Abra a URL que você copiou em um editor de texto
2. Localize `[YOUR-PASSWORD]`
3. Substitua por **a senha que você copiou no passo 1**

**Exemplo:**
- URL original: `postgresql://postgres.ojrbkxaeccafwklnkdfr:[YOUR-PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`
- Senha copiada: `MinhaSenha123!@#`
- URL corrigida: `postgresql://postgres.ojrbkxaeccafwklnkdfr:MinhaSenha123!@#@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`

---

### **4. Se a Senha Tiver Caracteres Especiais**

Se sua senha tiver caracteres especiais, você precisa **codificá-los** na URL:

| Caractere | Código URL |
|-----------|------------|
| `#` | `%23` |
| `*` | `%2A` |
| `@` | `%40` |
| `!` | `%21` |
| `$` | `%24` |
| `&` | `%26` |
| `%` | `%25` |
| `+` | `%2B` |
| `=` | `%3D` |
| `?` | `%3F` |
| `/` | `%2F` |

**Exemplo:**
- Senha original: `MinhaSenha123!@#`
- Senha codificada: `MinhaSenha123%21%40%23`
- URL final: `postgresql://postgres.ojrbkxaeccafwklnkdfr:MinhaSenha123%21%40%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`

---

### **5. Verificar a Porta**

⚠️ **ATENÇÃO:** Na imagem você está usando a porta `5432`, mas para Session Pooler geralmente é `6543`.

Verifique na URL do Supabase qual porta está sendo usada:
- Se for `5432` → use `5432`
- Se for `6543` → use `6543`

---

### **6. Adicionar Parâmetro `?pgbouncer=true` (se necessário)**

Para Session Pooler funcionar com Prisma, às vezes é necessário adicionar `?pgbouncer=true` no final da URL.

**URL sem parâmetro:**
```
postgresql://postgres.ojrbkxaeccafwklnkdfr:SENHA@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
```

**URL com parâmetro:**
```
postgresql://postgres.ojrbkxaeccafwklnkdfr:SENHA@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true
```

---

### **7. Atualizar o arquivo `.env` (AQUI É ONDE VOCÊ SALVA!)**

✅ **ESTE É O LUGAR ONDE VOCÊ SALVA A CONFIGURAÇÃO!** O arquivo `.env` local é onde a URL fica salva permanentemente.

1. Abra: `packages/db/.env`
2. Substitua a linha `DATABASE_URL` pela URL que você montou
3. **MANTENHA as aspas** ao redor da URL:

```env
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:SUA_SENHA_CODIFICADA@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true"
```

4. **Salve o arquivo** - Esta é a única configuração que precisa ser salva!
5. ✅ **Pronto!** Agora você não precisa mais configurar os dropdowns no Supabase toda vez - a URL está salva no seu `.env` local.

---

### **8. Testar**

```powershell
cd d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\packages\db
pnpm prisma db pull
```

---

## 🔍 Exemplo Completo

Vamos supor que:
- **Senha gerada:** `Abc123!@#`
- **URL base:** `postgresql://postgres.ojrbkxaeccafwklnkdfr:[YOUR-PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`

**Passo 1:** Codificar caracteres especiais:
- `!` → `%21`
- `@` → `%40`
- `#` → `%23`
- Senha codificada: `Abc123%21%40%23`

**Passo 2:** Substituir na URL:
```
postgresql://postgres.ojrbkxaeccafwklnkdfr:Abc123%21%40%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true
```

**Passo 3:** Colar no `.env`:
```env
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:Abc123%21%40%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true"
```

---

## 📋 Checklist

- [ ] Resetei a senha no Supabase
- [ ] Copiei a senha IMEDIATAMENTE quando apareceu
- [ ] Copiei a URL base do Supabase (com `[YOUR-PASSWORD]`)
- [ ] Substitui `[YOUR-PASSWORD]` pela senha real
- [ ] Codifiquei caracteres especiais (se houver)
- [ ] Verifiquei a porta (5432 ou 6543)
- [ ] Adicionei `?pgbouncer=true` no final (se necessário)
- [ ] Colei no arquivo `packages/db/.env`
- [ ] Testei com `pnpm prisma db pull`
- [ ] Funcionou! ✅

---

## 🆘 Se Perdeu a Senha

Se você perdeu a senha que foi gerada:

1. **Resete novamente:** Settings → Database → Reset database password
2. **Desta vez:** Copie a senha IMEDIATAMENTE e salve em um arquivo de texto
3. Siga os passos acima

---

**Lembre-se:** O Supabase nunca mostra a senha na URL por segurança. Você precisa copiá-la quando ela aparecer e substituir manualmente! 🔐
