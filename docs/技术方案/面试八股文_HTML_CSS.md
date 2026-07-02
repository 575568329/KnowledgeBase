# HTML/CSS 面试八股文 (2026)

> 更新时间:2026-07-01
> 关键词:语义化 · BFC · Flex · Grid · 响应式设计

---

## 一、HTML 基础

### 1. 语义化标签

**为什么语义化**:
- SEO 友好(搜索引擎理解页面结构)
- 可访问性(屏幕阅读器)
- 代码可维护性

**HTML5 语义化标签**:

```html
<header>    <!-- 头部 -->
<nav>       <!-- 导航 -->
<main>      <!-- 主内容 -->
<article>   <!-- 独立文章 -->
<section>   <!-- 章节 -->
<aside>     <!-- 侧边栏 -->
<footer>    <!-- 页脚 -->
<figure>    <!-- 图表 -->
  <img src="..." alt="...">
  <figcaption>图片说明</figcaption>
</figure>
```

**❌ 不语义化**:

```html
<div class="header">
  <div class="nav">...</div>
</div>
```

**✅ 语义化**:

```html
<header>
  <nav>...</nav>
</header>
```

### 2. Meta 标签

```html
<!-- 字符编码 -->
<meta charset="UTF-8">

<!-- 视口(响应式必备) -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- SEO -->
<meta name="description" content="页面描述">
<meta name="keywords" content="关键词1,关键词2">

<!-- Open Graph(社交分享) -->
<meta property="og:title" content="标题">
<meta property="og:image" content="封面图">

<!-- PWA -->
<meta name="theme-color" content="#000000">
<link rel="manifest" href="/manifest.json">
```

### 3. HTML5 新特性

**1) 表单增强**:

```html
<input type="email" required>
<input type="tel" pattern="[0-9]{11}">
<input type="date">
<input type="range" min="0" max="100">
<input type="color">

<datalist id="browsers">
  <option value="Chrome">
  <option value="Firefox">
</datalist>
<input list="browsers">
```

**2) 多媒体**:

```html
<video controls>
  <source src="video.mp4" type="video/mp4">
  <source src="video.webm" type="video/webm">
  您的浏览器不支持视频播放
</video>

<audio controls>
  <source src="audio.mp3" type="audio/mpeg">
</audio>
```

**3) Canvas / SVG**:

```html
<!-- Canvas:位图,JS绘制 -->
<canvas id="myCanvas" width="200" height="100"></canvas>

<!-- SVG:矢量图,XML -->
<svg width="100" height="100">
  <circle cx="50" cy="50" r="40" fill="red" />
</svg>
```

### 4. 可访问性(a11y)

```html
<!-- alt 属性(必须) -->
<img src="logo.png" alt="公司 Logo">

<!-- ARIA 属性 -->
<button aria-label="关闭">×</button>
<div role="alert" aria-live="polite">提示信息</div>

<!-- label 关联 -->
<label for="username">用户名</label>
<input id="username" type="text">

<!-- 语义化按钮 -->
<button type="button">点击</button>  <!-- ✅ -->
<div onclick="...">点击</div>        <!-- ❌ -->
```

---

## 二、CSS 基础

### 1. 选择器优先级

**优先级计算**(从高到低):

1. `!important`(10000)
2. 内联样式(1000)
3. ID 选择器(100)
4. 类/伪类/属性(10)
5. 标签/伪元素(1)

```css
/* 优先级计算 */
#id .class div            /* 100 + 10 + 1 = 111 */
.class1.class2 div::after /* 10 + 10 + 1 + 1 = 22 */
div.class[attr]:hover     /* 1 + 10 + 10 + 10 = 31 */
```

**权重相同**:后面的覆盖前面的。

### 2. 盒模型

**标准盒模型**(content-box):

```
width = content
总宽度 = width + padding + border
```

**IE 盒模型**(border-box):

```
width = content + padding + border
总宽度 = width
```

```css
/* 全局设置为 border-box(推荐) */
*, *::before, *::after {
  box-sizing: border-box;
}
```

### 3. BFC(块级格式化上下文)

**什么是 BFC**:独立渲染区域,内部布局不影响外部。

**触发 BFC**:
- `overflow: hidden/auto/scroll`(非 visible)
- `float: left/right`
- `position: absolute/fixed`
- `display: inline-block/flex/grid`
- `display: flow-root`(专门触发 BFC)

**应用场景**:

**1) 清除浮动**:

```css
.container {
  overflow: hidden;  /* 触发 BFC */
}
.container::after {
  content: '';
  display: block;
  clear: both;
}
```

**2) 防止外边距塌陷**:

```html
<div class="parent">
  <div class="child" style="margin-top: 20px"></div>
</div>
```

```css
/* 子元素 margin-top 会穿透到父元素 */
/* 解法:父元素触发 BFC */
.parent {
  overflow: hidden;
}
```

