# Next.js 面试八股文 (2026)

> 更新时间:2026-07-01
> 适用版本:Next.js 14/15(App Router)
> 关键词:SSR · RSC · App Router · 性能优化

---

## 一、核心概念

### 1. Next.js 是什么?

**定义**:React 全栈框架,提供 SSR/SSG/ISR/RSC 等渲染模式。

**核心能力**:
- **多种渲染模式**:SSR/SSG/ISR/CSR
- **文件路由**:约定式路由(`pages/`或`app/`)
- **API 路由**:后端 API endpoint
- **自动代码分割**:按路由拆分
- **图片优化**:`next/image`
- **RSC(Server Components)**:服务端组件

**与 CRA 对比**:

| 特性 | CRA | Next.js |
|------|-----|---------|
| 渲染 | 纯 CSR | SSR/SSG/ISR |
| 路由 | 需装 react-router | 内置文件路由 |
| API | 需单独后端 | 内置 API Routes |
| SEO | 差 | 优(服务端渲染) |
| 首屏性能 | 慢 | 快(服务端直出) |

### 2. 渲染模式

**SSR(Server-Side Rendering)**:每次请求服务端渲染。

```tsx
// app/page.tsx
export default async function Page() {
  const data = await fetch('https://api.example.com/data', {
    cache: 'no-store'  // 每次重新获取
  })
  return <div>{data}</div>
}
```

**SSG(Static Site Generation)**:构建时预渲染。

```tsx
export default async function Page() {
  const data = await fetch('https://api.example.com/data', {
    cache: 'force-cache'  // 构建时缓存
  })
  return <div>{data}</div>
}
```

**ISR(Incremental Static Regeneration)**:定时重新生成静态页面。

```tsx
export default async function Page() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 60 }  // 60秒后重新验证
  })
  return <div>{data}</div>
}
```

**CSR(Client-Side Rendering)**:客户端渲染(use client)。

```tsx
'use client'
import { useState, useEffect } from 'react'

export default function Page() {
  const [data, setData] = useState(null)
  
  useEffect(() => {
    fetch('/api/data').then(res => res.json()).then(setData)
  }, [])
  
  return <div>{data}</div>
}
```

---

## 二、App Router(Next.js 13+)

### 1. 文件路由约定

```
app/
├── page.tsx              → /
├── about/page.tsx        → /about
├── blog/[slug]/page.tsx  → /blog/:slug
├── dashboard/
│   ├── layout.tsx        → 嵌套布局
│   └── page.tsx          → /dashboard
└── api/
    └── users/route.ts    → API /api/users
```

**特殊文件**:

| 文件 | 作用 |
|------|------|
| `layout.tsx` | 共享布局(不重新渲染) |
| `page.tsx` | 页面(路由入口) |
| `loading.tsx` | 加载状态(Suspense fallback) |
| `error.tsx` | 错误边界 |
| `not-found.tsx` | 404 页面 |
| `template.tsx` | 布局(每次重新渲染) |

### 2. 服务端组件(RSC)

**默认服务端组件**:

```tsx
// app/page.tsx (默认服务端)
export default async function Page() {
  // 可直接访问数据库
  const users = await db.user.findMany()
  
  return (
    <div>
      {users.map(user => <UserCard key={user.id} user={user} />)}
    </div>
  )
}
```

**优势**:
- 零客户端 JS
- 直接访问后端资源(数据库/文件系统)
- 自动代码分割
- 更好的安全性(API 密钥不暴露)

**限制**:
- 不能用 `useState/useEffect/onClick`
- 不能用浏览器 API

**客户端组件**(交互时需要):

```tsx
'use client'  // 标记为客户端组件

export default function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

### 3. 数据获取

**服务端组件(推荐)**:

```tsx
async function getData() {
  const res = await fetch('https://api.example.com/data', {
    cache: 'force-cache',  // 默认,SSG
    // cache: 'no-store',  // SSR
    // next: { revalidate: 60 }  // ISR
  })
  return res.json()
}

export default async function Page() {
  const data = await getData()
  return <div>{data}</div>
}
```

**客户端组件**(SWR/React Query):

```tsx
'use client'
import useSWR from 'swr'

export default function Page() {
  const { data, error } = useSWR('/api/data', fetcher)
  
  if (error) return <div>failed to load</div>
  if (!data) return <div>loading...</div>
  return <div>{data}</div>
}
```

### 4. 路由组(Route Groups)

```
app/
├── (marketing)/
│   ├── about/page.tsx    → /about(不含 marketing)
│   └── layout.tsx        → 共享布局
└── (shop)/
    ├── products/page.tsx → /products
    └── layout.tsx
