# React 面试八股文 (2026)

> 更新时间:2026-07-01
> 适用版本:React 18/19
> 关联技术:Hooks · Concurrent Features · Server Components

---

## 一、基础概念(必考)

### 1. React 18/19 核心特性

| 特性 | React 17 | React 18 | React 19(实验) |
|------|----------|----------|----------------|
| **并发渲染** | ❌ | ✅ Concurrent Mode | 优化 |
| **自动批处理** | 仅合成事件 | 所有事件(Promise/setTimeout) | - |
| **Suspense** | 有限支持 | 完整支持(SSR) | 增强 |
| **Transitions** | ❌ | `useTransition`/`useDeferredValue` | 优化 |
| **Server Components** | ❌ | 实验性 | 稳定 |
| **Actions** | ❌ | ❌ | 新增(表单处理) |
| **use() Hook** | ❌ | ❌ | 新增(读取 Promise/Context) |

### 2. Hooks 核心

**useState**:状态管理,返回 `[state, setState]`。

```js
const [count, setCount] = useState(0)

// 函数式更新(基于前值)
setCount(prev => prev + 1)
```

**useEffect**:副作用(数据获取/订阅/DOM 操作)。

```js
useEffect(() => {
  const timer = setInterval(() => {}, 1000)
  return () => clearInterval(timer)  // 清理函数
}, [dependency])  // 依赖数组
```

**useRef**:持久化可变值,不触发重渲染。

```js
const inputRef = useRef(null)
inputRef.current.focus()

// 保存前值
const prevCount = useRef()
useEffect(() => {
  prevCount.current = count
})
```

**useCallback/useMemo**:性能优化。

```js
// 缓存函数
const memoizedCallback = useCallback(() => {
  doSomething(a, b)
}, [a, b])

// 缓存计算结果
const memoizedValue = useMemo(() => computeExpensive(a, b), [a, b])
```

**useContext**:跨组件共享状态。

```js
const ThemeContext = createContext('light')

// 提供者
<ThemeContext.Provider value="dark">
  <App />
</ThemeContext.Provider>

// 消费者
const theme = useContext(ThemeContext)
```

### 3. 组件类型

| 类型 | 定义 | 场景 |
|------|------|------|
| **函数组件** | `function App() { return <div /> }` | 默认选择 |
| **类组件** | `class App extends React.Component` | 遗留代码(不推荐) |
| **纯组件** | `React.memo(Component)` | 避免无意义重渲染 |
| **服务端组件** | `'use server'` 指令 | RSC,服务端渲染 |
| **客户端组件** | `'use client'` 指令 | RSC 中交互组件 |

---

## 二、核心原理(深挖)

### 1. 虚拟 DOM 与 Diff 算法

**为什么需要虚拟 DOM**:
- 直接操作 DOM 慢(重排/重绘)
- 批量更新,减少 DOM 操作次数
- 跨平台(React Native)

**Diff 三大策略**:

1. **Tree Diff**:只对比同层节点,跨层移动视为删除+创建
2. **Component Diff**:同类型组件继续 diff,不同类型直接替换
3. **Element Diff**:用 `key` 识别元素,复用 DOM 节点

```jsx
// ❌ 用 index 作 key(会导致错误复用)
{list.map((item, index) => <div key={index}>{item}</div>)}

// ✅ 用唯一 id
{list.map(item => <div key={item.id}>{item.name}</div>)}
```

### 2. Fiber 架构

**为什么引入 Fiber**:
- React 15 递归 diff 无法中断,长任务阻塞主线程导致卡顿
- Fiber 将渲染拆分成多个小任务,可中断、可恢复

**Fiber 是什么**:
- 一种数据结构(链表),每个节点代表一个组件
- 一种工作单元,记录组件状态、副作用、优先级

