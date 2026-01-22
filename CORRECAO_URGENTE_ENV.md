# 🚨 CORREÇÃO URGENTE - Arquivo .env com Problema

**Problema encontrado:** A linha `DATABASE_URL` no arquivo `.env` está **duplicada e mal formatada**.

**Linha atual (ERRADA):**
```
DATABASE_URL="DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:#Sb32531712*@#@aws-0-sa-east-1.pooler.supabase.com:6543/postgres""
```

**Problemas:**
1. ❌ `DATABASE_URL="DATABASE_URL="` - duplicado
2. ❌ URL cortada (`supabase.c om` com espaço)
3. ❌ Aspas duplas extras no final

---

## ✅ SOLUÇÃO: Corrigir Manualmente

### **Passo 1: Abrir o arquivo**

Abra o arquivo: `packages/db/.env`

### **Passo 2: Encontrar e Remover a linha errada**

Localize a linha que começa com `DATABASE_URL` e **DELETE ELA COMPLETAMENTE**.

### **Passo 3: Adicionar a linha CORRETA**

Adicione esta linha (substitua `#Sb32531712*@#` pela senha que você resetou no Supabase):

```env
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:#Sb32531712*@#@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
```

**⚠️ IMPORTANTE:**
- Use **apenas UMA** linha
- A URL deve estar **entre aspas duplas**
- **NÃO** pode ter `DATABASE_URL="DATABASE_URL="` no início
- A URL deve estar **completa** (sem espaços ou cortes)

### **Passo 4: Salvar o arquivo**

Salve o arquivo (Ctrl+S)

### **Passo 5: Testar**

```powershell
cd d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\packages\db
pnpm prisma db pull
```

---

## 📝 Exemplo do arquivo `.env` CORRETO

O arquivo `packages/db/.env` deve ter apenas:

```env
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:#Sb32531712*@#@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
```

**Nada mais!** (A menos que você tenha outras variáveis)

---

## 🔍 Verificar se está correto

Após corrigir, verifique:

```powershell
cd d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\packages\db
Get-Content .env
```

**Deve mostrar apenas:**
```
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:#Sb32531712*@#@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
```

**NÃO deve ter:**
- `DATABASE_URL="DATABASE_URL="` no início
- Espaços na URL
- Aspas extras no final

---

## ✅ Checklist

- [ ] Abri o arquivo `packages/db/.env`
- [ ] Removi a linha duplicada/errada
- [ ] Adicionei a linha correta (com a senha real)
- [ ] Verifiquei que não há duplicação
- [ ] Verifiquei que não há espaços na URL
- [ ] Salvei o arquivo
- [ ] Testei com `pnpm prisma db pull`
- [ ] Funcionou! ✅

---

**Corrija isso AGORA e teste novamente!** 🚀