```

括号路径**不影响 URL**,仅用于组织。

### 5. 并行路由(Parallel Routes)

```
app/
└── dashboard/
    ├── @analytics/page.tsx
    ├── @revenue/page.tsx
    └── layout.tsx
```

```tsx
// layout.tsx
export default function Layout({
  children,
  analytics,
  revenue
}: {
  children: React.ReactNode
  analytics: React.ReactNode
  revenue: React.ReactNode
}) {
  return (
    <>
      {children}
      {analytics}
      {revenue}
    </>
  )
}
```

**应用**:同时渲染多个页面(Dashboard 多面板)。

---

## 三、API Routes

### 1. Route Handlers(App Router)

```ts
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const users = await db.user.findMany()
  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const user = await db.user.create({ data: body })
  return NextResponse.json(user, { status: 201 })
}

// 动态路由
// app/api/users/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await db.user.findUnique({ where: { id: params.id } })
  return NextResponse.json(user)
}
```

### 2. Middleware

```ts
// middleware.ts(根目录)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 鉴权
  const token = request.cookies.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // 修改请求头
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-custom-header', 'value')
  
  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  })
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']  // 匹配路径
}
```

---

## 四、性能优化

### 1. 图片优化

```tsx
import Image from 'next/image'

<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority  // 首屏图片
  placeholder="blur"  // 模糊占位
  blurDataURL="data:image/..."
/>

// 外部图片
<Image
  src="https://example.com/image.jpg"
  alt="External"
  width={800}
  height={400}
  loader={({ src, width, quality }) => {
    return `https://cdn.example.com/${src}?w=${width}&q=${quality || 75}`
  }}
/>
```

**优势**:
- 自动 WebP/AVIF 格式
- 响应式(自动生成多尺寸)
- 懒加载(默认)
- 防止 CLS(layout shift)

### 2. 字体优化

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',  // font-display
  variable: '--font-inter'
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
```

**优势**:
- 自托管(不依赖 Google CDN)
- 零 CLS(字体度量预计算)
- 自动子集化

### 3. 代码分割

```tsx
// 动态导入
import dynamic from 'next/dynamic'

const DynamicComponent = dynamic(() => import('../components/Heavy'), {
  loading: () => <p>Loading...</p>,
  ssr: false  // 仅客户端加载
})

// 按需加载
const DynamicChart = dynamic(
  () => import('react-charts').then(mod => mod.Chart),
  { ssr: false }
)
```

### 4. 缓存策略

**Fetch 缓存**:

```tsx
// 默认:force-cache(SSG)
fetch(url)

// SSR(每次重新获取)
fetch(url, { cache: 'no-store' })

// ISR(60秒后重新验证)
fetch(url, { next: { revalidate: 60 } })
```

**路由段配置**:

```tsx
// app/page.tsx
export const dynamic = 'force-dynamic'  // SSR
export const revalidate = 60            // ISR
export const runtime = 'edge'           // Edge Runtime
```

---

## 五、高频面试题

### Q1: Pages Router vs App Router?

| 特性 | Pages Router | App Router |
|------|-------------|-----------|
| 路由 | pages/ | app/ |
| 布局 | `_app.tsx` | layout.tsx(嵌套) |
| 数据获取 | getServerSideProps | async/await 直接用 |
| 服务端组件 | ❌ | ✅ |
| Streaming | 有限 | ✅ |
| Suspense | 有限 | ✅ |
| 推荐 | 遗留项目 | 新项目(Next.js 13+) |

### Q2: getServerSideProps vs getStaticProps?

**Pages Router(旧)**:

```tsx
// SSR
export async function getServerSideProps(context) {
  const data = await fetchData()
  return { props: { data } }
}

// SSG
export async function getStaticProps() {
  const data = await fetchData()
  return { props: { data } }
}

// ISR
export async function getStaticProps() {
  const data = await fetchData()
  return {
    props: { data },
    revalidate: 60
  }
}
```

**App Router(新)**:直接用 `fetch` 的 `cache` 选项。

### Q3: 何时用服务端组件 vs 客户端组件?

**服务端组件**(默认):
- 数据获取
- 访问后端资源
- 保护敏感信息(API 密钥)
- 减少客户端 JS

