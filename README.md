# KnowledgeBase · 个人知识库

记录与 AI 讨论的各种方案,纯静态、离线可用的文档浏览器。左侧目录树,右侧预览,支持 **Markdown / PDF / Word(.docx) / 图片**。

## ✨ 特性

- 📂 **自动目录树** — 把文件丢进 `docs/`,左侧自动按文件夹分组
- 🔍 **快速搜索** — 按文件名/标题即时筛选
- 🎨 **多格式预览** — md(代码高亮 + Mermaid 图表)、pdf、docx、图片
- 🌗 **亮/暗主题** — 一键切换
- 📦 **零依赖离线** — 第三方库已本地化,断网也能用
- 🚀 **双端可用** — 本地双击启动 / GitHub Pages 在线访问

## 🖥️ 本地使用(Windows)

双击根目录的 **`启动.bat`** 即可。它会自动扫描文档、启动本地服务(用 Windows 自带 PowerShell,**无需安装 Node/Python**)、打开浏览器。

> ⚠️ 不要直接双击 `index.html`:浏览器的 `file://` 安全限制会导致读不了本地 md/pdf 文件。必须通过 `启动.bat` 起本地服务。

## 🌐 在线访问(GitHub Pages)

1. 把项目推送到 GitHub
2. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**
3. 推送到 `main` 分支后会自动构建部署
4. 访问 `https://<用户名>.github.io/KnowledgeBase/`

每次 push,GitHub Actions 会自动重新扫描 `docs/` 生成目录清单并部署。

## 📝 添加文档

把文件放进 `docs/`,支持子文件夹分组。文件名可加数字前缀控制排序(如 `01_xxx.md`,显示时自动隐藏前缀)。详见 `docs/00_使用说明.md`。

## 📁 项目结构

```
KnowledgeBase/
├── index.html              # 入口
├── 启动.bat                # Windows 一键启动
├── manifest.json           # 目录清单(自动生成)
├── docs/                   # 你的文档放这里
├── assets/
│   ├── css/                # 设计 token + 样式
│   ├── js/                 # app.js(主逻辑) + viewers.js(预览器)
│   └── vendor/             # 本地化的第三方库
├── scripts/
│   ├── generate-manifest.ps1   # 扫描 docs/ 生成清单
│   └── serve.ps1               # 本地静态服务器
└── .github/workflows/pages.yml # 自动部署
```

## 🔧 技术说明

- **Markdown**: marked.js + highlight.js + mermaid
- **PDF**: PDF.js
- **Word**: docx-preview(仅 .docx,复杂排版还原度有限)
- 纯前端、无构建步骤
