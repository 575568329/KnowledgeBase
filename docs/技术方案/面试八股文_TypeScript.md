# TypeScript 面试八股文 (2026)

> 更新时间:2026-07-01
> 适用版本:TypeScript 5.0+
> 关键词:类型系统 · 泛型 · 工具类型 · 类型体操

---

## 一、基础类型

### 1. 基本类型

```typescript
// 基础类型
let isDone: boolean = false
let count: number = 6
let name: string = "Alice"
let u: undefined = undefined
let n: null = null

// 数组
let list1: number[] = [1, 2, 3]
let list2: Array<number> = [1, 2, 3]

// 元组(固定长度+类型)
let tuple: [string, number] = ['hello', 10]

// 枚举
enum Color { Red, Green, Blue }
let c: Color = Color.Green  // 1

// any(绕过类型检查,不推荐)
let notSure: any = 4

// unknown(安全的 any,需类型断言才能用)
let value: unknown = 'hello'
if (typeof value === 'string') {
  console.log(value.toUpperCase())  // ✅ 类型守卫后可用
}

// void(无返回值)
function log(): void {
  console.log('log')
}

// never(永不返回)
function error(message: string): never {
  throw new Error(message)
}
```

### 2. 对象类型

```typescript
// 接口
interface User {
  readonly id: number     // 只读
  name: string
  age?: number           // 可选
  [key: string]: any     // 索引签名
}

// 类型别名(Type Alias)
type Point = {
  x: number
  y: number
}

// 接口 vs Type
// 接口:可扩展(extends/implements)
interface Animal {
  name: string
}
interface Dog extends Animal {
  breed: string
}

// Type:联合类型/交叉类型
type Pet = Dog | Cat
type Hybrid = Dog & Cat
```

---

## 二、高级类型

### 1. 联合类型(Union)

```typescript
type Status = 'success' | 'error' | 'loading'

function handle(status: Status) {
  if (status === 'success') {
    // 类型收窄
  }
}

// 字面量类型
type Direction = 'up' | 'down' | 'left' | 'right'
```

### 2. 交叉类型(Intersection)

```typescript
type Colorful = { color: string }
type Circle = { radius: number }

type ColorfulCircle = Colorful & Circle

const cc: ColorfulCircle = {
  color: 'red',
  radius: 10
}
```

### 3. 类型守卫(Type Guard)

```typescript
// typeof
function print(value: string | number) {
  if (typeof value === 'string') {
    console.log(value.toUpperCase())
  } else {
    console.log(value.toFixed(2))
  }
}

// instanceof
class Dog {}
class Cat {}

function handle(animal: Dog | Cat) {
  if (animal instanceof Dog) {
    // animal 类型收窄为 Dog
  }
}

// in
type Fish = { swim: () => void }
type Bird = { fly: () => void }

function move(animal: Fish | Bird) {
  if ('swim' in animal) {
    animal.swim()
  } else {
    animal.fly()
  }
}

// 自定义类型守卫
function isFish(animal: Fish | Bird): animal is Fish {
  return (animal as Fish).swim !== undefined
}
```

### 4. 类型断言

```typescript
// as 语法
const value = 'hello' as string

// 尖括号语法(JSX 中不可用)
const value2 = <string>'hello'

// 非空断言(!)
function process(name: string | null) {
  console.log(name!.toUpperCase())  // 断言 name 非 null
}

// 双重断言(不推荐)
const num = 'hello' as unknown as number
```

---

## 三、泛型(Generics)

### 1. 基础泛型

```typescript
// 泛型函数
function identity<T>(arg: T): T {
  return arg
}

identity<string>('hello')  // 显式指定
identity(123)              // 类型推断为 number

// 泛型接口
interface GenericIdentityFn<T> {
  (arg: T): T
}

// 泛型类
class GenericNumber<T> {
  zeroValue: T
  add: (x: T, y: T) => T
}
```

### 2. 泛型约束

```typescript
// extends 约束
interface Lengthwise {
  length: number
}

function logLength<T extends Lengthwise>(arg: T): T {
  console.log(arg.length)
  return arg
}

logLength('hello')    // ✅
logLength([1, 2, 3])  // ✅
logLength(123)        // ❌ number 没有 length

// 多重约束
function merge<T extends object, U extends object>(obj1: T, obj2: U) {
  return { ...obj1, ...obj2 }
}
```

### 3. 泛型默认值

```typescript
interface Props<T = string> {
  value: T
}

const p1: Props = { value: 'hello' }      // T 默认 string
const p2: Props<number> = { value: 123 }  // T 指定为 number
```

---

## 四、工具类型(Utility Types)

### 1. 内置工具类型

