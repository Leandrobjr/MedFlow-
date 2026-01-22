# Script PowerShell para configurar Supabase
# Execute após criar o projeto no Supabase e obter a DATABASE_URL

param(
    [Parameter(Mandatory=$true)]
    [string]$DatabaseUrl
)

Write-Host "🗄️ Configurando Supabase para MedFlow..." -ForegroundColor Cyan
Write-Host ""

# Navegar para a pasta do banco de dados
$dbPath = Join-Path $PSScriptRoot "..\packages\db"
Set-Location $dbPath

Write-Host "📁 Diretório: $dbPath" -ForegroundColor Gray
Write-Host ""

# Configurar DATABASE_URL
$env:DATABASE_URL = $DatabaseUrl

Write-Host "✅ DATABASE_URL configurada" -ForegroundColor Green
Write-Host ""

# Gerar cliente Prisma
Write-Host "🔧 Gerando cliente Prisma..." -ForegroundColor Yellow
pnpm prisma generate

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao gerar cliente Prisma" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Cliente Prisma gerado" -ForegroundColor Green
Write-Host ""

# Perguntar qual método usar
Write-Host "Escolha o método de migração:" -ForegroundColor Cyan
Write-Host "1. Prisma Migrate (recomendado para produção)"
Write-Host "2. Prisma DB Push (mais rápido, sem histórico)"
Write-Host ""
$choice = Read-Host "Digite 1 ou 2"

if ($choice -eq "1") {
    Write-Host ""
    Write-Host "📦 Criando migrações..." -ForegroundColor Yellow
    pnpm prisma migrate dev --name init_production
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao criar migrações" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Migrações criadas e aplicadas" -ForegroundColor Green
} elseif ($choice -eq "2") {
    Write-Host ""
    Write-Host "📦 Enviando schema para o banco..." -ForegroundColor Yellow
    pnpm prisma db push
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao enviar schema" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Schema aplicado ao banco" -ForegroundColor Green
} else {
    Write-Host "❌ Opção inválida" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Configuração do banco de dados concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️ PRÓXIMO PASSO:" -ForegroundColor Yellow
Write-Host "1. Acesse o Supabase SQL Editor"
Write-Host "2. Execute o conteúdo do arquivo: packages/db/prisma/rls.sql"
Write-Host "3. Isso configurará o Row Level Security (RLS)"
Write-Host ""
