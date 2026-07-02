# 资源加工国际化(i18n)改造方案 V2.0

> 文档性质：实施方案 (Implementation Plan)
> 创建时间：2026-06-10（V1.0）/ 2026-07-02（V2.0 修订）
> 适用范围：rpp-web 资源加工平台多语言改造
> 维护者：fjyu9
> 关联文档：
> - 《多语言改造规范手册.md》—— 日常开发铁律(What + How)
> - 《多语言改造演进思考记录.md》—— 关键决策复盘(Why + Context)
> - 《国际化场景全清单.md》—— 20 种场景速查
> - 《AI 协作开发通用原则.md》—— 批量改造约束来源

---

## 修订说明（V2.0 vs V1.0）

**修订时间**：2026-07-02

**修订依据**：澳门国际化二期（2026-06-15 ~ 06-30）实战经验

**主要变更**：

1. **新增第五章 5.4**：JS 枚举常量的三种模式（补充 options 数组返回函数写法）
2. **修正第六章**：编号错误（原两个 6.5）改为 6.5 和 6.6
3. **新增第九章 9.6**：卡口的五类盲区（明确卡口查不出什么）
4. **新增第十二章 12.1**：批量改造模块流程（铁律：先列清单再执行）
5. **扩充第十四章**：补充 3 个真实 bug 案例（Q7/Q8/Q9）
6. **新增第十六章**：高级场景覆盖（HTML 属性、Message、表格、图表等）

**修订原因**：
- 二期暴露了"批量改造遗漏"的结构性盲区（个人中心 5 页只做了 3 页）
- JS 枚举 options 数组场景高频但原方案未覆盖
- 卡口边界不清晰，导致对工具能力有误判
- 缺少真实 bug 案例，新成员踩坑重复率高

**向后兼容**：V2.0 是 V1.0 的超集，原有内容全部保留，只做必要补充和修正。

---

## 目录

