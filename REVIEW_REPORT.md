# 欧冶半导体全球产业监控大屏 — 全面审查报告

> 审查时间：2026-06-05  
> 审查版本：bigscreen-main.ts commit 3d343e2  
> 审查维度：IT编程专家 / 网站架构师 / 视觉专家

---

## 一、项目概况

| 指标 | 数值 |
|------|------|
| 总代码量 | 10,904 行（.ts + .css） |
| bigscreen-main.ts | 2,104 行 ⚠️ 超大文件 |
| main.ts | 2,787 行 ⚠️ 超大文件 |
| dataService.ts | 1,811 行 ⚠️ 超大文件 |
| staticData.ts | 288 行 |
| bigscreen.css | 872 行 |
| 构建产物 dist/ | 648KB |
| TypeScript 严格模式 | ❌ 关闭 |

---

## 二、IT 编程专家视角

### 🔴 P0 — 严重问题

#### 1. TypeScript 严格模式关闭（`tsconfig.json`）

```json
"strict": false,
"noUnusedLocals": false,
"noUnusedParameters": false,
"noImplicitAny": false
```

**后果**：类型错误无法在编译时捕获，`any` 类型泛滥，重构风险极高。

**建议**：逐步开启严格模式：
```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitAny": true
}
```
对于存量代码，可以先加 `// @ts-ignore` 逐步迁移。

#### 2. JSONP 实现存在内存泄漏风险（`bigscreen-main.ts:54-79`）

```typescript
function jsonpFetch(url: string, timeoutMs = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const cbName = '_emcb_' + Math.random().toString(36).slice(2, 8)
    ;(window as any)[cbName] = (data: any) => {
      delete (window as any)[cbName]  // ✅ 正常路径已清理
      // ...
    }
    setTimeout(() => {
      if ((window as any)[cbName]) {
        delete (window as any)[cbName]  // ✅ 超时路径已清理（代码正确）
        // ...
      }
    }, timeoutMs)
  })
}
```

经过仔细审查，超时路径实际上**已经正确清理**了全局回调。此条撤回。

但仍有问题：**script 标签在超时后没有被移除**（只删除了回调，没删 script 标签）。

```typescript
// 当前代码（超时路径）：
setTimeout(() => {
  if ((window as any)[cbName]) {
    delete (window as any)[cbName]
    document.head.removeChild(script)  // ✅ 实际上有这行，我之前看错了
    reject(...)
  }
}, timeoutMs)
```

经过再次审查，代码实际上**是正确的**，超时和错误路径都正确清理了 script 标签和全局回调。此问题不成立。

#### 3. `any` 类型滥用

- `jsonpFetch` 返回 `Promise<any>`
- `fetchRssWithFallback` 中 `data` 是 `any`
- `renderWorldMapV4` 中 `worldMapData` 是 `any`

**建议**：为 RSS 返回数据定义明确接口：
```typescript
interface RssItem {
  title: string
  link: string
  description: string
  pubDate: string
}
interface RssApiResponse {
  status: string
  items: RssItem[]
}
```

### 🟡 P1 — 重要问题

#### 4. 单文件过大，维护困难

| 文件 | 行数 | 职责 |
|------|------|------|
| `bigscreen-main.ts` | 2,104 | 类型定义 + 数据转换 + 渲染 + 事件绑定 + 地图绘制 |
| `main.ts` | 2,787 | 同样问题 |
| `dataService.ts` | 1,811 | 数据抓取 + 解析 + 降级 + 缓存 |

**建议拆分方案**：

```
src/
├── types.ts           // 所有接口定义
├── data/
│   ├── rssService.ts      // RSS 抓取 + 三层降级
│   ├── stockService.ts    // 股票行情
│   └── policyService.ts  // 政策数据提取
├── render/
│   ├── renderRisk.ts     // 风险预警渲染
│   ├── renderMap.ts      // 地图渲染
│   ├── renderTicker.ts   // Ticker 渲染
│   └── renderPolicy.ts   // 政策面板渲染
├── utils/
│   ├── dom.ts           // DOM 操作工具
│   ├── format.ts        // 格式化工具
│   └── storage.ts       // 本地缓存工具
└── bigscreen-main.ts    // 入口，组合以上模块
```

#### 5. 错误处理不一致

```typescript
// 方式1：记录错误
catch (err) { console.error('[Bigscreen] Init failed:', err) }

// 方式2：静默失败（不利于调试）
catch (_) { /* 降级 */ }

// 方式3：完全忽略
fetchLiveStockQuotes().catch(() => {})  // 错误被吞掉
```

