@echo off
echo Iniciando API em modo desenvolvimento...
echo.
echo Limpando dist antigo...
if exist dist rmdir /s /q dist 2>nul
echo.
echo Fazendo build...
call pnpm build
if %ERRORLEVEL% NEQ 0 (
    echo Build falhou!
    pause
    exit /b 1
)
echo.
echo Build concluido! Iniciando servidor...
echo.
node dist/main.js
