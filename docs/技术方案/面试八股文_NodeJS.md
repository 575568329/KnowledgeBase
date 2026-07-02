# Node.js 面试八股文 (2026)

> 更新时间:2026-07-01
> 适用版本:Node.js 20/22 LTS
> 关键词:异步编程 · 事件循环 · Stream · 性能优化

---

## 一、核心概念

### 1. Node.js 是什么?

**定义**:基于 Chrome V8 引擎的 JavaScript 运行时,用于构建高性能服务端应用。

**核心特点**:
- 单线程 + 事件驱动 + 非阻塞 I/O
- 适合 I/O 密集型(API服务/实时通信),不适合 CPU 密集型
- npm 生态(200万+包)

**应用场景**:
- RESTful API 服务
- 实时通信(WebSocket/SSE)
- 微服务
- 构建工具(Webpack/Vite)
- Serverless 函数

### 2. 事件循环(Event Loop)

**六个阶段**:

```
   ┌───────────────────────────┐
┌─>│        timers             │  setTimeout/setInterval
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │  系统级回调(TCP错误等)
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │  内部使用
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │  I/O 回调(fs/net)
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │          check            │  setImmediate
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──│      close callbacks      │  socket.on('close')
   └───────────────────────────┘
```

**微任务(Microtask)**:每个阶段结束后立即执行。
- `process.nextTick`(最高优先级)
- `Promise.then/catch/finally`

**执行顺序**:

```js
console.log('1')

setTimeout(() => console.log('2'), 0)
setImmediate(() => console.log('3'))

process.nextTick(() => console.log('4'))
Promise.resolve().then(() => console.log('5'))

console.log('6')

// 输出:1 → 6 → 4 → 5 → 2 → 3
// (nextTick > Promise > setTimeout > setImmediate)
```

### 3. 模块系统

**CommonJS vs ESM**:

| 特性 | CommonJS | ESM |
|------|----------|-----|
| 语法 | `require()` / `module.exports` | `import` / `export` |
| 加载时机 | 运行时(动态) | 编译时(静态) |
| 缓存 | 缓存值的拷贝 | 缓存值的引用 |
| 异步 | 同步加载 | 异步加载 |
| 树摇 | ❌ | ✅ |
| 循环依赖 | 返回部分导出 | 抛出错误(需 TDZ) |

```js
// CommonJS
const fs = require('fs')
module.exports = { foo }

// ESM
import fs from 'fs'
export { foo }
```

**ESM 在 Node.js 中启用**:
- `package.json` 中 `"type": "module"`
- 文件扩展名 `.mjs`

### 4. Stream(流)

**四种类型**:
- Readable:可读流(fs.createReadStream)
- Writable:可写流(fs.createWriteStream)
- Duplex:双工流(net.Socket)
- Transform:转换流(zlib.createGzip)

**为什么用 Stream**:
- 内存效率:不需要一次性加载整个文件
- 时间效率:边读边处理,无需等待全部数据

```js
const fs = require('fs')

// ❌ 读取 1GB 文件(内存占用 1GB)
const data = fs.readFileSync('big.txt')

// ✅ 用 Stream(内存占用 64KB 块)
fs.createReadStream('big.txt')
  .pipe(transformStream)
  .pipe(fs.createWriteStream('output.txt'))
```

---

## 二、异步编程

### 1. 回调地狱 → Promise → async/await

```js
// 回调地狱
fs.readFile('1.txt', (err, data1) => {
  if (err) throw err
  fs.readFile('2.txt', (err, data2) => {
    if (err) throw err
    fs.readFile('3.txt', (err, data3) => {
      console.log(data1, data2, data3)
    })
  })
})

// Promise 链
readFilePromise('1.txt')
  .then(data1 => readFilePromise('2.txt'))
  .then(data2 => readFilePromise('3.txt'))
  .catch(err => console.error(err))

// async/await(推荐)
try {
  const data1 = await readFilePromise('1.txt')
  const data2 = await readFilePromise('2.txt')
  const data3 = await readFilePromise('3.txt')
} catch (err) {
  console.error(err)
}
```

### 2. 并发控制

```js
// Promise.all:全部成功才成功,任一失败就失败
const [users, posts] = await Promise.all([
  fetchUsers(),
  fetchPosts()
])

// Promise.allSettled:等待全部完成,不管成功失败
const results = await Promise.allSettled([
  fetchUsers(),
  fetchPosts()
])

// Promise.race:返回最快的结果
const fastest = await Promise.race([
  fetch('api1'),
  fetch('api2')
])
```

---

## 三、高频面试题

### Q1: Node.js 单线程如何处理并发?