```js
// Fiber 节点结构(简化)
{
  type: 'div',              // 组件类型
  props: {},                // 属性
  stateNode: DOMNode,       // 对应 DOM 节点
  return: ParentFiber,      // 父节点
  child: FirstChildFiber,   // 第一个子节点
  sibling: NextSiblingFiber,// 兄弟节点
  alternate: OldFiber,      // 上一次的 Fiber(双缓存)
  effectTag: 'UPDATE',      // 副作用标记
  lanes: 0b0001,            // 优先级车道
}
```

**双缓存机制**:
- `current` 树(屏幕显示)
- `workInProgress` 树(内存构建)
- commit 阶段切换指针

### 3. 并发渲染(Concurrent Mode)

**时间切片(Time Slicing)**:将长任务拆分,浏览器空闲时执行。

```js
function workLoop(deadline) {
  while (nextUnitOfWork && deadline.timeRemaining() > 1) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
  }
  requestIdleCallback(workLoop)
}
```

**优先级调度**:
- Immediate(立即):用户输入(点击/输入)
- UserBlocking(用户阻塞):鼠标移动
- Normal(正常):网络请求
- Low(低优):数据分析
- Idle(空闲):日志

**Transitions API**:标记低优先级更新。

```js
import { useTransition } from 'react'

const [isPending, startTransition] = useTransition()

// 搜索输入(高优先级)
setInputValue(e.target.value)

// 搜索结果(低优先级,可中断)
startTransition(() => {
  setSearchResults(filterResults(e.target.value))
})
```

### 4. Reconciliation(协调)

**Render 阶段**:
- 可中断
- 执行 `render()`,构建 Fiber 树
- 标记副作用(增/删/改)

**Commit 阶段**:
- 不可中断
- 一次性提交 DOM 变更
- 三个子阶段:
  1. before mutation:调用 `getSnapshotBeforeUpdate`
  2. mutation:执行 DOM 操作
  3. layout:调用 `useLayoutEffect`,`componentDidMount/Update`

---

## 三、高频面试题

### Q1: useState 的更新是同步还是异步?

**在 React 18 之前**:
- 合成事件和生命周期:异步批处理
- 原生事件和 setTimeout:同步

**在 React 18**:
- 所有更新都是异步批处理(`createRoot` 启用)

```js
function App() {
  const [count, setCount] = useState(0)
  
  const handleClick = () => {
    setCount(count + 1)
    console.log(count)  // 0(闭包,不是最新值)
    setCount(count + 1)  // 仍然是 0+1=1(批处理)
  }
  
  // ✅ 正确写法
  const handleClickCorrect = () => {
    setCount(c => c + 1)  // 1
    setCount(c => c + 1)  // 2
  }
}
```

**如何强制同步**:`flushSync()`。

```js
import { flushSync } from 'react-dom'

flushSync(() => {
  setCount(count + 1)
})
console.log(count)  // 立即更新
```

### Q2: useEffect 和 useLayoutEffect 的区别?

| | useEffect | useLayoutEffect |
|---|---|---|
| **执行时机** | DOM 更新后,浏览器绘制后(异步) | DOM 更新后,浏览器绘制前(同步) |
| **阻塞渲染** | 否 | 是 |
| **场景** | 数据获取/订阅/日志 | DOM 测量/修改样式(避免闪烁) |

```js
useLayoutEffect(() => {
  const rect = divRef.current.getBoundingClientRect()
  setHeight(rect.height)  // 同步更新,避免闪烁
}, [])
```

### Q3: React 如何避免 XSS 攻击?

**自动转义**:JSX 中的字符串自动转义。

```jsx
const userInput = '<script>alert("xss")</script>'
<div>{userInput}</div>  // 显示为文本,不执行
```

**危险 API**:`dangerouslySetInnerHTML`(需手动清理)。

```jsx
<div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />
```

### Q4: 类组件生命周期 vs Hooks

| 类组件 | Hooks 等价 |
|--------|-----------|
| constructor | useState 初始值 |
| componentDidMount | useEffect(..., []) |
| componentDidUpdate | useEffect(..., [deps]) |
| componentWillUnmount | useEffect 返回的清理函数 |
| shouldComponentUpdate | React.memo / useMemo |
| getDerivedStateFromProps | render 时计算 / useEffect |

