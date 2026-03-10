# Script para commitar arquivos restantes do multi-tenant
# Execute após fechar o IDE/editor para evitar lock do Git

Write-Host "=== Commitando Arquivos Restantes ===" -ForegroundColor Cyan
Write-Host ""

# Verificar e remover lock se existir
if (Test-Path ".git/index.lock") {
    Write-Host "Removendo lock do Git..." -ForegroundColor Yellow
    Remove-Item ".git/index.lock" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Commit dos arquivos de integração multi-tenant
Write-Host "=== Commit: Integração TenantPrismaService ===" -ForegroundColor Green
git add apps/api/src/prisma/prisma.module.ts apps/api/src/finance/finance.service.ts apps/api/src/pep/pep.service.ts
if ($LASTEXITCODE -eq 0) {
    git commit -m "feat(api): Integração TenantPrismaService em Finance e PEP

- PrismaModule: adiciona TenantContextService e TenantPrismaService aos providers/exports
- FinanceService: refatora para usar TenantPrismaService.run() em operações críticas
- PepService: integra TenantPrismaService para isolamento de tenant
- Garante isolamento determinístico em operações financeiras e prontuário"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Commit realizado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "Erro no commit" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Erro ao adicionar arquivos" -ForegroundColor Red
    exit 1
}

# Commit do schema.prisma (indices para performance multi-tenant)
Write-Host ""
Write-Host "=== Commit: Otimizacoes de Schema ===" -ForegroundColor Green
git add packages/db/prisma/schema.prisma
if ($LASTEXITCODE -eq 0) {
    git commit -m "perf(db): Adiciona índices para otimização multi-tenant

- Adiciona índices compostos em MedicalFee para queries filtradas por tenantId
- Melhora performance de consultas de repasse médico por tenant e status
- Índices: [tenantId, staffId, status, createdAt], [tenantId, status, createdAt], [paymentId]"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Commit do schema realizado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "Erro no commit do schema" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Erro ao adicionar schema.prisma" -ForegroundColor Red
    exit 1
}

# Resumo Final
Write-Host "`n=== ✅ RESUMO DOS COMMITS ===" -ForegroundColor Cyan
git log --oneline -8
Write-Host ""
Write-Host "=== Status Final ===" -ForegroundColor Cyan
git status --short | Select-Object -First 10

Write-Host "`n✅ Todos os commits foram executados com sucesso!" -ForegroundColor Green
Write-Host "`n📋 Próximos passos:" -ForegroundColor Yellow
Write-Host "   1. Verificar commits: git log --oneline -8" -ForegroundColor White
Write-Host "   2. Push: git push origin feature/m2-frontend" -ForegroundColor White
Write-Host "   3. Criar Pull Request" -ForegroundColor White