**建议**：统一错误处理策略，至少记录 `console.warn`：

```typescript
const errorHandler = {
  warn(context: string, err: unknown) {
    console.warn(`[${context}]`, err)
  },
  fail(context: string, err: unknown) {
    console.error(`[${context}]`, err)
  }
}
```

#### 6. Race Condition 风险（`liveQuotes` Map）

```typescript
let liveQuotes = new Map<string, LiveQuote>()

async function fetchLiveStockQuotes(): Promise<void> {
  const results = await Promise.allSettled(...)
  const newMap = new Map<string, LiveQuote>()
  // 如果多个 fetchLiveStockQuotes 同时执行，可能覆盖彼此的结果
  if (newMap.size > 0) {
    liveQuotes = newMap  // 直接替换，不是合并
  }
}
```

**建议**：使用锁或队列，或者合并而非替换：
```typescript
const liveQuotesLock = { locked: false }
async function fetchLiveStockQuotes() {
  if (liveQuotesLock.locked) return
  liveQuotesLock.locked = true
  try {
    // ... 抓取逻辑
  } finally {
    liveQuotesLock.locked = false
  }
}
```

#### 7. `escapeHtml` 函数不够完善（`dataService.ts:38-45`）

```typescript
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
```

**问题**：没有处理 Unicode 控制字符（如 `\x00-\x1F`），可能没有处理所有 XSS 向量。

**建议**：使用成熟库：
```typescript
import { escape } from 'xss'  // 或者 'he' 库
```

但实际上，对于 RSS 内容，只转义这 5 个字符已经足够防止基本 XSS。这条降级为 P2。

### 🟢 P2 — 一般问题

#### 8. 模块级变量暴露过多

`bigscreen-main.ts` 中有大量模块级变量：
```typescript
let worldMapData: any = null
let isMapRendering = false
let newsScrollTimer: number | undefined
let currentHotNews: GeoHotNews[] = [...]
```

**建议**：封装在闭包或类中：
```typescript
class BigScreenApp {
  private worldMapData: any = null
  private isMapRendering = false
  // ...
}
```

#### 9. 没有使用 `enum` 而用了大量魔法字符串

```typescript
severity: 'critical' | 'high' | 'medium'  // 应该用 enum
category: 'AI' | '芯片' | '自动驾驶'  // 应该用 enum
```

**建议**：
```typescript
enum Severity { CRITICAL = 'critical', HIGH = 'high', MEDIUM = 'medium' }
enum Category { AI = 'AI', CHIP = '芯片', AUTO = '自动驾驶' }
```

---

## 三、网站架构师视角

### 🔴 P0 — 严重问题

#### 1. API Key 硬编码（`staticData.ts:21`）

```typescript
export const RSS2JSON_API_KEY = '5pqyispe2bx5hz4cxnqfv36tyk3s4x6l6up4cr6f'
```

**后果**：如果仓库是公开的（GitHub），Key 会泄露。

**建议**：使用环境变量：
```typescript
// .env.local（不提交到 Git）
VITE_RSS2JSON_API_KEY=5pqyispe2bx5hz4cxnqfv36tyk3s4x6l6up4cr6f

// staticData.ts
export const RSS2JSON_API_KEY = import.meta.env.VITE_RSS2JSON_API_KEY
```

#### 2. 没有本地缓存策略

**问题**：如果网络完全断开，无法显示任何数据。所有数据都从网络获取。

**建议**：增加 `localStorage` 缓存层：
```typescript
async function fetchWithCache(key: string, fetcher: () => Promise<any>, ttl = 300000) {
  const cached = localStorage.getItem(key)
  if (cached) {
    const { data, timestamp } = JSON.parse(cached)
    if (Date.now() - timestamp < ttl) return data
  }
  const data = await fetcher()
  localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }))
  return data
}
```

### 🟡 P1 — 重要问题

#### 3. 构建配置不完整（`vite.config.ts`）

```typescript
export default defineConfig({
  base: '/oritek-world-monitor/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 缺少以下配置：
    // sourcemap: true,       // 生产环境应该生成 sourcemap
    // minify: 'terser',     // 明确指定压缩工具
    // rollupOptions: { ... } // 只配置了 input，没有配置 output
  },
})
```

**建议**：
```typescript
export default defineConfig({
  base: '/oritek-world-monitor/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: 'hidden',  // 生成 sourcemap 但不引用（用于错误追踪）
    minify: 'terser',
    rollupOptions: {
      input: { ... },
      output: {
        manualChunks: {
          'd3': ['d3', 'd3-geo', 'topojson-client'],
          'vendor': ['some-other-lib']
        }
      }
    }
  },
})
```

