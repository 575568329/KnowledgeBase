#Requires -Version 5.1
<#
.SYNOPSIS
    分析 Claude Code 对话历史，提取问题、方案、决策和经验（优化版）
.DESCRIPTION
    读取指定会话的 JSONL 文件，智能提取有价值的信息并生成结构化文档
    - 只提取用户的真实消息（过滤工具结果）
    - 只提取助手的文本回复（过滤工具调用）
    - 统计工具使用情况
.PARAMETER SessionFile
    会话文件路径（.jsonl）
.PARAMETER OutputDir
    输出目录，默认为 docs/项目复盘/
.PARAMETER ProjectName
    项目名称，用于文档标题
.EXAMPLE
    .\analyze-conversation-v2.ps1 -SessionFile "C:\Users\fjyu9\.claude\projects\xxx.jsonl" -ProjectName "MyProject"
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
                # 只提取真实的用户消息（role=user 且有 content）
                if ($obj.message.role -eq "user" -and $obj.message.content -is [string]) {
                    $userMessages += @{
                        Content = $obj.message.content
                        Timestamp = $obj.timestamp
                        UUID = $obj.uuid
                    }
                }
            }
            "assistant" {
                # 只提取文本回复（排除纯工具调用）
                if ($obj.message.content) {
                    $textContent = ""

                    # content 可能是字符串或数组
                    if ($obj.message.content -is [string]) {
                        $textContent = $obj.message.content
                    } elseif ($obj.message.content -is [array]) {
                        # 提取 type=text 的部分
                        foreach ($block in $obj.message.content) {
                            if ($block.type -eq "text" -and $block.text) {
                                $textContent += $block.text + "`n"
                            }
                        }
                    }

                    if ($textContent.Trim()) {
                        $assistantMessages += @{
                            Content = $textContent.Trim()
                            Timestamp = $obj.timestamp
                            UUID = $obj.uuid
                            ParentUUID = $obj.parentUuid
                        }
                    }
                }
            }
            "tool_result" {
                # 统计工具使用
                if ($obj.attachment -and $obj.attachment.tool) {
                    $toolCalls += @{
                        Tool = $obj.attachment.tool
                        Timestamp = $obj.timestamp
                    }
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

| 指标 | 数量 |
|------|------|
| 用户消息数 | $($userMessages.Count) |
| 助手回复数 | $($assistantMessages.Count) |
| 工具调用次数 | $($toolCalls.Count) |
| 对话轮次 | $([Math]::Min($userMessages.Count, $assistantMessages.Count)) |

---

## 💬 用户提出的问题/需求

"@

$questionNumber = 1
foreach ($msg in $userMessages) {
    $content = $msg.Content -replace "`r`n", " " -replace "`n", " "
    if ($content.Length -gt 150) {
        $content = $content.Substring(0, 150) + "..."
    }
    $time = if ($msg.Timestamp) {
        ([DateTime]::Parse($msg.Timestamp).ToString("HH:mm:ss"))
    } else {
        "未知"
    }

    $reportContent += "`n`n### $questionNumber. [$time]`n`n> $content`n"
    $questionNumber++
}

$reportContent += @"

---

## 🔧 工具使用统计

"@

# 统计工具使用频率
$toolStats = $toolCalls | Where-Object { $_.Tool } | Group-Object -Property Tool | Sort-Object Count -Descending

if ($toolStats) {
    $reportContent += "`n| 工具名称 | 使用次数 |`n|----------|----------|`n"
    foreach ($tool in $toolStats) {
        $reportContent += "| $($tool.Name) | $($tool.Count) |`n"
    }
} else {
    $reportContent += "`n无工具调用记录`n"
}

$reportContent += @"

---

## 📌 助手回复摘要（前 10 条）

"@

$replyNumber = 1
foreach ($msg in ($assistantMessages | Select-Object -First 10)) {
    $content = $msg.Content

    # 限制长度
    if ($content.Length -gt 500) {
        $content = $content.Substring(0, 500) + "`n`n*[内容过长已截断]*"
    }

    $time = if ($msg.Timestamp) {
        ([DateTime]::Parse($msg.Timestamp).ToString("HH:mm:ss"))
    } else {
        "未知"
    }

    $reportContent += @"

### $replyNumber. [$time]

$content

"@
    $replyNumber++
}

$reportContent += @"

---

## 🎯 后续建议

基于以上对话分析，建议将有价值的内容整理为：

1. **技术决策记录** (`decisions/`) - 架构选型、技术方案讨论
2. **问题解决清单** (`debugging.md`) - 问题描述 + 解决方案
3. **操作流程** (`procedures/`) - 可复用的标准流程
4. **经验总结** (`preferences/`) - 最佳实践、踩坑经验

---

## 📎 元数据

- **会话文件**: ``$SessionFile``
- **分析工具**: ``scripts/analyze-conversation-v2.ps1``
- **生成时间**: ``$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")``

"@

# 写入 Markdown 报告
$outputFile = Join-Path $OutputDir "${timestamp}_${ProjectName}_对话分析.md"
$reportContent | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "✅ Markdown 报告已生成" -ForegroundColor Green
Write-Host "   输出文件: $outputFile" -ForegroundColor Gray

# 生成 JSON 数据
$jsonData = @{
    ProjectName = $ProjectName
    SessionFile = $SessionFile
    GeneratedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Statistics = @{
        UserMessages = $userMessages.Count
        AssistantMessages = $assistantMessages.Count
        ToolCalls = $toolCalls.Count
        ConversationTurns = [Math]::Min($userMessages.Count, $assistantMessages.Count)
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
Write-Host "`n💡 提示：" -ForegroundColor Yellow
Write-Host "   1. 查看 Markdown 报告获取对话概览" -ForegroundColor Gray
Write-Host "   2. 使用 JSON 数据做进一步自动化分析" -ForegroundColor Gray
Write-Host "   3. 基于报告提取关键内容写入 memory/" -ForegroundColor Gray
