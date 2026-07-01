# xkzy-harness 工程套件深度调研报告

> 调研对象:`D:\xunfei\xkzy-harness-plugin`
> 调研日期:2026-07-01
> 本报告回答:这个工程的本质、行业定位、解决的问题、与业界方案的区别

---

## 一、本质定义(What It Really Is)

**xkzy-harness 是一个「软件工程流程的 Claude Code 插件化编排器」**,把部门级开发规范(《AI 编程时代的软件工程 V1.0》)固化成可分发、可升级、可巡检的 12 个命令 + 27 个环节矩阵 + 22 个产物模板,通过 Claude Code 的 skill 机制驱动整个需求生命周期。

### 核心架构特点

```
[用户需求] → 12 个命令封装的生命周期
   ↓
[矩阵路由] R1/R2/R3 按复杂度分级
   ↓
[环节委派] 每环节委派给 ecs/opsx 等技能执行
   ↓
[状态管理] progress.md 进度账本跨会话/跨角色持久化
   ↓
[门禁机制] 👁 人审 / 🌙 条件自动 / 👤 人主导三层门禁
```

**三个关键抽象**:
1. **矩阵(matrix.yaml)** — 机器可读真相源(SSOT),27 环节 × 档位 × 阶段 × 角色 × 门禁 × 产物 × 推荐 Skill
2. **进度账本(progress.md)** — 跨会话/跨角色持久化状态,与 TodoWrite 临时清单分离
3. **委派执行器(work)** — 不重新实现环节逻辑,只读账本卡门禁、委派给对应 skill

---

## 二、依托的流程(What Process It Automates)

### 五阶段 + R1/R2/R3 分级路由

源自讯飞教育 BG《AI 编程时代的软件工程 V1.0》:

```
阶段1 需求定义 → 阶段2 技术方案设计 → 阶段3 AI 可执行任务拆解 
→ 阶段4 AI 编码与反馈执行 → 阶段5 测试与验收交付
      └────── 横切:一致性检查·持续性检查(贯穿全流程)──────┘
```

按复杂度分三档,决定哪些环节纳入:

| 档位 | 含义 | 增量 |
|------|------|------|
| R1 | 最小必选核心流程 | 缺陷修复/小增强/内部工具 |
| R2 | R1 + 可选:需求分析/交互/视觉/架构/测试方案/系统测试 | 中等功能,涉及交互/视觉/架构 |
| R3 | R2 + 必选:测试方案/系统用例/系统测试 + 可选:Mock | 对外核心/高风险/强质量要求 |

**关键创新:可选环节在阶段入口一次性决策**,不靠 AI 隐式开启 —— 阶段内多角色并行,入口编排清楚并行铺开哪些可选工作流。

### Issue 工作项分流(F1/F2)

线上 bug 走 Issue 轨(Fix- 前缀),按紧急度分档:
- **F2**:常规修复,复用后段验证 16 环,砍掉 8 个 feature 前段环节
- **F1**:紧急热修,stage0 先止血(人授权)→ 再走 F2 完整根治

分流判据(单刀):溯源到**未上线** change 的缺陷 = 开发期缺陷,走该 change 回炉;代码已在线上才建 Fix-。

---

## 三、利用 AI 什么优势解决什么问题

### 1. AI 优势利用

| AI 能力 | 如何利用 | 体现在哪 |
|---------|---------|---------|
| **理解自然语言需求** | `/xkzy-harness:start` 采集需求名称、判档、生成账本 | 判 R1/R2/R3 时把判据摆给用户、协助决策 |
| **生成结构化产物** | 按 22 个标准模板(prd/design/tasks/test-case 等)产出初稿 | `work` 逐环委派给 ecs/opsx 生成 md |
| **读取代码验证契约** | 详细设计/任务拆解时验证 `projects/` 真实代码,登记位置 | 防臆测契约(详细设计 §2.5 / tasks.md 证据项) |
| **独立审阅(Verifier Agent)** | 代码评审按 ≥4 视角产 `code-review-report.md`,BLOCKER 打回 | `work` 门禁 4: 🌙 条件门禁(0 BLOCKER 自动过) |
| **状态持久化与恢复** | 读 `progress.md` 断点续推,跨会话/跨角色交接 | `work` 步骤 0:git pull 拉最新账本 |
| **条件判定自动化** | `auto_pass_when` 全绿 → `🌙自动通过`,省逐次人签 | 静测/单测/本地验证/CI 构建 4 个环节 |

