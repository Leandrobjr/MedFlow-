# 🔍 Como Encontrar DATABASE_URL - Método Alternativo

**A seção "Connection string" não aparece na sua tela atual**

---

## ✅ Solução: Construir a URL Manualmente

Como você já está na página de Database Settings, podemos construir a URL usando informações que você já tem!

---

## 🎯 Passo a Passo Simplificado

### **1. Obter a Senha do Banco**

Na sua tela você vê:
- ✅ "Database password" com botão "Reset database password"

**Ação:**
1. Clique em **"Reset database password"**
2. O Supabase vai mostrar uma nova senha
3. **COPIE E ANOTE IMEDIATAMENTE** (ela só aparece uma vez!)
4. Exemplo: `MinhaSenha123!@#`

---

### **2. Obter o Project Reference**

O **Project Reference** está na URL do seu navegador!

**Olhe na barra de endereço do navegador:**

Você está em:
```
https://app.supabase.com/dashboard/project/<PROJECT-REF>/settings/database
```

O `<PROJECT-REF>` é uma string de letras/números. **Copie essa parte!**

**Exemplo:** Se a URL é:
```
https://app.supabase.com/dashboard/project/abcdefghijklmnop/settings/database
```

Então seu **Project Reference** é: `abcdefghijklmnop`

---

### **3. Obter a Região**

A região você escolheu ao criar o projeto. Se não lembra:

**Opção A: Verificar no Project Settings**
1. No menu lateral, clique em **"Project Settings"** (ícone de engrenagem no topo)
2. Procure por **"Region"** ou **"Location"**
3. Anote a região (ex: `sa-east-1` para São Paulo)

**Opção B: Tentar as mais comuns**
- **São Paulo:** `sa-east-1`
- **US East:** `us-east-1`
- **EU Central:** `eu-central-1`

---

### **4. Montar a DATABASE_URL**

Use este formato:

```
postgresql://postgres.[PROJECT-REF]:[SENHA]@aws-0-[REGIAO].pooler.supabase.com:6543/postgres
```

**Substitua:**
- `[PROJECT-REF]` = O que você copiou da URL do navegador
- `[SENHA]` = A senha que você resetou/criou
- `[REGIAO]` = A região do seu projeto

**Exemplo completo:**

```
PROJECT-REF: abcdefghijklmnop
SENHA: MinhaSenha123!@#
REGIAO: sa-east-1

URL FINAL:
postgresql://postgres.abcdefghijklmnop:MinhaSenha123!@#@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

---

## 🔄 Método Alternativo: Via API Settings

Se ainda não conseguir, tente este método:

### **Passo 1: Ir para API Settings**

1. No menu lateral esquerdo, clique em **"Settings"** (se não estiver expandido)
2. Clique em **"API"**
3. Você verá informações do projeto

### **Passo 2: Usar Project URL**

Na página de API você verá:
- **Project URL:** `https://abcdefghijklmnop.supabase.co`
- O `abcdefghijklmnop` é seu **Project Reference**!

### **Passo 3: Construir a URL**

Use o Project Reference que você encontrou e monte a URL:

```
postgresql://postgres.[PROJECT-REF]:[SENHA]@aws-0-[REGIAO].pooler.supabase.com:6543/postgres
```

---

## 🎯 Método Mais Simples: Usar a URL Direta

Se você tem o **Project Reference**, pode tentar esta URL direta:

```
postgresql://postgres.[PROJECT-REF]:[SENHA]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Exemplo:**
```
postgresql://postgres.abcdefghijklmnop:MinhaSenha123!@#@db.abcdefghijklmnop.supabase.co:5432/postgres
```

**⚠️ Nota:** Esta é a URL direta (porta 5432). Funciona, mas a URL com pooler (porta 6543) é melhor para produção.

---

## 📋 Checklist Rápido

- [ ] Resetei a senha do banco e anotei
- [ ] Copiei o Project Reference da URL do navegador
- [ ] Identifiquei a região do projeto
- [ ] Montei a URL usando o formato acima
- [ ] Testei a URL (veja abaixo)

---

## ✅ Testar se a URL Está Correta

Após montar a URL, teste ela:

### **No Terminal:**

```bash
# Windows PowerShell:
cd d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\packages\db
$env:DATABASE_URL="postgresql://postgres.abc123:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
pnpm prisma db pull
```

Se funcionar (não der erro), a URL está correta! ✅

---

## 🆘 Se Nada Funcionar

### **Última Opção: Contatar Suporte**

1. No Supabase, vá em **Settings → Support**
2. Ou acesse: https://supabase.com/support
3. Peça ajuda para encontrar a Connection String

---

## 💡 Dica Importante

**A URL com Connection Pooler (porta 6543) é melhor para produção**, mas se você não conseguir encontrá-la, a URL direta (porta 5432) também funciona!

**Formato Pooler (melhor):**
```
postgresql://postgres.[PROJECT-REF]:[SENHA]@aws-0-[REGIAO].pooler.supabase.com:6543/postgres
```

**Formato Direto (alternativa):**
```
postgresql://postgres.[PROJECT-REF]:[SENHA]@db.[PROJECT-REF].supabase.co:5432/postgres
```

---

**Tente primeiro o método de construir manualmente usando o Project Reference da URL do navegador!**
