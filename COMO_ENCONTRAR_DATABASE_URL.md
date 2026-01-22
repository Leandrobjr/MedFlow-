# 🔍 Como Encontrar DATABASE_URL e Senha no Supabase

**Baseado na sua tela atual**

---

## 📍 Onde você está agora

Você está em: **Settings → Database → Database Settings**

Na sua tela você vê:
- ✅ "Database password" (com botão "Reset database password")
- ✅ "Connection pooling configuration"
- ❌ **MAS não vê a seção "Connection string"** (ela está mais abaixo!)

---

## 🎯 Passo a Passo para Encontrar

### **1. Encontrar a SENHA do Banco**

**Opção A: Se você LEMBRA da senha que criou:**
- ✅ Use a senha que você criou ao criar o projeto
- ✅ Anote ela em lugar seguro

**Opção B: Se você NÃO LEMBRA da senha:**
1. Na sua tela atual, você vê o botão **"Reset database password"**
2. Clique nele
3. O Supabase vai gerar uma nova senha
4. **COPIE E ANOTE IMEDIATAMENTE** (ela só aparece uma vez!)
5. Guarde em lugar seguro

---

### **2. Encontrar a DATABASE_URL (Connection String)**

A seção "Connection string" está **mais abaixo** na mesma página. Siga estes passos:

#### **Passo 2.1: Role a página para baixo**

1. Na mesma página onde você está (Settings → Database)
2. **Role a página para baixo** (use a roda do mouse ou barra de rolagem)
3. Procure por uma seção chamada **"Connection string"** ou **"Connection info"**

#### **Passo 2.2: O que você vai encontrar**

Você verá algo assim:

```
Connection string
─────────────────────────────────────────────
URI
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**OU** (formato mais antigo):

```
Connection string
─────────────────────────────────────────────
URI
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

#### **Passo 2.3: Copiar a URL**

1. Você verá **duas abas**: "URI" e "Session mode"
2. Clique na aba **"URI"** (não "Session mode")
3. Você verá uma URL completa
4. **Copie esta URL**

---

### **3. Montar a DATABASE_URL Completa**

A URL que você copiou tem `[YOUR-PASSWORD]` no lugar da senha.

**Você precisa substituir:**

1. Pegue a URL que você copiou
2. Substitua `[YOUR-PASSWORD]` pela senha que você:
   - Lembra (se criou)
   - OU copiou após resetar (se não lembrava)

**Exemplo:**

**URL copiada:**
```
postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

**Sua senha:** `MinhaSenha123!@#`

**URL final (substitua [YOUR-PASSWORD]):**
```
postgresql://postgres.abcdefghijklmnop:MinhaSenha123!@#@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

**⚠️ IMPORTANTE:** 
- Use a URL com **porta 6543** (Connection Pooler) - é a melhor para produção
- Se só aparecer porta 5432, está OK também, mas prefira 6543

---

## 🖼️ Onde Está Cada Coisa (Visual)

```
┌─────────────────────────────────────────┐
│ Settings → Database                     │
├─────────────────────────────────────────┤
│                                         │
│ Database password                       │
│ [Reset database password] ← CLIQUE AQUI│
│                                         │
│ Connection pooling configuration        │
│ Pool Size: [14]                        │
│                                         │
│ ⬇️ ROLE PARA BAIXO ⬇️                   │
│                                         │
│ Connection string  ← ESTÁ AQUI!        │
│ [URI] [Session mode]                   │
│ postgresql://postgres...                │
│                                         │
└─────────────────────────────────────────┘
```

---

## ✅ Checklist Rápido

- [ ] Rolei a página para baixo
- [ ] Encontrei a seção "Connection string"
- [ ] Cliquei na aba "URI"
- [ ] Copiei a URL completa
- [ ] Resetei a senha (se não lembrava) OU usei a que lembrava
- [ ] Substituí `[YOUR-PASSWORD]` na URL pela senha real
- [ ] Anotei a URL final completa em lugar seguro

---

## 🆘 Se Ainda Não Encontrar

### **Alternativa: Usar o Project Settings**

1. No menu lateral esquerdo, clique em **"Project Settings"** (ícone de engrenagem)
2. Vá em **"Database"**
3. Role para baixo
4. Procure por **"Connection string"** ou **"Connection info"**

### **Ou usar a API:**

1. Vá em **Settings → API**
2. Procure por **"Project URL"** e **"anon key"**
3. Mas isso não é a DATABASE_URL - você precisa mesmo da Connection string do Database

---

## 📝 Exemplo Prático Completo

**Cenário:** Você resetou a senha e recebeu `NovaSenha2026!@#`

**URL copiada do Supabase:**
```
postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

**Substituindo [YOUR-PASSWORD]:**
```
postgresql://postgres.abcdefghijklmnop:NovaSenha2026!@#@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

**Esta é sua DATABASE_URL final!** ✅

---

## 🎯 Próximo Passo

Após encontrar a DATABASE_URL:

1. Anote ela em lugar seguro
2. Use no Render quando configurar as variáveis de ambiente
3. NÃO commite no Git!

---

**Dica:** Se ainda não encontrar, tire um print da tela completa (role tudo) e me mostre!