**3) 两栏布局(左固定右自适应)**:

```css
.left {
  float: left;
  width: 200px;
}
.right {
  overflow: hidden;  /* 触发 BFC,不被 float 覆盖 */
}
```

---

## 三、布局(核心)

### 1. Flexbox 布局

**容器属性**:

```css
.container {
  display: flex;
  
  flex-direction: row | column;        /* 主轴方向 */
  flex-wrap: nowrap | wrap;            /* 是否换行 */
  justify-content: flex-start | center | space-between | space-around;  /* 主轴对齐 */
  align-items: stretch | center | flex-start | flex-end;  /* 交叉轴对齐 */
  align-content: flex-start | center;  /* 多行对齐 */
}
```

**项目属性**:

```css
.item {
  flex: 1;  /* flex-grow flex-shrink flex-basis 简写 */
  /* 等价于 flex: 1 1 0% */
  
  order: 1;           /* 排序 */
  align-self: center; /* 单独对齐 */
}
```

**常见布局**:

```css
/* 水平垂直居中 */
.center {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 两端对齐 */
.space-between {
  display: flex;
  justify-content: space-between;
}

/* 圣杯布局(头尾固定,中间自适应) */
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.header, .footer { flex-shrink: 0; }
.main { flex: 1; overflow: auto; }
```

### 2. Grid 布局

**容器属性**:

```css
.container {
  display: grid;
  
  /* 定义行列 */
  grid-template-columns: 100px 200px 1fr;  /* 3列 */
  grid-template-rows: 50px auto;            /* 2行 */
  
  /* 重复 */
  grid-template-columns: repeat(3, 1fr);    /* 3等分 */
  
  /* 间距 */
  gap: 10px;  /* 行列间距 */
  row-gap: 10px;
  column-gap: 20px;
  
  /* 对齐 */
  justify-items: start | center | end;
  align-items: start | center | end;
}
```

**项目属性**:

```css
.item {
  /* 占据多列/行 */
  grid-column: 1 / 3;  /* 从第1列到第3列 */
  grid-row: 1 / 2;
  
  /* 简写 */
  grid-area: 1 / 1 / 3 / 3;  /* row-start / col-start / row-end / col-end */
}
```

**常见布局**:

```css
/* 卡片网格(自动填充) */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

/* 12列栅格系统 */
.grid-12 {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 20px;
}
.col-6 {
  grid-column: span 6;  /* 占6列 */
}
```

### 3. 传统布局

**1) 浮动布局**:

```css
.clearfix::after {
  content: '';
  display: block;
  clear: both;
}
```

**2) 定位布局**:

```css
/* 相对定位:相对自身原位置 */
position: relative;
top: 10px;

/* 绝对定位:相对最近的非 static 祖先 */
position: absolute;
top: 0;
right: 0;

/* 固定定位:相对视口 */
position: fixed;
bottom: 20px;

/* 粘性定位:滚动到阈值时固定 */
position: sticky;
top: 0;
```

---

## 四、响应式设计

### 1. 媒体查询(Media Query)

```css
/* 移动优先 */
.container { width: 100%; }

@media (min-width: 768px) {
  .container { width: 750px; }
}

@media (min-width: 1200px) {
  .container { width: 1170px; }
}

/* 横屏 */
@media (orientation: landscape) {
  /* ... */
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  body { background: #000; }
}
```

### 2. 常见断点

| 设备 | 断点 |
|------|------|
| 手机 | < 768px |
| 平板 | 768px ~ 1024px |
| 桌面 | > 1024px |
| 大屏 | > 1440px |

### 3. 响应式单位

```css
/* rem:相对根元素字号 */
html { font-size: 16px; }
.box { width: 10rem; }  /* 160px */

/* em:相对父元素字号 */
.parent { font-size: 20px; }
.child { font-size: 0.8em; }  /* 16px */

/* vw/vh:视口宽高的 1% */
.hero { height: 100vh; }  /* 全屏高 */

/* clamp:响应式字号 */
font-size: clamp(14px, 2vw, 20px);  /* 最小14px,最大20px */
```

---

## 五、高频面试题

### Q1: 水平垂直居中的N种方法?

```css
/* 1. Flex(推荐) */
.parent {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 2. Grid */
.parent {
  display: grid;
  place-items: center;
}

/* 3. 绝对定位 + transform */
.child {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 4. 绝对定位 + margin */
.child {
  position: absolute;
  top: 0; right: 0; bottom: 0; left: 0;
  margin: auto;
  width: 100px;
  height: 100px;
}

/* 5. table-cell */
.parent {
  display: table-cell;
  text-align: center;
  vertical-align: middle;
}
```

### Q2: 三栏布局(左右固定,中间自适应)?