- [修订说明（V2.0 vs V1.0）](#修订说明v20-vs-v10)
- [一、改造背景与目标](#一改造背景与目标)
- [二、技术选型](#二技术选型)
- [三、整体架构](#三整体架构)
- [四、语言文件组织规范](#四语言文件组织规范)
- [五、翻译出口与使用方法](#五翻译出口与使用方法)
- [六、语言决策规则](#六语言决策规则)
- [七、翻译规则与约束](#七翻译规则与约束)
- [八、工具链](#八工具链)
- [九、质量保障：卡口机制](#九质量保障卡口机制)
- [十、环境准备与首次验证](#十环境准备与首次验证)
- [十一、端到端完整示例](#十一端到端完整示例)
- [十二、标准作业流程](#十二标准作业流程)
- [十三、提交规范](#十三提交规范)
- [十四、常见问题与踩坑](#十四常见问题与踩坑)
- [十五、新成员上手清单](#十五新成员上手清单)
- [十六、高级场景覆盖](#十六高级场景覆盖)

---

## 一、改造背景与目标

### 背景

资源加工平台(rpp-web)原本仅支持简体中文。澳门项目(V7.0.x)要求同一套代码支持 **4 种资源语言**:

| 语言 | locale 标识 | 适用场景 |
|------|------------|---------|
| 简体中文 | `zh-CN` | 默认语言 / 兜底语言 |
| 繁体中文 | `zh-TW` | 澳门项目(港澳繁体) |
| 英文 | `en-US` | 国际化资源 |
| 葡萄牙文 | `pt-BR` | 澳门项目(葡语区) |

核心难点在于平台存在**双语言体系**:
- **工作室语言**(资源语言):某个工作室加工的资源用什么语言,加工界面就跟什么语言
- **页面语言**(界面语言):用户个人的界面语言偏好

同一个页面,加工区文案要跟工作室语言,导航栏/菜单要跟页面语言,二者可能不同。

### 目标

1. **功能目标**:加工流程页面全部用户可见文案支持四语言切换
2. **质量目标**:四语言文件一致,无漏翻、无路径错位 key
3. **工程目标**:建立工具链 + 自动卡口,把"人工自检"升级为"机器拦截"
4. **维护目标**:语言文件可多人协作、低冲突,新成员可快速上手

---

## 二、技术选型

| 维度 | 选型 | 理由 |
|------|------|------|
| 框架 | **vue-i18n 8.x** | Vue 2 标准方案,无需自造轮子 |
| 语言文件格式 | **JSON**(嵌套 namespace) | vue-i18n 原生支持,工具生态成熟 |
| 文件加载 | **require.context** 动态加载 | webpack 3 原生能力,新增文件免手动 import |
| 开发辅助 | **i18n-ally**(VSCode 插件) | 行内显示四语言译文,实时标红缺失 |
| CI 校验 | **自研 i18n-check.js** + vue-i18n-extract | 基线增量卡口,只拦新增问题 |
| 提交钩子 | **husky v4** pre-commit | 提交前自动跑卡口 + lint |

> **未采用托管平台**(Tolgee / Lokalise):当前团队规模小、内网环境,本地工具链已足够。大团队长期演进可再评估。

---

## 三、整体架构

```
src/config/lang/
├── index.js                  # i18n 实例初始化 + require.context 动态加载入口
└── locales/
    ├── zh-CN/                # 简体中文(基准语言)
    │   ├── workShop.json
    │   ├── taskProcess.json
    │   ├── ... (共 8 个文件)
    │   └── _rest.json
    ├── zh-TW/                # 繁体中文(同结构 8 文件)
    ├── en-US/                # 英文(同结构 8 文件)
    └── pt-BR/                # 葡语(同结构 8 文件)

src/utils/
├── macaoUtil.js              # $tm 安装(installStudioI18n) + 工作室参数处理
└── bizLocale.js              # resolveBizLocale() 语言决策核心

scripts/
└── i18n-check.js             # 卡口脚本

.i18n-baseline.json           # 存量问题基线(冻结历史,只拦新增)
```

### 核心数据流

```
组件调用 $tm('workShop.xxx')
   ↓
installStudioI18n 注入的 $tm 方法
   ↓
resolveBizLocale() 决定用哪个 locale(工作室语言 / 页面语言 / 兜底 zh-CN)
   ↓
i18n.t(key, locale) 从 messages[locale] 取文案
   ↓
messages 由 index.js 通过 require.context 合并 locales/ 下所有 JSON
```

---

## 四、语言文件组织规范

### 4.1 拆分结构(2026-06-10 已落地)

按业务模块拆分为 **8 个文件 / locale × 4 locale = 32 个 JSON**:

| 文件 | keys 量级 | 说明 |
|------|----------|------|
| `workShop.json` | ~1546 | 工作室核心,体量最大 |
| `taskProcess.json` | ~1032 | 任务加工核心 |
| `taskHall.json` | ~260 | 众包大厅 |
| `taskResult.json` | ~292 | 任务结果 |
| `myTask.json` | ~135 | 我的任务 |
| `compare.json` | ~125 | 资源对比 |
| `common.json` | ~108 | 公共词典(被 70+ 文件复用) |
| `_rest.json` | ~286 | 杂烩:studio / menu / nav / message / workbench / enum / language / tipPanel |

### 4.2 设计思路

- **6 个业务模块文件** —— 各对应一个活跃业务域,各模块负责人各管各的 JSON,团队协作零冲突
- **common.json** —— 广泛复用的基础词典(confirm/cancel/add 这种),集中放便于查找
- **_rest.json** —— 冷门或全动态查表的 namespace 杂烩(`menu[code]` / `enum.taskStatus[status]` 这类对象索引访问)

### 4.3 命名空间与代码路径对齐

命名空间应与业务目录一一对应,引用 key 前先在对应 `locales/<locale>/*.json` 里搜末段名,确认完整路径。例如:

| 组件路径 | 对应 namespace |
|---------|---------------|
| `views/common/task-process/**` | `taskProcess.*` |
| `views/rpp/workShop/**` | `workShop.*` |
| `views/common/task-result/**` | `taskResult.*` |

### 4.4 技术实现(index.js)

```js
const ctx = require.context('./locales', true, /\.json$/);
const messages = {};
ctx.keys().forEach(filePath => {
  const m = filePath.match(/^\.\/([^/]+)\/([^/]+)\.json$/);
  if (!m) return;
  const [, loc, ns] = m;
  if (!messages[loc]) messages[loc] = {};
  const data = ctx(filePath);
  if (ns === '_rest') Object.assign(messages[loc], data);   // _rest 平铺到根
  else messages[loc][ns] = data;                            // 其他挂在 ns 下
});
```

- `_rest.json` 内容平铺合并到 locale 根(里面是顶层 namespace)
- 其他业务模块文件挂在对应 namespace 下
- 最终 `messages` 结构与拆分前**完全等价**,`$tm('workShop.xxx')` 调用零修改

### 4.5 新增翻译该往哪放

1. 看组件路径对应哪个 namespace(见 4.3)
2. 新增 key 加进对应的 `<locale>/<ns>.json` 文件,**四语言同步**
3. 不确定结构?用 i18n-ally 实时查看四语言译文
4. 卡口 pre-commit 自动校验,新增漏翻立刻拦截

### 4.6 新建顶层 namespace 流程

如未来要做 `admin.*` 或 `homework.*`:
1. 在四个 locale 目录下各新建 `<ns>.json`,初始内容 `{}`
2. 加 key 按正常流程加
3. 体量够大(引用 >50 次或预计 >100 keys)考虑独立成文件,否则归 common 或就近 namespace

---

## 五、翻译出口与使用方法

### 5.1 翻译出口只有 2 个(2026-06-10 收敛完成)

**Vue 组件内 —— 用 `$tm`**

```js
// 基础用法
this.$tm('taskProcess.judge.confirmSubmit')   // → "确认提交" / "確認提交" / "Confirm" / "Confirmar"

// 带插值变量
this.$tm('taskProcess.common.questionNo', { index: 1 })   // JSON: "第{index}题"

// 强制指定语言(罕见场景)
this.$tm('common.confirm', null, { locale: 'en-US' })
```

模板内:
```html
<el-button>{{ $tm('common.confirm') }}</el-button>
<el-input :placeholder="$tm('workShop.namePlaceholder')" />
```

**JS 文件内 —— 用 `i18n.t`**

```js
import i18n from '@/config/lang';

// 普通业务,底层自动按路由判断语言
const text = i18n.t('common.confirm');

// 全站通用文案,固定页面语言
import { getCurrentLocale } from '@/config/lang';   // 注意:getCurrentLocale 在 lang 模块,不在 bizLocale
const text = i18n.t('nav.home', getCurrentLocale());
```

### 5.2 已删除的旧出口(禁止再用)

| 旧出口 | 状态 | 替代方式 |
|--------|------|---------|
| `studioI18nT` | ❌ 已删除(2026-06-10) | 组件用 `$tm`,JS 用 `i18n.t` |
| `translator` 参数模式 | ❌ 已删除(2026-06-10) | 枚举工厂函数内部直接 `i18n.t` |
| `$t` | ❌ 业务代码已清零 | 组件统一 `$tm` |
| `wt()` | ❌ 早期已废弃 | `$tm` |

> 📌 **记忆法**:组件用 `$tm`,JS 用 `i18n.t`,没有第三种。

### 5.3 枚举常量多语言写法

枚举存 **key**,调用方负责翻译。工厂函数内部直接调 `i18n.t`:

```js
// commonConstant.js
import i18n from '@/config/lang';

const JudgeLevelI18nKeyMap = {
  [JudgeLevelCodeEnum.HeGe]: 'taskProcess.judge.qualified',
  // ...
};

export function getJudgeLevelList() {
  return JudgeLevelList.map(item => ({
    ...item,
    name: i18n.t(JudgeLevelI18nKeyMap[item.code])   // 内部翻译,调用方无需传函数
  }));
}
```

调用方:
```js
computed: {
  judgeLevelList() {
    return getJudgeLevelList();   // 无参调用
  }
}
```

### 5.4 JS 枚举常量的三种模式（V2.0 补充）

根据枚举的使用场景，选择合适的多语言模式：

#### 模式 1：常量对象存 key → 调用方包 `$tm`

**适用**：枚举常量、配置对象、只在 Vue 模板中使用的场景

```js
// src/enum/xxx.js
export const STATUS_MAP = {
  pending: 'status.pending',    // ✅ 存 key
  approved: 'status.approved'
}

// 调用方（Vue 组件）
<template>
  <span>{{ $tm(STATUS_MAP.pending) }}</span>  // ✅ 包 $tm
</template>
```

#### 模式 2：函数返回译文 → 调用方直接用（5.3 节已展示）

**适用**：在 JS 文件中调用、需要立即得到译文的场景

```js
// src/utils/xxx.js
import i18n from '@/config/lang'

export function getStatusText(status) {
  const map = {
    pending: 'status.pending',
    approved: 'status.approved'
  }
  return i18n.t(map[status])  // ✅ 内部调用 i18n.t
}

// 调用方（Vue 组件 / JS 文件）
getStatusText('pending')  // ✅ 直接用，已经是译文
this.$message.success(getStatusText('pending'))
```

#### 模式 3：枚举 label/options 数组 → 返回函数 `() => i18n.t(...)`

**适用**：el-select / el-radio / el-checkbox 等需要 options 数组的场景

```js
// src/enum/xxx.js
import i18n from '@/config/lang'

export const TYPE_OPTIONS = [
  { label: () => i18n.t('type.a'), value: 1 },  // ✅ 返回函数
  { label: () => i18n.t('type.b'), value: 2 }
]

// 调用方（Vue 组件）
<el-select v-model="form.type">
  <el-option
    v-for="item in TYPE_OPTIONS"
    :key="item.value"
    :label="item.label()"     // ✅ 执行函数
    :value="item.value"
  />
</el-select>
```

**为什么要返回函数**：
- JS 文件加载时还没有语言上下文，直接 `i18n.t(key)` 会固定为初始语言
- 返回函数 `() => i18n.t(key)` → 调用时才求值，能响应语言切换

**常见错误**：
```js
// ❌ 错误：顶层直接调用 i18n.t，固定为初始语言
export const TYPE_OPTIONS = [
  { label: i18n.t('type.a'), value: 1 }  // 切换语言后不更新
]

// ✅ 正确：返回函数
export const TYPE_OPTIONS = [
  { label: () => i18n.t('type.a'), value: 1 }
]
```

**三种模式对比**：

| 模式 | 存储内容 | 调用方式 | 适用场景 |
|------|---------|---------|---------|
| 模式 1 | 存 key | `$tm(常量.key)` | Vue 模板展示 |
| 模式 2 | 工厂函数内部调 `i18n.t` | 直接用返回值 | JS 逻辑、Message 提示 |
| 模式 3 | 返回函数 `() => i18n.t(...)` | 执行函数 `item.label()` | el-select options 数组 |

---

## 六、语言决策规则

所有语言选择统一收口到 `resolveBizLocale()` (`src/utils/bizLocale.js`),**按路由判断**:

### 6.1 决策机制(重要,排查 bug 必备)

```js
// resolveBizLocale 简化逻辑
export function resolveBizLocale(options = {}) {
  // 1. 显式传 locale,优先用
  const explicitLocale = normalizeLocaleTag(options.locale || options.forceLocale);
  if (isSupportedLocale(explicitLocale)) return explicitLocale;
  
  // 2. 判断是否工作室路由
  const isStudioPage = isStudioRoute(window.location.hash);   // 核心:路由判断
  
  // 3. 非工作室路由 → 页面语言
  if (!isStudioPage) {
    return getPageLocale();
  }
  
  // 4. 工作室路由 → 从 store 取工作室语言
  const store = require('@/store').default;
  const macaoParams = store.state.macao.macaoParams;         // 核心:语言来自 store
  const studioLocale = normalizeLocaleTag(macaoParams?.languageLabel);
  
  // 5. 工作室语言缺失 → 固定回退 zh-CN
  return isSupportedLocale(studioLocale) ? studioLocale : 'zh-CN';
}
```

**排查语言不对时看这里**:
- 是不是工作室路由 → 检查 `isStudioRoute(window.location.hash)`
- 工作室语言哪来的 → Vue DevTools 看 `$store.state.macao.macaoParams.languageLabel`
- 为什么回退中文了 → `languageLabel` 是空/非四语言之一

### 6.2 工作室路由

- **优先工作室语言**(资源语言,来自 `store.state.macao.macaoParams.languageLabel`)
- 工作室语言缺失时 → **固定回退 `zh-CN`**

### 6.3 非工作室路由

- 使用**页面语言**(用户界面语言偏好,来自 `localStorage` 或浏览器默认)

### 6.4 全站通用文案固定页面语言

以下场景**不跟工作室语言走**,固定页面语言:
- 顶部导航栏(`CommonNavBar`)
- 导航菜单(`navUtil`)
- 账号角色面板(`PersonalSettingButton`)
- 其他全站共用的壳层文案

> **为什么**:导航栏是全站框架,跟着某个工作室的资源语言切换会造成"换了工作室导航栏语言也变"的割裂体验。

### 6.5 element-ui / zxment 内置文案

与业务翻译规则一致:
- 工作室路由 → 工作室语言
- 非工作室路由 → 页面语言
- 工作室语言缺失 → 固定回退 `zh-CN`

### 6.6 请求头透传语言上下文

请求层(`src/utils/http.js`)统一注入 3 个请求头,不在各 API 文件重复手写:

| 请求头 | 含义 |
|--------|------|
| `locale` | 页面语言,下划线格式 |
| `localeWorkShop` | 工作室语言;没有时传空字符串 `''` |
| `isInWorkShop` | `1`(工作室页面) / `2`(工作室外页面) |

---

## 七、翻译规则与约束

### 7.1 改造铁律(违反必出 bug)

1. **每写一个 `$tm('x.y.z')`,必须同时在 4 个语言 JSON 建好 `x.y.z`**
   - 漏建 → 页面显示原始 key 字符串(如 `taskProcess.idImport.taskDetail`)
2. **中文原文必须从 `git diff` / 文件现状提取真实文本,禁止推断**
   - 繁/英/葡基于真实简体翻译
3. **占位符参数名逐字一致**
   - 代码传 `{index}`,JSON 必须写 `{index}`(写成 `{n}` 即失效)
   - 四语言占位符必须完全一致

### 7.2 翻译范围

**要翻**:
- 按钮、标题、提示语、placeholder、tab 名、dialog 标题

**不翻**:
- 后端返回的业务值、接口 payload 中文字段
- 日志、`console.log`、注释
- enum 字典的 `desc`、数据标记、状态机值

### 7.3 key 命名

- 用**语义命名**(`confirmSubmit` 而非 `btn1`)
- 四语言文件 key 必须完全一致
- 先查复用:`common.*` 和各 namespace 已有的通用词(确定/取消/提示/是/否…)直接复用

### 7.4 禁止在 data() 中固化翻译结果

```js
// ❌ 错误:语言切换后文本不更新
data() {
  return { title: this.$tm('xxx.title') };
}

// ✅ 正确:用 computed
computed: {
  title() { return this.$tm('xxx.title'); }
}
```

### 7.5 繁体专项(zh-TW 易踩)

- 繁体必须**真的是繁体**,不能简体原文照抄
- 用 **OpenCC `hk` 港澳繁体**(本项目给澳门用),**不要用 `tw`/`t`**
  - `tw/t` 会把「台」误转「臺」,与项目惯例(工作台/平台/后台用「台」)冲突
- 注意 OpenCC 误转:副词「只」(只能/只有)会被错转量词「隻」,需修回

### 7.6 动态拼接无法静态校验

```js
// 这类动态拼接,卡口无法校验,需自行保证四语言齐全
$tm('compare.correctionType_' + key)   // 前缀拼接
```

---

## 八、工具链

### 8.1 i18n-ally(VSCode 插件,开发阶段)

**作用**:编辑器内行内显示四语言译文,缺失项标红,支持跳转/查死 key。

**配置**(`.vscode/settings.json`,已 gitignore):
```json
{
  "i18n-ally.localesPaths": ["src/config/lang/locales"],
  "i18n-ally.keystyle": "nested",
  "i18n-ally.pathMatcher": "{locale}/{namespaces}.json",
  "i18n-ally.keywords": ["$tm", "i18n.t"]
}
```

**注意**:拆分文件后若 i18n-ally 显示缺失但代码层已验证齐全,多为缓存问题。
- 解决:`Ctrl+Shift+P` → `i18n Ally: Refresh` 或 `Developer: Reload Window`

### 8.2 vue-i18n-extract(辅助报告)

**作用**:扫描代码用到的 key vs JSON 定义的 key,输出 missing / unused 报告。

**使用**:
```bash
npm run i18n:extract   # 实际执行 vue-i18n-extract report
```

**配置**(`vue-i18n-extract.config.js`):
```js
module.exports = {
  vueFiles: './src/**/*.?(js|vue)',
  languageFiles: './src/config/lang/locales/**/*.json'
};
```

> 注:vue-i18n-extract 会读取配置文件,但 npm 脚本直接调命令 `vue-i18n-extract report`,不是 node 跑配置。

### 8.3 i18n-check.js(自研卡口,提交阶段)

**作用**:提交前自动检测两类问题,只拦新增。详见第九章。

### 8.4 npm 脚本

```bash
npm run i18n:check       # 卡口检查,发现新增问题 exit 1
npm run i18n:report      # 只打印全部问题,不卡(exit 0)
npm run i18n:baseline    # 把当前全部问题写入基线(修完 bug 后收紧)
npm run i18n:extract     # vue-i18n-extract 报告
```

---

## 九、质量保障：卡口机制

### 9.1 为什么需要卡口

历史上靠"人工四语言自检"对抗漏翻,但人工流程不可靠:
- 路径错位 bug 高发(代码引用 `taskProcess.duplicateCheck.*`,真实路径却是 `taskResult.divideQuestionResult.duplicateCheck.*`)
- 漏翻线上裸奔(页面直接显示 key 字符串)

### 9.2 检测内容

`scripts/i18n-check.js`(纯 Node,零依赖)检测两类:

1. **路径错位**:代码引用了但基准语言(zh-CN)里不存在的 key → 路径写错/漏定义
2. **漏翻**:基准语言有、其他语言漏翻的 key → 四语言不一致

### 9.3 基线增量策略

存量已有历史问题,裸卡会让全团队提交不了。采用**基线增量**:
- 存量问题冻结进 `.i18n-baseline.json` 放行
- 只拦**新增**问题
- 修完存量 bug 后跑 `npm run i18n:baseline` 收紧基线

当前基线 count 已归 **0**(存量问题全部修复)。

### 9.4 识别的调用形态

卡口正则识别 3 种翻译出口:
```js
const CALL_RE = /(?:\$tm|\$t|i18n\.t)\(\s*['"]([^'"$`]+?)['"]\s*(\+|\))?/g;
```

**跳过规则**:
- 字面量后紧跟 `+`(动态拼接前缀)→ 跳过
- 字面量以 `.` 或 `_` 结尾(拼接前缀)→ 跳过
- `el.*` / `ze.*`(组件库内置)→ 跳过
- saber / saberPreview / node_modules / dist(第三方/产物)→ 跳过

### 9.5 自动触发

husky v4 pre-commit 钩子自动跑:
```bash
lint-staged && npm run i18n:check
```
提交时无需手动执行,新增的「路径错位 / 漏翻」直接拦提交。

### 9.6 卡口的五类盲区（V2.0 补充）

**重要**：卡口只能检查"已写的代码是否正确"，检查不了"该写的代码是否都写了"。

以下五类问题卡口**查不出**，需要其他手段补充：

#### 盲区 1：整页未国际化（0 个 `$tm` 调用）

**表现**：某个页面完全没做国际化，0 个 `$tm` / `i18n.t` 调用。

**为什么卡口查不出**：
- 卡口只扫描已有的 `$tm('xxx')` 调用，检查 key 是否存在
- 如果整页都是硬编码中文，没有任何 `$tm` 调用 → 卡口无法发现

**补充手段**：
- **开工前枚举清单**（见第十二章 12.1）：列出模块全部页面，逐页勾选
- **验收时逐页点击**：切换语言后逐页检查，整页中文立即暴露

**二期案例**：个人中心 5 页只做了 3 页，漏了 my-benefits / my-homepage 两个页面。

---

#### 盲区 2：翻译文案做逻辑判断（后端返回值不一致）

**表现**：后端返回中文文案，前端用来做 `if` 判断，多语言后判断失效。

```js
// ❌ 卡口查不出这个 bug
if (response.data.status === '审核中') {  // 后端多语言后返回 "Under Review"
  // 判断逻辑失效
}
```

**为什么卡口查不出**：
- 这段代码没有 `$tm` / `i18n.t` 调用，卡口不会扫描
- 这是**业务逻辑错误**，不是"翻译 key 缺失"

**补充手段**：
- **Code Review**：重点审查 `if (xxx ===` 后面的字符串
- **与后端对齐契约**：判断字段用 `statusCode`（数字/枚举），不用文案
- **单元测试**：模拟多语言环境，测试判断逻辑

**详见**：第十四章 Q8、《国际化场景全清单.md》场景 4.3

---

#### 盲区 3：语言决策逻辑错误（该用工作室语言的用了页面语言）

**表现**：工作室路由的文案应该跟工作室语言，但实际用了页面语言。

```js
// ❌ 卡口查不出这个 bug
// CommonNavBar 导航栏，应该固定页面语言，但错误地跟了工作室语言
this.$tm('nav.home')  // key 存在，卡口通过，但语言选择错了
```

**为什么卡口查不出**：
- key 在四个语言文件都存在，卡口认为"没问题"
- 但实际是**语言决策逻辑**写错了（`resolveBizLocale` 判断有误）

**补充手段**：
- **手工验证**：切换工作室后，检查导航栏语言是否跟着变（不应该变）
- **Code Review**：审查 `getCurrentLocale()` 调用是否传了正确参数

**详见**：第六章 6.4、第十四章 Q7

---

#### 盲区 4：动态拼接 key（运行时才确定）

**表现**：key 是运行时动态拼接的，卡口无法枚举所有可能的组合。

```js
// ❌ 卡口查不出这个 bug
const key = `status.${type}.${subType}`  // type/subType 运行时才知道
this.$tm(key)  // 如果某个组合在 i18n 文件中缺失，卡口发现不了
```

**为什么卡口查不出**：
- 卡口只识别字面量 `$tm('xxx.yyy')`
- 模板字符串、变量拼接在静态分析阶段不可知

**补充手段**：
- **枚举所有组合**：手工列出所有可能的 `type × subType` 组合，确保 i18n 文件齐全
- **运行时检查**（开发环境）：
  ```js
  const translated = this.$tm(key)
  if (translated === key) {
    console.warn(`Missing i18n key: ${key}`)
  }
  ```
- **优先改为静态映射**：
  ```js
  const KEY_MAP = {
    'typeA-sub1': 'status.typeA.sub1',
    'typeA-sub2': 'status.typeA.sub2'
  }
  this.$tm(KEY_MAP[`${type}-${subType}`])
  ```

**详见**：第七章 7.6、《国际化场景全清单.md》场景 6

---

#### 盲区 5：翻译质量问题（译文不通顺、不准确）

**表现**：四语言 key 都存在，但译文质量差（机翻痕迹重、语义不准确、上下文不符）。

```json
// ❌ 卡口查不出这个问题
{
  "zh-CN": "保存成功",
  "zh-TW": "保存成功",     // 应该是 "儲存成功"
  "en-US": "Save Success",  // 应该是 "Saved successfully"
  "pt-BR": "Economizar sucesso"  // 直译，应该是 "Salvo com sucesso"
}
```

**为什么卡口查不出**：
- 卡口只检查 key 是否存在，不检查译文质量
- 翻译质量需要**人工审校** + **母语者校对**

**补充手段**：
- **专业翻译审校**：关键文案由母语者或专业译员校对
- **用户测试**：真实用户试用，收集反馈
- **翻译记忆库**（Translation Memory）：复用已审核的译文

---

#### 总结：工具分工

| 质量维度 | 工具 | 备注 |
|---------|------|------|
| ✅ key 路径正确性 | i18n-check 卡口 | 路径错位、漏翻 |
| ✅ 四语言一致性 | i18n-check 卡口 | 四个文件 key 对齐 |
| ❌ 覆盖率（哪些该做没做） | 枚举清单 + 人工验收 | 整页未翻译 |
| ❌ 业务逻辑正确性 | Code Review + 单测 | 后端返回值判断 |
| ❌ 语言决策逻辑 | 手工验证 + CR | 该用工作室语言的用了页面语言 |
| ❌ 动态拼接 key | 枚举组合 + 运行时检查 | 静态分析无法覆盖 |
| ❌ 翻译质量 | 人工审校 + 用户测试 | 机器无法判断语义 |

**核心原则**：
- **卡口管正确性**（已写的代码对不对）
- **覆盖率靠枚举清单**（该写的都写了没）
- **质量靠人工审阅**（写得好不好）

---

## 十、环境准备与首次验证

**新成员开工前必做,确保工具链生效。**

### 10.1 安装 i18n-ally(VSCode 插件)

1. VSCode 扩展市场搜 `i18n Ally`,安装 Lokalise 出品的那个
2. 打开项目任意 `.vue` 文件,鼠标悬停到 `$tm('xxx')` 上
3. 看到行内悬浮显示 4 种语言译文 → 安装成功
4. 看到红色波浪线 + "missing in zh-TW" → 说明缺失检测也生效了

**如果看不到悬浮译文**:
- 检查 `.vscode/settings.json` 是否存在(项目已有,但被 `.gitignore` 排除,首次 clone 需自己建)
- 手动创建内容见第八章 8.1

### 10.2 验证 npm 脚本

```bash
cd D:\xunfei\zyjg\rpp-web
npm run i18n:check       # 应输出 "✓ 无新增 i18n 问题"
npm run i18n:extract     # 输出 missing/unused 报告(当前应该很干净)
```

如果 `i18n:check` 报错,说明你本地代码有新增漏翻,先跑 `npm run i18n:report` 看详情。

### 10.3 内网 npm 源(如未配)

```bash
npm config set registry https://artifacts.iflytek.com/artifactory/api/npm/npm-repo
```

### 10.4 确认 husky 钩子生效

```bash
cat .husky/pre-commit   # Windows 用 type
```
应看到 `lint-staged && npm run i18n:check`。

提交时如果 husky 没跑,检查:
- `.husky/` 目录存在
- `package.json` 的 `husky.hooks` 字段有 `pre-commit`

---

## 十一、端到端完整示例

**从一句硬编码中文,到四语言生效,完整走一遍。**

### 场景:给任务列表页的"刷新"按钮加多语言

#### Step 1:定位文件和硬编码

文件:`src/views/rpp/task/TaskList.vue`

硬编码:
```html
<el-button @click="refresh">刷新</el-button>
```

#### Step 2:设计 key

- 组件路径:`views/rpp/task/` → 属于任务列表,不是加工流程
- 对应 namespace:`myTask.*`(我的任务模块)
- "刷新"是通用操作,先查 `common.json` 有没有 `refresh`
- 假设没有,新建:`myTask.taskList.refresh`

#### Step 3:替换代码

```html
<el-button @click="refresh">{{ $tm('myTask.taskList.refresh') }}</el-button>
```

#### Step 4:同步四语言 JSON

打开 4 个文件:
- `src/config/lang/locales/zh-CN/myTask.json`
- `src/config/lang/locales/zh-TW/myTask.json`
- `src/config/lang/locales/en-US/myTask.json`
- `src/config/lang/locales/pt-BR/myTask.json`

在 `taskList` 对象下同步新增:
```json
{
  "taskList": {
    "refresh": "刷新"           // zh-CN
    "refresh": "重新整理"       // zh-TW(港澳繁体,或直接"刷新")
    "refresh": "Refresh"        // en-US
    "refresh": "Atualizar"      // pt-BR
  }
}
```

#### Step 5:i18n-ally 即时验证

保存 4 个 JSON 后,回到 `TaskList.vue`,鼠标悬停 `$tm('myTask.taskList.refresh')`:
- 看到 4 种语言译文 → 成功
- 仍有红波浪线 → 刷新插件(`Ctrl+Shift+P` → `i18n Ally: Refresh`)

#### Step 6:本地验证切换

```bash
npm run dev   # 启动开发服务器
```

浏览器打开任务列表,控制台执行:
```js
// 假设有全局切换语言方法(实际看项目实现)
window.$store.commit('SET_LOCALE', 'en-US');
```
或者直接进工作室页面(工作室语言不同时,按钮文案应跟着变)。

#### Step 7:提交前卡口自动跑

```bash
git add src/views/rpp/task/TaskList.vue
git add src/config/lang/locales/*/myTask.json
git commit -m "feat:任务列表刷新按钮多语言"
```

husky pre-commit 自动跑:
1. `lint-staged` → ESLint 自动 fix
2. `npm run i18n:check` → 检测新增的 `myTask.taskList.refresh` 是否四语言齐全
3. 全绿 → 提交成功
4. 报错 → 提交被拦,修复后重新提交

---

## 十二、标准作业流程

### 12.1 批量改造模块流程（V2.0 补充）

**适用场景**：国际化整个模块（如个人中心全部页面、某个业务域全部组件）

**核心铁律：先列清单，再执行**

#### 为什么需要这个流程

AI 协作开发的**结构性盲区**：
- AI 是**被动驱动**（你指哪改哪）+ **按文件流**（逐文件处理，无全局视角）
- 只改你指到的文件，不会自动补全"模块全集"
- "边发现边改"必然遗漏——只翻手头碰到的文件，碰不到的永远看不见

**二期教训**：个人中心 5 页只做了 3 页，漏了 my-benefits / my-homepage 两个页面。菜单标签批量翻译了制造"已完成"假象，切语言后点进去整页还是中文。

#### 标准流程（四步法）

##### 第一步：枚举受影响文件清单

**清单来源（按优先级）**：
1. **路由子树**（最准确）：从 `src/router/` 枚举该模块 `children` 下全部页面
2. **目录树**：Glob 该模块目录下所有 `.vue` / `.js`（可能漏跨目录引用）
3. **引用扫描**：Grep 该模块核心文件（如常量/工具类）的 import（可能漏间接引用）

**清单格式**（Markdown 表格）：
```markdown
## 个人中心国际化改造范围

| 子页面 | 路径 | 状态 |
|-------|------|------|
| 个人主页 | src/views/rpp/user-center/my-homepage.vue | ⬜ 待改造 |
| 个人信息 | src/views/rpp/user-center/personal-info.vue | ⬜ 待改造 |
| 我的收益 | src/views/rpp/user-center/my-benefits.vue | ⬜ 待改造 |
| 账号安全 | src/views/rpp/user-center/account-safe.vue | ⬜ 待改造 |
| 银行卡管理 | src/views/rpp/user-center/bank-card-manage.vue | ⬜ 待改造 |

**总计**：5 个页面
```

**示例命令**：
```bash
# 方式1：从路由枚举
grep -r "path.*user-center" src/router/ -A 5

# 方式2：从目录枚举
find src/views/rpp/user-center -name "*.vue"

# 方式3：从引用扫描
grep -r "import.*userCenterConstant" src/ --include="*.vue" --include="*.js"
```

##### 第二步：人工确认清单无遗漏

**检查项**：
- [ ] 是否覆盖模块全部页面（对照路由配置）
- [ ] 是否有跨目录的引用文件（如公共组件）
- [ ] 是否有动态路由页面（如 `:id` 参数）
- [ ] 是否有弹窗、抽屉等嵌套组件

**常见遗漏**：
- 路由配置在父模块，实际页面在子目录
- 公共组件在 `components/` 下，被多个模块复用
- 动态引入的组件（`() => import(...)`）

##### 第三步：逐项执行并勾选

**执行顺序**：
1. 按清单从上到下逐个改造
2. 改完一个勾选一个（`⬜` → `✅`）
3. **禁止**"看到哪个文件顺手翻哪个"（必然遗漏）
4. **禁止**"边发现边改"（AI 看不见的文件永远不会改）

**勾选示例**：
```markdown
| 子页面 | 路径 | 状态 |
|-------|------|------|
| 个人主页 | src/views/rpp/user-center/my-homepage.vue | ✅ 已完成 |
| 个人信息 | src/views/rpp/user-center/personal-info.vue | ✅ 已完成 |
| 我的收益 | src/views/rpp/user-center/my-benefits.vue | ⬜ 待改造 |
```

##### 第四步：验收覆盖率

**验收方式**：
1. 启动开发服务器 `npm run dev`
2. 切换语言到非中文（如英文）
3. **按清单逐页点击**，检查是否全部生效
4. 发现整页中文 → 回到清单，标记为"遗漏"

**验收清单**：
```markdown
| 子页面 | 改造状态 | 验收状态 |
|-------|---------|---------|
| 个人主页 | ✅ | ✅ 英文正常 |
| 个人信息 | ✅ | ✅ 英文正常 |
| 我的收益 | ✅ | ❌ 整页中文（遗漏） |
| 账号安全 | ✅ | ✅ 英文正常 |
| 银行卡管理 | ✅ | ⚠️ 部分中文（补充） |
```

#### 与单文件流程的区别

| 维度 | 单文件流程 | 批量改造流程 |
|------|-----------|-------------|
| 适用 | 改一个文件 | 改整个模块（3+ 文件） |
| 第一步 | 直接 Read 文件 | **先列清单** |
| 执行 | 逐个中文翻译 | **按清单逐项执行并勾选** |
| 验收 | 卡口 + 单文件验证 | **按清单逐页验收覆盖率** |

#### 反面教材（禁止这样做）

❌ **错误做法 1：边发现边改**
```
AI：我看到 personal-info.vue，先翻译它
AI：翻完了，再看看有没有其他文件
AI：找到 account-safe.vue，也翻译它
用户：搞定了吗？
AI：搞定了
实际：漏了 my-benefits.vue 和 my-homepage.vue
```

❌ **错误做法 2：只看菜单标签**
```
AI：菜单的 5 个标签都翻译了
用户：好，个人中心完成了
实际：菜单翻了，但点进去整页还是中文
```

✅ **正确做法：先列清单再执行**
```
AI：个人中心模块有 5 个页面（列出清单）
用户：确认无遗漏
AI：逐页改造并勾选（1/5 → 2/5 → ... → 5/5）
用户：按清单逐页验收
```

#### 清单模板

```markdown
## <模块名>国际化改造范围

### 路由分析
- 路由前缀：`/rpp/user-center`
- 父路由：`src/router/admin/index.js`
- 子路由数：5

### 改造清单

| 序号 | 子页面 | 路径 | 改造状态 | 验收状态 | 备注 |
|-----|-------|------|---------|---------|------|
| 1 | 个人主页 | src/views/rpp/user-center/my-homepage.vue | ⬜ | ⬜ | |
| 2 | 个人信息 | src/views/rpp/user-center/personal-info.vue | ⬜ | ⬜ | |
| 3 | 我的收益 | src/views/rpp/user-center/my-benefits.vue | ⬜ | ⬜ | |
| 4 | 账号安全 | src/views/rpp/user-center/account-safe.vue | ⬜ | ⬜ | |
| 5 | 银行卡管理 | src/views/rpp/user-center/bank-card-manage.vue | ⬜ | ⬜ | |

**总计**：5 个页面

### 公共组件（如有）
- [ ] src/components/user-center/avatar-uploader.vue
- [ ] src/components/user-center/verify-code-btn.vue

### 执行计划
- 预计耗时：2-3 小时（每页 30-40 分钟）
- 负责人：xxx
- 截止日期：2026-xx-xx
```

#### 工具支持

**生成清单脚本**（可选）：
```bash
#!/bin/bash
# generate-i18n-checklist.sh
# 用法: bash generate-i18n-checklist.sh user-center

MODULE=$1
echo "## ${MODULE} 国际化改造范围"
echo ""
echo "| 序号 | 文件 | 状态 |"
echo "|-----|------|------|"

find "src/views/rpp/${MODULE}" -name "*.vue" | sort | nl -w1 -s'|' | sed 's/^/|/' | sed 's/$/| ⬜ |/'
```

---

### 12.2 单文件改造流程

每个文件的改造流程:

```
1. Read 文件,找出所有硬编码中文(排除注释/console)
2. 判断该文件属于加工流程(用 $tm) 还是 管理页面(用 $tm,JS 用 i18n.t)
3. 逐个中文 → 设计语义 key → 替换为 $tm('xx')
   - 动态拼接 `第${i}题` → $tm('xx', {i}),JSON 写 "第{i}题"
   - 模板标签、按钮、弹窗 title、placeholder、message 提示都要改
4. 在四个 locale 的对应 namespace 文件同步建 key(key 名一致)
   - 简体=原文;繁体=简转繁(hk);英文/葡语=准确翻译
5. 收尾自检,全绿才算完成
```

### 收尾自检清单

1. **残留中文检查**:改过的文件除注释/console 外无硬编码中文
2. **key 完整性**(最易漏):每个 `$tm` 引用的 key 在四个语言文件都已定义
3. **占位符一致**:带参 key 的参数名与 JSON 占位符逐字一致
4. **四语言对齐**:每个 key 在四个文件都存在
5. **ESLint**:`npx eslint <改过的文件>`(不要用全量 `npm run lint`)
6. **繁体简繁一致性**:zh-TW 新建 key 确认真的是繁体
7. **卡口**:`npm run i18n:check` 通过

---

## 十三、提交规范

- **commit 风格**:`feat:加工流程多语言改造-<模块>` —— 单行中文,简洁,逗号分隔
- **禁止**加 `Co-Authored-By`、`<...>` 等任何尾注
- 按模块/Task 分批提交,**只提交 i18n 相关文件**
- **提交前必看暂存区**:`git diff --cached --stat` 核对,确认只有本次该提交的文件
- **绝不提交**:
  - 本地配置(`config/index.js` 的代理 IP)
  - 调试 mock 数据(如 `userService.js` 写死数据)
  - `package-lock.json`
- 提交不推送,由人工 review 后推
- husky pre-commit 会自动跑 `eslint --fix` + `i18n:check`,正常放行即可

> ⚠️ **协作教训**:未提交改动曾被外部还原导致丢失。改完及时提交,或 `git stash` 保存。

---

## 十四、常见问题与踩坑

### Q1：为什么不直接用 vue-i18n 的 `$t`？

`$t` 无法区分"工作室语言"和"页面语言",项目双语言体系必须用自定义的 `$tm` 走 `resolveBizLocale()`。

### Q2：页面显示成 key 字符串(如 `taskProcess.xxx`)怎么办？

说明 key 漏建或路径写错。检查:
1. 四个语言文件是否都有这个 key
2. 代码引用路径与 JSON 实际路径是否一致(路径错位高发)

### Q3：如何确保所有语言包都补齐？

三道防线:
1. **开发阶段**:i18n-ally 行内显示四语言译文,缺失标红
2. **提交阶段**:husky pre-commit 跑 `i18n:check` 卡口拦截
3. **运行时**:vue-i18n 在 key 不存在时显示 key 字符串,QA 易发现

### Q4：插值变量为什么不生效？

检查占位符:
- 不要把 JS 模板字符串 `` `第${i}题` `` 原样塞进 JSON
- `$tm` 不认 `${}`,要写 `第{i}题` 并 `$tm('k', {i})` 传参
- 代码传 `{index}`,JSON 必须写 `{index}`(逐字一致)

### Q5：新增语言文件需要手动 import 吗？

不需要。`index.js` 用 `require.context` 自动扫描 `locales/` 下所有 JSON,新增文件自动加载。

### Q6：element-ui 分页"共 X 条"语言不对？

element-ui / zxment 内置文案走 `resolveElementLocale()`,规则与业务一致(工作室路由跟工作室语言,缺失回退 zh-CN)。

### Q7：为什么切换工作室后导航栏语言也变了？（V2.0 补充）

**现象**：切换到英文工作室，顶部导航栏、账号面板也变成英文了。

**原因**：导航栏是**全站通用文案**，应该固定用页面语言，不跟工作室语言。

**排查**：
1. 检查 `CommonNavBar` 组件是否调用 `$tm` 时没有传参数
2. 检查 `navUtil.js` 是否用了 `resolveBizLocale()` 而非 `getCurrentLocale()`

**解决方案**：
```js
// ❌ 错误：跟工作室语言
this.$tm('nav.home')

// ✅ 正确：固定页面语言
import { getCurrentLocale } from '@/config/lang'
i18n.t('nav.home', getCurrentLocale())  // 或传 { forcePageLang: true }
```

**详见**：第六章 6.4、《多语言改造规范手册.md》当前统一规则第 4 条。

---

### Q8：改编题型校验的"一课一研"为什么显示英文？（V2.0 补充）

**现象**：改编题型校验逻辑失效，原本应该拦截"一课一研"的校验没生效。

**原因**：典型的"**后端返回值做判断**"问题。

**原代码**：
```js
// ❌ 后端多语言改造后，sectionName 返回 "One Lesson One Study"，判断失效
if (sections[0].sectionName === '一课一研') {
  // 校验逻辑
}
```

**为什么会出错**：
- 原本后端返回 `{sectionName: "一课一研"}`
- 后端多语言改造后，根据工作室语言返回 `{sectionName: "One Lesson One Study"}`
- 前端 `if (xxx === '一课一研')` 判断失效

**解决方案（优先级）**：

**方案 1（最佳）**：要求后端返回 `sectionCode`（数字或枚举），前端按 code 判断
```js
// ✅ 正确：按 code 判断
if (sections[0].sectionCode === 'ONE_LESSON_ONE_STUDY') {
  // 校验逻辑
}
```

**方案 2（次选）**：前端建立映射表，先把后端文案翻译成固定 key 再判断
```js
// ✅ 正确：映射表
const SECTION_NAME_MAP = {
  '一课一研': 'ONE_LESSON_ONE_STUDY',
  'One Lesson One Study': 'ONE_LESSON_ONE_STUDY',
  '一課一研': 'ONE_LESSON_ONE_STUDY',
  // ...其他语言
}

const sectionKey = SECTION_NAME_MAP[sections[0].sectionName]
if (sectionKey === 'ONE_LESSON_ONE_STUDY') {
  // 校验逻辑
}
```

**方案 3（临时）**：与后端约定"判断字段保持中文"（风险：后端忘记、新人不知道）
```js
// ⚠️ 风险：依赖口头约定
// 需要在接口文档明确标注："sectionName 字段固定返回中文，用于前端判断逻辑"
if (sections[0].sectionName === '一课一研') {
  // 校验逻辑
}
```

**通用规律**：
- 后端返回的**显示文案** → 前端直接渲染，不做判断
- 后端返回的**枚举值** → 用 code/status（数字/枚举），不用文案

**详见**：《国际化场景全清单.md》场景 4.3、第九章 9.6 盲区 2。

---

### Q9：为什么 el-select 的 options 切换语言不更新？（V2.0 补充）

**现象**：el-select 下拉选项切换语言后仍然显示初始语言。

**原因**：label 直接用了字符串或者 `i18n.t(key)` 顶层调用。

**错误写法**：
```js
// ❌ 错误 1：label 直接用字符串
export const TYPE_OPTIONS = [
  { label: '类型A', value: 1 }  // 永远显示中文
]

// ❌ 错误 2：顶层直接调用 i18n.t，固定为初始语言
export const TYPE_OPTIONS = [
  { label: i18n.t('type.a'), value: 1 }  // JS 文件加载时求值一次，之后不更新
]
```

**正确写法**：
```js
// ✅ 正确：返回函数，调用时才求值
import i18n from '@/config/lang'

export const TYPE_OPTIONS = [
  { label: () => i18n.t('type.a'), value: 1 },  // 返回函数
  { label: () => i18n.t('type.b'), value: 2 }
]

// 调用方
<el-select v-model="form.type">
  <el-option
    v-for="item in TYPE_OPTIONS"
    :key="item.value"
    :label="item.label()"     // ✅ 执行函数
    :value="item.value"
  />
</el-select>
```

**为什么要返回函数**：
- JS 文件加载时（`import` 阶段）还没有语言上下文
- 直接 `i18n.t(key)` 会固定为初始语言（通常是 `zh-CN`）
- 返回函数 `() => i18n.t(key)` → 调用时才求值，能响应语言切换

**Vue 组件中的写法（对比）**：
```js
// Vue 组件内可以用 computed（每次重新求值）
computed: {
  typeOptions() {
    return [
      { label: this.$tm('type.a'), value: 1 },  // ✅ computed 会重新执行
      { label: this.$tm('type.b'), value: 2 }
    ]
  }
}
```

**详见**：第五章 5.4、《国际化场景全清单.md》场景 2.3。

---

## 十六、高级场景覆盖（V2.0 新增）

本章覆盖前面章节未详细展开的高频场景。完整场景清单（20种）见《国际化场景全清单.md》。

### 16.1 HTML 属性中的文案

**场景**：`placeholder`、`title`（tooltip）、`alt`（图片替代文字）等属性中的中文。

**错误写法**：
```vue
<el-input placeholder="请输入姓名" />
<el-button title="点击保存">保存</el-button>
<img src="..." alt="用户头像" />
```

**正确写法**：
```vue
<el-input :placeholder="$tm('form.namePlaceholder')" />
<el-button :title="$tm('common.clickToSave')">{{ $tm('common.save') }}</el-button>
<img :src="..." :alt="$tm('user.avatarAlt')" />
```

**注意**：属性绑定必须用 `:placeholder` 或 `v-bind:placeholder`，不能用 `placeholder="{{ ... }}"`（Vue 2 不支持）。

---

### 16.2 Message / MessageBox

**场景**：`this.$message`、`this.$alert`、`this.$confirm` 等提示文案。

**错误写法**：
```js
this.$message.success('操作成功')
this.$message.error('保存失败，请重试')
this.$confirm('确认删除吗？', '提示')
```

**正确写法**：
```js
this.$message.success(this.$tm('common.operationSuccess'))
this.$message.error(this.$tm('common.saveFailed'))
this.$confirm(
  this.$tm('common.deleteConfirm'),
  this.$tm('common.tip'),
  {
    confirmButtonText: this.$tm('common.confirm'),
    cancelButtonText: this.$tm('common.cancel')
  }
)
```

**提示**：`common.json` 中已有大量通用提示文案（成功/失败/确认/取消等），优先复用。

---

### 16.3 表格列配置

#### 16.3.1 列 label

**错误写法**：
```js
columns: [
  { label: '姓名', prop: 'name' }
]
```

**正确写法（方式 1：computed）**：
```js
computed: {
  columns() {
    return [
      { label: this.$tm('user.name'), prop: 'name' }
    ]
  }
}
```

**正确写法（方式 2：template 里包 $tm）**：
```js
data() {
  return {
    columns: [
      { labelKey: 'user.name', prop: 'name' }  // 存 key
    ]
  }
}

// template
<el-table-column
  v-for="col in columns"
  :key="col.prop"
  :label="$tm(col.labelKey)"
  :prop="col.prop"
/>
```

#### 16.3.2 formatter 返回值

**错误写法**：
```js
{
  label: '状态',
  prop: 'status',
  formatter: (row) => row.status === 1 ? '已审核' : '待审核'
}
```

**正确写法**：
```js
{
  label: this.$tm('task.status'),
  prop: 'status',
  formatter: (row) => {
    const key = row.status === 1 ? 'status.approved' : 'status.pending'
    return i18n.t(key)  // JS 上下文用 i18n.t
  }
}
```

**注意**：formatter 是普通 JS 函数，不是 Vue 组件上下文，用 `i18n.t` 而非 `this.$tm`。

---

### 16.4 路由 meta 中的面包屑

**场景**：面包屑、页面标题从路由 `meta` 读取。

**错误写法**：
```js
{
  path: '/task/list',
  meta: { title: '任务列表' }
}
```

**正确写法**：
```js
{
  path: '/task/list',
  meta: { title: 'task.list.title' }  // 存 key
}

// 面包屑组件读取
<el-breadcrumb-item>{{ $tm($route.meta.title) }}</el-breadcrumb-item>

// 页面标题
document.title = this.$tm(this.$route.meta.title)
```

---

### 16.5 echarts / 图表文案

**场景**：图表的坐标轴标签、legend、tooltip 等文案。

**错误写法**：
```js
data() {
  return {
    option: {
      xAxis: { name: '日期' },
      yAxis: { name: '数量' },
      legend: { data: ['完成', '未完成'] }
    }
  }
}
```

**正确写法**：
```js
computed: {
  chartOption() {
    return {
      xAxis: { name: this.$tm('chart.date') },
      yAxis: { name: this.$tm('chart.count') },
      legend: {
        data: [this.$tm('chart.completed'), this.$tm('chart.pending')]
      }
    }
  }
}

// 监听语言切换，重新渲染图表
watch: {
  '$i18n.locale'() {
    this.chart.setOption(this.chartOption)
  }
}
```

**注意**：
- 图表配置用 `computed` 响应语言变化
- 需要监听 `$i18n.locale` 切换时调用 `chart.setOption` 更新

---

### 16.6 Excel 导出

**场景**：导出 Excel 的表头、文件名。

**错误写法**：
```js
exportExcel({
  filename: '任务列表.xlsx',
  columns: ['任务名称', '状态', '创建时间']
})
```

**正确写法**：
```js
exportExcel({
  filename: `${this.$tm('task.listTitle')}.xlsx`,
  columns: [
    this.$tm('task.name'),
    this.$tm('task.status'),
    this.$tm('task.createTime')
  ]
})
```

---

### 16.7 时间日期格式

**场景**：不同语言的日期格式不同。

**示例**：
- 中文：`2026年7月2日`
- 英文：`July 2, 2026`
- 葡语：`2 de julho de 2026`

**处理（moment.js）**：
```js
import moment from 'moment'
import 'moment/locale/zh-cn'
import 'moment/locale/pt'

// 切换语言时
const locale = currentLang === 'zh-CN' ? 'zh-cn' : currentLang.toLowerCase()
moment.locale(locale)

// 使用
moment(date).format('LL')  // 自动按当前 locale 格式化
```

**处理（dayjs）**：
```js
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/pt'

dayjs.locale(currentLang.toLowerCase())
dayjs(date).format('LL')
```

---

### 16.8 场景速查表

| 场景 | 优先级 | 示例 | 详见章节 |
|------|-------|------|---------|
| HTML 属性 | P1 | placeholder / title / alt | 16.1 |
| Message / MessageBox | P0 | this.$message.success(...) | 16.2 |
| 表格列 label | P0 | el-table-column :label | 16.3.1 |
| 表格 formatter | P1 | formatter 返回值 | 16.3.2 |
| 路由 meta | P1 | 面包屑 / 页面标题 | 16.4 |
| echarts 图表 | P2 | xAxis / yAxis / legend | 16.5 |
| Excel 导出 | P2 | 表头 / 文件名 | 16.6 |
| 时间日期格式 | P1 | moment / dayjs locale | 16.7 |
| 图片中的文字 | P2 | 多语言图片 / CSS 替代 | 《场景清单》7 |
| 第三方 SDK | P2 | Saber Editor 配置 | 《场景清单》8 |

**完整清单**：《国际化场景全清单.md》覆盖 20 种场景，包括数字金额格式、正则中文字符集、打印 PDF 等边缘场景。

---

## 十五、新成员上手清单

开工前确认:

- [ ] 已读本方案 + 《多语言改造规范手册.md》
- [ ] VSCode 已装 i18n-ally 并能看到四语言行内译文
- [ ] 清楚翻译出口只有 2 个:组件 `$tm`、JS `i18n.t`
- [ ] 知道语言文件按业务模块拆成 32 个 JSON,会找对应 namespace
- [ ] 知道 4 条改造铁律(key 同步四语言、原文不推断、占位符一致)
- [ ] 知道收尾要做「key 完整性双向核对」,不只是查残留中文
- [ ] 知道提交前 husky 会自动跑卡口,新增漏翻会被拦
- [ ] 知道 commit 不带 Co-Authored-By,不提交 package-lock.json / 本地配置

---

## 附录：关键文件速查

| 文件 | 作用 |
|------|------|
| `src/config/lang/index.js` | i18n 实例初始化 + require.context 加载 |
| `src/config/lang/locales/<locale>/*.json` | 四语言 × 8 模块语言文件 |
| `src/utils/macaoUtil.js` | `$tm` 安装(installStudioI18n) |
| `src/utils/bizLocale.js` | `resolveBizLocale()` 语言决策 |
| `src/utils/http.js` | 请求头语言上下文注入 |
| `scripts/i18n-check.js` | 卡口脚本 |
| `.i18n-baseline.json` | 存量问题基线 |
| `vue-i18n-extract.config.js` | extract 工具配置 |
| `.vscode/settings.json` | i18n-ally 配置(gitignore) |

---

## 变更记录

| 日期 | 作者 | 变更内容 |
|------|------|----------|
| 2026-06-10 | Claude & fjyu9 | V1.0：创建方案,综合规范手册/演进记录/方案评估三份文档 |
| 2026-06-10 | Claude & fjyu9 | V1.0：修复 3 个硬伤(getCurrentLocale 导入路径、resolveBizLocale 决策机制、i18n:extract 描述)。新增环境准备章节、端到端完整示例 |
| 2026-07-02 | Claude & fjyu9 | V2.0：基于澳门国际化二期实战经验修订。新增 5.4(JS 枚举三种模式)、9.6(卡口五类盲区)、12.1(批量改造流程约束)、16(高级场景覆盖)。扩充 Q&A 补充 3 个真实 bug 案例。修正第六章编号错误 |
|------|------|----------|
| 2026-06-10 | Claude & fjyu9 | 创建方案,综合规范手册/演进记录/方案评估三份文档 |
| 2026-06-10 | Claude & fjyu9 | 修复 3 个硬伤:getCurrentLocale 导入路径、resolveBizLocale 决策机制、i18n:extract 描述。新增:环境准备章节、端到端完整示例 |
