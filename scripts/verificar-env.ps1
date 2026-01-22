# Script para verificar e ajudar a corrigir o .env

Write-Host "🔍 Verificando arquivo .env..." -ForegroundColor Cyan
Write-Host ""

$envPath = Join-Path $PSScriptRoot "..\packages\db\.env"

if (Test-Path $envPath) {
    Write-Host "✅ Arquivo .env encontrado: $envPath" -ForegroundColor Green
    Write-Host ""
    
    $content = Get-Content $envPath -Raw
    $dbUrlLine = $content | Select-String "DATABASE_URL"
    
    if ($dbUrlLine) {
        Write-Host "📋 Linha DATABASE_URL encontrada:" -ForegroundColor Yellow
        Write-Host $dbUrlLine.Line
        Write-Host ""
        
        # Verificar se é URL do Supabase ou localhost
        if ($dbUrlLine.Line -match "localhost") {
            Write-Host "⚠️ PROBLEMA ENCONTRADO:" -ForegroundColor Red
            Write-Host "   A URL está configurada para localhost (banco local)" -ForegroundColor Red
            Write-Host "   Precisa ser atualizada para o Supabase!" -ForegroundColor Red
            Write-Host ""
            Write-Host "📝 URL CORRETA para Supabase:" -ForegroundColor Cyan
            $correctUrl = 'DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:[SUA_SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"'
            Write-Host "   $correctUrl" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "⚠️ AÇÃO NECESSÁRIA:" -ForegroundColor Yellow
            Write-Host "   1. Resete a senha no Supabase (Settings → Database → Reset database password)"
            Write-Host "   2. Abra o arquivo: packages\db\.env"
            Write-Host "   3. Substitua a linha DATABASE_URL pela URL acima"
            Write-Host "   4. Substitua [SUA_SENHA] pela senha resetada"
            Write-Host "   5. Salve o arquivo"
        } elseif ($dbUrlLine.Line -match "ojrbkxaeccafwklnkdfr") {
            Write-Host "✅ URL parece estar configurada para Supabase" -ForegroundColor Green
            Write-Host ""
            
            # Verificar se tem senha ou está incompleta
            if ($dbUrlLine.Line -match "\[SUA_SENHA\]|\[YOUR-PASSWORD\]") {
                Write-Host "⚠️ PROBLEMA:" -ForegroundColor Red
                Write-Host "   A URL tem [SUA_SENHA] ou [YOUR-PASSWORD] - precisa substituir pela senha real!" -ForegroundColor Red
            } elseif ($dbUrlLine.Line -match "@aws-0-sa-east-1.pooler.supabase.com:6543") {
                Write-Host "✅ Formato da URL parece correto (Connection Pooler)" -ForegroundColor Green
                Write-Host ""
                Write-Host "Se ainda dá erro, verifique:" -ForegroundColor Yellow
                Write-Host "   - A senha está correta?"
                Write-Host "   - Não há espaços extras na URL?"
                Write-Host "   - A URL está entre aspas?"
            } elseif ($dbUrlLine.Line -match "@db\.ojrbkxaeccafwklnkdfr\.supabase\.co:5432") {
                Write-Host "✅ Formato da URL parece correto (URL Direta)" -ForegroundColor Green
            } else {
                Write-Host "⚠️ URL pode estar incompleta ou no formato errado" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "Formato esperado:" -ForegroundColor Cyan
                $expectedUrl = 'DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"'
                Write-Host "   $expectedUrl" -ForegroundColor Yellow
            }
        } else {
            Write-Host "⚠️ URL não reconhecida" -ForegroundColor Yellow
            Write-Host "   Verifique se está usando a URL do Supabase" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Linha DATABASE_URL não encontrada no .env" -ForegroundColor Red
        Write-Host ""
        Write-Host "Adicione esta linha ao arquivo:" -ForegroundColor Yellow
        $newUrl = 'DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:[SUA_SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"'
        Write-Host $newUrl -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ Arquivo .env não encontrado em: $envPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Crie o arquivo e adicione:" -ForegroundColor Yellow
    $newUrl = 'DATABASE_URL="postgresql://postgres.ojrbkxaeccafwklnkdfr:[SUA_SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"'
    Write-Host $newUrl -ForegroundColor Cyan
}

Write-Host ""
