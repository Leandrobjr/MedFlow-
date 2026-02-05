$ErrorActionPreference = "Stop"

$apiDir = "d:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\apps\api"
$healthUrl = "http://127.0.0.1:3001/health"
$timeoutSeconds = 150
$stdoutLogPath = Join-Path (Join-Path $PSScriptRoot "..") "_tmp_api_startup.out.log"
$stderrLogPath = Join-Path (Join-Path $PSScriptRoot "..") "_tmp_api_startup.err.log"

Write-Host "== MedFlow: verificação automática da API ==" -ForegroundColor Cyan
Write-Host "Pasta da API: $apiDir"
Write-Host "Healthcheck:  $healthUrl"
Write-Host "Timeout:      $timeoutSeconds s"
Write-Host "Stdout log:   $stdoutLogPath"
Write-Host "Stderr log:   $stderrLogPath"
Write-Host ""

if (-not (Test-Path $apiDir)) {
  throw "Pasta da API não encontrada: $apiDir"
}

try {
  $pids = @()
  foreach ($m in (netstat -ano | Select-String ":3001" | Select-String "LISTENING")) {
    $tokens = ($m.Line -split "\s+") | Where-Object { $_ -ne "" }
    $pidToken = $tokens[-1]
    if ($pidToken -match "^\d+$") {
      $pids += [int]$pidToken
    }
  }

  $pids = $pids | Sort-Object -Unique
  if ($pids.Count -gt 0) {
    Write-Host "⚠️ Porta 3001 já está em uso (PIDs: $($pids -join ', ')). Encerrando..." -ForegroundColor Yellow
    foreach ($pidToKill in $pids) {
      & taskkill /PID $pidToKill /T /F | Out-Null
    }
    Start-Sleep -Seconds 1
  }
} catch {
  # ignore
}

$p = $null
try {
  Set-Location $apiDir

  $distMain = Join-Path $apiDir "dist\\main.js"
  if (-not (Test-Path $distMain)) {
    Write-Host "Build da API não encontrado. Rodando build..." -ForegroundColor Yellow
    & pnpm build | Out-Null
  }

  Write-Host "Iniciando API (node dist/main)..." -ForegroundColor Yellow
  Remove-Item $stdoutLogPath -Force -ErrorAction SilentlyContinue
  Remove-Item $stderrLogPath -Force -ErrorAction SilentlyContinue

  $p = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList "/c node dist\\main" `
    -PassThru `
    -NoNewWindow `
    -RedirectStandardOutput $stdoutLogPath `
    -RedirectStandardError $stderrLogPath

  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  $ok = $false
  $lastError = $null
  $lastStatus = $null

  do {
    try {
      $r = Invoke-WebRequest -UseBasicParsing $healthUrl -TimeoutSec 2
      $lastStatus = $r.StatusCode
      if ($r.StatusCode -eq 200) {
        $ok = $true
        Write-Host "✅ HEALTH_OK (HTTP 200)" -ForegroundColor Green
        break
      }
    } catch {
      $lastError = $_.Exception.Message
    }

    Start-Sleep -Milliseconds 750
  } while ((Get-Date) -lt $deadline)

  if (-not $ok) {
    Write-Host ""
    Write-Host "❌ Healthcheck falhou. Veja os logs:" -ForegroundColor Red
    Write-Host "  - $stdoutLogPath"
    Write-Host "  - $stderrLogPath"
    if ($lastStatus) {
      Write-Host "Último HTTP status visto: $lastStatus"
    }
    if ($lastError) {
      Write-Host "Último erro de conexão: $lastError"
    }
    throw "Healthcheck falhou: a API não ficou saudável em até $timeoutSeconds segundos."
  }
} finally {
  if ($p -and -not $p.HasExited) {
    Write-Host "Encerrando API (PID $($p.Id))..." -ForegroundColor Yellow
    & taskkill /PID $p.Id /T /F | Out-Null
  }
}

Write-Host "Verificação concluída com sucesso." -ForegroundColor Green