### 2. 解决的核心问题

#### 问题 1:流程口口相传 → 难一致、难升级

**痛点**:该跑哪些环节、谁签字、产物长什么样,靠文档 + 人工传达,新人上手慢、执行偏差大。

**解法**:插件 + 矩阵真相源(matrix.yaml)。

流程逻辑只在插件里改,`/plugin upgrade` 全员生效;团队定制矩阵放 workspace `.claude/xkzy-harness/matrix.local.yaml`(差异须在文件头登记,`/xkzy-harness:check` 巡检)。

#### 问题 2:跨角色/跨会话交接断层

**痛点**:产品→架构师→测试→运维,接力推进时状态断层,不知道"上一个人做到哪了"。

**解法**:`progress.md` 进度账本(跨会话持久化)+ `work` 步骤 0 断点续推。

每环节产出/确认/交接备注都落账本,角色交接时自动提示,可 `@角色名`。账本入 main 后远端领先 → `git pull --rebase` 拉最新,避免基于旧账本漏掉别会话推进。

#### 问题 3:人审瓶颈 vs 质量风险

**痛点**:全程人审(👁)太重,全程自动化不可控。

**解法**:三层门禁分层把关。

- `👁` 硬门禁(需求/设计/评审):一次只过一道,不跳过、不批量,附加评审闸(TPD 链接)
- `🌙` 条件门禁(静测/单测/CI/代码评审):`auto_pass_when` 全满足 → 自动通过,晨审批量补签
- `👤` 人主导(验收测试/上线交付):真人执行 + 签字,AI 不代签

反作弊:记 `🌙自动通过` 前先跑 `gate-assert.sh config-unchanged / evidence-fresh` 确定性断言,防"改配置凑绿"/"臆造证据"。

#### 问题 4:夜间无人值守能力

**痛点**:编码→集成测试可机器验,但夜间无人签字。

**解法**:`/xkzy-harness:night` 夜间批次 + `🌙` 条件门禁。

睡前 `/xkzy-harness:night-check` 准入预检(上游完成度/产物完备/环境可达),产就绪清单;夜间自动放行该区间(编码实现→集成测试)的 `🌙` 环节,遇 `👁` 停车,晨审批量补签。`👁` 产出即挂起 → 不卡流程,白天回来续推。

---

## 四、行业水平定位(Where It Stands)

### 业界对标

