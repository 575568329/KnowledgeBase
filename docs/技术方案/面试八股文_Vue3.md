# Vue 3 面试八股文 (2026)

> 更新时间:2026-07-01
> 适用版本:Vue 3.4+
> 关联技术:Composition API · Pinia · Vite

---

## 一、基础概念(必考)

### 1. Vue 3 与 Vue 2 的核心差异

| 维度 | Vue 2 | Vue 3 |
|------|-------|-------|
| **响应式系统** | Object.defineProperty | Proxy |
| **API 风格** | Options API | Composition API (兼容 Options) |
| **状态管理** | Vuex | Pinia (官方推荐) |
| **构建工具** | Vue CLI / Webpack | Vite (官方推荐) |
| **TypeScript** | 支持但体验一般 | 原生 TS 支持,类型推导完善 |
| **性能** | - | 编译优化(静态提升/预字符串化/事件缓存) |
| **包体积** | ~32KB | ~13KB (Tree-shaking 友好) |
| **Fragment** | 不支持(必须单根) | 支持多根节点 |
| **Teleport** | 不支持 | 内置 |
| **Suspense** | 不支持 | 内置(异步组件加载) |

**为什么 Proxy 优于 defineProperty**:
- defineProperty 只能劫持对象已有属性,新增/删除属性需 `Vue.set/delete`
- defineProperty 无法劫持数组索引和 length,需重写数组方法
- Proxy 可代理整个对象,劫持 13 种操作(get/set/deleteProperty/has 等),无需递归遍历

### 2. Composition API 核心

**setup 函数**:组件的入口,执行时机早于 `beforeCreate`。

```js
import { ref, computed, watch, onMounted } from 'vue'

export default {
  setup(props, context) {
    // context = { attrs, slots, emit, expose }
    const count = ref(0)
    const double = computed(() => count.value * 2)
    
    watch(count, (newVal, oldVal) => {
      console.log(`count changed: ${oldVal} → ${newVal}`)
    })
    
    onMounted(() => {
      console.log('mounted')
    })
    
    return { count, double }
  }
}
```

**setup 语法糖(`<script setup>`)**:编译时自动返回,顶层绑定直接暴露给模板。

```vue
<script setup>
import { ref } from 'vue'
const count = ref(0)  // 自动 return
</script>
```

### 3. 响应式 API

| API | 作用 | 场景 |
|-----|------|------|
| `ref()` | 包装基本类型为响应式对象(`.value` 访问) | 基本类型(string/number/boolean) |
| `reactive()` | 包装对象为响应式 Proxy | 对象/数组 |
| `computed()` | 计算属性,依赖变化自动更新 | 派生状态 |
| `watch()` | 侦听响应式数据变化 | 副作用(API 调用/DOM 操作) |
| `watchEffect()` | 立即执行并自动追踪依赖 | 自动收集依赖的副作用 |
| `readonly()` | 只读代理 | 防止外部修改内部状态 |
| `toRefs()` | 解构 reactive 对象保持响应性 | 组合式函数返回值 |
| `unref()` | 如果是 ref 则返回 .value,否则原样返回 | 兼容 ref/非 ref 参数 |

**ref vs reactive 选择**:
- **ref**:基本类型;需要重新赋值的对象;与 TypeScript 配合更好
- **reactive**:纯对象结构(如表单数据);不需要整体替换

### 4. 生命周期钩子(Composition API)

| Options API | Composition API | 执行时机 |
|-------------|-----------------|---------|
| beforeCreate | 无(直接写 setup 顶层) | 实例初始化前 |
| created | 无(直接写 setup 顶层) | 实例创建后 |
| beforeMount | onBeforeMount | 挂载前 |
| mounted | onMounted | 挂载后(DOM 可用) |
| beforeUpdate | onBeforeUpdate | 数据更新前 |
| updated | onUpdated | 数据更新后 |
| beforeUnmount | onBeforeUnmount | 卸载前 |
| unmounted | onUnmounted | 卸载后 |
| errorCaptured | onErrorCaptured | 捕获子组件错误 |
| renderTracked | onRenderTracked | 追踪依赖(DEV) |
| renderTriggered | onRenderTriggered | 追踪触发更新(DEV) |