```typescript
interface User {
  id: number
  name: string
  age: number
}

// Partial:所有属性可选
type PartialUser = Partial<User>
// { id?: number; name?: string; age?: number }

// Required:所有属性必选
type RequiredUser = Required<PartialUser>

// Readonly:所有属性只读
type ReadonlyUser = Readonly<User>

// Pick:挑选部分属性
type UserPreview = Pick<User, 'id' | 'name'>
// { id: number; name: string }

// Omit:排除部分属性
type UserWithoutAge = Omit<User, 'age'>
// { id: number; name: string }

// Record:构造对象类型
type Roles = Record<'admin' | 'user' | 'guest', number>
// { admin: number; user: number; guest: number }

// Exclude:从联合类型中排除
type T1 = Exclude<'a' | 'b' | 'c', 'a'>  // 'b' | 'c'

// Extract:从联合类型中提取
type T2 = Extract<'a' | 'b' | 'c', 'a' | 'f'>  // 'a'

// NonNullable:排除 null/undefined
type T3 = NonNullable<string | null | undefined>  // string

// ReturnType:获取函数返回类型
function getUser() {
  return { id: 1, name: 'Alice' }
}
type User = ReturnType<typeof getUser>

// Parameters:获取函数参数类型
function createUser(name: string, age: number) {}
type Params = Parameters<typeof createUser>  // [string, number]
```

### 2. 自定义工具类型

```typescript
// DeepPartial:深度可选
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// DeepReadonly:深度只读
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

// Mutable:移除 readonly
type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}

// RequireAtLeastOne:至少一个必选
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>>
  & {
      [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
    }[Keys]
```

---

## 五、类型体操(高级)

### 1. 条件类型(Conditional Types)

```typescript
// T extends U ? X : Y
type IsString<T> = T extends string ? true : false

type A = IsString<'hello'>  // true
type B = IsString<123>      // false

// infer 推断
type GetReturnType<T> = T extends (...args: any[]) => infer R ? R : never

type Func = () => string
type Return = GetReturnType<Func>  // string

// 分布式条件类型
type ToArray<T> = T extends any ? T[] : never
type Arr = ToArray<string | number>  // string[] | number[]
```

### 2. 映射类型(Mapped Types)

```typescript
// in keyof
type Readonly<T> = {
  readonly [P in keyof T]: T[P]
}

// 键名重映射(as)
type Getters<T> = {
  [P in keyof T as `get${Capitalize<string & P>}`]: () => T[P]
}

interface User {
  name: string
  age: number
}

type UserGetters = Getters<User>
// { getName: () => string; getAge: () => number }
```

### 3. 模板字面量类型(Template Literal Types)

```typescript
type World = 'world'
type Greeting = `hello ${World}`  // 'hello world'

// 与联合类型结合
type Method = 'GET' | 'POST'
type Path = '/users' | '/posts'
type Route = `${Method} ${Path}`
// 'GET /users' | 'GET /posts' | 'POST /users' | 'POST /posts'

// Uppercase/Lowercase/Capitalize/Uncapitalize
type Upper = Uppercase<'hello'>  // 'HELLO'
```

---

## 六、实战场景

### 场景1:表单类型安全

```typescript
interface FormData {
  username: string
  password: string
  email: string
}

// 表单字段配置
type FormConfig<T> = {
  [K in keyof T]: {
    label: string
    type: 'text' | 'password' | 'email'
    validator?: (value: T[K]) => boolean
  }
}

const formConfig: FormConfig<FormData> = {
  username: {
    label: '用户名',
    type: 'text',
    validator: (v) => v.length >= 3
  },
  password: {
    label: '密码',
    type: 'password'
  },
  email: {
    label: '邮箱',
    type: 'email'
  }
}
```

### 场景2:API 响应类型

```typescript
// 统一响应格式
interface ApiResponse<T> {
  code: number
  data: T
  message: string
}

// 用户 API
async function getUser(id: number): Promise<ApiResponse<User>> {
  const res = await fetch(`/api/users/${id}`)
  return res.json()
}

// 使用
const response = await getUser(1)
response.data.name  // ✅ 类型推断为 string
```

### 场景3:类型安全的 Redux

```typescript
// Action 类型
interface Action<T extends string, P = void> {
  type: T
  payload: P
}

// Action Creators
function createAction<T extends string, P = void>(
  type: T
): (payload: P) => Action<T, P> {
  return (payload: P) => ({ type, payload })
}

const increment = createAction<'INCREMENT', number>('INCREMENT')
const decrement = createAction<'DECREMENT'>('DECREMENT')

// Reducer
type CounterAction = ReturnType<typeof increment> | ReturnType<typeof decrement>

function counterReducer(state: number, action: CounterAction) {
  switch (action.type) {
    case 'INCREMENT':
      return state + action.payload  // payload 类型为 number
    case 'DECREMENT':
      return state - 1
    default:
      return state
  }
}
```

