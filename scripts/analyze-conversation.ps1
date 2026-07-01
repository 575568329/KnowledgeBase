<#
.SYNOPSIS
    分析 Claude Code 对话历史，提取问题、方案、决策和经验
.DESCRIPTION
    读取指定会话的 JSONL 文件，智能提取有价值的信息并生成结构化文档
.PARAMETER SessionFile
    会话文件路径（.jsonl）
.PARAMETER OutputDir
    输出目录，默认为 docs/项目复盘/
.PARAMETER ProjectName
    项目名称，用于文档标题
.EXAMPLE
    .\analyze-conversation.ps1 -SessionFile "C:\Users\fjyu9\.claude\projects\D--Study-KnowledgeBase\686eaaa5-7b41-483e-a23e-9db3d28e55b9.jsonl" -ProjectName "KnowledgeBase"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$SessionFile,

    [Parameter(Mandatory=$false)]
    [string]$OutputDir = "docs/项目复盘",

    [Parameter(Mandatory=$false)]
    [string]$ProjectName = "未命名项目"
)

# 确保输出目录存在
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

Write-Host "📖 开始分析对话历史..." -ForegroundColor Cyan
Write-Host "   文件: $SessionFile" -ForegroundColor Gray

# 读取 JSONL 文件
$lines = Get-Content $SessionFile -Encoding UTF8
$totalLines = $lines.Count
Write-Host "   共 $totalLines 条记录" -ForegroundColor Gray

# 解析数据结构
$userMessages = @()
$assistantMessages = @()
$toolCalls = @()
$errors = @()

Write-Host "`n🔍 解析对话内容..." -ForegroundColor Cyan

$lineNumber = 0
foreach ($line in $lines) {
    $lineNumber++
    if ($lineNumber % 100 -eq 0) {
        Write-Progress -Activity "解析对话" -Status "处理第 $lineNumber / $totalLines 条" -PercentComplete (($lineNumber / $totalLines) * 100)
    }

    try {
        $obj = $line | ConvertFrom-Json -ErrorAction Stop

        switch ($obj.type) {
            "user" {
                if ($obj.message.content) {
                    $userMessages += @{
                        Content = $obj.message.content
                        Timestamp = $obj.timestamp
                        UUID = $obj.uuid
                    }
                }
            }
            "assistant" {
                if ($obj.message.content) {
                    $assistantMessages += @{
                        Content = $obj.message.content
                        Timestamp = $obj.timestamp
                        UUID = $obj.uuid
                        ParentUUID = $obj.parentUuid
                    }
                }
            }
            "tool_result" {
                $toolCalls += @{
                    Tool = $obj.attachment.tool
                    Result = $obj.attachment.result
                    Timestamp = $obj.timestamp
                }
            }
        }
    }
    catch {
        # 跳过无法解析的行
    }
}

Write-Progress -Activity "解析对话" -Completed

Write-Host "✅ 解析完成" -ForegroundColor Green
Write-Host "   用户消息: $($userMessages.Count)" -ForegroundColor Gray
Write-Host "   助手回复: $($assistantMessages.Count)" -ForegroundColor Gray
Write-Host "   工具调用: $($toolCalls.Count)" -ForegroundColor Gray

# 生成时间戳
$timestamp = Get-Date -Format "yyyyMMddHHmmss"

# 提取关键对话片段
Write-Host "`n📝 生成分析报告..." -ForegroundColor Cyan

$reportContent = @"
# $ProjectName - 对话历史分析报告

> 生成时间：$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
> 数据源：``$(Split-Path $SessionFile -Leaf)``

---

## 📊 基本统计

- **用户消息数**：$($userMessages.Count)
- **助手回复数**：$($assistantMessages.Count)
- **工具调用次数**：$($toolCalls.Count)
- **对话轮次**：$([Math]::Min($userMessages.Count, $assistantMessages.Count))

---

## 💬 对话主题提取

### 用户提出的问题/需求

"@

$questionNumber = 1
foreach ($msg in $userMessages) {
    $content = $msg.Content -replace "`r`n", " " -replace "`n", " "
    if ($content.Length -gt 200) {
        $content = $content.Substring(0, 200) + "..."
    }
    $time = if ($msg.Timestamp) {
        ([DateTime]::Parse($msg.Timestamp).ToString("HH:mm:ss"))
    } else {
        "未知时间"
    }

    $reportContent += @"

**$questionNumber. [$time]**
> $content

"@
    $questionNumber++
}

$reportContent += @"

---

## 🔧 使用的工具

"@

# 统计工具使用频率
$toolStats = $toolCalls | Where-Object { $_.Tool } | Group-Object -Property Tool | Sort-Object Count -Descending

foreach ($tool in $toolStats) {
    $reportContent += "- **$($tool.Name)**: $($tool.Count) 次`n"
}

$reportContent += @"

---

## 📌 关键回复摘要

> 以下是助手的主要回复内容（前 10 条）

"@

$replyNumber = 1
foreach ($msg in ($assistantMessages | Select-Object -First 10)) {
    $content = $msg.Content -replace "`r`n", " " -replace "`n", " "
    if ($content.Length -gt 300) {
        $content = $content.Substring(0, 300) + "..."
    }
    $time = if ($msg.Timestamp) {
        ([DateTime]::Parse($msg.Timestamp).ToString("HH:mm:ss"))
    } else {
        "未知时间"
    }

    $reportContent += @"

### $replyNumber. [$time]

$content

"@
    $replyNumber++
}

$reportContent += @"

---

## 🎯 提取建议

基于以上对话分析，建议后续整理为以下类型文档：

1. **技术决策记录** - 记录架构选型、技术方案的讨论过程
2. **问题解决清单** - 整理遇到的问题及解决方案
3. **操作流程文档** - 提炼重复性操作的标准流程
4. **经验教训总结** - 记录踩坑经验和最佳实践

---

## 📎 附录

- 会话文件：``$SessionFile``
- 分析工具：``scripts/analyze-conversation.ps1``
- 生成时间：``$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")``

"@

# 写入文件
$outputFile = Join-Path $OutputDir "${timestamp}_${ProjectName}_对话分析.md"
$reportContent | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "✅ 报告已生成" -ForegroundColor Green
Write-Host "   输出文件: $outputFile" -ForegroundColor Gray

# 同时生成 JSON 格式的原始数据
$jsonData = @{
    ProjectName = $ProjectName
    SessionFile = $SessionFile
    GeneratedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Statistics = @{
        UserMessages = $userMessages.Count
        AssistantMessages = $assistantMessages.Count
        ToolCalls = $toolCalls.Count
    }
    UserMessages = $userMessages
    AssistantMessages = $assistantMessages
    ToolStats = $toolStats | ForEach-Object { @{ Tool = $_.Name; Count = $_.Count } }
}

$jsonFile = Join-Path $OutputDir "${timestamp}_${ProjectName}_对话数据.json"
$jsonData | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonFile -Encoding UTF8

Write-Host "✅ JSON 数据已导出" -ForegroundColor Green
Write-Host "   数据文件: $jsonFile" -ForegroundColor Gray

Write-Host "`n🎉 分析完成！" -ForegroundColor Green
