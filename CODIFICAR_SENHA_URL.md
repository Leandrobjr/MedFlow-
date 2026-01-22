# 🔐 Codificar Senha na URL

**Problema:** A senha `#Sb32531712*@#` tem caracteres especiais que precisam ser codificados na URL.

---

## 🔄 Codificação de Caracteres Especiais

Na URL, alguns caracteres precisam ser codificados:

| Caractere | Código URL |
|-----------|------------|
| `#` | `%23` |
| `*` | `%2A` |
| `@` | `%40` |
| `!` | `%21` |
| `$` | `%24` |

---

## 📝 Sua Senha Codificada

**Senha original:** `#Sb32531712*@#`

**Senha codificada:** `%23Sb32531712%2A%40%23`

**Tradução:**
- `#` → `%23`
- `*` → `%2A`
- `@` → `%40`
- `#` → `%23`

---

## ✅ URL Correta com Senha Codificada

### **Formato com Connection Pooler (Porta 6543):**

```env
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:%23Sb32531712%2A%40%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
```

### **Formato Direto (Porta 5432):**

```env
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:%23Sb32531712%2A%40%23@db.ojrbkxaeccafwklnkdfr.supabase.co:5432/postgres"
```

---

## 🎯 Próximo Passo

Atualize o arquivo `packages/db/.env` com a URL usando a senha codificada acima.
