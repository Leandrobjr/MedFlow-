# 🔐 Resolver Erro de Autenticação - Supabase

**Erro atual:** `Authentication failed` - As credenciais não são válidas.

**Status:** A conexão está funcionando, mas a senha ou formato está incorreto.

---

## 🎯 Solução: Resetar Senha e Verificar Formato

### **Passo 1: Resetar a Senha no Supabase**

1. Acesse: https://app.supabase.com
2. Selecione seu projeto: **MedFlow**
3. Vá em **Settings → Database**
4. Clique em **"Reset database password"**
5. **COPIE A SENHA IMEDIATAMENTE** (ela só aparece uma vez!)
6. Anote em lugar seguro

**⚠️ IMPORTANTE:** Copie a senha EXATAMENTE como aparece, incluindo todos os caracteres especiais.

---

### **Passo 2: Verificar o Formato da URL**

O Supabase pode usar diferentes formatos. Vamos tentar ambos:

#### **Formato A: Connection Pooler (Porta 6543) - RECOMENDADO**

```env
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:[SENHA_CODIFICADA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
```

#### **Formato B: URL Direta (Porta 5432)**

```env
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:[SENHA_CODIFICADA]@db.ojrbkxaeccafwklnkdfr.supabase.co:5432/postgres"
```

---

### **Passo 3: Codificar a Senha**

Se sua senha tiver caracteres especiais, codifique-os:

| Caractere | Código |
|-----------|--------|
| `#` | `%23` |
| `*` | `%2A` |
| `@` | `%40` |
| `!` | `%21` |
| `$` | `%24` |
| `&` | `%26` |

**Exemplo:**
- Senha: `#Sb32531712*`
- Codificada: `%23Sb32531712%2A`

---

### **Passo 4: Atualizar o arquivo `.env`**

1. Abra: `packages/db/.env`
2. Substitua a linha `DATABASE_URL` por uma das opções acima
3. Substitua `[SENHA_CODIFICADA]` pela senha codificada
4. Salve o arquivo

---

### **Passo 5: Testar**

```powershell
cd d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\packages\db
pnpm prisma db pull
```

---

## 🔍 Verificações Adicionais

### **1. Verificar se a senha está correta**

- Confirme que copiou a senha COMPLETA do Supabase
- Verifique se não há espaços extras
- Confirme que codificou os caracteres especiais corretamente

### **2. Tentar sem codificação (se a senha não tiver caracteres especiais)**

Se sua senha NÃO tiver `#`, `*`, `@`, etc., tente sem codificar:

```env
DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:SUA_SENHA_SEM_CODIFICAR@db.ojrbkxaeccafwklnkdfr.supabase.co:5432/postgres"
```

### **3. Verificar Network Restrictions no Supabase**

1. No Supabase: **Settings → Database**
2. Role até **"Network Restrictions"**
3. Verifique se está permitindo conexões de todos os IPs
4. Se não, clique em **"Manage IP Addresses"** e permita `0.0.0.0/0`

---

## 📋 Checklist

- [ ] Resetei a senha no Supabase
- [ ] Copiei a senha COMPLETA (sem cortar)
- [ ] Codifiquei caracteres especiais (se houver)
- [ ] Atualizei o arquivo `.env`
- [ ] Verifiquei Network Restrictions no Supabase
- [ ] Testei com `pnpm prisma db pull`
- [ ] Funcionou! ✅

---

## 🆘 Se Ainda Não Funcionar

1. **Verifique a Connection String no Supabase:**
   - Vá em **Settings → Database**
   - Role até **"Connection string"** (pode estar mais abaixo)
   - Copie a URL EXATA que aparece lá
   - Use essa URL no `.env`

2. **Tente usar a Session Mode:**
   - No Supabase, na seção Connection string
   - Tente a aba **"Session mode"** ao invés de "URI"

3. **Contate o Suporte do Supabase:**
   - Se nada funcionar, pode haver um problema com o projeto
   - Acesse: https://supabase.com/support

---

**Próximo passo:** Resetar a senha novamente e tentar com a URL exata do Supabase! 🚀