### Q5: 为什么 Hooks 不能写在条件语句里?

Hooks 依赖调用顺序维护状态链表,条件调用会打乱顺序。

```js
// ❌ 错误
if (condition) {
  const [state, setState] = useState(0)  // 顺序不稳定
}

// ✅ 正确
const [state, setState] = useState(0)
if (condition) {
  // 使用 state
}
```

### Q6: React 性能优化手段?

1. **避免无意义重渲染**:
   - `React.memo`:浅比较 props
   - `useMemo/useCallback`:缓存值/函数
   
2. **代码分割**:
   ```js
   const LazyComponent = React.lazy(() => import('./Heavy'))
   <Suspense fallback={<Loading />}>
     <LazyComponent />
   </Suspense>
   ```

3. **虚拟列表**:只渲染可视区(react-window/react-virtualized)

4. **useTransition**:标记低优先级更新

5. **Web Worker**:耗时计算移到 Worker

---

## 四、实战场景题

### 场景1:自定义 Hook(数据获取)

```js
import { useState, useEffect } from 'react'

function useFetch(url) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    let cancelled = false
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setData(data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err)
          setLoading(false)
        }
      })
    
    return () => { cancelled = true }  // 清理
  }, [url])
  
  return { data, loading, error }
}

// 使用
const { data, loading, error } = useFetch('/api/users')
```

### 场景2:受控/非受控组件

```js
// 受控组件(React 管理 state)
function ControlledInput() {
  const [value, setValue] = useState('')
  return <input value={value} onChange={e => setValue(e.target.value)} />
}

// 非受控组件(DOM 管理 state)
function UncontrolledInput() {
  const inputRef = useRef()
  const handleSubmit = () => {
    console.log(inputRef.current.value)
  }
  return <input ref={inputRef} defaultValue="initial" />
}
```

### 场景3:防抖/节流

```js
import { useEffect, useRef } from 'react'

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  
  return debouncedValue
}

// 使用
const [searchTerm, setSearchTerm] = useState('')
const debouncedSearchTerm = useDebounce(searchTerm, 500)

useEffect(() => {
  if (debouncedSearchTerm) {
    fetchResults(debouncedSearchTerm)
  }
}, [debouncedSearchTerm])
```

### 场景4:错误边界

```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false }
  
  static getDerivedStateFromError(error) {
    return { hasError: true }
  }
  
  componentDidCatch(error, info) {
    logErrorToService(error, info)
  }
  
  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>
    }
    return this.props.children
  }
}

// 使用
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

## 五、React 19 新特性(前瞻)

### 1. Actions(表单处理)

```jsx
function AddTodo() {
  async function addTodo(formData) {
    'use server'  // 服务端 Action
    const todo = await db.todos.create({
      text: formData.get('text')
    })
    revalidatePath('/todos')
  }
  
  return (
    <form action={addTodo}>
      <input name="text" />
      <button type="submit">Add</button>
    </form>
  )
}
```

### 2. use() Hook

```js
// 读取 Promise
function Note({notePromise}) {
  const note = use(notePromise)
  return <div>{note.content}</div>
}

// 读取 Context
function Button() {
  const theme = use(ThemeContext)
  return <button className={theme} />
}
```

### 3. Server Components

```jsx
// app/page.js (服务端组件,默认)
async function Page() {
  const data = await db.query()  // 直接数据库查询
  return <ClientComponent data={data} />
}

// components/ClientComponent.js
'use client'  // 标记为客户端组件
export function ClientComponent({ data }) {
  const [state, setState] = useState(data)
  return <button onClick={() => setState(...)}>Click</button>
}
```

---

## 参考资料

- [React 官方文档](https://react.dev/)
- [React 18 升级指南](https://react.dev/blog/2022/03/29/react-v18)
- [React Hooks RFC](https://github.com/reactjs/rfcs/blob/main/text/0068-react-hooks.md)
