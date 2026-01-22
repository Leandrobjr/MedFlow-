# 🔧 Corrigir DATABASE_URL - Erro de Conexão

**Erro atual:** `Can't reach database server at postgres.ojrbkxaeccafwklnkdfr:5432`

**Causa:** A URL no arquivo `.env` está incompleta ou no formato errado.

---

## 🎯 Solução

### **1. Obter a Senha do Banco**

Primeiro, você precisa da senha:

1. No Supabase, vá em **Settings → Database**
2. Clique em **"Reset database password"**
3. **COPIE A SENHA IMEDIATAMENTE** (ela só aparece uma vez!)
4. Anote em lugar seguro

**Exemplo:** `MinhaSenha123!@#`

---

### **2. Corrigir o arquivo `.env`**

O arquivo `.env` deve estar em: `packages/db/.env`

**Formato CORRETO da URL:**

#### **Opção A: Connection Pooler (RECOMENDADO - Porta 6543):**

```env
DATABASE_URL=postgresql://postgres.ojrbkxaeccafwklnkdfr:[SUA_SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

**Substitua `[SUA_SENHA]` pela senha que você resetou.**

**Exemplo completo:**
```env
DATABASE_URL=postgresql://postgres.ojrbkxaeccafwklnkdfr:MinhaSenha123!@#@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

---

#### **Opção B: URL Direta (Alternativa - Porta 5432):**

Se a Opção A não funcionar, tente esta:

```env
DATABASE_URL=postgresql://postgres.ojrbkxaeccafwklnkdfr:[SUA_SENHA]@db.ojrbkxaeccafwklnkdfr.supabase.co:5432/postgres
```

**Exemplo:**
```env
DATABASE_URL=postgresql://postgres.ojrbkxaeccafwklnkdfr:MinhaSenha123!@#@db.ojrbkxaeccafwklnkdfr.supabase.co:5432/postgres
```

---

### **3. Verificar o arquivo `.env`**

1. Abra o arquivo: `packages/db/.env`
2. Verifique se existe a linha `DATABASE_URL=`
3. Se não existir, crie o arquivo
4. Adicione a URL completa no formato acima

**⚠️ IMPORTANTE:**
- A URL deve começar com `postgresql://`
- Deve ter o formato completo com host, porta, usuário, senha e database
- Não pode ter espaços extras
- A senha deve estar entre `:` e `@`

---

### **4. Testar a Conexão**

Após corrigir o `.env`, teste novamente:

```powershell
cd d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\packages\db
pnpm prisma db pull
```

**Se funcionar:** ✅ URL está correta!

**Se ainda der erro:** Tente a Opção B (URL direta)

---

## 🐛 Erros Comuns

### **Erro: "Can't reach database server"**

**Causas possíveis:**
1. URL incompleta (falta parte do host)
2. Senha incorreta
3. Região errada
4. Formato da URL incorreto

**Solução:**
- Verifique se a URL está completa
- Confirme que substituiu `[SUA_SENHA]` pela senha real
- Tente a URL direta (porta 5432) se a pooler não funcionar

---

### **Erro: "password authentication failed"**

**Causa:** Senha incorreta na URL.

**Solução:**
1. Resete a senha novamente no Supabase
2. Atualize o `.env` com a nova senha
3. Teste novamente

---

## 📋 Checklist

- [ ] Resetei a senha no Supabase
- [ ] Copiei a senha gerada
- [ ] Abri o arquivo `packages/db/.env`
- [ ] Adicionei/corrigi a linha `DATABASE_URL=`
- [ ] Usei o formato completo da URL
- [ ] Substituí `[SUA_SENHA]` pela senha real
- [ ] Testei com `pnpm prisma db pull`
- [ ] Funcionou! ✅

---

## 💡 Dica

**Se você não tem o arquivo `.env`:**

1. Crie o arquivo: `packages/db/.env`
2. Adicione apenas esta linha:
   ```env
   DATABASE_URL=postgresql://postgres.ojrbkxaeccafwklnkdfr:[SUA_SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```
3. Substitua `[SUA_SENHA]` pela senha real
4. Salve o arquivo

---

**Próximo passo:** Resetar a senha, corrigir o `.env` e testar novamente! 🚀
