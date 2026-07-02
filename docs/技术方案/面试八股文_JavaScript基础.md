# JavaScript 基础面试八股文 (2026)

> 更新时间:2026-07-01
> 适用版本:ES6~ES2024
> 关键词:闭包 · 原型链 · this · 异步编程 · EventLoop

---

## 一、数据类型

### 1. 基本类型 vs 引用类型

**7种基本类型(存栈)**:
- `undefined`, `null`, `boolean`, `number`, `string`, `symbol`, `bigint`

**引用类型(存堆)**:
- `Object`, `Array`, `Function`, `Date`, `RegExp`, `Map`, `Set`

**区别**:

```js
// 基本类型:值传递
let a = 1
let b = a
b = 2
console.log(a)  // 1(不受影响)

// 引用类型:地址传递
let obj1 = { name: 'Alice' }
let obj2 = obj1
obj2.name = 'Bob'
console.log(obj1.name)  // 'Bob'(受影响)
```

### 2. 类型判断

| 方法 | 优点 | 缺点 |
|------|------|------|
| `typeof` | 简单 | `null`→`'object'`, 数组→`'object'` |
| `instanceof` | 判断原型链 | 跨 iframe 失效,基本类型不准 |
| `Object.prototype.toString.call()` | 最准确 | 写法长 |

```js
typeof null              // 'object'(历史 bug)
typeof []                // 'object'
[] instanceof Array      // true
Object.prototype.toString.call([])  // '[object Array]'

// 封装判断函数
function getType(val) {
  return Object.prototype.toString.call(val).slice(8, -1).toLowerCase()
}
getType([])     // 'array'
getType(null)   // 'null'
```

### 3. 类型转换

**隐式转换规则**:

```js
// String + 任意 → String
'1' + 2          // '12'
'1' + true       // '1true'
'1' + [1,2]      // '11,2'

// Number 运算 → Number
'3' - 1          // 2
'3' * '2'        // 6
true + 1         // 2

// == 宽松相等
[] == ![]        // true(复杂转换)
0 == false       // true
'' == 0          // true

// === 严格相等(推荐)
0 === false      // false
```

**ToPrimitive 规则**:

```js
const obj = {
  valueOf() { return 1 },
  toString() { return '2' }
}

obj + 1    // 2(优先 valueOf)
String(obj) // '2'(String 上下文优先 toString)
```

---

## 二、作用域与闭包

### 1. 作用域链

```js
var a = 1
function outer() {
  var b = 2
  function inner() {
    var c = 3
    console.log(a, b, c)  // 1 2 3(作用域链:inner→outer→global)
  }
  inner()
}
outer()
```

**查找顺序**:当前作用域 → 外层 → 全局,找不到报 `ReferenceError`。

### 2. 闭包(Closure)

**定义**:函数 + 外部变量的引用。

```js
function createCounter() {
  let count = 0  // 私有变量
  return {
    increment() { return ++count },
    getCount() { return count }
  }
}

const counter = createCounter()
counter.increment()  // 1
counter.increment()  // 2
counter.getCount()   // 2
// count 无法直接访问
```

**应用场景**:
1. **数据封装/私有变量**
2. **函数工厂**:
   ```js
   function makeAdder(x) {
     return y => x + y
   }
   const add5 = makeAdder(5)
   add5(3)  // 8
   ```
3. **防抖/节流**
4. **模块模式**

**内存泄漏风险**:

```js
function leak() {
  const bigData = new Array(1000000)
  return () => {
    console.log(bigData.length)  // bigData 无法回收
  }
}
```

解法:用完置 `null`。

---

## 三、this 指向(必考)

### 1. 绑定规则(优先级从高到低)

**1) new 绑定**:

```js
function Person(name) {
  this.name = name
}
const p = new Person('Alice')  // this → p
```

**2) 显式绑定**(`call/apply/bind`):