---

## 七、高频面试题

### Q1: interface vs type?

| 特性 | interface | type |
|------|----------|------|
| 扩展方式 | extends | & (交叉类型) |
| 合并声明 | ✅ | ❌ |
| 联合类型 | ❌ | ✅ |
| 元组 | ❌ | ✅ |
| 映射类型 | ❌ | ✅ |
| 性能 | 稍快 | 稍慢(编译时) |

**推荐**:对象用 `interface`,联合/元组用 `type`。

### Q2: any vs unknown vs never?

```typescript
// any:跳过类型检查(不推荐)
let a: any = 'hello'
a.foo()  // ✅ 编译通过,运行时报错

// unknown:安全的 any,需类型守卫
let u: unknown = 'hello'
u.toUpperCase()  // ❌ 报错
if (typeof u === 'string') {
  u.toUpperCase()  // ✅
}

// never:永不存在的值
function error(): never {
  throw new Error()
}

type A = string & number  // never(不可能同时是两种类型)
```

### Q3: 类型推断(Type Inference)规则?

```typescript
// 1. 基础推断
let x = 3  // number

// 2. 最佳通用类型
let arr = [0, 1, null]  // (number | null)[]

// 3. 上下文类型推断
window.onmousedown = function(event) {
  console.log(event.button)  // event 推断为 MouseEvent
}

// 4. 函数返回值推断
function add(a: number, b: number) {
  return a + b  // 推断返回 number
}
```

### Q4: 协变(Covariance) vs 逆变(Contravariance)?

```typescript
// 协变:子类型可赋值给父类型(返回值)
interface Animal { name: string }
interface Dog extends Animal { breed: string }

let animal: Animal = { name: 'A' }
let dog: Dog = { name: 'D', breed: 'Husky' }

animal = dog  // ✅ 协变

// 逆变:父类型可赋值给子类型(参数)
type AnimalHandler = (a: Animal) => void
type DogHandler = (d: Dog) => void

let handleAnimal: AnimalHandler = (a) => console.log(a.name)
let handleDog: DogHandler = handleAnimal  // ✅ 逆变(strictFunctionTypes)
```

### Q5: 声明文件(.d.ts)如何编写?

```typescript
// types/jquery.d.ts
declare namespace $ {
  function ajax(url: string, settings?: any): void
  
  interface AjaxSettings {
    method?: 'GET' | 'POST'
    data?: any
  }
}

// 使用
$.ajax('/api', { method: 'POST' })

// 声明全局变量
declare const API_URL: string

// 声明模块
declare module 'my-lib' {
  export function hello(): void
}
```

---

## 八、编译配置(tsconfig.json)

### 重要配置项

```json
{
  "compilerOptions": {
    "target": "ES2020",              // 编译目标
    "module": "ESNext",              // 模块系统
    "lib": ["ES2020", "DOM"],        // 引入库
    "jsx": "react-jsx",              // JSX 转换
    
    "strict": true,                  // 启用所有严格检查
    "noImplicitAny": true,           // 禁止隐式 any
    "strictNullChecks": true,        // 严格空值检查
    "strictFunctionTypes": true,     // 严格函数类型检查
    
    "moduleResolution": "node",      // 模块解析策略
    "baseUrl": "./",                 // 基础路径
    "paths": {                       // 路径映射
      "@/*": ["src/*"]
    },
    
    "esModuleInterop": true,         // 兼容 CommonJS
    "skipLibCheck": true,            // 跳过 .d.ts 检查(加速)
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 九、性能优化

1. **开启 `skipLibCheck`**:跳过 node_modules 类型检查
2. **增量编译**:`--incremental`,生成 `.tsbuildinfo` 缓存
3. **Project References**:大型项目拆分子项目
4. **`isolatedModules`**:每个文件独立编译(配合 Babel)
5. **减少类型体操复杂度**:过深的递归类型影响编译性能

---

## 十、常见错误处理

```typescript
// 1. 对象可能为 undefined
const user: User | undefined = getUser()
user.name  // ❌ Object is possibly 'undefined'

// 解法
user?.name  // 可选链
user!.name  // 非空断言(不推荐)
if (user) user.name  // 类型守卫

// 2. 类型不兼容
const arr: number[] = [1, 2, 3]
arr.push('4')  // ❌ Argument of type 'string' is not assignable to 'number'

// 3. 隐式 any
function log(msg) {  // ❌ Parameter 'msg' implicitly has an 'any' type
  console.log(msg)
}

// 解法
function log(msg: string) {}
```

---

## 参考资料

- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Type Challenges](https://github.com/type-challenges/type-challenges)