**单线程**指 JavaScript 执行线程,但底层 libuv 有线程池(默认4个线程)处理 I/O。

**工作流程**:
1. JS 发起异步 I/O(fs/net)
2. libuv 分配给线程池执行
3. I/O 完成后,回调进入事件队列
4. 事件循环取出回调,交给 JS 线程执行

### Q2: process.nextTick vs setImmediate

| | process.nextTick | setImmediate |
|---|---|---|
| 执行时机 | 当前阶段结束立即执行(微任务) | check 阶段执行 |
| 优先级 | 最高 | 低于 nextTick |
| 场景 | 尽快执行(错误处理/初始化) | I/O 后的回调 |

```js
setTimeout(() => console.log('setTimeout'), 0)
setImmediate(() => console.log('setImmediate'))
process.nextTick(() => console.log('nextTick'))

// 输出:nextTick → setTimeout → setImmediate
```

### Q3: Buffer 是什么?

**定义**:Node.js 处理二进制数据的类(类似 Uint8Array)。

```js
// 创建 Buffer
const buf1 = Buffer.from('hello')  // 从字符串
const buf2 = Buffer.alloc(10)      // 分配 10 字节(填充0)
const buf3 = Buffer.allocUnsafe(10) // 不初始化(快但不安全)

// 读写
buf1[0] = 0x48  // H
console.log(buf1.toString())  // hello
```

### Q4: Cluster 模块如何实现多进程?

**Master-Worker 模式**:

```js
const cluster = require('cluster')
const http = require('http')
const os = require('os')

if (cluster.isMaster) {
  const cpus = os.cpus().length
  for (let i = 0; i < cpus; i++) {
    cluster.fork()  // 启动 Worker
  }
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.id} died`)
    cluster.fork()  // 自动重启
  })
} else {
  http.createServer((req, res) => {
    res.end('Hello')
  }).listen(8000)
}
```

**负载均衡**:Master 监听端口,分发请求给 Worker(Round Robin)。

### Q5: 如何防止内存泄漏?

**常见原因**:
1. **全局变量**:挂在 global 上未清理
2. **闭包**:持有外部作用域引用
3. **定时器未清理**:`setInterval` 不 `clearInterval`
4. **事件监听器**:不 `removeListener`
5. **缓存无限增长**:没有 LRU 机制

**监控工具**:
- `process.memoryUsage()`:查看内存使用
- `--inspect`:Chrome DevTools 分析堆快照
- `clinic.js`:诊断性能问题

---

## 四、性能优化

### 1. 缓存策略

```js
const NodeCache = require('node-cache')
const cache = new NodeCache({ stdTTL: 600 })  // 10分钟

async function getUser(id) {
  const cached = cache.get(id)
  if (cached) return cached
  
  const user = await db.users.findById(id)
  cache.set(id, user)
  return user
}
```

### 2. 数据库连接池

```js
const { Pool } = require('pg')
const pool = new Pool({
  max: 20,  // 最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
})

const result = await pool.query('SELECT * FROM users')
```

### 3. 压缩响应

```js
const compression = require('compression')
app.use(compression())  // gzip
```

### 4. Worker Threads(CPU 密集)

```js
const { Worker } = require('worker_threads')

function runTask(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./worker.js', { workerData: data })
    worker.on('message', resolve)
    worker.on('error', reject)
  })
}

const result = await runTask({ num: 1000000 })
```

---

## 五、实战场景

### 场景1:文件上传(Stream)

```js
const express = require('express')
const multer = require('multer')
const fs = require('fs')

const storage = multer.diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ filename: req.file.filename })
})
```

### 场景2:JWT 认证

```js
const jwt = require('jsonwebtoken')

// 生成 Token
const token = jwt.sign({ userId: 123 }, 'secret', { expiresIn: '1h' })

// 验证中间件
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).send('Unauthorized')
  
  try {
    const payload = jwt.verify(token, 'secret')
    req.user = payload
    next()
  } catch (err) {
    res.status(401).send('Invalid token')
  }
}
```

### 场景3:限流(防爬虫)

```js
const rateLimit = require('express-rate-limit')

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15分钟
  max: 100,  // 最多 100 次请求
  message: 'Too many requests'
})

app.use('/api/', limiter)
```

### 场景4:WebSocket 实时通信

```js
const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 8080 })

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    // 广播给所有客户端
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    })
  })
})
```

---

## 参考资料

- [Node.js 官方文档](https://nodejs.org/docs/)
- [深入理解 Node.js 事件循环](https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/)
- [Stream 手册](https://nodejs.org/api/stream.html)
