@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ==========================================
echo   Knowledge Base - Starting...
echo ==========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\generate-manifest.ps1"

echo.
echo URL: http://localhost:8850/index.html
echo Press Ctrl+C to stop
echo.

timeout /t 2 /nobreak >nul
start http://localhost:8850/index.html

node scripts\serve.js 8850

echo.
pause
