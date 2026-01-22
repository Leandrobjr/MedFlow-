# 🔧 Atualizar .env para Supabase

**Problema encontrado:** Seu `.env` está configurado para o banco local, não para o Supabase.

**URL atual no .env:**
```
DATABASE_URL="postgresql://admin:admin123@localhost:5432/medflow?schema=public"
```

**Precisa ser atualizada para:**
```
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
```

---

## 🎯 Passo a Passo

### **1. Obter a Senha do Supabase**

1. No Supabase: **Settings → Database**
2. Clique em **"Reset database password"**
3. **COPIE A SENHA IMEDIATAMENTE**
4. Anote em lugar seguro

**Exemplo:** `MinhaSenha123!@#`

---

### **2. Atualizar o arquivo `.env`**

**Localização:** `packages/db/.env`

**Abra o arquivo e substitua a linha `DATABASE_URL` por:**

#### **Opção A: Connection Pooler (RECOMENDADO):**

```env
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:[SUA_SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
```

**Substitua `[SUA_SENHA]` pela senha que você resetou.**

**Exemplo completo:**
```env
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:MinhaSenha123!@#@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
```

---

#### **Opção B: URL Direta (Alternativa):**

Se a Opção A não funcionar:

```env
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:[SUA_SENHA]@db.ojrbkxaeccafwklnkdfr.supabase.co:5432/postgres"
```

---

### **3. Salvar o arquivo**

Após atualizar, **salve o arquivo** (Ctrl+S)

---

### **4. Testar a Conexão**

```powershell
cd d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\packages\db
pnpm prisma db pull
```

**Se funcionar:** ✅ URL está correta!

**Se ainda der erro:** 
- Verifique se a senha está correta
- Tente a Opção B (URL direta)
- Verifique se não há espaços extras na URL

---

## 📋 Checklist

- [ ] Resetei a senha no Supabase
- [ ] Copiei a senha gerada
- [ ] Abri o arquivo `packages/db/.env`
- [ ] Substituí a linha `DATABASE_URL` pela URL do Supabase
- [ ] Substituí `[SUA_SENHA]` pela senha real
- [ ] Salvei o arquivo
- [ ] Testei com `pnpm prisma db pull`
- [ ] Funcionou! ✅

---

## ⚠️ Importante

- **NÃO commite** o arquivo `.env` no Git (já está no `.gitignore`)
- **Guarde a senha** em lugar seguro
- A URL deve estar **entre aspas** (`"..."`)

---

**Próximo passo:** Resetar a senha, atualizar o `.env` e testar! 🚀
