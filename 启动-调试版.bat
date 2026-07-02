@echo off
chcp 65001 >nul
title Knowledge Base - Local Server
cd /d "%~dp0"

echo.
echo ================================================
echo   Knowledge Base - Debug Mode
echo ================================================
echo.
echo Current Dir: %cd%
echo.
pause

echo Checking Node.js...
where node
if errorlevel 1 (
    echo ERROR: Node.js not found
    pause
    exit /b 1
)

echo.
node --version
echo.
pause

echo Checking serve.js...
if exist "%~dp0scripts\serve.js" (
    echo OK: serve.js found
) else (
    echo ERROR: serve.js not found
    pause
    exit /b 1
)
echo.
pause

echo Generating manifest...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\generate-manifest.ps1"
echo Manifest done, error level: %errorlevel%
echo.
pause

echo.
echo ================================================
echo   Starting server...
echo   URL: http://localhost:8850/index.html
echo ================================================
echo.
echo Press any key to start node server...
pause

REM Open browser after 2 seconds
start "" powershell -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:8850/index.html'"

echo.
echo Executing: node scripts\serve.js 8850
echo Server logs will appear below...
echo.

REM Start server (blocks here)
node scripts\serve.js 8850

echo.
echo Node command exited
echo Error level: %errorlevel%
echo.
echo Press any key to close...
pause
