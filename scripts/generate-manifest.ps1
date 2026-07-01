<#
.SYNOPSIS
    扫描 docs/ 目录，生成 manifest.json（前端目录树数据源）。
.DESCRIPTION
    递归遍历 docs/ 下的支持格式文件，输出嵌套结构的 JSON。
    本地启动与 GitHub Actions 共用此脚本，保证两端目录一致。
#>

param(
    [string]$DocsDir = "docs",
    [string]$Output  = "manifest.json"
)

$ErrorActionPreference = "Stop"

# 脚本所在目录的上一级 = 项目根
$root    = Split-Path -Parent $PSScriptRoot
$docsAbs = Join-Path $root $DocsDir
$outAbs  = Join-Path $root $Output

# 支持的文件扩展名
$supported = @(".md", ".markdown", ".pdf", ".docx", ".html", ".htm",
               ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico")

function Get-Title([string]$name) {
    # 去掉扩展名 + 去掉排序前缀（如 "01_" / "01-"）作为展示标题
    $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
    return ($base -replace '^\d+[_\-\.\s]+', '')
}

function Get-FrontmatterTags([string]$filePath) {
    # 只处理 md/markdown 文件
    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    if ($ext -ne '.md' -and $ext -ne '.markdown') { return @() }

    try {
        # 读取文件前 30 行(frontmatter 通常在这范围内)
        $lines = Get-Content $filePath -TotalCount 30 -Encoding UTF8 -ErrorAction Stop
        if ($lines.Count -lt 3) { return @() }

        # 检查是否以 --- 开头(YAML frontmatter)
        if ($lines[0] -ne '---') { return @() }

        # 找第二个 --- 的位置
        $endIdx = -1
        for ($i = 1; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -eq '---') {
                $endIdx = $i
                break
            }
        }
        if ($endIdx -eq -1) { return @() }

        # 提取 frontmatter 区域
        $frontmatter = $lines[1..($endIdx-1)] -join "`n"

        # 简单解析 tags 行(支持 tags: [a, b, c] 和 tags: [a,b,c])
        if ($frontmatter -match 'tags:\s*\[([^\]]+)\]') {
            $tagStr = $matches[1]
            $tags = $tagStr -split ',' | ForEach-Object { $_.Trim().Trim('"').Trim("'") } | Where-Object { $_ }
            return @($tags)
        }

        return @()
    } catch {
        return @()
    }
}

function Get-ContentPreview([string]$filePath) {
    # 提取 markdown 正文（去 frontmatter，前 2000 字符）用于全文搜索
    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    if ($ext -ne '.md' -and $ext -ne '.markdown') { return "" }

    try {
        $content = Get-Content $filePath -Raw -Encoding UTF8 -ErrorAction Stop
        if (-not $content) { return "" }

        # 去掉 frontmatter（如果有）
        if ($content -match '^---\s*\r?\n') {
            # 找第二个 ---
            if ($content -match '^---\s*\r?\n(.*?)\r?\n---\s*\r?\n(.*)$', 'Singleline') {
                $content = $matches[2]  # 正文部分
            }
        }

        # 去掉 markdown 语法（简单清洗）
        $content = $content -replace '#+ ', ''           # 标题
        $content = $content -replace '\[([^\]]+)\]\([^\)]+\)', '$1'  # 链接
        $content = $content -replace '\*\*([^\*]+)\*\*', '$1'        # 粗体
        $content = $content -replace '\*([^\*]+)\*', '$1'            # 斜体
        $content = $content -replace '`([^`]+)`', '$1'               # 行内代码
        $content = $content -replace '```[\s\S]*?```', ''            # 代码块
        $content = $content -replace '\s+', ' '                      # 多空白合并

        # 取前 2000 字符
        $preview = $content.Trim()
        if ($preview.Length -gt 2000) {
            $preview = $preview.Substring(0, 2000)
        }

        return $preview
    } catch {
        return ""
    }
}

function Build-Node([System.IO.DirectoryInfo]$dir, [string]$relBase) {
    $children = @()

    # 子目录（按名称排序，目录在前）
    $subDirs = Get-ChildItem -Path $dir.FullName -Directory |
               Where-Object { $_.Name -notmatch '^\.' } |
               Sort-Object Name
    foreach ($sd in $subDirs) {
        $rel  = if ($relBase) { "$relBase/$($sd.Name)" } else { $sd.Name }
        $node = Build-Node $sd $rel
        # 仅保留含有效文件的目录
        if ($node.children.Count -gt 0) { $children += $node }
    }

    # 当前目录下的文件
    $files = Get-ChildItem -Path $dir.FullName -File |
             Where-Object { $supported -contains $_.Extension.ToLower() } |
             Sort-Object Name
    foreach ($f in $files) {
        $rel = if ($relBase) { "$relBase/$($f.Name)" } else { $f.Name }
        $mtime = [int][double]::Parse(($f.LastWriteTime.ToUniversalTime() - [datetime]'1970-01-01').TotalSeconds)
        $tags = Get-FrontmatterTags $f.FullName
        $content = Get-ContentPreview $f.FullName
        $node = [ordered]@{
            type  = "file"
            name  = $f.Name
            title = (Get-Title $f.Name)
            path  = "docs/$rel"
            mtime = $mtime
        }
        if ($tags.Count -gt 0) { $node.tags = $tags }
        if ($content) { $node.content = $content }
        $children += $node
    }

    return [ordered]@{
        type     = "dir"
        name     = $dir.Name
        title    = (Get-Title $dir.Name)
        children = $children
    }
}

if (-not (Test-Path $docsAbs)) {
    New-Item -ItemType Directory -Path $docsAbs -Force | Out-Null
}

$docsInfo = Get-Item $docsAbs
$rootNode = Build-Node $docsInfo ""
$rootNode.name  = "docs"
$rootNode.title = "知识库"

# 统计文件数
$count = 0
function Count-Files($node) {
    if ($node.type -eq "file") { return 1 }
    $c = 0
    foreach ($ch in $node.children) { $c += (Count-Files $ch) }
    return $c
}
$count = Count-Files $rootNode

# 显式以 UTF-8 无 BOM 写入，兼容 Windows PowerShell 5.1 与 PowerShell 7+
$json = $rootNode | ConvertTo-Json -Depth 50
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($outAbs, $json, $utf8NoBom)

Write-Host "[manifest] 已生成 $Output，共收录 $count 篇文档。" -ForegroundColor Green