#### 4. 模块耦合度高

`bigscreen-main.ts` 直接导入多个模块，没有清晰边界：

```typescript
import { ... } from './staticData'
import type { ... } from './dataService'
import { ... } from './dataService'
```

**建议**：使用依赖注入或事件总线解耦：
```typescript
// 定义接口
interface DataService {
  fetchAllNews(): Promise<NewsResult>
  fetchIndustryIndices(): Promise<IndustryIndex[]>
  // ...
}

// 传入依赖
function init(dataService: DataService) { ... }
```

#### 5. 数据流不清晰

当前数据流：
```
RSS 源 → dataService.ts 抓取 → bigscreen-main.ts 转换 → 渲染
```

中间有很多临时变量和转换函数，缺乏统一的数据存储。

**建议**：设计一个简单的数据存储（Store）：
```typescript
class Store {
  private state: State = initialState
  private listeners: Set<() => void> = new Set()

  getState() { return this.state }
  
  async fetchNews() {
    const news = await fetchAllNews()
    this.state = { ...this.state, news }
    this.notify()
  }
  
  private notify() {
    this.listeners.forEach(fn => fn())
  }
}
```

### 🟢 P2 — 一般问题

#### 6. 没有提供 Service Worker

**问题**：作为一个信息监控大屏，应该支持离线访问。

**建议**：使用 Vite PWA 插件：
```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['oritek-logo.png', 'oritek-icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}']
      }
    })
  ]
})
```

#### 7. 没有使用路由

当前 `index.html` 和 `bigscreen.html` 是两个独立的页面。

**建议**：如果未来增加更多页面，应该使用前端路由（如 `vue-router` 或 `react-router`，或者简单的原生路由）。

---

## 四、视觉专家视角

### 🔴 P0 — 严重问题

#### 1. Google Fonts 在国内可能加载慢或失败（`bigscreen.html:8`）

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:...&family=Noto+Sans+SC:..." rel="stylesheet">
```

**后果**：在国内，Google Fonts 可能被墙或加载极慢，导致页面显示默认字体（效果差）。

**建议**：使用国内镜像或本地托管：
```html
<!-- 方案1：国内镜像 -->
<link href="https://fonts.googleapis.com.cn/css2?..." rel="stylesheet">

<!-- 方案2：本地托管 -->
<link href="/fonts/inter.css" rel="stylesheet">
```

#### 2. `prefers-reduced-motion` 未处理

**问题**：没有为"减少动画"偏好用户提供替代方案。

**建议**：
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 🟡 P1 — 重要问题

#### 3. 动画性能（`bigscreen.css`）

大量使用 `box-shadow` 和 `backdrop-filter`，在低性能设备上可能卡顿。

**建议**：
- 使用 `transform` 和 `opacity` 来实现动画（GPU 加速）
- 为动画元素添加 `will-change: transform, opacity`
- 减少 `box-shadow` 的模糊半径

```css
/* 优化前 */
@keyframes livePulseV4 {
  0%, 100% { box-shadow: 0 0 8px var(--accent-green), 0 0 16px rgba(16, 185, 129, 0.4); }
}

/* 优化后 */
@keyframes livePulseV4 {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.8); }
}
```

#### 4. 响应式设计断点不足

当前只有 1600px 和 1280px 两个断点。

**建议**：增加更多断点：
```css
/* 默认：1920px 及以上 */
.main-grid-v4 { grid-template-columns: 1fr 1.2fr 1fr; }

/* 1440px */
@media (max-width: 1440px) {
  .main-grid-v4 { grid-template-columns: 280px 1fr 280px; }
}

/* 1280px（已有） */
@media (max-width: 1280px) { ... }

/* 1024px（新增） */
@media (max-width: 1024px) {
  .main-grid-v4 { grid-template-columns: 1fr; grid-template-rows: auto auto auto; }
}
```

#### 5. 可访问性（A11y）问题

- 没有使用 `aria-label` 或 `role` 属性
- 颜色对比度可能不符合 WCAG 2.1 AA 标准

**建议**：
```html
<!-- 为图标按钮添加 aria-label -->
<button aria-label="手动刷新数据">🔄 手动刷新</button>

