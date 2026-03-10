# 📋 Passo a Passo Final - Commitar Arquivos Restantes

## 🎯 Objetivo

Comitar os 4 arquivos restantes que completam a implementação multi-tenant:
1. `prisma.module.ts` - Configuração do módulo
2. `finance.service.ts` - Integração do TenantPrismaService
3. `pep.service.ts` - Integração do TenantPrismaService  
4. `schema.prisma` - Índices para otimização

---

## ⚠️ IMPORTANTE: Por que precisa ser manual?

O Git está bloqueado porque o IDE (Cursor) está usando o repositório. Isso é normal e seguro - apenas precisamos fechar o IDE temporariamente.

---

## ✅ Passo a Passo (Para Leigo)

### **Passo 1: Fechar o Cursor/IDE**

1. **Salve todos os arquivos** (Ctrl+S ou File > Save All)
2. **Feche completamente o Cursor/VS Code**
   - Clique no X da janela
   - Ou use Alt+F4
   - **Importante:** Certifique-se de que não há nenhuma janela do Cursor aberta

### **Passo 2: Abrir PowerShell como Administrador**

1. **Pressione a tecla Windows** (ou clique no menu Iniciar)
2. **Digite:** `PowerShell`
3. **Clique com botão direito** em "Windows PowerShell"
4. **Selecione:** "Executar como administrador"
5. **Clique em "Sim"** quando pedir permissão

### **Passo 3: Navegar até o Projeto**

No PowerShell que abriu, digite exatamente (copie e cole):

```powershell
cd "d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo"
```

Pressione **Enter**. Você deve ver o caminho mudar no prompt.

### **Passo 4: Executar o Script**

Digite exatamente:

```powershell
.\commitar-arquivos-restantes.ps1
```

Pressione **Enter**.

**O que vai acontecer:**
- O script vai remover qualquer bloqueio do Git
- Vai adicionar os 4 arquivos ao Git
- Vai criar 2 commits separados (um para integração, outro para schema)
- Vai mostrar um resumo final

**Se aparecer algum erro:**
- Anote a mensagem de erro completa
- Tente novamente (às vezes precisa de 2 tentativas)
- Se persistir, siga o "Passo Alternativo" abaixo

### **Passo 5: Verificar se Funcionou**

Após o script executar, você deve ver mensagens verdes como:
- ✅ Commit realizado com sucesso!
- ✅ Commit do schema realizado com sucesso!

Digite para verificar:

```powershell
git log --oneline -8
```

Você deve ver 8 commits listados, incluindo os 2 novos.

### **Passo 6: Abrir o Cursor Novamente**

1. Abra o Cursor normalmente
2. Verifique se os arquivos estão commitados:
   - Abra o terminal no Cursor
   - Digite: `git status`
   - Os 4 arquivos não devem mais aparecer como "modified"

---

## 🔄 Passo Alternativo (Se o Script Não Funcionar)

Se o script der erro, execute os comandos manualmente:

### **1. Remover Bloqueio:**

```powershell
cd "d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo"
Remove-Item .git/index.lock -Force -ErrorAction SilentlyContinue
```

### **2. Primeiro Commit (Integração):**

```powershell
git add apps/api/src/prisma/prisma.module.ts
git add apps/api/src/finance/finance.service.ts
git add apps/api/src/pep/pep.service.ts

git commit -m "feat(api): Integração TenantPrismaService em Finance e PEP

- PrismaModule: adiciona TenantContextService e TenantPrismaService aos providers/exports
- FinanceService: refatora para usar TenantPrismaService.run() em operações críticas
- PepService: integra TenantPrismaService para isolamento de tenant
- Garante isolamento determinístico em operações financeiras e prontuário"
```

### **3. Segundo Commit (Schema):**

```powershell
git add packages/db/prisma/schema.prisma

git commit -m "perf(db): Adiciona índices para otimização multi-tenant

- Adiciona índices compostos em MedicalFee para queries filtradas por tenantId
- Melhora performance de consultas de repasse médico por tenant e status
- Índices: [tenantId, staffId, status, createdAt], [tenantId, status, createdAt], [paymentId]"
```

### **4. Verificar:**

```powershell
git log --oneline -8
git status
```

---

## ✅ Critérios de Sucesso

Após executar, você deve ter:

- ✅ **8 commits** no total (6 das fases + 2 novos)
- ✅ **Nenhum arquivo modificado** em `git status` (exceto arquivos não rastreados como documentação)
- ✅ **Mensagens de sucesso** no PowerShell

---

## 🚀 Próximos Passos (Após Commitar)

### **1. Push para o Repositório:**

```powershell
git push origin feature/m2-frontend
```

### **2. Criar Pull Request:**

- Vá para o GitHub/GitLab
- Crie um PR da branch `feature/m2-frontend` para `main` (ou `develop`)
- Inclua descrição das melhorias de segurança multi-tenant

### **3. Testes:**

```powershell
cd apps/api
pnpm build
pnpm test:e2e tenant-isolation
```

---

## ❓ Dúvidas Frequentes

**P: E se eu esquecer de fechar o Cursor?**
R: O script vai tentar remover o bloqueio automaticamente, mas pode falhar. Nesse caso, feche o Cursor e tente novamente.

**P: Posso executar os comandos diretamente no terminal do Cursor?**
R: Não recomendado, pois o Cursor pode estar bloqueando o Git. Use PowerShell externo.

**P: E se der erro de permissão?**
R: Certifique-se de que o PowerShell está rodando como Administrador (botão direito > Executar como administrador).

**P: Os commits vão apagar meus arquivos?**
R: Não! Commits apenas salvam as mudanças. Seus arquivos continuam intactos.

---

## 📞 Se Precisar de Ajuda

Se encontrar algum problema:
1. Anote a mensagem de erro completa
2. Verifique se o PowerShell está como Administrador
3. Tente fechar TODOS os programas que possam estar usando o Git (Cursor, VS Code, Git GUI, etc.)
4. Execute o passo alternativo manualmente

---

**Data:** 21 de Janeiro de 2026  
**Versão:** 1.0
