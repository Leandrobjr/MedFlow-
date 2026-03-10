# 📋 Instruções para Executar Commits Incrementais

## ⚠️ Problema Identificado

Há um lock do Git (`.git/index.lock`) que está impedindo a execução automática dos commits. Isso geralmente acontece quando:

- O IDE/editor (Cursor/VSCode) está com o Git aberto
- Outro processo está usando o repositório Git
- Um processo Git anterior travou

## ✅ Solução

### **Opção 1: Executar Script PowerShell (Recomendado)**

1. **Feche o Cursor/IDE completamente** (para liberar o lock)
2. **Abra um novo PowerShell** como Administrador
3. **Navegue até o repositório:**
   ```powershell
   cd "d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo"
   ```
4. **Execute o script:**
   ```powershell
   .\executar-commits.ps1
   ```

O script irá:
- Remover o lock automaticamente (se existir)
- Executar todos os commits sequencialmente
- Mostrar o status final

---

### **Opção 2: Executar Commits Manualmente**

Se preferir executar manualmente, siga os comandos abaixo **em ordem**:

#### **1. Remover Lock (se existir):**
```powershell
cd "d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo"
Remove-Item .git/index.lock -Force -ErrorAction SilentlyContinue
```

#### **2. FASE 1:**
```powershell
git add apps/api/src/common/middleware/tenant.middleware.ts
git commit -m "feat(api): FASE 1 - Hardening do TenantMiddleware

- Ignora header x-tenant-slug em produção (segurança)
- Validação forte do slug (sanitização [a-z0-9-], tamanho 3-63)
- Erro 400 ao invés de 404 quando tenant não resolvido
- Logs com requestId para rastreamento
- Referer não usado em produção (falsificável)
- Resolução por subdomínio priorizada em produção"
```

#### **3. FASE 2:**
```powershell
git add apps/api/src/prisma/prisma.service.ts apps/api/src/prisma/tenant-prisma.service.ts apps/api/src/auth/auth.service.ts
git commit -m "feat(api): FASE 2 - Hardening do Prisma/TenantPrisma

- TenantPrismaService.run() valida tenant obrigatório (HTTP 400)
- PrismaService.withTenant() valida UUID e current_setting
- Validação dupla do contexto de tenant (set_config + current_setting)
- AuthService usa tenant do contexto e prisma.withTenant()
- Tipagem correta com Prisma.TransactionClient"
```

#### **4. FASE 3:**
```powershell
git add apps/web/src/lib/api.ts
git commit -m "feat(web): FASE 3 - Segurança do Frontend (DEV-only header)

- Header x-tenant-slug controlado por NEXT_PUBLIC_ALLOW_TENANT_HEADER
- Default: false (seguro por padrão)
- Erro no console se NEXT_PUBLIC_TENANT_SLUG não configurado
- Sem fallbacks inseguros (não usa 'clinica1' hardcoded)"
```

#### **5. FASE 4:**
```powershell
git add apps/api/test/tenant-isolation.e2e-spec.ts
git commit -m "test(api): FASE 4 - Testes e2e de isolamento multi-tenant

- Cria 2 tenants (A e B) e valida isolamento
- Testa prisma.withTenant() e tenantPrisma.run()
- Valida que tenant A não vê dados do tenant B
- Testa AsyncLocalStorage com tenantContext.runAsync()
- Valida erro quando não há contexto de tenant"
```

#### **6. FASE 5:**
```powershell
git add docs/dev-multitenant.md
git commit -m "docs: FASE 5 - Documentação completa multi-tenant

- Como rodar com header (DEV) e env flags
- Como rodar sem header (prod-like)
- Checklist detalhado para novos métodos
- Referência rápida e comandos úteis
- Exemplos práticos e troubleshooting"
```

#### **7. Arquivos Auxiliares:**
```powershell
git add apps/api/nest-cli.json apps/web/src/app/dashboard/agenda/page.tsx
git commit -m "chore: Ajustes auxiliares para multi-tenant

- nest-cli.json: deleteOutDir=false (evita EPERM)
- agenda/page.tsx: correção de status válidos"
```

#### **8. Verificar:**
```powershell
git log --oneline -6
git status
```

---

## 🔍 Verificação Pós-Commit

Após executar os commits, verifique:

```powershell
# Ver últimos 6 commits
git log --oneline -6

# Ver status
git status

# Verificar build (opcional)
cd apps/api
pnpm build
```

---

## 📝 Notas

- **Importante:** Feche o IDE antes de executar os commits para evitar conflitos
- O script `executar-commits.ps1` já está criado e pronto para uso
- Todos os arquivos necessários já estão modificados e prontos para commit
- O build foi verificado e está funcionando ✅

---

**Data:** 21 de Janeiro de 2026