```js
const obj = { name: 'Alice' }
function greet() {
  console.log(this.name)
}
greet.call(obj)  // 'Alice'
```

**3) 隐式绑定**(对象方法):

```js
const obj = {
  name: 'Alice',
  greet() { console.log(this.name) }
}
obj.greet()  // 'Alice'(this → obj)

const fn = obj.greet
fn()  // undefined(丢失绑定,this → window/undefined)
```

**4) 默认绑定**:

```js
function foo() {
  console.log(this)
}
foo()  // window(非严格) / undefined(严格模式)
```

### 2. 箭头函数

**没有自己的 this**,继承外层作用域。

```js
const obj = {
  name: 'Alice',
  greet: () => {
    console.log(this.name)
  }
}
obj.greet()  // undefined(this 继承外层,非 obj)

// 正确写法
const obj2 = {
  name: 'Bob',
  greet() {
    setTimeout(() => {
      console.log(this.name)  // 'Bob'(继承 greet 的 this)
    }, 100)
  }
}
```

### 3. 经典陷阱

```js
var name = 'window'
const obj = {
  name: 'obj',
  getName: function() {
    return function() {
      return this.name
    }
  }
}
obj.getName()()  // 'window'(返回的函数独立调用)

// 解法1:箭头函数
getName: function() {
  return () => this.name
}

// 解法2:保存 this
const that = this
return function() { return that.name }
```

---

## 四、原型与原型链

### 1. 三角关系

```js
function Person(name) {
  this.name = name
}
Person.prototype.sayHi = function() {
  console.log('Hi, ' + this.name)
}

const p = new Person('Alice')

// 三角关系
p.__proto__ === Person.prototype          // true
Person.prototype.constructor === Person   // true
Person.__proto__ === Function.prototype   // true
```

**原型链查找**:

```
p.sayHi
→ p 自身没有
→ p.__proto__(Person.prototype)找到 ✓
```

### 2. instanceof 原理

```js
function myInstanceof(obj, Ctor) {
  let proto = obj.__proto__
  while (proto) {
    if (proto === Ctor.prototype) return true
    proto = proto.__proto__
  }
  return false
}
```

### 3. 继承方式

**1) 原型链继承**:

```js
function Parent() { this.name = 'parent' }
Parent.prototype.getName = function() { return this.name }

function Child() {}
Child.prototype = new Parent()  // ❌ 缺点:共享引用类型
```

**2) 构造函数继承**:

```js
function Child() {
  Parent.call(this)  // ✅ 独立属性
}
// ❌ 缺点:无法继承原型方法
```

**3) 组合继承(常用)**:

```js
function Child() {
  Parent.call(this)  // 继承属性
}
Child.prototype = new Parent()  // 继承方法
Child.prototype.constructor = Child
// ❌ 缺点:调用两次父构造函数
```

**4) 寄生组合继承(最优)**:

```js
function inherit(Child, Parent) {
  Child.prototype = Object.create(Parent.prototype)
  Child.prototype.constructor = Child
}

function Child() {
  Parent.call(this)
}
inherit(Child, Parent)
```

**5) ES6 Class(推荐)**:

```js
class Parent {
  constructor(name) { this.name = name }
  getName() { return this.name }
}

class Child extends Parent {
  constructor(name, age) {
    super(name)  // 必须先调用
    this.age = age
  }
}
```

---

## 五、异步编程(核心)

### 1. Event Loop(事件循环)

**浏览器事件循环**:

```
宏任务队列(MacroTask)        微任务队列(MicroTask)
- setTimeout                 - Promise.then
- setInterval                - MutationObserver
- I/O                        - queueMicrotask
- UI渲染
```

**执行顺序**:

```
1. 执行同步代码
2. 清空微任务队列
3. 渲染(如需要)
4. 取一个宏任务执行
5. 回到步骤2
```

**经典题**:

```js
console.log(1)

setTimeout(() => console.log(2), 0)

Promise.resolve().then(() => console.log(3))

console.log(4)

// 输出:1 → 4 → 3 → 2
// 同步(1,4) → 微任务(3) → 宏任务(2)
```

### 2. Promise

**三种状态**:pending → fulfilled/rejected(不可逆)。

**基础用法**:

```js
const promise = new Promise((resolve, reject) => {
  setTimeout(() => resolve('done'), 1000)
})

promise
  .then(result => console.log(result))
  .catch(error => console.error(error))
  .finally(() => console.log('cleanup'))
```

**链式调用**:

```js
fetch('/api')
  .then(res => res.json())
  .then(data => processData(data))
  .then(result => showResult(result))
  .catch(err => console.error(err))
```

**并发控制**:

```js
// Promise.all:全成功才成功
Promise.all([p1, p2, p3])  // 任一失败→整体失败

// Promise.allSettled:等全部完成
Promise.allSettled([p1, p2])  // 返回每个结果{status, value/reason}

// Promise.race:最快的
Promise.race([p1, p2])  // 第一个完成的(成功或失败)

// Promise.any:最快成功的
Promise.any([p1, p2])  // 第一个成功的,全失败才失败
```

### 3. async/await

**本质**:Generator + 自动执行器的语法糖。

```js
async function fetchData() {
  try {
    const res = await fetch('/api')
    const data = await res.json()
    return data
  } catch (err) {
    console.error(err)
  }
}

// 等价于
function fetchData() {
  return fetch('/api')
    .then(res => res.json())
    .catch(err => console.error(err))
}
```

**错误处理**:

```js
// 方式1:try-catch
try {
  const data = await fetchData()
} catch (err) {
  console.error(err)
}

// 方式2:await-to-js 模式
const [err, data] = await to(fetchData())
if (err) return handleError(err)
```

**并发执行**:

```js
// ❌ 串行(慢)
const data1 = await fetch('/api1')
const data2 = await fetch('/api2')  // 等 api1 完成

// ✅ 并行(快)
const [data1, data2] = await Promise.all([
  fetch('/api1'),
  fetch('/api2')
])
```

---

## 六、ES6+ 新特性

### 1. 解构赋值

```js
// 数组
const [a, , c] = [1, 2, 3]  // a=1, c=3
const [x, ...rest] = [1, 2, 3, 4]  // x=1, rest=[2,3,4]

// 对象
const { name, age = 18 } = { name: 'Alice' }
const { name: userName } = { name: 'Bob' }  // 重命名
```

### 2. 扩展运算符

```js
// 数组合并
const arr = [...arr1, ...arr2]

// 对象合并(浅拷贝)
const obj = { ...obj1, ...obj2 }

// 函数参数
Math.max(...[1, 2, 3])
```

### 3. 模板字符串

```js
const name = 'Alice'
const msg = `Hello, ${name}!`

// 标签模板
function tag(strings, ...values) {
  return strings[0] + values[0].toUpperCase()
}
tag`Hello, ${name}`  // 'Hello, ALICE'
```

### 4. Symbol

```js
// 唯一标识符
const s1 = Symbol('desc')
const s2 = Symbol('desc')
s1 === s2  // false

// 作为对象属性(不可枚举)
const obj = {
  [Symbol('id')]: 123
}
Object.keys(obj)  // [](Symbol 属性不可枚举)
```

### 5. Map/Set

```js
// Map:键可以是任意类型
const map = new Map()
map.set({ id: 1 }, 'value')
map.get({ id: 1 })  // undefined(不同引用)

// Set:去重
const set = new Set([1, 2, 2, 3])  // {1, 2, 3}
```

---

## 七、高频面试题

### Q1: var/let/const 区别?

| | var | let | const |
|---|---|---|---|
| 作用域 | 函数级 | 块级 | 块级 |
| 变量提升 | ✅ | ❌(TDZ) | ❌(TDZ) |
| 重复声明 | ✅ | ❌ | ❌ |
| 修改 | ✅ | ✅ | ❌(基本类型) |

