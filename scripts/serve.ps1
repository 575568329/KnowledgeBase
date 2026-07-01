<#
.SYNOPSIS
    零依赖本地静态服务器（基于 .NET HttpListener，Windows 自带）。
.DESCRIPTION
    1. 调用 generate-manifest.ps1 刷新目录清单
    2. 在 localhost 上挑选空闲端口启动静态文件服务
    3. 自动用默认浏览器打开首页
    无需安装 Node / Python，Windows 10/11 开箱即用。
#>

param(
    [int]$Port = 8848
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# ---------- 1. 刷新目录清单 ----------
Write-Host "正在扫描 docs/ 生成目录清单..." -ForegroundColor Cyan
try {
    & (Join-Path $PSScriptRoot "generate-manifest.ps1")
} catch {
    Write-Host "[警告] 清单生成失败：$($_.Exception.Message)" -ForegroundColor Yellow
}

# ---------- 2. MIME 类型映射 ----------
$mime = @{
    ".html"="text/html; charset=utf-8";  ".htm"="text/html; charset=utf-8"
    ".js"="application/javascript; charset=utf-8"; ".mjs"="application/javascript; charset=utf-8"
    ".css"="text/css; charset=utf-8";    ".json"="application/json; charset=utf-8"
    ".md"="text/plain; charset=utf-8";   ".markdown"="text/plain; charset=utf-8"
    ".pdf"="application/pdf"
    ".docx"="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"
    ".webp"="image/webp"; ".svg"="image/svg+xml"; ".bmp"="image/bmp"; ".ico"="image/x-icon"
    ".woff"="font/woff"; ".woff2"="font/woff2"; ".ttf"="font/ttf"; ".otf"="font/otf"
    ".map"="application/json"
}

# ---------- 3. 选择可用端口并启动监听 ----------
$listener = [System.Net.HttpListener]::new()
$bound = $false
for ($p = $Port; $p -lt ($Port + 20); $p++) {
    try {
        $listener.Prefixes.Clear()
        $listener.Prefixes.Add("http://localhost:$p/")
        $listener.Start()
        $Port = $p
        $bound = $true
        break
    } catch {
        try { $listener.Close() } catch {}
        $listener = [System.Net.HttpListener]::new()
    }
}
if (-not $bound) {
    Write-Host "[错误] 未能在 $Port-$($Port+19) 范围找到可用端口。" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

$url = "http://localhost:$Port/index.html"
Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  知识库已启动： $url" -ForegroundColor Green
Write-Host "  关闭此窗口即可停止服务。" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""

# 自动打开默认浏览器
Start-Process $url | Out-Null

# ---------- 4. 请求循环 ----------
try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response
        try {
            $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
            if ([string]::IsNullOrEmpty($rel)) { $rel = "index.html" }

            # 防目录穿越：解析为绝对路径后必须仍在 root 内
            $full = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
            if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
                $res.StatusCode = 403; $res.Close(); continue
            }

            if (Test-Path $full -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($full).ToLower()
                $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
                $bytes = [System.IO.File]::ReadAllBytes($full)
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $res.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
                $res.OutputStream.Write($msg, 0, $msg.Length)
            }
        } catch {
            try { $res.StatusCode = 500 } catch {}
        } finally {
            try { $res.OutputStream.Close() } catch {}
        }
    }
} finally {
    try { $listener.Stop() } catch {}
}