<!-- 为面板添加 role -->
<div role="region" aria-label="风险预警面板">...</div>
```

使用工具检查对比度：
```bash
npx axe DevTools # 或手动检查
```

### 🟢 P2 — 一般问题

#### 6. CSS 变量命名一致性

检查代码后，CSS 变量命名实际上是**一致的**：
- `--bg-deep`（定义）→ `var(--bg-deep)`（使用）✅

但建议增加注释说明用途：
```css
:root {
  /* 背景色 */
  --bg-deep: #020812;      /* 最深背景 */
  --bg-panel: rgba(8, 16, 30, 0.85);  /* 面板背景 */
  --bg-card: rgba(12, 22, 40, 0.7);   /* 卡片背景 */
  
  /* 边框色 */
  --border-panel: rgba(6, 182, 212, 0.1);  /* 面板边框 */
  --border-glow: rgba(6, 182, 212, 0.2);   /* 发光边框 */
}
```

---

## 五、优先级总览

| 优先级 | 问题 | 维度 | 预计工作量 |
|--------|------|------|------------|
| 🔴 P0 | TypeScript 严格模式关闭 | IT | 2-3 天 |
| 🔴 P0 | API Key 硬编码 | 架构 | 0.5 天 |
| 🔴 P0 | 没有本地缓存 | 架构 | 1 天 |
| 🔴 P0 | Google Fonts 国内加载慢 | 视觉 | 0.5 天 |
| 🔴 P0 | `prefers-reduced-motion` 未处理 | 视觉 | 0.5 天 |
| 🟡 P1 | 单文件过大（2k+ 行） | IT | 3-5 天 |
| 🟡 P1 | 构建配置不完整 | 架构 | 0.5 天 |
| 🟡 P1 | 动画性能 | 视觉 | 1 天 |
| 🟡 P1 | 响应式断点不足 | 视觉 | 0.5 天 |
| 🟡 P1 | 可访问性 | 视觉 | 1-2 天 |
| 🟢 P2 | `any` 类型滥用 | IT | 1 天 |
| 🟢 P2 | 错误处理不一致 | IT | 0.5 天 |
| 🟢 P2 | Race Condition 风险 | IT | 0.5 天 |
| 🟢 P2 | 模块级变量暴露 | IT | 1 天 |
| 🟢 P2 | 模块耦合度高 | 架构 | 2-3 天 |
| 🟢 P2 | 数据流不清晰 | 架构 | 2-3 天 |
| 🟢 P2 | 没有 Service Worker | 架构 | 1 天 |
| 🟢 P2 | `escapeHtml` 不够完善 | IT | 0.5 天 |

---

## 六、建议行动计划

### 第一阶段（1-2 周）：解决 P0 问题
1. **API Key 移到环境变量**（0.5 天）—— 立即做，安全风险高
2. **Google Fonts 换国内镜像**（0.5 天）—— 立即做，影响用户体验
3. **增加 `prefers-reduced-motion` 支持**（0.5 天）—— 立即做，可访问性
4. **增加本地缓存层**（1 天）—— 提高可靠性
5. **逐步开启 TypeScript 严格模式**（2-3 天）—— 提高代码质量

### 第二阶段（2-4 周）：解决 P1 问题
1. **拆分超大文件**（3-5 天）—— 提高可维护性
2. **完善构建配置**（0.5 天）—— 提高构建质量
3. **优化动画性能**（1 天）—— 提高流畅度
4. **增加响应式断点**（0.5 天）—— 提高适配性
5. **增加可访问性支持**（1-2 天）—— 提高可用性

### 第三阶段（持续）：解决 P2 问题
1. **减少 `any` 类型使用**（1 天）
2. **统一错误处理**（0.5 天）
3. **修复 Race Condition**（0.5 天）
4. **解耦模块**（2-3 天）
5. **优化数据流**（2-3 天）

---

## 七、总结

**优点**：
- ✅ 功能完整，数据抓取有三层降级策略
- ✅ 视觉效果出色，NOC 风格专业
- ✅ 地图-新闻联动交互设计优秀
- ✅ 使用 D3.js 实现专业地图渲染

**主要问题**：
- ❌ TypeScript 严格模式关闭，类型安全无保障
- ❌ 超大文件（2k+ 行），维护困难
- ❌ API Key 硬编码，安全风险
- ❌ 没有本地缓存，离线无法使用
- ❌ Google Fonts 国内可能加载慢
- ❌ 可访问性支持不足

**整体评价**：
这是一个功能完整、视觉效果优秀的产业监控大屏，但在代码质量、架构设计和可访问性方面还有较大提升空间。建议按照 P0 → P1 → P2 的优先级逐步优化。