```js
console.log(a)  // undefined(变量提升)
var a = 1

console.log(b)  // ReferenceError(TDZ 暂时性死区)
let b = 2

const obj = { name: 'Alice' }
obj.name = 'Bob'  // ✅(引用不变,属性可变)
obj = {}  // ❌ TypeError
```

### Q2: 深拷贝 vs 浅拷贝?

**浅拷贝**(只复制第一层):

```js
const obj2 = Object.assign({}, obj1)
const obj3 = { ...obj1 }
const arr2 = arr1.slice()
```

**深拷贝**:

```js
// 1. JSON(局限:不支持函数/Symbol/循环引用)
const obj2 = JSON.parse(JSON.stringify(obj1))

// 2. 递归实现
function deepClone(obj, map = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj
  if (map.has(obj)) return map.get(obj)  // 处理循环引用
  
  const clone = Array.isArray(obj) ? [] : {}
  map.set(obj, clone)
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clone[key] = deepClone(obj[key], map)
    }
  }
  return clone
}

// 3. structuredClone(浏览器原生,最推荐)
const obj2 = structuredClone(obj1)
```

### Q3: 防抖 vs 节流?

**防抖(Debounce)**:延迟执行,重复触发重新计时。

```js
function debounce(fn, delay) {
  let timer = null
  return function(...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

// 应用:搜索框输入
input.addEventListener('input', debounce(search, 500))
```

**节流(Throttle)**:固定频率执行。

```js
function throttle(fn, delay) {
  let last = 0
  return function(...args) {
    const now = Date.now()
    if (now - last > delay) {
      fn.apply(this, args)
      last = now
    }
  }
}

// 应用:滚动事件
window.addEventListener('scroll', throttle(handleScroll, 200))
```

### Q4: 数组常用方法?

| 方法 | 改变原数组 | 返回值 |
|------|----------|--------|
| push/pop | ✅ | 新长度/删除元素 |
| shift/unshift | ✅ | 新长度/删除元素 |
| splice | ✅ | 删除元素数组 |
| sort/reverse | ✅ | 排序后数组 |
| slice | ❌ | 新数组 |
| concat | ❌ | 新数组 |
| map/filter/reduce | ❌ | 新数组/结果 |

**reduce 高级用法**:

```js
// 数组求和
[1,2,3].reduce((sum, n) => sum + n, 0)  // 6

// 数组去重
[1,2,2,3].reduce((arr, n) => arr.includes(n) ? arr : [...arr, n], [])

// 对象分组
users.reduce((groups, user) => {
  (groups[user.role] = groups[user.role] || []).push(user)
  return groups
}, {})
```

### Q5: 柯里化(Currying)?

**定义**:多参数函数 → 单参数函数链。

```js
// 原函数
function add(a, b, c) {
  return a + b + c
}

// 柯里化后
function curryAdd(a) {
  return function(b) {
    return function(c) {
      return a + b + c
    }
  }
}
curryAdd(1)(2)(3)  // 6

// 通用柯里化函数
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args)
    }
    return (...args2) => curried.apply(this, args.concat(args2))
  }
}

const add = curry((a, b, c) => a + b + c)
add(1)(2)(3)  // 6
add(1, 2)(3)  // 6
```

---

## 八、性能优化

1. **减少DOM操作**:批量修改用 DocumentFragment
2. **事件委托**:利用冒泡,父元素监听
3. **懒加载**:图片/组件按需加载
4. **Web Worker**:CPU密集任务放 Worker
5. **缓存**:缓存计算结果/API响应
6. **代码分割**:动态 import

---

## 参考资料

- [MDN JavaScript](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript)
- [JavaScript Info](https://javascript.info/)
- [You Don't Know JS](https://github.com/getify/You-Dont-Know-JS)
