/* ============================================================
 * viewers.js — 各格式预览器
 * 对外暴露 window.Viewers，按文件类型分发渲染
 * ============================================================ */
(function () {
  'use strict';

  // ---------- 配置第三方库 ----------
  // PDF.js worker 路径（相对入口 index.html）
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/vendor/pdfjs/pdf.worker.min.js';
  }

  // marked（v12：highlight 选项已移除，改为渲染后用 hljs 处理 DOM）
  if (window.marked) {
    window.marked.setOptions({
      gfm: true,
      breaks: false
    });
  }

  // 对容器内的代码块应用 highlight.js（mermaid 代码块跳过）
  function highlightCodeBlocks(root) {
    if (!window.hljs) return;
    root.querySelectorAll('pre code').forEach(function (block) {
      if (/\blanguage-mermaid\b|\blang-mermaid\b/.test(block.className)) return;
      try { window.hljs.highlightElement(block); } catch (e) {}
    });
  }

  // ---------- 站内链接处理 ----------
  // app.js 会注入 window.KB.resolveLink(target) -> { path, title } | null
  // 用于把 [[wiki]] 或相对 md 链接解析为知识库内的真实文档

  // 把 [[标题]] / [[标题|显示文字]] 转成标准 md 链接 [显示文字](kb://标题)
  // 使用 kb:// 伪协议,渲染后再统一处理成站内跳转
  function preprocessWikiLinks(text) {
    return text.replace(/\[\[([^\]]+)\]\]/g, function (_, inner) {
      const parts = inner.split('|');
      const target = parts[0].trim();
      const label = (parts[1] || parts[0]).trim();
      return '[' + label + '](kb://' + encodeURIComponent(target) + ')';
    });
  }

  // 渲染后处理所有 <a>:站内链接转 hash 跳转,外部链接开新标签
  function processLinks(root, baseDir) {
    const resolve = (window.KB && window.KB.resolveLink) || function () { return null; };
    root.querySelectorAll('a[href]').forEach(function (a) {
      const href = a.getAttribute('href') || '';

      // 1) 外部链接:开新标签
      if (/^(https?:)?\/\//.test(href) || href.startsWith('mailto:')) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        a.classList.add('doc-link', 'doc-link--external');
        return;
      }

      // 2) 纯锚点(#section):页内跳转,不处理
      if (href.startsWith('#')) return;

      // 3) wiki 伪协议 kb://标题
      let target = null;
      if (href.startsWith('kb://')) {
        target = decodeURIComponent(href.slice(5));
      } else if (!href.startsWith('/') && !href.startsWith('data:')) {
        // 4) 相对链接:相对于当前 md 所在目录解析
        target = baseDir + href;
      }
      if (target === null) return;

      const hit = resolve(target);
      if (hit && hit.path) {
        a.classList.add('doc-link');
        a.setAttribute('href', '#' + encodeURI(hit.path));
        a.setAttribute('data-kb-path', hit.path);
        a.setAttribute('title', hit.title || hit.path);
      } else {
        // 解析不到:标记失效链接
        a.classList.add('doc-link', 'doc-link--broken');
        a.setAttribute('title', '未找到链接目标:' + target);
        a.removeAttribute('href');
      }
    });
  }

  let mermaidReady = false;
  function initMermaid(dark) {
    if (!window.mermaid) return;
    window.mermaid.initialize({
      startOnLoad: false,
      theme: dark ? 'dark' : 'default',
      securityLevel: 'loose'
    });
    mermaidReady = true;
  }

  // ---------- 工具函数 ----------
  function el(html) {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  function showState(container, type, message) {
    const cls = type === 'error' ? 'state state--error' : 'state';
    const inner = type === 'loading'
      ? '<div class="spinner"></div>'
      : '<div style="font-size:32px">' + (type === 'error' ? '⚠️' : 'ℹ️') + '</div>';
    container.innerHTML = '<div class="' + cls + '">' + inner +
      '<div>' + escapeHtml(message) + '</div></div>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 解析失败时统一抛出可读错误
  async function fetchFile(path) {
    let resp;
    try {
      resp = await fetch(encodeURI(path));
    } catch (e) {
      throw new Error('无法读取文件，可能未通过本地服务打开（请双击「启动.bat」）。');
    }
    if (!resp.ok) throw new Error('文件加载失败：HTTP ' + resp.status);
    return resp;
  }

  // ---------- Markdown ----------
  async function renderMarkdown(container, path, opts) {
    showState(container, 'loading', '正在渲染文档…');
    const resp = await fetchFile(path);
    const text = await resp.text();

    const card = el('<article class="doc-card"><div class="markdown"></div></article>');
    const body = card.querySelector('.markdown');
    // 先把 [[wiki 链接]] 转成 kb:// 伪协议链接,再交给 marked
    body.innerHTML = window.marked.parse(preprocessWikiLinks(text));
    // 修正相对图片路径，使其相对于 md 文件所在目录
    const baseDir = path.replace(/[^/]*$/, '');
    body.querySelectorAll('img').forEach(function (img) {
      const src = img.getAttribute('src') || '';
      if (src && !/^(https?:)?\/\//.test(src) && !src.startsWith('data:') && !src.startsWith('/')) {
        img.src = baseDir + src;
      }
    });

    // 处理站内链接(wiki 链接 / 相对 md 链接 → hash 跳转)
    processLinks(body, baseDir);

    // 渲染 mermaid 代码块
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    initMermaid(dark);
    const mblocks = body.querySelectorAll('code.language-mermaid, code.lang-mermaid');
    if (mblocks.length && window.mermaid) {
      let i = 0;
      for (const code of mblocks) {
        const pre = code.closest('pre') || code;
        const holder = document.createElement('div');
        holder.className = 'mermaid';
        try {
          const id = 'mmd-' + Date.now() + '-' + (i++);
          const out = await window.mermaid.render(id, code.textContent);
          holder.innerHTML = out.svg;
          pre.replaceWith(holder);
        } catch (e) {
          // 渲染失败保留原始代码块，不阻断整篇
        }
      }
    }

    // 高亮剩余代码块（mermaid 已被替换，不会命中）
    highlightCodeBlocks(body);

    container.innerHTML = '';
    container.appendChild(card);
  }

  // ---------- PDF ----------
  async function renderPdf(container, path) {
    if (!window.pdfjsLib) { showState(container, 'error', 'PDF 组件未加载'); return; }
    showState(container, 'loading', '正在加载 PDF…');
    const resp = await fetchFile(path);
    const data = await resp.arrayBuffer();

    const pdf = await window.pdfjsLib.getDocument({ data: data }).promise;
    const wrap = el('<div class="doc-card doc-card--wide"><div class="pdf-viewer"></div></div>');
    const viewer = wrap.querySelector('.pdf-viewer');
    container.innerHTML = '';
    container.appendChild(wrap);

    const scale = Math.min(2, (window.devicePixelRatio || 1) * 1.3);
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: scale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = (viewport.width / scale) + 'px';
      viewer.appendChild(canvas);
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    }
  }

  // ---------- Word (.docx) ----------
  async function renderDocx(container, path) {
    if (!window.docx) { showState(container, 'error', 'Word 预览组件未加载'); return; }
    showState(container, 'loading', '正在渲染 Word 文档…');
    const resp = await fetchFile(path);
    const blob = await resp.blob();

    const wrap = el('<div class="docx-wrapper"></div>');
    container.innerHTML = '';
    container.appendChild(wrap);
    await window.docx.renderAsync(blob, wrap, null, {
      className: 'docx',
      inWrapper: true,
      ignoreWidth: false,
      breakPages: true
    });
  }

  // ---------- 图片 ----------
  async function renderImage(container, path, opts) {
    const name = (opts && opts.name) || path.split('/').pop();
    container.innerHTML =
      '<div class="doc-card"><figure class="img-viewer">' +
      '<img src="' + encodeURI(path) + '" alt="' + escapeHtml(name) + '" />' +
      '<figcaption>' + escapeHtml(name) + '</figcaption>' +
      '</figure></div>';
  }

  // ---------- HTML 网页 ----------
  async function renderHtml(container, path) {
    // 用 iframe 直接渲染整页网页，保证样式/脚本隔离
    const wrap = el('<div class="html-viewer"></div>');
    const iframe = document.createElement('iframe');
    iframe.className = 'html-frame';
    iframe.src = encodeURI(path);
    // 允许脚本运行（同源本地服务下安全），便于预览交互网页
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
    wrap.appendChild(iframe);
    container.innerHTML = '';
    container.appendChild(wrap);
  }

  // ---------- 类型判定 + 分发 ----------
  function extOf(path) {
    const m = /\.([^.\/]+)$/.exec(path);
    return m ? m[1].toLowerCase() : '';
  }

  const IMG_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];

  function kindOf(path) {
    const e = extOf(path);
    if (e === 'md' || e === 'markdown') return 'md';
    if (e === 'pdf') return 'pdf';
    if (e === 'docx') return 'docx';
    if (e === 'html' || e === 'htm') return 'html';
    if (IMG_EXTS.indexOf(e) !== -1) return 'img';
    return 'unknown';
  }

  async function render(container, path, opts) {
    opts = opts || {};
    const kind = kindOf(path);
    try {
      if (kind === 'md') await renderMarkdown(container, path, opts);
      else if (kind === 'pdf') await renderPdf(container, path);
      else if (kind === 'docx') await renderDocx(container, path);
      else if (kind === 'html') await renderHtml(container, path);
      else if (kind === 'img') await renderImage(container, path, opts);
      else showState(container, 'error', '暂不支持预览该格式：' + extOf(path));
    } catch (e) {
      showState(container, 'error', (e && e.message) || '渲染出错');
    }
  }

  window.Viewers = { render: render, kindOf: kindOf, extOf: extOf };
})();

