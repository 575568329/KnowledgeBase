@echo off
chcp 65001 >nul
title 知识库 - 本地服务
cd /d "%~dp0"

echo 正在扫描 docs/ 生成目录清单...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\generate-manifest.ps1"
echo.

echo 正在启动本地服务...
start "" "http://localhost:8850/index.html"
node "%~dp0scripts\serve.js" 8850

echo.
echo 服务已停止。
pause
