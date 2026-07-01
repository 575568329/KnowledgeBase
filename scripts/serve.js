// 零依赖 Node 静态服务器 + 本地增强 API
// 用法: node scripts/serve.js [port]
//
// 静态文件:  GET  /**
// 本地 API:  GET  /api/status         - 探测本地模式
//           GET  /api/events         - SSE 推送 docs/ 变化
//           POST /api/upload         - multipart 上传文件到 docs/
//           DELETE /api/file?path=X  - 删除 docs/ 内文件
//
// 所有 API 严格校验路径必须在 docs/ 内(防目录穿越)
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { execFile } = require('child_process');

const PORT = parseInt(process.argv[2] || process.env.PORT || 8850, 10);
const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp', '.ico': 'image/x-icon',
};

// ---------- SSE 客户端集合 + docs/ 监听 ----------
const sseClients = new Set();
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch {}
  }
}

// 重新生成 manifest(调用 PS 脚本)
let manifestRegenTimer = null;
function regenerateManifest() {
  clearTimeout(manifestRegenTimer);
  manifestRegenTimer = setTimeout(() => {
    const ps = path.join(__dirname, 'generate-manifest.ps1');
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps],
      { cwd: ROOT, windowsHide: true },
      (err) => {
        if (err) console.error('[manifest]', err.message);
        else broadcast('manifest-updated', { at: Date.now() });
      }
    );
  }, 300); // 300ms debounce, 合并连续文件变化
}

// 监听 docs/ 目录(递归)
function watchDocs() {
  if (!fs.existsSync(DOCS)) fs.mkdirSync(DOCS, { recursive: true });
  try {
    fs.watch(DOCS, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      // 忽略临时文件
      if (/(^|[\\/])\.(swp|tmp|~)|~$/.test(filename)) return;
      regenerateManifest();
    });
    console.log('[watch] 监听 docs/ 变化中...');
  } catch (e) {
    console.warn('[watch] fs.watch 失败:', e.message);
  }
}

// ---------- 工具:安全解析 docs 内路径 ----------
// 返回 null 表示路径不合法(在 docs 外)
function resolveDocsPath(relPath) {
  // 允许空字符串(表示 docs 根目录),但不允许 null/undefined
  if (relPath === null || relPath === undefined || typeof relPath !== 'string') return null;
  // 去掉前导 / 和 docs/
  const clean = relPath.replace(/^\/+/, '').replace(/^docs\/+/, '');
  const full = path.resolve(DOCS, clean);
  // 必须在 docs 内(等于 DOCS 本身也允许,用于上传到根目录)
  if (full !== DOCS && !full.startsWith(DOCS + path.sep)) return null;
  return full;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ---------- API: /api/status ----------
function handleStatus(req, res) {
  sendJson(res, 200, {
    mode: 'local',
    version: '1.0',
    docsRoot: 'docs',
    features: ['watch', 'upload', 'delete'],
  });
}

// ---------- API: /api/events (SSE) ----------
function handleEvents(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: hello\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
  sseClients.add(res);
  // 心跳,防中间设备关闭空闲连接
  const hb = setInterval(() => {
    try { res.write(': hb\n\n'); } catch {}
  }, 25000);
  req.on('close', () => {
    clearInterval(hb);
    sseClients.delete(res);
  });
}

// ---------- API: DELETE /api/file?path=... ----------
function handleDelete(req, res) {
  const q = url.parse(req.url, true).query;
  const target = resolveDocsPath(q.path);
  if (!target) return sendJson(res, 400, { error: 'invalid path' });
  fs.stat(target, (err, stat) => {
    if (err) return sendJson(res, 404, { error: 'not found' });
    if (!stat.isFile()) return sendJson(res, 400, { error: 'not a file' });
    fs.unlink(target, (uerr) => {
      if (uerr) return sendJson(res, 500, { error: uerr.message });
      // fs.watch 会自动触发 manifest 重生 + SSE 广播
      sendJson(res, 200, { ok: true, path: q.path });
    });
  });
}

// ---------- API: POST /api/upload (multipart/form-data) ----------
// 极简 multipart 解析:只处理单文件字段 + 一个 targetDir 字段
function handleUpload(req, res) {
  const contentType = req.headers['content-type'] || '';
  const m = /boundary=([^;]+)/.exec(contentType);
  if (!m) return sendJson(res, 400, { error: 'missing multipart boundary' });
  const boundary = Buffer.from('--' + m[1].trim());

  const chunks = [];
  let total = 0;
  const MAX = 100 * 1024 * 1024; // 100MB 上限
  req.on('data', (c) => {
    total += c.length;
    if (total > MAX) {
      req.destroy();
      return sendJson(res, 413, { error: 'file too large' });
    }
    chunks.push(c);
  });
  req.on('end', () => {
    try {
      const buf = Buffer.concat(chunks);
      const parts = splitMultipart(buf, boundary);
      let targetDir = '';
      let file = null;
      for (const p of parts) {
        const name = /name="([^"]+)"/.exec(p.header);
        if (!name) continue;
        if (name[1] === 'targetDir') {
          targetDir = p.body.toString('utf8').trim();
        } else if (name[1] === 'file') {
          const fnm = /filename="([^"]+)"/.exec(p.header);
          if (fnm) file = { name: fnm[1], data: p.body };
        }
      }
      if (!file) return sendJson(res, 400, { error: 'no file field' });

      // 目标路径 = docs/{targetDir}/{filename}
      const dirFull = resolveDocsPath(targetDir || '');
      if (!dirFull) return sendJson(res, 400, { error: 'invalid targetDir' });
      // 文件名安全化
      const safeName = path.basename(file.name).replace(/[\\/:*?"<>|]/g, '_');
      const dest = path.join(dirFull, safeName);
      if (!dest.startsWith(DOCS)) return sendJson(res, 400, { error: 'path escapes docs' });

      fs.mkdirSync(dirFull, { recursive: true });
      fs.writeFile(dest, file.data, (werr) => {
        if (werr) return sendJson(res, 500, { error: werr.message });
        const rel = path.relative(ROOT, dest).replace(/\\/g, '/');
        sendJson(res, 200, { ok: true, path: rel });
      });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
  });
}

