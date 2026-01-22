# 🔑 Sua DATABASE_URL - MedFlow

**Project Reference:** `ojrbkxaeccafwklnkdfr`  
**Região:** São Paulo (`sa-east-1`)

---

## ✅ Informações que você já tem

- ✅ **Project Reference:** `ojrbkxaeccafwklnkdfr`
- ✅ **Região:** `sa-east-1` (São Paulo)
- ⏳ **Senha:** Você precisa resetar/criar (veja abaixo)

---

## 🔐 Obter a Senha do Banco

1. No Supabase, na página onde você está (Database Settings)
2. Clique em **"Reset database password"**
3. O Supabase vai mostrar uma nova senha
4. **COPIE E ANOTE IMEDIATAMENTE** (ela só aparece uma vez!)

**Exemplo de senha:** `MinhaSenha123!@#`

---

## 📝 Montar a DATABASE_URL

Após obter a senha, use este formato:

### **Formato com Connection Pooler (RECOMENDADO - Porta 6543):**

```
postgresql://postgres.ojrbkxaeccafwklnkdfr:[SUA_SENHA_AQUI]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

**Substitua `[SUA_SENHA_AQUI]` pela senha que você resetou.**

**Exemplo (se sua senha fosse `MinhaSenha123!@#`):**
```
postgresql://postgres.ojrbkxaeccafwklnkdfr:MinhaSenha123!@#@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

---

### **Formato Direto (Alternativa - Porta 5432):**

Se a URL acima não funcionar, tente esta:

```
postgresql://postgres.ojrbkxaeccafwklnkdfr:[SUA_SENHA_AQUI]@db.ojrbkxaeccafwklnkdfr.supabase.co:5432/postgres
```

**Exemplo:**
```
postgresql://postgres.ojrbkxaeccafwklnkdfr:MinhaSenha123!@#@db.ojrbkxaeccafwklnkdfr.supabase.co:5432/postgres
```

---

## ✅ Próximos Passos

1. **Resetar senha:**
   - Clique em "Reset database password" no Supabase
   - Copie a senha gerada

2. **Montar a URL:**
   - Use o formato acima
   - Substitua `[SUA_SENHA_AQUI]` pela senha real

3. **Testar a URL:**
   ```powershell
   cd d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\packages\db
   $env:DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
   pnpm prisma db pull
   ```

4. **Se funcionar:** ✅ URL está correta!
5. **Se não funcionar:** Tente o formato direto (porta 5432)

---

## 📋 Checklist

- [ ] Resetei a senha do banco
- [ ] Anotei a senha em lugar seguro
- [ ] Montei a URL substituindo `[SUA_SENHA_AQUI]`
- [ ] Testei a URL com `pnpm prisma db pull`
- [ ] URL funcionou! ✅

---

## 🎯 URL Final (após obter senha)

Depois que você resetar a senha, sua URL será:

```
postgresql://postgres.ojrbkxaeccafwklnkdfr:[SENHA_RESETADA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

**Substitua `[SENHA_RESETADA]` pela senha real!**

---

**Próximo passo:** Resetar a senha e montar a URL completa! 🚀
