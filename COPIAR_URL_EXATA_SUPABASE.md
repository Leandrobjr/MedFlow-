# 🔗 Copiar URL Exata do Supabase

**Problema:** A autenticação está falhando mesmo com a senha resetada.

**Solução:** Usar a Connection String EXATA que o Supabase fornece.

---

## 📋 Passo a Passo Detalhado

### **1. Acesse o Supabase**

1. Vá para: https://app.supabase.com
2. Faça login
3. Selecione seu projeto: **MedFlow**

---

### **2. Encontre a Connection String**

1. No menu lateral esquerdo, clique em **"Settings"** (⚙️)
2. Clique em **"Database"**
3. Role a página para BAIXO
4. Procure pela seção **"Connection string"** ou **"Connection pooling"**

---

### **3. Escolha o Modo Correto**

O Supabase oferece diferentes formatos. Tente nesta ordem:

#### **Opção A: Session Mode (Recomendado para Prisma)**

1. Na seção "Connection string"
2. Clique na aba **"Session mode"**
3. Clique no botão **"Copy"** ao lado da URL
4. Esta é a URL que você deve usar!

#### **Opção B: Transaction Mode**

1. Se Session Mode não funcionar
2. Clique na aba **"Transaction mode"**
3. Clique em **"Copy"**

#### **Opção C: Direct Connection**

1. Se as outras não funcionarem
2. Procure por **"Direct connection"** ou **"URI"**
3. Copie essa URL

---

### **4. Formato Esperado**

A URL deve ter um destes formatos:

**Formato 1 (Session Mode):**
```
postgresql://postgres.ojrbkxaeccafwklnkdfr:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Formato 2 (Direct):**
```
postgresql://postgres.ojrbkxaeccafwklnkdfr:[SENHA]@db.ojrbkxaeccafwklnkdfr.supabase.co:5432/postgres
```

**⚠️ IMPORTANTE:** 
- A URL já vem com a senha preenchida
- Copie a URL COMPLETA, incluindo todos os parâmetros após `?`
- Não modifique nada, use exatamente como está

---

### **5. Atualizar o arquivo `.env`**

1. Abra o arquivo: `packages/db/.env`
2. Substitua a linha `DATABASE_URL` pela URL que você copiou
3. **MANTENHA as aspas** ao redor da URL:

```env
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

4. Salve o arquivo

---

### **6. Se a Senha Tiver Caracteres Especiais**

Se a URL copiada tiver caracteres especiais na senha que causam problemas, você pode precisar codificá-los:

| Caractere | Código |
|-----------|--------|
| `#` | `%23` |
| `*` | `%2A` |
| `@` | `%40` |
| `!` | `%21` |
| `$` | `%24` |
| `&` | `%26` |
| `%` | `%25` |

**Mas tente primeiro SEM codificar**, pois o Supabase geralmente já fornece a URL pronta para uso.

---

### **7. Testar**

```powershell
cd d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\packages\db
pnpm prisma db pull
```

---

## 🎯 O Que Fazer Agora

1. ✅ Acesse o Supabase
2. ✅ Vá em Settings → Database
3. ✅ Role até "Connection string"
4. ✅ Clique em "Session mode"
5. ✅ Clique em "Copy"
6. ✅ Cole no arquivo `packages/db/.env`
7. ✅ Teste com `pnpm prisma db pull`

---

## 📸 Onde Encontrar (Visual)

```
Supabase Dashboard
├── Settings (⚙️)
│   └── Database
│       ├── [várias configurações...]
│       ├── Connection string ← AQUI!
│       │   ├── Session mode ← TENTE ESTE PRIMEIRO
│       │   ├── Transaction mode
│       │   └── Direct connection
│       └── [mais configurações...]
```

---

## 🆘 Se Não Encontrar a Seção

1. **Verifique se está no projeto correto**
2. **Tente procurar por "Connection pooling"** ao invés de "Connection string"
3. **Verifique se o projeto está ativo** (não pausado)
4. **Tente usar a URL do formato antigo:**
   - Vá em **Settings → Database**
   - Procure por **"Database URL"** ou **"Connection URL"**
   - Pode estar em uma seção diferente

---

**Próximo passo:** Copie a URL EXATA do Supabase e cole no `.env`! 🚀