```css
/* 1. Flex */
.container { display: flex; }
.left, .right { width: 200px; }
.main { flex: 1; }

/* 2. Grid */
.container {
  display: grid;
  grid-template-columns: 200px 1fr 200px;
}

/* 3. 浮动 */
.left { float: left; width: 200px; }
.right { float: right; width: 200px; }
.main { margin: 0 200px; }

/* 4. 绝对定位 */
.left { position: absolute; left: 0; width: 200px; }
.right { position: absolute; right: 0; width: 200px; }
.main { margin: 0 200px; }
```

### Q3: CSS 优化技巧?

1. **减少重排重绘**:
   - 批量修改 DOM:用 `DocumentFragment`
   - `transform/opacity` 不触发重排(GPU 加速)
   - `will-change` 提示浏览器优化

2. **选择器优化**:
   - 避免通配符 `*`
   - 避免深层嵌套(`.a .b .c .d`)
   - ID 选择器最快

3. **CSS 包体积**:
   - 压缩(cssnano)
   - 移除未使用 CSS(PurgeCSS)
   - 雪碧图/CSS Sprites(减少 HTTP 请求)

4. **关键 CSS**:
   - 内联首屏 CSS
   - 懒加载非首屏 CSS

### Q4: 隐藏元素的方法及区别?

| 方法 | 占据空间 | 事件响应 | 子元素可见 |
|------|---------|---------|----------|
| `display: none` | ❌ | ❌ | ❌ |
| `visibility: hidden` | ✅ | ❌ | 可(子设 `visible`) |
| `opacity: 0` | ✅ | ✅ | ❌ |
| `position: absolute; left: -9999px` | ❌ | ❌ | ❌ |

### Q5: 清除浮动的方法?

```css
/* 1. 父元素触发 BFC */
.parent { overflow: hidden; }

/* 2. 伪元素(推荐) */
.clearfix::after {
  content: '';
  display: block;
  clear: both;
}

/* 3. 额外标签 */
<div style="clear: both;"></div>
```

### Q6: 重排(Reflow) vs 重绘(Repaint)?

**重排(Reflow)**:几何属性变化,重新计算布局。

触发:
- 增删 DOM
- 改变 `width/height/padding/margin/border`
- `display: none`
- 获取某些属性(`offsetTop/clientWidth`)

**重绘(Repaint)**:外观变化,不影响布局。

触发:
- 改变 `color/background`
- `visibility: hidden`

**性能**:重排 > 重绘 > 不触发(transform/opacity 仅合成)。

---

## 六、CSS 预处理器

### Sass/Less 常用功能

```scss
// 变量
$primary-color: #333;

// 嵌套
.nav {
  ul { list-style: none; }
  li { display: inline-block; }
  a { color: $primary-color; }
}

// Mixin
@mixin center {
  display: flex;
  justify-content: center;
  align-items: center;
}

.box {
  @include center;
}

// 函数
@function double($n) {
  @return $n * 2;
}

width: double(50px);  // 100px

// 继承
%message {
  padding: 10px;
  border: 1px solid;
}

.success {
  @extend %message;
  border-color: green;
}
```

---

## 七、现代 CSS 特性(2026)

### 1. CSS 变量(自定义属性)

```css
:root {
  --primary-color: #007bff;
  --spacing: 20px;
}

.button {
  background: var(--primary-color);
  padding: var(--spacing);
}

/* JS 修改 */
document.documentElement.style.setProperty('--primary-color', '#ff0000');
```

### 2. Container Queries(容器查询)

```css
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
```

### 3. Subgrid

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.nested-grid {
  display: grid;
  grid-template-columns: subgrid;  /* 继承父网格 */
}
```

### 4. CSS Houdini(Paint API)

```css
.box {
  background: paint(checkerboard);
}
```

```js
// paint-worklet.js
registerPaint('checkerboard', class {
  paint(ctx, geom, properties) {
    // 自定义绘制逻辑
  }
})
```

---

## 八、性能优化清单

1. **减少 HTTP 请求**:雪碧图/内联小图片(base64)
2. **压缩资源**:Gzip/Brotli
3. **关键渲染路径**:内联首屏 CSS,defer 非关键 CSS
4. **GPU 加速**:`transform: translateZ(0)`
5. **避免 @import**:阻塞并行下载,用 `<link>`
6. **字体优化**:`font-display: swap`,WOFF2 格式
7. **图片优化**:WebP/AVIF,懒加载,响应式图片(`srcset`)

---

## 参考资料

- [MDN CSS](https://developer.mozilla.org/zh-CN/docs/Web/CSS)
- [CSS Tricks](https://css-tricks.com/)
- [Can I Use](https://caniuse.com/)
- [Flexbox Froggy](https://flexboxfroggy.com/)(Flex 练习游戏)
- [Grid Garden](https://cssgridgarden.com/)(Grid 练习游戏)