---

## 二、核心原理(深挖)

### 1. 响应式原理(Proxy)

**Vue 3 如何实现响应式**:

```js
// 简化版实现
const reactiveMap = new WeakMap()

function reactive(target) {
  if (reactiveMap.has(target)) return reactiveMap.get(target)
  
  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      track(target, key)  // 收集依赖
      return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver)
      trigger(target, key)  // 触发更新
      return result
    }
  })
  
  reactiveMap.set(target, proxy)
  return proxy
}

// 依赖收集
let activeEffect = null
const targetMap = new WeakMap()

function track(target, key) {
  if (!activeEffect) return
  let depsMap = targetMap.get(target)
  if (!depsMap) targetMap.set(target, (depsMap = new Map()))
  let dep = depsMap.get(key)
  if (!dep) depsMap.set(key, (dep = new Set()))
  dep.add(activeEffect)
}

// 触发更新
function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  effects?.forEach(effect => effect())
}
```

**追问:为什么用 WeakMap**:
- 弱引用,target 被销毁后自动清理,防止内存泄漏
- 不可枚举,不干扰对象自身属性

### 2. diff 算法优化

**Vue 3 的编译优化**:

1. **静态提升(Static Hoisting)**:静态节点提升到 render 函数外,只创建一次。

```js
// 编译前
<div>
  <p>静态文本</p>
  <p>{{ dynamic }}</p>
</div>

// 编译后
const _hoisted_1 = _createElementVNode("p", null, "静态文本")
function render() {
  return _createElementVNode("div", null, [
    _hoisted_1,  // 复用
    _createElementVNode("p", null, _toDisplayString(dynamic))
  ])
}
```

2. **预字符串化(Pre-stringification)**:大量连续静态节点直接序列化为 HTML 字符串。

3. **动态标记(PatchFlag)**:编译时标记节点的动态部分,diff 时只对比动态内容。

```js
// PatchFlag 枚举
export const enum PatchFlags {
  TEXT = 1,         // 动态文本
  CLASS = 2,        // 动态 class
  STYLE = 4,        // 动态 style
  PROPS = 8,        // 动态属性(非 class/style)
  FULL_PROPS = 16,  // 有动态 key 的属性
  HYDRATE_EVENTS = 32, // 有事件监听器
  // ...
}
```

4. **事件缓存(Cache Event Handler)**:事件监听器缓存,避免每次 render 创建新函数。

### 3. Pinia 原理

**为什么 Pinia 替代 Vuex**:
- 更轻量(~1KB)
- 完整 TypeScript 支持
- 不需要 mutations(直接修改 state)
- 模块化天然支持(不需要嵌套)
- DevTools 支持更好

**Pinia 实现原理**:

```js
// 简化版
export function defineStore(id, options) {
  return function useStore() {
    const pinia = inject(piniaSymbol)
    if (!pinia._stores.has(id)) {
      const store = reactive({
        ...options.state?.(),
        ...options.getters,
        ...options.actions
      })
      pinia._stores.set(id, store)
    }
    return pinia._stores.get(id)
  }
}
```

---

## 三、高频面试题

### Q1: Vue 3 如何实现双向绑定?

`v-model` 本质是 `:value` + `@input` 的语法糖。

```vue
<!-- 子组件 -->
<script setup>
defineProps(['modelValue'])
const emit = defineEmits(['update:modelValue'])
</script>
<input :value="modelValue" @input="emit('update:modelValue', $event.target.value)">

<!-- 父组件 -->
<MyInput v-model="text" />
<!-- 等价于 -->
<MyInput :modelValue="text" @update:modelValue="text = $event" />
```

**多个 v-model**:

```vue
<MyComponent v-model:title="title" v-model:content="content" />
```

### Q2: computed 和 watch 的区别?

| | computed | watch |
|---|---|---|
| **返回值** | 必须有 | 无 |
| **缓存** | 依赖不变不重新计算 | 每次依赖变化都执行 |
| **场景** | 模板使用的派生状态 | 副作用(API/DOM/定时器) |
| **依赖收集** | 自动 | 自动(watch)或手动(watchEffect) |

