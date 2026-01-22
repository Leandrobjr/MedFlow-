# Script para corrigir o arquivo .env

Write-Host "🔧 Corrigindo arquivo .env..." -ForegroundColor Cyan
Write-Host ""

$envPath = Join-Path $PSScriptRoot "..\packages\db\.env"

if (Test-Path $envPath) {
    # Ler conteúdo atual
    $content = Get-Content $envPath -Raw
    
    # Remover linha DATABASE_URL duplicada/mal formatada
    $lines = Get-Content $envPath
    $newLines = @()
    
    foreach ($line in $lines) {
        if ($line -match "^DATABASE_URL") {
            # Pular linhas duplicadas ou mal formatadas
            if ($line -match 'DATABASE_URL="DATABASE_URL=') {
                Write-Host "⚠️ Linha duplicada encontrada, será removida" -ForegroundColor Yellow
                continue
            }
        }
        $newLines += $line
    }
    
    # Adicionar linha correta se não existir
    $hasCorrectUrl = $false
    foreach ($line in $newLines) {
        if ($line -match '^DATABASE_URL="postgresql://postgres\.ojrbkxaeccafwklnkdfr:' -and 
            $line -match '@aws-0-sa-east-1\.pooler\.supabase\.com:6543/postgres"$') {
            $hasCorrectUrl = $true
            break
        }
    }
    
    if (-not $hasCorrectUrl) {
        Write-Host "📝 Adicionando URL correta..." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "⚠️ IMPORTANTE: Você precisa adicionar a senha!" -ForegroundColor Red
        Write-Host ""
        Write-Host "A URL correta deve ser:" -ForegroundColor Cyan
        Write-Host 'DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:[SUA_SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"' -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Substitua [SUA_SENHA] pela senha que você resetou no Supabase" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "✅ Arquivo parece estar correto" -ForegroundColor Green
    }
    
    Write-Host "📋 Conteúdo atual do .env:" -ForegroundColor Cyan
    Get-Content $envPath | ForEach-Object { Write-Host "   $_" }
    
} else {
    Write-Host "❌ Arquivo .env não encontrado" -ForegroundColor Red
}

Write-Host ""
