@echo off
echo ========================================
echo Iniciando MedFlow Web App
echo ========================================
echo.

cd /d "%~dp0"

echo Limpando cache...
if exist .next rmdir /s /q .next 2>nul
if exist node_modules\.cache rmdir /s /q node_modules\.cache 2>nul

echo.
echo Iniciando Next.js na porta 3000...
echo.

call pnpm dev

pause