// 极简 multipart 分段器
function splitMultipart(buf, boundary) {
  const parts = [];
  let start = buf.indexOf(boundary);
  if (start < 0) return parts;
  start += boundary.length + 2; // 跳过 \r\n
  while (start < buf.length) {
    const next = buf.indexOf(boundary, start);
    if (next < 0) break;
    const seg = buf.slice(start, next - 2); // -2 去掉尾部 \r\n
    const hdrEnd = seg.indexOf('\r\n\r\n');
    if (hdrEnd > 0) {
      const header = seg.slice(0, hdrEnd).toString('utf8');
      const body = seg.slice(hdrEnd + 4);
      parts.push({ header, body });
    }
    start = next + boundary.length + 2;
  }
  return parts;
}

// ---------- 静态文件服务 ----------
function handleStatic(req, res) {
  try {
    let rel = decodeURIComponent(url.parse(req.url).pathname).replace(/^\/+/, '');
    if (!rel || rel.endsWith('/')) rel += 'index.html';

    const full = path.resolve(ROOT, rel);
    if (!full.startsWith(ROOT)) {
      res.writeHead(403); return res.end('Forbidden');
    }
    fs.stat(full, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404 Not Found: ' + rel);
      }
      const ext = path.extname(full).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(full).pipe(res);
    });
  } catch (e) {
    console.error('[static]', e.message);
    try { res.writeHead(500); res.end('Server Error: ' + e.message); } catch {}
  }
}

// ---------- 主路由 ----------
const server = http.createServer((req, res) => {
  const u = url.parse(req.url).pathname || '/';
  // API 路由
  if (u === '/api/status') return handleStatus(req, res);
  if (u === '/api/events') return handleEvents(req, res);
  if (u === '/api/file' && req.method === 'DELETE') return handleDelete(req, res);
  if (u === '/api/upload' && req.method === 'POST') return handleUpload(req, res);
  // 其余走静态
  handleStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  const addr = `http://localhost:${PORT}/`;
  console.log('======================================================');
  console.log('  知识库已启动: ' + addr + 'index.html');
  console.log('  本地模式: 支持上传/删除/自动刷新');
  console.log('  按 Ctrl+C 停止服务');
  console.log('======================================================');
  watchDocs();
});

server.on('error', (e) => {
  console.error('[启动失败]', e.message);
  if (e.code === 'EADDRINUSE') {
    console.error('端口 ' + PORT + ' 被占用,请换个端口: node scripts/serve.js 8860');
  }
  process.exit(1);
});
