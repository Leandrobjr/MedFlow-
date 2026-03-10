# Script para executar commits incrementais por fase
# Execute este script após fechar o IDE/editor para evitar lock do Git

Write-Host "=== 🔄 Executando Commits Incrementais por Fase ===" -ForegroundColor Cyan
Write-Host ""

# Verificar e remover lock se existir
if (Test-Path ".git/index.lock") {
    Write-Host "⚠️  Removendo lock do Git..." -ForegroundColor Yellow
    Remove-Item ".git/index.lock" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# FASE 1
Write-Host "=== FASE 1: TenantMiddleware Hardening ===" -ForegroundColor Green
git add apps/api/src/common/middleware/tenant.middleware.ts
if ($LASTEXITCODE -eq 0) {
    git commit -m "feat(api): FASE 1 - Hardening do TenantMiddleware

- Ignora header x-tenant-slug em produção (segurança)
- Validação forte do slug (sanitização [a-z0-9-], tamanho 3-63)
- Erro 400 ao invés de 404 quando tenant não resolvido
- Logs com requestId para rastreamento
- Referer não usado em produção (falsificável)
- Resolução por subdomínio priorizada em produção"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ FASE 1 commitada com sucesso" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro no commit FASE 1" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Erro ao adicionar arquivo FASE 1" -ForegroundColor Red
    exit 1
}

# FASE 2
Write-Host "`n=== FASE 2: Prisma/TenantPrisma Hardening ===" -ForegroundColor Green
git add apps/api/src/prisma/prisma.service.ts apps/api/src/prisma/tenant-prisma.service.ts apps/api/src/auth/auth.service.ts
if ($LASTEXITCODE -eq 0) {
    git commit -m "feat(api): FASE 2 - Hardening do Prisma/TenantPrisma

- TenantPrismaService.run() valida tenant obrigatório (HTTP 400)
- PrismaService.withTenant() valida UUID e current_setting
- Validação dupla do contexto de tenant (set_config + current_setting)
- AuthService usa tenant do contexto e prisma.withTenant()
- Tipagem correta com Prisma.TransactionClient"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ FASE 2 commitada com sucesso" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro no commit FASE 2" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Erro ao adicionar arquivos FASE 2" -ForegroundColor Red
    exit 1
}

# FASE 3
Write-Host "`n=== FASE 3: Frontend Security ===" -ForegroundColor Green
git add apps/web/src/lib/api.ts
if ($LASTEXITCODE -eq 0) {
    git commit -m "feat(web): FASE 3 - Segurança do Frontend (DEV-only header)

- Header x-tenant-slug controlado por NEXT_PUBLIC_ALLOW_TENANT_HEADER
- Default: false (seguro por padrão)
- Erro no console se NEXT_PUBLIC_TENANT_SLUG não configurado
- Sem fallbacks inseguros (não usa 'clinica1' hardcoded)"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ FASE 3 commitada com sucesso" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro no commit FASE 3" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Erro ao adicionar arquivo FASE 3" -ForegroundColor Red
    exit 1
}

# FASE 4
Write-Host "`n=== FASE 4: Testes E2E de Isolamento ===" -ForegroundColor Green
git add apps/api/test/tenant-isolation.e2e-spec.ts
if ($LASTEXITCODE -eq 0) {
    git commit -m "test(api): FASE 4 - Testes e2e de isolamento multi-tenant

- Cria 2 tenants (A e B) e valida isolamento
- Testa prisma.withTenant() e tenantPrisma.run()
- Valida que tenant A não vê dados do tenant B
- Testa AsyncLocalStorage com tenantContext.runAsync()
- Valida erro quando não há contexto de tenant"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ FASE 4 commitada com sucesso" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro no commit FASE 4" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Erro ao adicionar arquivo FASE 4" -ForegroundColor Red
    exit 1
}

# FASE 5
Write-Host "`n=== FASE 5: Documentação ===" -ForegroundColor Green
git add docs/dev-multitenant.md
if ($LASTEXITCODE -eq 0) {
    git commit -m "docs: FASE 5 - Documentação completa multi-tenant

- Como rodar com header (DEV) e env flags
- Como rodar sem header (prod-like)
- Checklist detalhado para novos métodos
- Referência rápida e comandos úteis
- Exemplos práticos e troubleshooting"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ FASE 5 commitada com sucesso" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro no commit FASE 5" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Erro ao adicionar arquivo FASE 5" -ForegroundColor Red
    exit 1
}

# Arquivos Auxiliares
Write-Host "`n=== Arquivos Auxiliares ===" -ForegroundColor Green
git add apps/api/nest-cli.json apps/web/src/app/dashboard/agenda/page.tsx
if ($LASTEXITCODE -eq 0) {
    git commit -m "chore: Ajustes auxiliares para multi-tenant

- nest-cli.json: deleteOutDir=false (evita EPERM)
- agenda/page.tsx: correção de status válidos"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Arquivos auxiliares commitados com sucesso" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro no commit auxiliares" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Erro ao adicionar arquivos auxiliares" -ForegroundColor Red
    exit 1
}

# Resumo Final
Write-Host "`n=== ✅ RESUMO DOS COMMITS ===" -ForegroundColor Cyan
git log --oneline -6
Write-Host "`n=== Status Final ===" -ForegroundColor Cyan
git status --short | Select-Object -First 15

Write-Host "`n✅ Todos os commits foram executados com sucesso!" -ForegroundColor Green