**客户端组件**(`'use client'`):
- 交互性(`onClick/onChange`)
- 状态(`useState/useReducer`)
- 副作用(`useEffect`)
- 浏览器 API(`window/localStorage`)
- 第三方库(如需要 DOM)

### Q4: Streaming 如何工作?

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<Skeleton />}>
        <SlowComponent />
      </Suspense>
    </div>
  )
}

async function SlowComponent() {
  const data = await slowFetch()  // 慢接口
  return <div>{data}</div>
}
```

**原理**:
1. 服务端立即发送 HTML 框架
2. `SlowComponent` 异步加载中,先渲染 `<Skeleton />`
3. 数据就绪后,流式传输剩余 HTML
4. 客户端接收后替换 fallback

**优势**:TTFB 更快,用户更早看到内容。

### Q5: 如何做国际化(i18n)?

```tsx
// middleware.ts
import { match } from '@formatjs/intl-localematcher'
import Negotiator from 'negotiator'

function getLocale(request) {
  const headers = { 'accept-language': request.headers.get('accept-language') || 'en-US' }
  const languages = new Negotiator({ headers }).languages()
  const locales = ['en', 'zh', 'ja']
  return match(languages, locales, 'en')
}

export function middleware(request) {
  const pathname = request.nextUrl.pathname
  const pathnameIsMissingLocale = locales.every(
    locale => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  )
  
  if (pathnameIsMissingLocale) {
    const locale = getLocale(request)
    return NextResponse.redirect(new URL(`/${locale}${pathname}`, request.url))
  }
}

// app/[lang]/page.tsx
const dictionaries = {
  en: () => import('./dictionaries/en.json').then(m => m.default),
  zh: () => import('./dictionaries/zh.json').then(m => m.default)
}

export default async function Page({ params: { lang } }) {
  const dict = await dictionaries[lang]()
  return <h1>{dict.title}</h1>
}
```

---

## 六、部署优化

### 1. 环境变量

```bash
# .env.local(本地,不提交)
DATABASE_URL=postgresql://...
SECRET_KEY=xxx

# .env.production(生产)
NEXT_PUBLIC_API_URL=https://api.example.com
```

**访问**:

```tsx
// 服务端:都能访问
process.env.DATABASE_URL

// 客户端:只能访问 NEXT_PUBLIC_ 前缀
process.env.NEXT_PUBLIC_API_URL
```

### 2. 分析包体积

```bash
npm install @next/bundle-analyzer

# next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
})

module.exports = withBundleAnalyzer({})

# 运行
ANALYZE=true npm run build
```

### 3. Vercel 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel

# 生产部署
vercel --prod
```

---

## 七、实战场景

### 场景1:SEO 优化

```tsx
// app/blog/[slug]/page.tsx
import { Metadata } from 'next'

export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.slug)
  
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [post.coverImage]
    }
  }
}

export default function Page({ params }) {
  // ...
}
```

### 场景2:认证(NextAuth.js)

```tsx
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import GithubProvider from 'next-auth/providers/github'

const handler = NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET
    })
  ]
})

export { handler as GET, handler as POST }

// 使用
import { getServerSession } from 'next-auth'

export default async function Page() {
  const session = await getServerSession()
  
  if (!session) {
    redirect('/api/auth/signin')
  }
  
  return <div>Hello {session.user.name}</div>
}
```

---

## 八、常见坑

1. **hydration mismatch**:服务端/客户端渲染不一致
   ```tsx
   // ❌ 错误
   <div>{new Date().toString()}</div>
   
   // ✅ 正确
   'use client'
   const [time, setTime] = useState(null)
   useEffect(() => setTime(new Date().toString()), [])
   ```

2. **客户端组件引入服务端组件**:
   ```tsx
   // ❌ 客户端组件不能直接 import 服务端组件
   'use client'
   import ServerComponent from './ServerComponent'
   
   // ✅ 通过 props 传入
   export default function ClientComponent({ serverComponent }) {
     return <div>{serverComponent}</div>
   }
   ```

3. **动态路由预渲染**:
   ```tsx
   // 需提供 generateStaticParams
   export async function generateStaticParams() {
     const posts = await getPosts()
     return posts.map(post => ({ slug: post.slug }))
   }
   ```

---

## 参考资料

- [Next.js 官方文档](https://nextjs.org/docs)
- [App Router 完整指南](https://nextjs.org/docs/app)
- [RSC From Scratch](https://github.com/reactwg/server-components)