| 方案类别 | 代表 | 做什么 | 与 xkzy-harness 区别 |
|---------|------|--------|---------------------|
| **CI/CD 编排** | GitHub Actions · GitLab CI · Jenkins | 自动化构建/测试/部署管道 | 粒度:单环节(CI);xkzy 粒度:全生命周期 27 环节。业界聚焦"交付自动化",xkzy 覆盖"需求→设计→编码→测试→交付"全链路 |
| **AI Agent 编排** | LangGraph · n8n · Apify via MCP | 通用 AI workflow 编排,串联多个 agent/tool | 领域:通用(任意工作流);xkzy 领域:软件工程流程专用。业界提供画布,xkzy 固化方法论 |
| **MCP 生态** | [Claude MCP](https://docs.anthropic.com/en/docs/agents-and-tools/mcp) · [n8n/Apify MCP 集成](https://medium.com/@tuguidragos/the-agentic-revolution-how-claude-can-now-control-your-entire-n8n-and-apify-workflow-library-via-286fc85d4350) | 扩展 Claude 的工具调用能力 | 关系:互补。MCP 是"Claude 能调什么外部工具",xkzy 是"用 Claude 跑什么软件工程流程" —— xkzy 的 ecs/opsx 技能可以是 MCP server |
| **Harness(同名产品)** | [Harness.io](https://www.harness.io/) | 企业级 CI/CD 平台(付费 SaaS) | 名字撞了但定位不同。Harness.io = DevOps 交付平台(pipeline as code);xkzy-harness = 部门级软件工程流程插件(Claude Code 生态) |

### 独特性(Unique Value)

1. **方法论固化 + 工具一体**

业界 CI/CD 只做"交付自动化",不管"需求怎么拆、设计谁评审";通用 workflow 平台(LangGraph/n8n)提供画布,但软件工程流程得自己搭。

xkzy-harness 把《AI 编程时代的软件工程 V1.0》**方法论 + 工具 + 模板**打包成插件,开箱即用。

2. **人机协同的门禁设计**

不是"全自动"也不是"全人工" —— 三层门禁(`👁`/`🌙`/`👤`)精准定义哪些环节 AI 可自动、哪些必须人审,附加反作弊断言。

这种细粒度控制,业界 CI/CD 没有(粗放的 approval gate),通用 workflow 平台做不到(领域无关)。

3. **跨角色/跨会话持久化**

`progress.md` 账本 + git 作为真相源,多角色接力时自然交接。不依赖外部状态管理系统(如 Jira/禅道),轻量。

4. **插件 + workspace 分离**

**流程逻辑**(命令/矩阵/模板)在插件,`/plugin upgrade` 全员生效;**业务资产**(知识库/规约/项目地图)在 workspace。

这个分层设计让"标准流程"和"团队定制"解耦,是业界少见的。

### 成熟度评估

- **技术栈**:基于 Claude Code skill 机制 + bash 脚本 + git,轻量、无额外服务依赖,可部署性强
- **文档完备度**:README/SKILL.md/matrix.yaml 三层文档,机器可读 + 人类可读,配套手册 `/xkzy-harness:references:work-gates` 详尽
- **实际应用**:有 3 个实例 workspace(学科资源/资源加工/视频加工),已落地
- **待验证**:夜间无人值守(`night`)、多仓库(挂载点=All)、Issue 轨(F1/F2)的实战效果

**行业水平判断:领先于通用 CI/CD,但仅限软件工程流程领域的垂直创新**。这不是"通用 agent 编排平台",而是"把部门软件工程流程用 AI 跑起来"的专用解决方案。

---

## 五、业界已有项目/方案对比

### 1. GitHub Actions / GitLab CI

**做什么**:[CI/CD 管道自动化](https://resources.github.com/devops/tools/automation/actions/),YAML 定义 pipeline,自动触发构建/测试/部署。

**区别**:
- 粒度:单环节(Build → Test → Deploy);xkzy-harness 27 环节覆盖全生命周期
- 切入点:代码 push 触发;xkzy 从需求采集切入
- 人机协同:Actions 的 approval 是粗粒度"人工门";xkzy 三层门禁 + 反作弊断言

**解决的问题**:交付自动化。不解决"需求怎么拆、设计谁评审"。

### 2. LangGraph / n8n / Apify

**做什么**:[通用 AI agent workflow 编排](https://www.qodo.ai/blog/building-agentic-flows-with-langgraph-model-context-protocol/),可视化画布或代码定义 agent 串联。

**区别**:
- 领域:通用(任意工作流);xkzy 领域:软件工程流程专用
- 固化度:提供画布,流程自己搭;xkzy 固化 27 环节 + 22 模板
- 状态管理:内存/数据库;xkzy 用 git + progress.md(轻量)

**解决的问题**:通用 agent 编排。软件工程流程得自己在上面搭,无现成方法论。

### 3. MCP (Model Context Protocol)

**做什么**:[扩展 Claude 的工具调用能力](https://docs.anthropic.com/en/docs/agents-and-tools/mcp),让 Claude 能调外部服务(搜索/数据库/自动化工具)。

**区别**:
- 关系:互补,不是替代。MCP 是"Claude 能调什么",xkzy 是"用 Claude 跑什么流程"
- xkzy 的 ecs/opsx 技能**可以是** MCP server,也可以是纯 Claude skill

**解决的问题**:Claude 的工具扩展性。不直接解决软件工程流程编排。

### 4. Harness.io (企业级 CI/CD 平台)

**做什么**:[DevOps 交付平台](https://www.harness.io/),pipeline as code + 金丝雀发布 + 成本优化,付费 SaaS。

**区别**:
- 名字撞了,但定位完全不同
- Harness.io = 企业级 DevOps 平台(重量级,多团队大规模);xkzy-harness = 部门级流程插件(轻量,Claude Code 生态)
- Harness.io 聚焦交付(CD);xkzy 覆盖全生命周期

**解决的问题**:大规模 DevOps 交付。不涉及需求/设计/任务拆解环节。

### 5. Claude Code + Anthropic Agent SDK

**做什么**:[Claude Code 官方框架](https://code.claude.com/docs/en/agent-sdk/mcp),提供 skill/plugin/MCP 机制构建 AI workflow。

**区别**:
- xkzy-harness **基于** Claude Code skill 机制实现
- 官方提供基础设施(skill/plugin/MCP),xkzy 在上面构建了"软件工程流程"这个垂直应用

**解决的问题**:AI agent 开发框架。xkzy 是该框架上的一个专用应用。

---

## 六、总结:本质与价值

**本质**:xkzy-harness 不是通用的"AI workflow 编排平台",而是**把部门级软件工程方法论固化成 Claude Code 插件的垂直应用**。

**解决的问题**:
1. 流程一致性(口口相传 → 可分发插件)
2. 跨角色交接断层(临时状态 → 持久化账本)
3. 人审瓶颈 vs 质量风险(全人工 vs 全自动 → 三层门禁分层)
4. 夜间无人值守能力(条件门禁 + 晨审补签)

**在行业中的位置**:
- 领先于通用 CI/CD(覆盖全生命周期,不只交付)
- 垂直于通用 agent 编排(软件工程流程专用,内嵌方法论)
- 基于 Claude Code 生态(skill/MCP 互补,不是替代)
- 对标 Harness.io 但定位不同(部门级插件 vs 企业级 SaaS)

**核心创新**:方法论(R1/R2/R3 分级)+ 工具(12 命令)+ 模板(22 产物)+ 门禁(👁🌙👤)四位一体,开箱即用的软件工程流程自动化套件。

---

## 附:关键文件清单

| 文件 | 作用 |
|------|------|
| `README.md` | 插件概览,12 命令生命周期,安装/升级说明 |
| `matrix.yaml` | 27 环节 × 档位 × 阶段 × 角色 × 门禁 × 产物 × skill,机器可读真相源(SSOT) |
| `skills/start/SKILL.md` | 创建流程:采集、判档、落账本 |
| `skills/work/SKILL.md` | 执行流程:读账本、卡门禁、委派 ecs/opsx |
| `skills/night/SKILL.md` | 夜间无人值守批量推进 |
| `templates/` | 22 个标准产物模板(prd/design/tasks/test-case 等) |
| `xkzy-harness-介绍.pptx` | PPT 介绍(4MB) |
| `xkzy-harness.png` | 全景图(12MB) |

**相关 workspace**:
- [学科资源 workspace](https://code.iflytek.com/EPD_TPD_AIP/ai-res/xkzy-harness-workspace.git)
- [资源加工平台 workspace](https://code.iflytek.com/EPD_ZYJG_RPP/crowdsourced-harness-workspace.git)
- [视频加工平台 workspace](https://code.iflytek.com/osc/_source/EPD_ZYJG_RPP/VPP/VideoWeb)
