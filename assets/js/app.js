/* ============================================================
 * app.js — 应用主逻辑
 * 加载 manifest.json → 渲染目录树 → hash 路由 → 搜索 / 主题
 * ============================================================ */
(function () {
  'use strict';

  const KIND_BADGE = {
    md: { cls: 'badge--md', text: 'MD' },
    pdf: { cls: 'badge--pdf', text: 'PDF' },
    docx: { cls: 'badge--docx', text: 'DOC' },
    html: { cls: 'badge--html', text: 'WEB' },
    img: { cls: 'badge--img', text: 'IMG' }
  };

  const state = {
    manifest: null,
    flatFiles: [],   // 扁平文件列表，用于搜索
    currentPath: null,
    mode: 'preview',  // 'local' 或 'preview'，探测 /api/status 决定
    features: [],     // 本地模式下服务端支持的功能列表
    sse: null,        // EventSource 引用
    scrollPositions: {}, // 记录每篇文档的滚动位置 { path: scrollTop }
    searchIndex: null    // MiniSearch 实例
  };

  const dom = {
    tree: document.getElementById('tree'),
    content: document.getElementById('content'),
    search: document.getElementById('search'),
    breadcrumb: document.getElementById('breadcrumb'),
    fileCount: document.getElementById('file-count'),
    openRaw: document.getElementById('open-raw'),
    app: document.getElementById('app'),
    scrim: document.getElementById('scrim'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    themeToggle: document.getElementById('theme-toggle'),
    modeBadge: document.getElementById('mode-badge'),
    uploadBtn: document.getElementById('upload-btn'),
    uploadInput: document.getElementById('upload-input'),
    resizeHandle: document.getElementById('resize-handle'),
    tagFilter: document.getElementById('tag-filter'),
    exportPdf: document.getElementById('export-pdf')
  };

  /* ---------------- 主题 ---------------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('hljs-light').disabled = (theme === 'dark');
    document.getElementById('hljs-dark').disabled = (theme !== 'dark');
    document.getElementById('icon-sun').style.display = (theme === 'dark') ? 'none' : 'block';
    document.getElementById('icon-moon').style.display = (theme === 'dark') ? 'block' : 'none';
    try { localStorage.setItem('kb-theme', theme); } catch (e) {}
  }
  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem('kb-theme'); } catch (e) {}
    if (!saved) {
      saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(saved);
  }
  dom.themeToggle.addEventListener('click', function () {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    // 若当前是 md，重渲染以刷新 mermaid 主题
    if (state.currentPath && window.Viewers.kindOf(state.currentPath) === 'md') {
      openPath(state.currentPath);
    }
  });

  /* ---------------- 侧边栏收起 / 展开 ---------------- */
  const MOBILE_QUERY = '(max-width: 768px)';
  function isMobile() { return window.matchMedia(MOBILE_QUERY).matches; }
  function closeDrawer() { dom.app.classList.remove('is-drawer-open'); }

  // 桌面端折叠状态持久化
  function applyCollapsed(collapsed) {
    dom.app.classList.toggle('is-collapsed', collapsed);
    try { localStorage.setItem('kb-collapsed', collapsed ? '1' : '0'); } catch (e) {}
  }
  function initCollapsed() {
    let saved = '0';
    try { saved = localStorage.getItem('kb-collapsed') || '0'; } catch (e) {}
    if (saved === '1') dom.app.classList.add('is-collapsed');
  }

  /* ---------------- 侧边栏宽度调整 ---------------- */
  function setSidebarWidth(px) {
    const min = 200, max = window.innerWidth * 0.5;
    const w = Math.max(min, Math.min(max, px));
    document.documentElement.style.setProperty('--sidebar-w', w + 'px');
    return w;
  }
  function initSidebarWidth() {
    let saved = 288; // 默认宽度
    try {
      const s = localStorage.getItem('kb-sidebar-width');
      if (s) saved = parseInt(s, 10);
    } catch (e) {}
    setSidebarWidth(saved);
  }
  if (dom.resizeHandle) {
    let startX = 0, startW = 0;
    dom.resizeHandle.addEventListener('mousedown', function (e) {
      if (isMobile()) return; // 移动端禁用
      startX = e.clientX;
      const cur = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w');
      startW = parseInt(cur, 10) || 288;
      dom.app.classList.add('is-resizing');
      e.preventDefault();

      function onMove(e2) {
        const delta = e2.clientX - startX;
        const newW = setSidebarWidth(startW + delta);
        // 实时保存(可选,也可以只在 mouseup 时保存)
      }
      function onUp() {
        dom.app.classList.remove('is-resizing');
        const finalW = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w');
        try { localStorage.setItem('kb-sidebar-width', parseInt(finalW, 10)); } catch (e) {}
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  dom.sidebarToggle.addEventListener('click', function () {
    if (isMobile()) {
      // 窄屏：开关抽屉
      dom.app.classList.toggle('is-drawer-open');
    } else {
      // 桌面：折叠 / 展开
      applyCollapsed(!dom.app.classList.contains('is-collapsed'));
    }
  });
  dom.scrim.addEventListener('click', closeDrawer);

  // 跨断点时清理另一套状态，避免残留
  window.matchMedia(MOBILE_QUERY).addEventListener('change', function () {
    closeDrawer();
  });

  /* ---------------- manifest 加载 ---------------- */
  async function loadManifest() {
    try {
      const resp = await fetch('manifest.json?_=' + Date.now());
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return await resp.json();
    } catch (e) {
      return null;
    }
  }

  // 把树打平成文件列表（用于搜索 / 默认打开）
  function flatten(node, acc) {
    if (node.type === 'file') {
      acc.push(node);
    } else if (node.children) {
      node.children.forEach(function (c) { flatten(c, acc); });
    }
    return acc;
  }

  /* ---------------- 目录树渲染 ---------------- */
  function caretSvg() {
    return '<span class="node__caret"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="m9 18 6-6-6-6"></path></svg></span>';
  }
  function dirIconSvg() {
    return '<span class="node__icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'style="color:var(--text-3)"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9' +
      'L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path></svg></span>';
  }
  function fileBadge(kind) {
    const b = KIND_BADGE[kind] || { cls: '', text: '?' };
    return '<span class="badge ' + b.cls + '">' + b.text + '</span>';
  }

  function buildNode(node, depth) {
    const indent = depth * 14;
    if (node.type === 'dir') {
      const wrap = document.createElement('div');
      wrap.className = 'node node--dir is-open';
      const row = document.createElement('div');
      row.className = 'node__row';
      row.style.paddingLeft = (8 + indent) + 'px';
      row.innerHTML = caretSvg() + dirIconSvg() +
        '<span class="node__label">' + escapeHtml(node.title || node.name) + '</span>';
      row.addEventListener('click', function () { wrap.classList.toggle('is-open'); });
      wrap.appendChild(row);

      const kids = document.createElement('div');
      kids.className = 'node__children';
      (node.children || []).forEach(function (c) { kids.appendChild(buildNode(c, depth + 1)); });
      wrap.appendChild(kids);
      return wrap;
    }
    // file
    const kind = window.Viewers.kindOf(node.path);
    const wrap = document.createElement('div');
    wrap.className = 'node node--file';
    const row = document.createElement('div');
    row.className = 'node__row';
    row.style.paddingLeft = (8 + indent + 16) + 'px';
    row.dataset.path = node.path;
    const timeLabel = node.mtime ? '<span class="node__time">' + escapeHtml(formatTime(node.mtime)) + '</span>' : '';
    row.innerHTML = fileBadge(kind) +
      '<span class="node__label" title="' + escapeHtml(node.title || node.name) + '">' +
      escapeHtml(node.title || node.name) + '</span>' +
      timeLabel +
      // 删除按钮:本地模式下 hover 显示(CSS 控制)
      '<button class="node__action node__delete" type="button" title="删除">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
      '<path d="M10 11v6M14 11v6"/></svg></button>';

    row.addEventListener('click', function (e) {
      // 点删除按钮时不触发路由
      if (e.target.closest('.node__delete')) return;
      location.hash = '#' + encodeURI(node.path);
      closeDrawer();
    });

    const delBtn = row.querySelector('.node__delete');
    if (delBtn) {
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteFile(node.path, node.title || node.name);
      });
    }

    wrap.appendChild(row);
    return wrap;
  }

  function renderTree(manifest) {
    dom.tree.innerHTML = '';
    if (!manifest || !manifest.children || manifest.children.length === 0) {
      dom.tree.innerHTML = '<div class="tree__empty">docs/ 目录暂无文档<br>放入 .md / .pdf / .docx / 图片即可</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    manifest.children.forEach(function (c) { frag.appendChild(buildNode(c, 0)); });
    dom.tree.appendChild(frag);
  }

  function highlightActive(path) {
    dom.tree.querySelectorAll('.node__row.is-active').forEach(function (r) {
      r.classList.remove('is-active');
    });
    if (!path) return;
    const row = dom.tree.querySelector('.node__row[data-path="' + cssEscape(path) + '"]');
    if (row) {
      row.classList.add('is-active');
      // 展开所有祖先目录
      let p = row.parentElement;
      while (p && p !== dom.tree) {
        if (p.classList && p.classList.contains('node--dir')) p.classList.add('is-open');
        p = p.parentElement;
      }
      row.scrollIntoView({ block: 'nearest' });
    }
  }

  /* ---------------- 面包屑 ---------------- */
  function renderBreadcrumb(path) {
    if (!path) {
      dom.breadcrumb.innerHTML = '<span class="breadcrumb__cur">欢迎</span>';
      return;
    }
    const parts = path.replace(/^docs\//, '').split('/');
    let html = '';
    parts.forEach(function (seg, i) {
      const isLast = i === parts.length - 1;
      const label = escapeHtml(stripExt(seg));
      if (isLast) html += '<span class="breadcrumb__cur">' + label + '</span>';
      else html += '<span>' + label + '</span><span class="breadcrumb__sep">/</span>';
    });
    dom.breadcrumb.innerHTML = html;
  }

  /* ---------------- 打开文件 ---------------- */
  async function openPath(path) {
    state.currentPath = path;
    renderBreadcrumb(path);
    highlightActive(path);
    dom.openRaw.style.display = 'grid';
    dom.exportPdf.style.display = 'grid';  // 显示导出按钮
    dom.openRaw.onclick = function () { window.open(encodeURI(path), '_blank'); };
    // 先滚到顶,再渲染;渲染完成后恢复该文档记录的滚动位置
    dom.content.scrollTop = 0;
    await window.Viewers.render(dom.content, path, { name: path.split('/').pop() });
    document.title = stripExt(path.split('/').pop()) + ' · 知识库';
    // 恢复滚动位置(回退到读过的文档时停在原处)
    const saved = state.scrollPositions[path];
    if (typeof saved === 'number') {
      // 等一帧确保布局完成
      requestAnimationFrame(function () { dom.content.scrollTop = saved; });
    }
  }

  function showWelcome() {
    state.currentPath = null;
    renderBreadcrumb(null);
    highlightActive(null);
    dom.openRaw.style.display = 'none';
    dom.exportPdf.style.display = 'none';  // 隐藏导出按钮
    document.title = '知识库';
    const count = state.flatFiles.length;
    dom.content.innerHTML =
      '<div class="welcome">' +
      '<div class="welcome__logo">📚</div>' +
      '<h1>欢迎来到知识库</h1>' +
      '<p>这里记录与 AI 讨论的各种方案与笔记。</p>' +
      '<p>从左侧目录选择一篇文档开始阅读，支持 Markdown、PDF、Word、图片预览。</p>' +
      '<div class="welcome__hint">📂 当前共收录 ' + count + ' 篇文档</div>' +
      '</div>';
  }

  /* ---------------- hash 路由 ---------------- */
  function onRoute() {
    // 切换前,记录当前文档的滚动位置(供回退时恢复)
    if (state.currentPath) {
      state.scrollPositions[state.currentPath] = dom.content.scrollTop;
    }
    const hash = location.hash.slice(1);
    if (!hash) { showWelcome(); return; }
    const path = decodeURI(hash);
    openPath(path);
  }

  /* ---------------- 搜索 ---------------- */
  function initSearchIndex() {
    // 初始化 MiniSearch 实例
    if (typeof MiniSearch === 'undefined') {
      console.warn('MiniSearch 未加载，全文搜索不可用');
      return;
    }

    // 只索引有 content 的文件
    const docs = state.flatFiles.filter(function (f) { return f.content; }).map(function (f) {
      return {
        id: f.path,
        title: f.title || f.name,
        content: f.content,
        path: f.path
      };
    });

    if (docs.length === 0) return;

    state.searchIndex = new MiniSearch({
      fields: ['title', 'content'],
      storeFields: ['title', 'path'],
      searchOptions: {
        boost: { title: 2 },  // 标题匹配权重更高
        prefix: true,         // 支持前缀匹配
        fuzzy: 0.2            // 轻微模糊匹配
      },
      tokenize: function (text) {
        // 简单中文分词：按字符 + 空格分割
        return text.toLowerCase().split(/[\s　]+/).flatMap(function (word) {
          if (/[一-龥]/.test(word)) {
            // 中文按字拆分 + 保留原词
            return [word].concat(word.split(''));
          }
          return [word];
        }).filter(function (t) { return t.length > 0; });
      }
    });

    state.searchIndex.addAll(docs);
    console.log('[搜索] 已索引 ' + docs.length + ' 篇文档');
  }

  function highlightSnippet(text, keyword) {
    // 在文本中高亮关键词，返回上下文片段
    const lower = text.toLowerCase();
    const kw = keyword.toLowerCase();
    let idx = lower.indexOf(kw);
    if (idx === -1) {
      // 如果直接匹配失败，尝试按字匹配（中文）
      const chars = kw.split('');
      for (let i = 0; i < chars.length; i++) {
        idx = lower.indexOf(chars[i]);
        if (idx !== -1) break;
      }
    }
    if (idx === -1) return '';

    const start = Math.max(0, idx - 30);
    const end = Math.min(text.length, idx + kw.length + 30);
    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    // 高亮关键词
    const regex = new RegExp('(' + escapeRegex(keyword) + ')', 'gi');
    snippet = escapeHtml(snippet).replace(regex, '<mark>$1</mark>');
    return snippet;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function doSearch(keyword) {
    keyword = keyword.trim();
    if (!keyword) {
      renderTree(state.manifest);
      highlightActive(state.currentPath);
      return;
    }

    // 1. 文件名匹配（精确优先）
    const keyLower = keyword.toLowerCase();
    const titleMatches = state.flatFiles.filter(function (f) {
      return (f.title || f.name || '').toLowerCase().indexOf(keyLower) !== -1 ||
             (f.path || '').toLowerCase().indexOf(keyLower) !== -1;
    });

    // 2. 全文匹配（如果 MiniSearch 可用）
    let contentMatches = [];
    if (state.searchIndex) {
      try {
        const results = state.searchIndex.search(keyword, { prefix: true, fuzzy: 0.2 });
        contentMatches = results.map(function (r) {
          const file = state.flatFiles.find(function (f) { return f.path === r.id; });
          if (!file) return null;
          return {
            file: file,
            snippet: highlightSnippet(file.content || '', keyword),
            score: r.score
          };
        }).filter(function (m) { return m !== null; });
      } catch (e) {
        console.error('搜索失败:', e);
      }
    }

    // 合并去重（文件名匹配优先）
    const titlePaths = new Set(titleMatches.map(function (f) { return f.path; }));
    const combined = titleMatches.map(function (f) {
      return { file: f, matchType: 'title', snippet: '' };
    });

    contentMatches.forEach(function (m) {
      if (!titlePaths.has(m.file.path)) {
        combined.push({ file: m.file, matchType: 'content', snippet: m.snippet });
      }
    });

    // 渲染结果
    dom.tree.innerHTML = '';
    if (combined.length === 0) {
      dom.tree.innerHTML = '<div class="tree__empty">没有匹配「' + escapeHtml(keyword) + '」的文档</div>';
      return;
    }

    combined.forEach(function (item) {
      const f = item.file;
      const kind = window.Viewers.kindOf(f.path);
      const row = document.createElement('div');
      row.className = 'node node--file';
      const inner = document.createElement('div');
      inner.className = 'node__row';
      inner.style.paddingLeft = '12px';
      inner.dataset.path = f.path;

      let html = fileBadge(kind) +
        '<span class="node__label" title="' + escapeHtml(f.path) + '">' +
        escapeHtml(f.title || f.name) + '</span>';

      // 内容匹配显示片段
      if (item.matchType === 'content' && item.snippet) {
        html += '<div class="search-snippet">' + item.snippet + '</div>';
      }

      inner.innerHTML = html;
      inner.addEventListener('click', function () {
        location.hash = '#' + encodeURI(f.path);
        closeDrawer();
      });
      row.appendChild(inner);
      dom.tree.appendChild(row);
    });
    highlightActive(state.currentPath);
  }

  let searchTimer = null;
  dom.search.addEventListener('input', function () {
    clearTimeout(searchTimer);
    const v = dom.search.value;
    searchTimer = setTimeout(function () { doSearch(v); }, 160);
  });

  /* ---------------- 标签筛选 ---------------- */
  function collectAllTags() {
    const tagSet = new Set();
    state.flatFiles.forEach(function (f) {
      if (f.tags && Array.isArray(f.tags)) {
        f.tags.forEach(function (t) { tagSet.add(t); });
      }
    });
    return Array.from(tagSet).sort();
  }

  function populateTagFilter() {
    const tags = collectAllTags();
    if (tags.length === 0) {
      dom.tagFilter.style.display = 'none';
      return;
    }
    dom.tagFilter.innerHTML = '<option value="">全部文档</option>';
    tags.forEach(function (tag) {
      const opt = document.createElement('option');
      opt.value = tag;
      opt.textContent = '# ' + tag;
      dom.tagFilter.appendChild(opt);
    });
  }

  function filterByTag(tag) {
    if (!tag) {
      // 清空筛选,显示完整树
      renderTree(state.manifest);
      highlightActive(state.currentPath);
      return;
    }
    // 筛选带该 tag 的文件
    const hits = state.flatFiles.filter(function (f) {
      return f.tags && f.tags.indexOf(tag) !== -1;
    });
    dom.tree.innerHTML = '';
    if (hits.length === 0) {
      dom.tree.innerHTML = '<div class="tree__empty">没有带标签 #' + escapeHtml(tag) + ' 的文档</div>';
      return;
    }
    hits.forEach(function (f) {
      const kind = window.Viewers.kindOf(f.path);
      const row = document.createElement('div');
      row.className = 'node node--file';
      const inner = document.createElement('div');
      inner.className = 'node__row';
      inner.style.paddingLeft = '12px';
      inner.dataset.path = f.path;
      const timeLabel = f.mtime ? '<span class="node__time">' + escapeHtml(formatTime(f.mtime)) + '</span>' : '';
      inner.innerHTML = fileBadge(kind) +
        '<span class="node__label" title="' + escapeHtml(f.path) + '">' +
        escapeHtml(f.title || f.name) + '</span>' + timeLabel;
      inner.addEventListener('click', function () {
        location.hash = '#' + encodeURI(f.path);
        closeDrawer();
      });
      row.appendChild(inner);
      dom.tree.appendChild(row);
    });
    highlightActive(state.currentPath);
  }

  if (dom.tagFilter) {
    dom.tagFilter.addEventListener('change', function () {
      const tag = dom.tagFilter.value;
      filterByTag(tag);
    });
  }

  /* ---------------- 导出 PDF ---------------- */
  function exportToPdf() {
    if (!state.currentPath) {
      alert('请先打开一篇文档');
      return;
    }

    // 设置打印前的文档标题（会显示在 PDF 元数据中）
    const originalTitle = document.title;
    const fileName = stripExt(state.currentPath.split('/').pop());
    document.title = fileName;

    // 触发浏览器打印对话框
    window.print();

    // 恢复原标题
    setTimeout(function () {
      document.title = originalTitle;
    }, 100);
  }

  if (dom.exportPdf) {
    dom.exportPdf.addEventListener('click', exportToPdf);
  }

  /* ---------------- 工具 ---------------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cssEscape(s) { return String(s).replace(/"/g, '\\"'); }
  function stripExt(s) { return String(s).replace(/\.[^.]+$/, ''); }

  /* ---------------- 时间格式化 ---------------- */
  function formatTime(mtime) {
    if (!mtime) return '';
    const now = Date.now();
    const diff = now - mtime * 1000; // mtime 是秒,转毫秒
    const day = 24 * 3600 * 1000;
    if (diff < day) return '今天';
    if (diff < 3 * day) return Math.floor(diff / day) + ' 天前';
    if (diff < 7 * day) return Math.floor(diff / day) + ' 天前';
    const d = new Date(mtime * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }

  /* ---------------- 站内链接解析(供 viewers.js 调用) ---------------- */
  // 规范化路径:去掉 ./ 和 ../,便于比较
  function normalizePath(p) {
    const parts = String(p).split('/');
    const out = [];
    for (const seg of parts) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') { out.pop(); continue; }
      out.push(seg);
    }
    return out.join('/');
  }

  // 解析链接目标 → { path, title } | null
  // 支持三种匹配:1) 完整/相对路径  2) 文件名(带扩展名)  3) wiki 标题(无扩展名)
  function resolveLink(target) {
    if (!target || !state.flatFiles.length) return null;
    const norm = normalizePath(target);
    const normLower = norm.toLowerCase();

    // 1) 路径完全匹配(去掉可能的 docs/ 前缀差异)
    let hit = state.flatFiles.find(function (f) {
      const fp = f.path.toLowerCase();
      return fp === normLower || fp === 'docs/' + normLower || 'docs/' + fp === normLower;
    });
    if (hit) return { path: hit.path, title: hit.title || hit.name };

    // 2) 文件名匹配(target 可能只写了文件名)
    const baseName = norm.split('/').pop().toLowerCase();
    hit = state.flatFiles.find(function (f) {
      return (f.name || '').toLowerCase() === baseName;
    });
    if (hit) return { path: hit.path, title: hit.title || hit.name };

    // 3) wiki 标题匹配(无扩展名,匹配 title 或去前缀去扩展名的文件名)
    const targetNoExt = stripExt(baseName);
    hit = state.flatFiles.find(function (f) {
      const title = (f.title || '').toLowerCase();
      const nameNoExt = stripExt((f.name || '').toLowerCase());
      // 去掉排序前缀(如 20260701_ 或 01_)后再比
      const nameClean = nameNoExt.replace(/^\d+[_\-\.\s]+/, '');
      return title === targetNoExt || nameNoExt === targetNoExt || nameClean === targetNoExt;
    });
    if (hit) return { path: hit.path, title: hit.title || hit.name };

    return null;
  }

  // 暴露给 viewers.js
  window.KB = window.KB || {};
  window.KB.resolveLink = resolveLink;


  /* ---------------- 本地模式:探测 / SSE / API ---------------- */
  async function detectMode() {
    try {
      const resp = await fetch('/api/status', { cache: 'no-store' });
      if (!resp.ok) throw new Error('status ' + resp.status);
      const info = await resp.json();
      state.mode = info.mode || 'preview';
      state.features = info.features || [];
    } catch (e) {
      state.mode = 'preview';
    }
    applyModeToUI();
  }

  function applyModeToUI() {
    document.documentElement.setAttribute('data-mode', state.mode);
    if (dom.modeBadge) {
      dom.modeBadge.style.display = state.mode === 'local' ? 'inline-flex' : 'none';
    }
    if (dom.uploadBtn) {
      dom.uploadBtn.style.display = state.mode === 'local' ? 'grid' : 'none';
    }
  }

  function subscribeEvents() {
    if (state.mode !== 'local' || !('EventSource' in window)) return;
    try {
      const es = new EventSource('/api/events');
      state.sse = es;
      es.addEventListener('manifest-updated', async () => {
        // 目录变化,重新拉取 + 重渲染
        const m = await loadManifest();
        if (m) {
          state.manifest = m;
          state.flatFiles = flatten(m, []);
          dom.fileCount.textContent = state.flatFiles.length + ' 篇';
          const kw = dom.search.value.trim();
          if (kw) doSearch(kw); else renderTree(m);
          highlightActive(state.currentPath);
        }
      });
      es.onerror = () => {
        // 服务重启时会短暂断开,EventSource 自动重连
      };
    } catch (e) {
      console.warn('SSE 订阅失败:', e);
    }
  }

  async function deleteFile(filePath, displayName) {
    if (!confirm('确定删除「' + (displayName || filePath) + '」?此操作不可撤销。')) return;
    try {
      const resp = await fetch('/api/file?path=' + encodeURIComponent(filePath), { method: 'DELETE' });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || '删除失败');
      // 如果当前打开的就是被删的文件,回到欢迎页
      if (state.currentPath === filePath) location.hash = '';
      // SSE 会推 manifest-updated,树自动刷新
    } catch (e) {
      alert('删除失败:' + e.message);
    }
  }

  async function uploadFiles(files, targetDir) {
    if (!files || !files.length) return;
    for (const f of files) {
      const form = new FormData();
      form.append('targetDir', targetDir || '');
      form.append('file', f);
      try {
        const resp = await fetch('/api/upload', { method: 'POST', body: form });
        const j = await resp.json();
        if (!resp.ok) throw new Error(j.error || '上传失败');
      } catch (e) {
        alert('上传「' + f.name + '」失败:' + e.message);
      }
    }
  }

  /* ---------------- 启动 ---------------- */
  async function init() {
    initTheme();
    initCollapsed();
    initSidebarWidth();
    await detectMode();

    // 绑定上传(本地模式生效)
    if (dom.uploadBtn && dom.uploadInput) {
      dom.uploadBtn.addEventListener('click', () => dom.uploadInput.click());
      dom.uploadInput.addEventListener('change', async (e) => {
        await uploadFiles(e.target.files, '');
        dom.uploadInput.value = ''; // 允许重复上传同名文件
      });
    }

    state.manifest = await loadManifest();

    if (!state.manifest) {
      dom.tree.innerHTML =
        '<div class="tree__empty">无法加载目录清单<br><br>' +
        '请双击项目根目录的<br><b>「启动.bat」</b><br>通过本地服务打开</div>';
      dom.content.innerHTML =
        '<div class="state state--error"><div style="font-size:32px">⚠️</div>' +
        '<div>未能读取 manifest.json。<br>直接双击 index.html 时浏览器会因安全限制无法读取本地文件。<br>' +
        '请改用项目根目录的「启动.bat」启动本地服务后访问。</div></div>';
      return;
    }

    state.flatFiles = flatten(state.manifest, []);
    dom.fileCount.textContent = state.flatFiles.length + ' 篇';
    renderTree(state.manifest);
    populateTagFilter(); // 填充标签下拉
    initSearchIndex();   // 初始化全文搜索索引

    window.addEventListener('hashchange', onRoute);
    onRoute();

    // 本地模式下订阅 SSE,自动刷新目录
    subscribeEvents();
  }

  init();
})();