```js
// computed:计算属性
const fullName = computed(() => `${firstName.value} ${lastName.value}`)

// watch:副作用
watch(searchQuery, async (newQuery) => {
  results.value = await fetchResults(newQuery)
})
```

### Q3: nextTick 原理?

DOM 更新是异步的,Vue 将数据变化放入队列,下一个事件循环 tick 统一更新。`nextTick` 返回 Promise,在 DOM 更新后执行回调。

```js
import { nextTick } from 'vue'

count.value++
console.log(el.textContent)  // 旧值
await nextTick()
console.log(el.textContent)  // 新值
```

**实现**:优先使用 `Promise.then`,降级 `MutationObserver` → `setImmediate` → `setTimeout`。

### Q4: Teleport 的应用场景?

将组件 HTML 渲染到 DOM 其他位置(常用于 modal/toast)。

```vue
<Teleport to="body">
  <div class="modal">{{ content }}</div>
</Teleport>
```

### Q5: 如何优化大列表渲染?

1. **虚拟滚动**:只渲染可视区域项(`vue-virtual-scroller`)
2. **分页/懒加载**:Intersection Observer 监听滚动
3. **Object.freeze**:冻结不需要响应式的数据
4. **v-memo**:缓存子树(Vue 3.2+)

```vue
<div v-for="item in list" :key="item.id" v-memo="[item.selected]">
  <!-- selected 不变时跳过更新 -->
</div>
```

### Q6: 组合式函数(Composables)最佳实践?

```js
// useCounter.js
import { ref, computed } from 'vue'

export function useCounter(initialValue = 0) {
  const count = ref(initialValue)
  const double = computed(() => count.value * 2)
  
  function increment() {
    count.value++
  }
  
  return { count, double, increment }
}

// 使用
import { useCounter } from './useCounter'
const { count, increment } = useCounter(10)
```

**命名约定**:`use` 前缀,返回响应式状态和方法。

---

## 四、实战场景题

### 场景1:表单验证(响应式规则)

```js
import { ref, computed } from 'vue'

const email = ref('')
const emailError = computed(() => {
  if (!email.value) return '邮箱不能为空'
  if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email.value)) {
    return '邮箱格式不正确'
  }
  return null
})

const isValid = computed(() => !emailError.value)
```

### 场景2:防抖搜索

```js
import { ref, watch } from 'vue'
import { debounce } from 'lodash-es'

const searchQuery = ref('')
const results = ref([])

const debouncedSearch = debounce(async (query) => {
  results.value = await fetchResults(query)
}, 300)

watch(searchQuery, (newQuery) => {
  debouncedSearch(newQuery)
})
```

### 场景3:权限指令

```js
// directives/permission.js
export const permission = {
  mounted(el, binding) {
    const { value } = binding
    const userPermissions = store.state.user.permissions
    
    if (!userPermissions.includes(value)) {
      el.parentNode?.removeChild(el)
    }
  }
}

// 使用
<button v-permission="'admin:delete'">删除</button>
```

### 场景4:跨组件通信(provide/inject)

```js
// 祖先组件
import { provide, ref } from 'vue'

const theme = ref('dark')
provide('theme', theme)

// 后代组件
import { inject } from 'vue'
const theme = inject('theme')
```

---

## 五、性能优化清单

1. **v-if vs v-show**:频繁切换用 `v-show`,条件稀少用 `v-if`
2. **key 的重要性**:列表用唯一 id,不用 index(会导致错误复用)
3. **组件异步加载**:`defineAsyncComponent(() => import('./Heavy.vue'))`
4. **shallowRef/shallowReactive**:只跟踪浅层响应,深层对象用 `triggerRef` 手动触发
5. **KeepAlive 缓存**:切换时保留组件状态

```vue
<KeepAlive :include="['CompA', 'CompB']">
  <component :is="current" />
</KeepAlive>
```

---

## 参考资料

- [Vue 3 官方文档](https://vuejs.org/)
- [Pinia 官方文档](https://pinia.vuejs.org/)
- [Composition API FAQ](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Vue 3 入门指南(learning-vue3)](https://github.com/chengpeiquan/learning-vue3)
