import './style.css'
import { Chart, registerables } from 'chart.js'
import * as d3 from 'd3'
import * as d3Geo from 'd3-geo'
import * as topojson from 'topojson-client'
import {
  type NewsItem,
  type IndustryIndex,
  type GlobalHotspot,
  type CompanyNews,
  type NewsIndustry,
  type AlertItem,
  type AIInsight,
  type StartupFundingItem,
  type FinancialMarket,
  fetchRealNews,
  fetchStockData,
  fetchIndustryIndices,
  fetchGlobalHotspots,
  fetchCompanyNews,
  fetchAllNews,
  forceRefreshAll,
  generateSentimentFromNews,
  generateHeadlinesFromNews,
  generateTechNewsFromNews,
  generateTechTrendsFromNews,
  generateSupplyChainFromNews,
  generatePoliciesFromNews,
  generatePolicyApplicationsFromNews
} from './dataService'
Chart.register(...registerables)

// 世界地图数据缓存
let worldMapData: any = null
let isMapRendering = false
let mapRenderRetryCount = 0
const MAX_MAP_RETRY = 3

// ResizeObserver 专用：跟踪上一次渲染的实际尺寸（避免闭包捕获初始值导致 resize 失效）
let mapLastRenderedWidth = 0
let mapLastRenderedHeight = 0

// ==================== 配置 ====================
// 自动刷新间隔：5分钟
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000

// 获取基础路径 - 兼容开发和生产环境
function getBasePath(): string {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  const isGitHubPages = hostname.includes('github.io')
  return isGitHubPages ? '/oritek-world-monitor' : ''
}

// 获取最新新闻（委托 dataService 处理联网抓取和缓存）
async function fetchLatestNews(): Promise<NewsItem[]> {
  console.log('Fetching latest news from data service...')
  return await fetchRealNews()
}

// ==================== 自动刷新机制 ====================
let autoRefreshInterval: number | null = null

function startAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval)
  }
  
  autoRefreshInterval = window.setInterval(async () => {
    console.log('=== AUTO REFRESH TRIGGERED ===')
    await performFullRefresh()
    showRefreshNotification()
  }, AUTO_REFRESH_INTERVAL)
  
  console.log(`Auto-refresh started: every ${AUTO_REFRESH_INTERVAL / 1000} seconds (5 minutes)`)
}

// 执行完整刷新 - 使用真实RSS数据
async function performFullRefresh() {
  console.log('=== PERFORMING FULL DATA REFRESH ===')
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) {
    console.error('App element not found')
    return
  }
  
  try {
    // 强制刷新所有数据（清除缓存并从RSS获取真实数据）
    const [allNews, indices, hotspots, stocks] = await Promise.all([
      fetchAllNews(),
      fetchIndustryIndices(),
      fetchGlobalHotspots(),
      fetchStockData(['NVDA', 'QCOM', 'MBLY', '09660.HK', '02533.HK', '603893.SH'])
    ])
    
    console.log('Refreshed data:', {
      news: allNews.news.length,
      alerts: allNews.alerts.length,
      aiInsights: allNews.aiInsights.length,
      indices: indices.length,
      hotspots: hotspots.length,
      stocks: stocks.length
    })
    
    // ====== 更新所有全局数据 ======
    
    // 1. 新闻数据
    newsData = allNews.news
    
    // 2. 警报数据
    alertData = allNews.alerts
    
    // 3. AI洞察数据
    aiInsights = allNews.aiInsights
    
    // 4. 创业公司融资数据
    startupFunding = allNews.startupFunding
    
    // 5. 金融市场数据
    financialMarkets = allNews.financialMarkets
    
    // 6. 全球热点
    globalHotspots = hotspots
    
    // 7. 行业指数
    industryIndices = indices.map(idx => ({
      name: idx.name,
      value: idx.value,
      change: idx.change,
      changePercent: idx.changePercent,
      icon: idx.icon,
      timestamp: idx.timestamp
    }))
    
    // 8. 市场表现（竞争对手股价）
    if (stocks.length > 0) {
      marketPerformance = stocks.map(stock => ({
        name: stock.name,
        ticker: stock.symbol,
        price: stock.price,
        change: stock.change,
        changePercent: stock.changePercent,
        marketCap: stock.marketCap || '-',
        threat: (stock.symbol === 'NVDA' || stock.symbol === '09660.HK' ? 'high' : 'medium') as 'high' | 'medium' | 'low'
      }))
      competitors = marketPerformance
    }
    
    // 9. 科技动态热度更新（基于真实新闻）
    const now = new Date()
    const minuteSeed = now.getMinutes()
    techNews = techNews.map((news, i) => ({
      ...news,
      heat: Math.max(50, Math.min(99, news.heat + Math.floor((Math.random() - 0.5) * 10))),
      time: `${minuteSeed + i * 15}分钟前`
    }))

    // 9. 公司新闻（联网抓取）
    try {
      const freshCompanyNews = await fetchCompanyNews()
      if (freshCompanyNews && freshCompanyNews.length > 0) {
        companyNews = freshCompanyNews
        console.log(`[performFullRefresh] 公司新闻已更新，${companyNews.length} 条`)
      }
    } catch (e) {
      console.warn('[performFullRefresh] 公司新闻刷新失败:', e)
    }

    // 重置地图渲染状态（不重置地图数据缓存）
    isMapRendering = false
    mapRenderRetryCount = 0
    
    // 重新渲染整个页面
    app.innerHTML = renderApp()
    bindEvents()
    
    // 等待 DOM 更新后再渲染地图 - 使用 requestAnimationFrame 确保 DOM 已更新
    requestAnimationFrame(async () => {
      console.log('DOM updated, rendering map and charts...')
      initCharts()
      await renderWorldMapD3()
      console.log('=== FULL REFRESH COMPLETED ===')
    })
    
  } catch (error) {
    console.error('Error during full refresh:', error)
    // 出错也尝试重渲染
    app.innerHTML = renderApp()
    bindEvents()
    setTimeout(() => renderWorldMapD3(), 300)
  }
}

function showRefreshNotification() {
  const notification = document.createElement('div')
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
    color: white;
    padding: 15px 25px;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    z-index: 10000;
    font-size: 14px;
    animation: slideIn 0.3s ease;
  `
  notification.innerHTML = '🔄 数据已刷新 - ' + new Date().toLocaleTimeString()
  document.body.appendChild(notification)
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease'
    setTimeout(() => notification.remove(), 300)
  }, 3000)
}

// 添加 CSS 动画
const style = document.createElement('style')
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  .header-btn.spinning {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes pulse-high {
    0%, 100% { r: 10; opacity: 0.6; }
    50% { r: 25; opacity: 0.2; }
  }
  @keyframes pulse-medium {
    0%, 100% { r: 10; opacity: 0.6; }
    50% { r: 22; opacity: 0.2; }
  }
  @keyframes pulse-low {
    0%, 100% { r: 8; opacity: 0.6; }
    50% { r: 18; opacity: 0.2; }
  }
  .hotspot-marker {
    transition: transform 0.2s ease;
  }
  .hotspot-marker:hover {
    transform: scale(1.3);
  }
  .continent-path, .country-path {
    transition: fill 0.3s ease;
  }
  .continent-path:hover, .country-path:hover {
    fill: rgba(40, 60, 90, 0.95) !important;
  }
`
document.head.appendChild(style)

// ==================== 本地数据状态 ====================

// 新闻数据
let newsData: NewsItem[] = []

// 警报数据
let alertData: AlertItem[] = []

// 舆情数据（从新闻情感分析派生）
interface SentimentData {
  positive: number
  neutral: number
  negative: number
  positiveNews: string[]
  negativeNews: string[]
}
let sentimentData: SentimentData = {
  positive: 58,
  neutral: 24,
  negative: 18,
  positiveNews: ['数据加载中...'],
  negativeNews: ['数据加载中...']
}

// 市场表现数据 - 基于真实股价
interface Competitor {
  name: string
  ticker: string
  price: number
  change: number
  changePercent: number
  marketCap: string
  threat: 'high' | 'medium' | 'low'
}

let marketPerformance: Competitor[] = []
let competitors = marketPerformance

// 产业指数
let industryIndices: IndustryIndex[] = []

// 技术趋势（从新闻分析技术热点）
interface TechTrend {
  name: string
  icon: string
  heat: number
  patents: number
  status: 'hot' | 'warm' | 'cool'
}

let techTrends: TechTrend[] = [
  { name: '端到端大模型', icon: '🧠', heat: 92, patents: 234, status: 'hot' },
  { name: '纯视觉方案', icon: '👁️', heat: 78, patents: 156, status: 'hot' },
  { name: '4D 毫米波雷达', icon: '📡', heat: 65, patents: 89, status: 'warm' },
  { name: 'Chiplet 架构', icon: '🔲', heat: 58, patents: 67, status: 'warm' },
  { name: '固态激光雷达', icon: '🔦', heat: 45, patents: 34, status: 'cool' }
]

// 供应链数据（从新闻分析供应链状况）
interface SupplyItem {
  name: string
  region: string
  status: 'normal' | 'warning' | 'critical'
  trend: number
}

let supplyChain: SupplyItem[] = [
  { name: '先进制程晶圆', region: '台湾/韩国', status: 'critical', trend: 35 },
  { name: 'HBM 高带宽存储', region: '韩国', status: 'warning', trend: 28 },
  { name: '高端光刻胶', region: '日本', status: 'warning', trend: 25 },
  { name: '车规级 MCU', region: '中国/欧洲', status: 'normal', trend: -5 },
  { name: '功率半导体', region: '中国/欧洲', status: 'normal', trend: 8 }
]

// 合规政策数据（从政策RSS新闻派生）
interface PolicyItem {
  date: string
  title: string
  description: string
  urgent: boolean
}

let policies: PolicyItem[] = [
  { date: '2026-03-25', title: '美国对华 AI 芯片出口管制新规生效', description: '扩大管制范围至自动驾驶训练芯片', urgent: true },
  { date: '2026-04-01', title: '半导体设备进口税收优惠延续', description: '关键设备进口关税减免政策延长 2 年', urgent: false },
  { date: '2026-04-15', title: '大基金三期投资计划公布', description: '重点投向先进制程和汽车芯片', urgent: false }
]

// AI洞察数据
let aiInsights: AIInsight[] = []

// 创业公司与风投数据
interface StartupFunding {
  id: string
  title: string
  company: string
  amount: string
  investors: string
  sector: string
  time: string
}

let startupFunding: StartupFunding[] = []

// 科技动态数据（从新闻提取）
interface TechNews {
  id: string
  title: string
  category: 'chip' | 'auto' | 'robotics' | 'cloud' | 'ai'
  time: string
  source: string
  heat: number
}

let techNews: TechNews[] = [
  { id: '1', title: '台积电 2nm 工艺良率突破 60%', category: 'chip', time: '3小时前', source: 'Digitimes', heat: 95 },
  { id: '2', title: '特斯拉 FSD V13 开始推送', category: 'auto', time: '5小时前', source: 'Tesla', heat: 88 },
  { id: '3', title: 'Figure AI 发布新一代人形机器人', category: 'robotics', time: '昨天', source: 'Figure', heat: 82 },
  { id: '5', title: 'AWS 推出 Trainium3 训练芯片', category: 'cloud', time: '昨天', source: 'AWS', heat: 75 }
]

// 公司新闻数据
let companyNews: CompanyNews[] = []

// 金融市场数据（暂时保留硬编码，真实股票API需要付费）
let financialMarkets: FinancialMarket[] = [
  { name: '纳斯达克', symbol: 'IXIC', value: 18285.32, change: 125.45, changePercent: 0.69, type: 'index' },
  { name: '费城半导体', symbol: 'SOX', value: 4856.78, change: 68.92, changePercent: 1.44, type: 'index' },
  { name: '上证指数', symbol: '000001', value: 3285.65, change: -12.35, changePercent: -0.37, type: 'index' },
  { name: '恒生科技', symbol: 'HSTECH', value: 4256.89, change: 85.23, changePercent: 2.04, type: 'index' },
  { name: '比特币', symbol: 'BTC', value: 68542, change: 1250, changePercent: 1.86, type: 'crypto' },
  { name: '黄金', symbol: 'XAU', value: 2185.30, change: 12.50, changePercent: 0.57, type: 'commodity' }
]

// 政策申报数据（从政策RSS新闻派生）
interface PolicyApplication {
  id: string
  title: string
  department: string
  region: string
  sector: string
  deadline: string
  amount: string
  status: 'open' | 'closing' | 'closed'
}

let policyApplications: PolicyApplication[] = [
  { id: '1', title: '2026年智能网联汽车创新专项申报', department: '工信部', region: '全国', sector: 'auto', deadline: '2026-04-15', amount: '最高5000万', status: 'open' },
  { id: '2', title: '集成电路产业高质量发展专项资金', department: '发改委', region: '全国', sector: 'chip', deadline: '2026-04-30', amount: '最高1亿', status: 'open' },
  { id: '3', title: '人形机器人关键技术攻关项目', department: '科技部', region: '全国', sector: 'robotics', deadline: '2026-04-10', amount: '最高3000万', status: 'closing' },
  { id: '4', title: '深圳市人工智能产业扶持计划', department: '深圳市工信局', region: '深圳', sector: 'ai', deadline: '2026-05-20', amount: '最高2000万', status: 'open' },
  { id: '5', title: '广东省新能源汽车产业集群项目', department: '广东省发改委', region: '广东', sector: 'auto', deadline: '2026-04-25', amount: '最高8000万', status: 'open' },
  { id: '6', title: '上海市集成电路产业研发专项', department: '上海市科委', region: '上海', sector: 'chip', deadline: '2026-04-08', amount: '最高5000万', status: 'closing' }
]

// 全球热点数据
let globalHotspots: GlobalHotspot[] = []

// 热点地理坐标（扩展完整版，覆盖所有主要热点区域）
const hotspotCoordinates: Record<string, { lon: number; lat: number }> = {
  // 北美
  '美国': { lon: -95, lat: 37 },
  '加拿大': { lon: -106, lat: 56 },
  '墨西哥': { lon: -102, lat: 24 },
  // 南美
  '巴西': { lon: -52, lat: -10 },
  '阿根廷': { lon: -64, lat: -34 },
  // 欧洲
  '欧洲': { lon: 10, lat: 50 },
  '英国': { lon: -2, lat: 54 },
  '德国': { lon: 10, lat: 51 },
  '法国': { lon: 2, lat: 46 },
  '意大利': { lon: 12, lat: 42 },
  '西班牙': { lon: -4, lat: 40 },
  '荷兰': { lon: 5, lat: 52 },
  '波兰': { lon: 20, lat: 52 },
  // 亚洲
  '中国': { lon: 105, lat: 35 },
  '台湾': { lon: 121, lat: 24 },
  '中国台湾': { lon: 121, lat: 24 },
  '日本': { lon: 138, lat: 36 },
  '韩国': { lon: 127, lat: 37 },
  '印度': { lon: 78, lat: 20 },
  '东南亚': { lon: 110, lat: 10 },
  '新加坡': { lon: 104, lat: 1 },
  '越南': { lon: 106, lat: 16 },
  '泰国': { lon: 101, lat: 15 },
  '印尼': { lon: 120, lat: -5 },
  // 中东
  '中东': { lon: 45, lat: 25 },
  '沙特阿拉伯': { lon: 45, lat: 24 },
  '阿联酋': { lon: 54, lat: 24 },
  '伊朗': { lon: 53, lat: 32 },
  '以色列': { lon: 35, lat: 31 },
  // 非洲
  '非洲': { lon: 20, lat: 10 },
  '南非': { lon: 25, lat: -29 },
  '埃及': { lon: 31, lat: 27 },
  // 大洋洲
  '澳大利亚': { lon: 134, lat: -25 },
  '新西兰': { lon: 174, lat: -41 },
  // 俄罗斯
  '俄罗斯': { lon: 105, lat: 60 },
}

let currentPage = 'dashboard'

// ==================== 组件渲染函数 ====================

function renderHeader(): string {
  return `
    <header class="header">
      <div class="header-left">
        <div class="logo">
          <div class="logo-icon">◉</div>
          <div class="logo-text">ORITEK <span class="logo-accent">WORLD MONITOR</span></div>
        </div>
        <nav class="nav">
          <button class="nav-item ${currentPage === 'dashboard' ? 'active' : ''}" data-page="dashboard">全局看板</button>
          <button class="nav-item ${currentPage === 'semiconductor' ? 'active' : ''}" data-page="semiconductor">半导体</button>
          <button class="nav-item ${currentPage === 'automotive' ? 'active' : ''}" data-page="automotive">智能汽车</button>
          <button class="nav-item ${currentPage === 'robotics' ? 'active' : ''}" data-page="robotics">机器人</button>
          <button class="nav-item ${currentPage === 'ai' ? 'active' : ''}" data-page="ai">AI</button>
        </nav>
      </div>
      <div class="header-right">
        <div class="status">
          <div class="status-indicator"></div>
          <span class="status-text">LIVE</span>
        </div>
        <div class="last-update">更新于 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
        <button class="header-btn refresh-btn" id="refreshBtn" title="手动刷新">🔄</button>
        <button class="header-btn">🔔</button>
        <button class="header-btn primary">+ 新建监控</button>
      </div>
    </header>
  `
}

// 资讯快讯数据（从新闻派生）
interface HeadlineItem {
  flag: string
  text: string
}
let globalHeadlines: HeadlineItem[] = [
  { flag: '🔄', text: '正在加载全球产业资讯...' },
  { flag: '📡', text: '数据获取中，请稍候...' }
]

function renderIndustryTicker(): string {
  // 重复数组确保滚动无缝
  const allHeadlines = [...globalHeadlines, ...globalHeadlines]

  return `
    <div class="ticker-bar">
      <div class="ticker-label">产业指数</div>
      <div class="ticker-items">
        ${[...industryIndices, ...industryIndices].map(idx => `
          <div class="ticker-item">
            <span class="ticker-icon">${idx.icon}</span>
            <span class="ticker-name">${idx.name}</span>
            <span class="ticker-value">${idx.value.toFixed(2)}</span>
            <span class="ticker-change ${idx.change >= 0 ? 'up' : 'down'}">${idx.change >= 0 ? '↑' : '↓'} ${Math.abs(idx.changePercent).toFixed(2)}%</span>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="news-ticker-bar">
      <div class="news-ticker-label">全球资讯</div>
      <div class="news-ticker-track">
        ${allHeadlines.map(h => `
          <span class="news-ticker-item">
            <span class="news-ticker-flag">${h.flag}</span>
            <span class="news-ticker-text">${h.text}</span>
          </span>
        `).join('')}
      </div>
    </div>
  `
}

function renderWorldMap(): string {
  const categoryIcons: Record<string, string> = {
    conflict: '⚠️',
    diplomacy: '🔔',
    economy: '📊',
    tech: '💡'
  }

  // 注意：地图渲染将在 DOM 插入后由调用方触发，不在此处 setTimeout
  return `
    <div class="world-map-container">
      <div class="world-map-header">
        <div class="card-title">
          <div class="card-title-icon">🌍</div>
          <span>全球时政热点</span>
        </div>
        <div class="world-map-legend">
          <span class="legend-item"><span class="legend-dot high"></span>高影响</span>
          <span class="legend-item"><span class="legend-dot medium"></span>中影响</span>
          <span class="legend-item"><span class="legend-dot low"></span>低影响</span>
        </div>
      </div>
      <!-- 地图区域 - 全宽展示 -->
      <div class="world-map" id="worldMapContainer">
        <svg viewBox="0 0 1600 800" class="world-map-svg" preserveAspectRatio="xMidYMid meet" id="worldMapSvg" style="width:100%;height:100%;display:block;background:rgba(0,10,30,0.4);">
          <defs>
            <radialGradient id="oceanGradient" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stop-color="rgba(0, 40, 100, 0.3)" />
              <stop offset="100%" stop-color="rgba(0, 0, 0, 0)" />
            </radialGradient>
          </defs>
          <rect class="map-bg" width="1600" height="800" fill="url(#oceanGradient)" />
        </svg>
        <!-- 地图 tooltip -->
        <div id="mapTooltip" style="display:none;position:absolute;background:rgba(5,15,35,0.95);border:1px solid rgba(0,200,255,0.3);border-radius:6px;padding:10px 14px;pointer-events:none;z-index:100;min-width:200px;max-width:280px;backdrop-filter:blur(8px);"></div>
      </div>
      <!-- 热点卡片区域 - 地图下方横向滚动 -->
      <div class="hotspot-list">
        ${globalHotspots.filter(s => hotspotCoordinates[s.region]).slice(0, 8).map(spot => `
          <div class="hotspot-card ${spot.impact}" data-region="${spot.region}">
            <div class="hotspot-card-header">
              <span class="hotspot-card-icon">${categoryIcons[spot.category]}</span>
              <span class="hotspot-card-region">${spot.region}</span>
              <span class="hotspot-card-time">${spot.time}</span>
            </div>
            <div class="hotspot-card-title">${spot.title}</div>
            <div class="hotspot-card-summary">${spot.summary}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

// ==================== 世界地图 D3 渲染 ====================

// ResizeObserver 实例（单例，页面生命周期内有效）
let mapResizeObserver: ResizeObserver | null = null

async function renderWorldMapD3() {
  if (isMapRendering) {
    console.log('Map rendering already in progress, skipping...')
    return
  }

  isMapRendering = true
  console.log('=== Starting D3 World Map Render ===')

  try {
    const svgEl = document.getElementById('worldMapSvg')
    if (!svgEl) {
      console.error('SVG element #worldMapSvg not found in DOM')
      isMapRendering = false
      return
    }

    const svg = d3.select('#worldMapSvg')

    // ── 自适应：获取 SVG 实际渲染尺寸 ──
    const rect = svgEl.getBoundingClientRect()
    const WIDTH  = Math.max(rect.width,  300)   // 最小 300px
    // 强制 2:1 比例：Equirectangular 投影的自然比例
    // 忽略容器的 CSS 高度，始终用宽度的一半作为高度
    const HEIGHT = Math.round(WIDTH / 2)

    // 更新 SVG viewBox 尺寸（强制 2:1）
    svg.attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)

    // ── 投影：Equirectangular 等距圆柱投影 ──
    // 特点：全球完整显示，无裁剪，高纬度地区变形
    // 适合需要同时看到中国、美国、欧洲的应用场景
    //
    // 参数说明：
    // - scale: 根据容器宽度计算，让全球宽度适配容器
    // - translate: 中心点偏移
    const equirectScale = WIDTH / (2 * Math.PI) * 0.95  // 略微缩小留边距
    const projection = d3Geo.geoEquirectangular()
      .scale(equirectScale)
      .translate([WIDTH / 2, HEIGHT / 2])
      .precision(0.1)

    const pathGenerator = d3Geo.geoPath().projection(projection)

    // 清除所有旧内容
    svg.selectAll('g').remove()
    svg.selectAll('.hotspot-markers').remove()

    // 背景 rect
    if (svg.select('rect.map-bg').empty()) {
      svg.insert('rect', ':first-child')
        .attr('class', 'map-bg')
        .attr('width', WIDTH)
        .attr('height', HEIGHT)
        .attr('fill', 'rgba(0, 20, 40, 0.6)')
    } else {
      svg.select('rect.map-bg').attr('width', WIDTH).attr('height', HEIGHT)
    }

    const mapGroup = svg.append('g').attr('id', 'mapGroup')

    // ── 加载地图 TopoJSON ──
    let mapData = worldMapData

    if (!mapData) {
      console.log('Loading map data...')
      const basePath = getBasePath()
      const urls = [
        `${basePath}/world-110m.json`,
        'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
        'https://unpkg.com/world-atlas@2.0.2/countries-110m.json'
      ]

      for (const url of urls) {
        try {
          console.log('Fetching map data from:', url)
          const resp = await fetch(url)
          if (resp.ok) {
            const topology = await resp.json()
            if (topology.objects && topology.objects.countries) {
              mapData = topojson.feature(topology, topology.objects.countries)
              worldMapData = mapData
              console.log(`✅ Map loaded from ${url}: ${(mapData as any).features.length} countries`)
              break
            } else if (topology.objects && topology.objects.land) {
              mapData = topojson.feature(topology, topology.objects.land)
              worldMapData = mapData
              console.log(`✅ Map loaded (land) from ${url}`)
              break
            }
          }
        } catch (e) {
          console.warn('Failed to load from:', url, (e as Error).message)
        }
      }
    }

    if (mapData && (mapData as any).features) {
      const features = (mapData as any).features
      mapGroup.selectAll('path.country')
        .data(features)
        .enter()
        .append('path')
        .attr('class', 'country')
        .attr('d', (d: any) => pathGenerator(d) || '')
        .attr('fill', 'url(#landGradient)')
        .attr('stroke', 'rgba(0, 180, 255, 0.4)')
        .attr('stroke-width', Math.max(0.3, WIDTH / 3200))
        .attr('filter', 'url(#landGlow)')
        .on('mouseenter', function() { d3.select(this).attr('fill', '#2a5a7c').attr('stroke', 'rgba(0, 200, 255, 0.7)') })
        .on('mouseleave',  function() { d3.select(this).attr('fill', 'url(#landGradient)').attr('stroke', 'rgba(0, 180, 255, 0.4)') })
      console.log(`✅ D3 rendered ${features.length} country paths (${WIDTH.toFixed(0)}×${HEIGHT.toFixed(0)})`)
    } else {
      console.warn('All map sources failed, using built-in simplified continents')
      renderFallbackMap(mapGroup, projection)
    }

    // 背景渐变 - 深海效果
    const defs = svg.select('defs').empty() ? svg.insert('defs', ':first-child') : svg.select('defs')
    
    // 海洋渐变
    if (defs.select('#oceanGradient').empty()) {
      const gradient = defs.append('linearGradient')
        .attr('id', 'oceanGradient')
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '0%').attr('y2', '100%')
      gradient.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(0, 40, 80, 0.8)')
      gradient.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(0, 15, 40, 0.9)')
    }
    
    // 大陆渐变
    if (defs.select('#landGradient').empty()) {
      const gradient = defs.append('linearGradient')
        .attr('id', 'landGradient')
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '100%').attr('y2', '100%')
      gradient.append('stop').attr('offset', '0%').attr('stop-color', '#1a3d5c')
      gradient.append('stop').attr('offset', '100%').attr('stop-color', '#0f2840')
    }
    
    // 大陆发光效果
    if (defs.select('#landGlow').empty()) {
      const filter = defs.append('filter')
        .attr('id', 'landGlow')
        .attr('x', '-20%').attr('y', '-20%')
        .attr('width', '140%').attr('height', '140%')
      filter.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'blur')
      filter.append('feFlood').attr('flood-color', 'rgba(0, 180, 255, 0.3)').attr('result', 'color')
      filter.append('feComposite').attr('in', 'color').attr('in2', 'blur').attr('operator', 'in').attr('result', 'glow')
      const merge = filter.append('feMerge')
      merge.append('feMergeNode').attr('in', 'glow')
      merge.append('feMergeNode').attr('in', 'SourceGraphic')
    }

    // ── 渲染热点标记（自适应边界过滤） ──
    renderHotspotMarkers(svg, projection, WIDTH, HEIGHT)

    // ── 经纬网格 ──
    const graticule = d3Geo.geoGraticule()()
    mapGroup.append('path')
      .datum(graticule)
      .attr('d', pathGenerator as any)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(0, 150, 200, 0.12)')
      .attr('stroke-width', 0.5)

    // ── 边框线（世界边缘）- Equirectangular 投影边框是矩形 ──
    const sphere: any = { type: 'Sphere' }
    mapGroup.append('path')
      .datum(sphere)
      .attr('d', pathGenerator as any)
      .attr('fill', 'url(#oceanGradient)')
      .attr('stroke', 'rgba(0, 180, 255, 0.6)')
      .attr('stroke-width', 2)

    // ── 更新本次渲染的实际尺寸（ResizeObserver 回调将对比此值）──
    mapLastRenderedWidth = WIDTH
    mapLastRenderedHeight = HEIGHT

  } catch (error) {
    console.error('Error rendering world map:', error)
  } finally {
    isMapRendering = false
  }
}

// ── ResizeObserver：容器大小变化时自动重绘地图 ──
// 正确做法：observer 仅在首次渲染时注册一次，后续 resize 触发时只重渲染，不重建 observer
let _resizeObserverInitialized = false
function setupMapResizeObserver(container: HTMLElement) {
  if (_resizeObserverInitialized) return
  _resizeObserverInitialized = true

  mapResizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      // 尺寸变化超过 5px 才重绘，对比最近一次渲染的实际尺寸
      if (Math.abs(width - mapLastRenderedWidth) > 5 || Math.abs(height - mapLastRenderedHeight) > 5) {
        console.log(`[ResizeObserver] Map size changed to ${width.toFixed(0)}×${height.toFixed(0)}, re-rendering...`)
        isMapRendering = false   // 重置状态，允许重新渲染
        renderWorldMapD3()
      }
    }
  })

  mapResizeObserver.observe(container)
}

// 渲染热点标记（支持自适应尺寸）- 修复闪烁问题
function renderHotspotMarkers(svg: any, projection: any, WIDTH = 1600, HEIGHT = 800) {

  // ── 热点数据：显示更多热点（最多15个）并启用所有有坐标的热点 ──
  const allHotspots = (globalHotspots && globalHotspots.length > 0)
    ? globalHotspots
    : getDefaultHotspots()
  // 显示所有有坐标的热点，不硬编码数量
  const hotspotsToRender = allHotspots.filter(s => hotspotCoordinates[s.region])

  const impactColors: Record<string, string> = {
    high: '#ff3366',
    medium: '#ff9500',
    low: '#00d4ff'
  }
  const impactPulseSize: Record<string, number> = {
    high: 28,
    medium: 22,
    low: 16
  }

  // 移除旧的热点标记
  svg.selectAll('.hotspot-markers').remove()

  const markersGroup = svg.append('g').attr('class', 'hotspot-markers')

  hotspotsToRender.forEach((spot, idx) => {
    const coord = hotspotCoordinates[spot.region]
    if (!coord) return

    const projected = projection([coord.lon, coord.lat])
    if (!projected) return
    const [x, y] = projected

    // 过滤掉投影到屏幕外的点（使用动态尺寸）
    if (x < -20 || x > WIDTH + 20 || y < -20 || y > HEIGHT + 20) return
    
    const color = impactColors[spot.impact]
    const pulseMax = impactPulseSize[spot.impact]
    const dur = `${1.5 + idx * 0.2}s` // 错开动画时机
    
    const marker = markersGroup.append('g')
      .attr('class', `hotspot-marker impact-${spot.impact}`)
      .attr('data-id', spot.id)
      .attr('data-region', spot.region)
      .attr('transform', `translate(${x}, ${y})`)
      .style('cursor', 'pointer')
    
    // tooltip 标题
    marker.append('title').text(`${spot.region}: ${spot.title}`)
    
    // 发光效果（使用局部 defs）
    const localDefs = svg.select('defs').empty() ? svg.insert('defs', ':first-child') : svg.select('defs')
    const glowFilter = localDefs.select('#hotspotGlow').empty() 
      ? localDefs.append('filter').attr('id', 'hotspotGlow').attr('x', '-100%').attr('y', '-100%').attr('width', '300%').attr('height', '300%')
      : localDefs.select('#hotspotGlow')
    if (localDefs.select('#hotspotGlow').selectAll('*').length === 0) {
      const blur = glowFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur')
      const merge = glowFilter.append('feMerge')
      merge.append('feMergeNode').attr('in', 'coloredBlur')
      merge.append('feMergeNode').attr('in', 'SourceGraphic')
    }
    
    // 脉冲外圈 - 使用 SMIL 动画（SVG 原生，对 r/opacity 属性有效）
    const pulseCircle = marker.append('circle')
      .attr('r', 10)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('opacity', 0.8)
      .attr('filter', 'url(#hotspotGlow)')
    
    pulseCircle.append('animate')
      .attr('attributeName', 'r')
      .attr('from', 10)
      .attr('to', pulseMax + 8)
      .attr('dur', dur)
      .attr('repeatCount', 'indefinite')
    
    pulseCircle.append('animate')
      .attr('attributeName', 'opacity')
      .attr('from', 0.8)
      .attr('to', 0)
      .attr('dur', dur)
      .attr('repeatCount', 'indefinite')
    
    // 实心中心点（静态）
    marker.append('circle')
      .attr('r', 6)
      .attr('fill', color)
      .attr('filter', 'url(#hotspotGlow)')
      .attr('opacity', 0.95)
    
    // 内圈高亮
    marker.append('circle')
      .attr('r', 2)
      .attr('fill', '#ffffff')
      .attr('opacity', 0.8)
    
    // 外圈边框（静态）
    marker.append('circle')
      .attr('r', 8)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1)
      .attr('opacity', 0.5)
    
    // hover 交互：显示详情浮窗 - 修复闪烁问题
    marker
      .on('mouseenter', function(event: MouseEvent) {
        // 高亮当前标记
        d3.select(this).select('circle[fill]')
          .attr('r', 7)
          .attr('opacity', 1)
        
        // 显示浮窗 - 使用 clientX/clientY 配合容器定位，避免闪烁
        const tooltip = d3.select('#mapTooltip')
        if (!tooltip.empty()) {
          const container = document.querySelector('#worldMapContainer')
          if (container) {
            const rect = container.getBoundingClientRect()
            const x = event.clientX - rect.left + 15
            const y = event.clientY - rect.top - 10
            tooltip
              .style('display', 'block')
              .style('left', x + 'px')
              .style('top', y + 'px')
              .html(`
                <div class="map-tooltip-region">${spot.region}</div>
                <div class="map-tooltip-title">${spot.title}</div>
                <div class="map-tooltip-summary">${spot.summary}</div>
                <div class="map-tooltip-time">${spot.time}</div>
              `)
          }
        }
      })
      .on('mousemove', function(event: MouseEvent) {
        // 鼠标移动时实时更新tooltip位置
        const tooltip = d3.select('#mapTooltip')
        if (!tooltip.empty()) {
          const container = document.querySelector('#worldMapContainer')
          if (container) {
            const rect = container.getBoundingClientRect()
            const x = event.clientX - rect.left + 15
            const y = event.clientY - rect.top - 10
            tooltip
              .style('left', x + 'px')
              .style('top', y + 'px')
          }
        }
      })
      .on('mouseleave', function() {
        d3.select(this).select('circle[fill]')
          .attr('r', 6)
          .attr('opacity', 0.95)
        d3.select('#mapTooltip').style('display', 'none')
      })
  })
  
  console.log(`✅ Hotspot markers rendered: ${hotspotsToRender.filter(s => hotspotCoordinates[s.region]).length} points`)
}

// 热点数据默认模板（兜底用）
function getDefaultHotspots(): GlobalHotspot[] {
  return [
    { id: '1', title: '美国对华半导体出口管制再度升级', region: '美国',   category: 'policy',  impact: 'high',   time: '2小时前', summary: '新规将影响先进制程设备出口' },
    { id: '2', title: '台积电先进制程产能持续紧张',     region: '中国台湾', category: 'tech',    impact: 'high',   time: '4小时前', summary: '3nm 订单已排至 2026 年底' },
    { id: '3', title: '欧盟芯片法案补贴计划首批落地',   region: '欧洲',     category: 'policy',  impact: 'medium', time: '6小时前', summary: '430 亿欧元支持本土芯片制造' },
    { id: '4', title: '中国新能源汽车出口高速增长',     region: '中国',     category: 'economy', impact: 'medium', time: '3小时前', summary: 'Q1 出口同比增长 45%' },
    { id: '5', title: '日本扩大半导体设备对华出口限制', region: '日本',     category: 'policy',  impact: 'high',   time: '8小时前', summary: '涉及 23 种先进半导体制造设备' },
    { id: '6', title: '韩国三星先进制程良率持续提升',   region: '韩国',     category: 'tech',    impact: 'medium', time: '10小时前', summary: '3nm GAA 工艺良率已超 60%' },
    { id: '7', title: '中东主权基金大举投资芯片产业',   region: '中东',     category: 'economy', impact: 'medium', time: '12小时前', summary: '沙特阿美联合筹建中东首家先进晶圆厂' },
    { id: '8', title: '印度半导体激励政策吸引多家厂商', region: '印度',     category: 'economy', impact: 'medium', time: '5小时前',  summary: '塔塔集团与 PSMC 合作建厂' },
  ]
}

// 渲染简化版地图（支持投影参数）
function renderFallbackMap(pathsGroup: any, projection?: any) {
  // 使用预定义的简化大陆路径
  const continents = [
    // 北美
    { name: '北美', d: 'M120,100 Q180,80 230,85 L280,90 L310,110 L320,140 L300,170 L260,190 L220,200 L170,190 L120,160 L80,130 L100,110 L120,100' },
    // 南美
    { name: '南美', d: 'M200,250 L250,220 L280,250 L290,300 L270,360 L240,400 L200,410 L180,370 L190,300 L200,250' },
    // 欧洲
    { name: '欧洲', d: 'M440,90 L500,80 L560,90 L580,120 L570,150 L530,165 L480,155 L440,130 L430,100 L440,90' },
    // 非洲
    { name: '非洲', d: 'M450,180 L520,170 L570,200 L580,280 L560,360 L510,400 L460,390 L430,340 L420,260 L450,180' },
    // 亚洲
    { name: '亚洲', d: 'M560,70 L680,60 L800,80 L900,120 L940,180 L920,240 L860,270 L760,260 L660,230 L580,180 L540,120 L560,70' },
    // 澳大利亚
    { name: '澳大利亚', d: 'M820,320 L900,300 L940,340 L930,390 L880,420 L820,400 L800,360 L820,320' }
  ]
  
  pathsGroup
    .selectAll('path')
    .data(continents)
    .enter()
    .append('path')
    .attr('d', (d: any) => d.d)
    .attr('fill', 'rgba(30, 45, 65, 0.9)')
    .attr('stroke', 'rgba(0, 200, 255, 0.4)')
    .attr('stroke-width', 0.8)
    .attr('class', 'continent-path')
    .append('title')
    .text((d: any) => d.name)
  
  console.log('Fallback map rendered with', continents.length, 'continents')
}

// 当前新闻筛选状态
let currentNewsFilter: 'all' | 'competitor' | 'market' = 'all'

function renderNewsCompact(industry: NewsIndustry = 'all'): string {
  // 按行业和类型过滤新闻
  let filteredNews = newsData
  if (industry !== 'all') {
    filteredNews = filteredNews.filter(n => n.industry === industry || n.industry === 'all')
  }
  
  const filteredByCategory = currentNewsFilter === 'all' 
    ? filteredNews 
    : filteredNews.filter(n => n.category === currentNewsFilter)
  
  const industryName = {
    'all': '全行业',
    'semiconductor': '半导体',
    'automotive': '智能汽车',
    'robotics': '机器人',
    'ai': 'AI'
  }[industry] || '全行业'
  
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">📰</div>
          <span>实时情报 · ${industryName}</span>
        </div>
        <div class="card-actions">
          <button class="card-action ${currentNewsFilter === 'all' ? 'active' : ''}" data-filter="all">全部</button>
          <button class="card-action ${currentNewsFilter === 'competitor' ? 'active' : ''}" data-filter="competitor">竞争</button>
          <button class="card-action ${currentNewsFilter === 'market' ? 'active' : ''}" data-filter="market">市场</button>
        </div>
      </div>
      <div class="card-body">
        <div class="news-feed compact" id="newsFeed">
          ${filteredByCategory.slice(0, 5).map(news => `
            <div class="news-item ${news.priority}">
              <div class="news-time">${news.time}</div>
              <div class="news-content">
                <div class="news-title">${news.title}</div>
                <div class="news-meta">
                  <span class="news-tag ${news.category}">${news.category}</span>
                  <span>${news.source}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderAlertCompact(): string {
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">🚨</div>
          <span>风险预警</span>
        </div>
      </div>
      <div class="card-body">
        <div class="alert-list compact">
          ${alertData.slice(0, 3).map(alert => `
            <div class="alert-item ${alert.level}">
              <div class="alert-icon">${alert.icon}</div>
              <div class="alert-content">
                <div class="alert-title">${alert.title}</div>
                <div class="alert-desc">${alert.description}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderMarketPerformanceCompact(): string {
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">📈</div>
          <span>市场表现</span>
        </div>
      </div>
      <div class="card-body">
        <div class="market-row">
          ${marketPerformance.slice(0, 8).map(comp => `
            <div class="market-mini">
              <div class="market-info">
                <div class="market-name">${comp.name}</div>
                <div class="market-ticker">${comp.ticker}</div>
              </div>
              <div class="market-data">
                <div class="market-price ${comp.change >= 0 ? 'up' : 'down'}">
                  ${comp.price > 0 ? (comp.ticker.includes('.HK') || comp.ticker.includes('.SH') ? '¥' : '$') + comp.price.toFixed(2) : '-'}
                </div>
                <div class="market-change ${comp.change >= 0 ? 'up' : 'down'}">
                  ${comp.change >= 0 ? '↑' : '↓'} ${Math.abs(comp.changePercent).toFixed(2)}%
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderTechRadarCompact(): string {
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">🔬</div>
          <span>技术雷达</span>
        </div>
      </div>
      <div class="card-body">
        <div class="tech-list">
          ${techTrends.slice(0, 4).map(tech => `
            <div class="tech-mini">
              <div class="tech-icon">${tech.icon}</div>
              <div class="tech-info">
                <div class="tech-name">${tech.name}</div>
                <div class="tech-heat-bar ${tech.status}" style="width: ${tech.heat}%"></div>
              </div>
              <div class="tech-count">${tech.patents}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderSupplyChainCompact(): string {
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">🔗</div>
          <span>供应链</span>
        </div>
      </div>
      <div class="card-body">
        <div class="supply-list compact">
          ${supplyChain.slice(0, 4).map(item => `
            <div class="supply-item">
              <div class="supply-status ${item.status}"></div>
              <div class="supply-info">
                <div class="supply-name">${item.name}</div>
                <div class="supply-region">${item.region}</div>
              </div>
              <div class="supply-trend ${item.trend > 0 ? 'up' : 'down'}">
                ${item.trend > 0 ? '↑' : '↓'} ${Math.abs(item.trend)}%
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderPolicyCompact(): string {
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">⚖️</div>
          <span>合规政策</span>
        </div>
      </div>
      <div class="card-body">
        <div class="timeline compact">
          ${policies.slice(0, 3).map(policy => `
            <div class="timeline-item ${policy.urgent ? 'urgent' : ''}">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-title">${policy.title}</div>
                <div class="timeline-date">${policy.date}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderSentimentCompact(): string {
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">💬</div>
          <span>舆情监控</span>
        </div>
      </div>
      <div class="card-body">
        <div class="sentiment-mini">
          <div class="sentiment-bar">
            <div class="sentiment-segment positive" style="width: ${sentimentData.positive}%"></div>
            <div class="sentiment-segment neutral" style="width: ${sentimentData.neutral}%"></div>
            <div class="sentiment-segment negative" style="width: ${sentimentData.negative}%"></div>
          </div>
          <div class="sentiment-legend-mini">
            <span><span class="dot positive"></span>正面 ${sentimentData.positive}%</span>
            <span><span class="dot neutral"></span>中性 ${sentimentData.neutral}%</span>
            <span><span class="dot negative"></span>负面 ${sentimentData.negative}%</span>
          </div>
        </div>
      </div>
    </div>
  `
}

function renderCompanyNewsCompact(): string {
  const categoryIcons: Record<string, string> = {
    product: '💎',
    event: '🎯',
    finance: '📊',
    partner: '🤝'
  }
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">🏢</div>
          <span>公司新闻</span>
        </div>
      </div>
      <div class="card-body">
        <div class="company-news-list">
          ${companyNews.slice(0, 4).map(news => `
            <div class="company-news-item">
              <div class="company-news-icon">${categoryIcons[news.category]}</div>
              <div class="company-news-content">
                <div class="company-news-title">${news.title}</div>
                <div class="company-news-meta">
                  <span>${news.source}</span>
                  <span>${news.time}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderAIInsightsCompact(): string {
  const categoryIcons: Record<string, string> = {
    trend: '📈',
    breakthrough: '💡',
    policy: '📋',
    market: '💰'
  }
  return `
    <div class="card ultra-compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">🤖</div>
          <span>AI洞察</span>
        </div>
      </div>
      <div class="card-body">
        <div class="compact-list">
          ${aiInsights.slice(0, 3).map(insight => `
            <div class="compact-item">
              <span class="compact-icon">${categoryIcons[insight.category]}</span>
              <span class="compact-text" title="${insight.title}">${insight.title}</span>
              <span class="compact-time">${insight.time}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderStartupFundingCompact(): string {
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">🚀</div>
          <span>创业公司与风投</span>
        </div>
      </div>
      <div class="card-body">
        <div class="funding-news-list">
          ${startupFunding.slice(0, 3).map(startup => `
            <div class="funding-news-item">
              <div class="funding-news-title">${startup.title}</div>
              <div class="funding-news-meta">
                <span class="funding-news-amount">${startup.amount}</span>
                <span class="funding-news-investors">${startup.investors}</span>
                <span class="funding-news-time">${startup.time}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderTechNewsCompact(): string {
  const categoryIcons: Record<string, string> = {
    chip: '🔲',
    auto: '🚗',
    robotics: '🤖',
    cloud: '☁️'
  }
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">⚡</div>
          <span>科技</span>
        </div>
      </div>
      <div class="card-body">
        <div class="tech-news-list">
          ${techNews.slice(0, 4).map(news => `
            <div class="tech-news-item">
              <div class="tech-news-icon">${categoryIcons[news.category]}</div>
              <div class="tech-news-content">
                <div class="tech-news-title">${news.title}</div>
                <div class="tech-news-meta">
                  <span>${news.source}</span>
                  <span>${news.time}</span>
                </div>
              </div>
              <div class="tech-news-heat">
                <div class="heat-bar" style="width: ${news.heat}%"></div>
                <span>${news.heat}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderFinancialMarketsCompact(): string {
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">💹</div>
          <span>金融</span>
        </div>
      </div>
      <div class="card-body">
        <div class="financial-list">
          ${financialMarkets.slice(0, 6).map(market => `
            <div class="financial-item">
              <div class="financial-info">
                <div class="financial-name">${market.name}</div>
                <div class="financial-symbol">${market.symbol}</div>
              </div>
              <div class="financial-value ${market.change >= 0 ? 'up' : 'down'}">
                ${market.value.toLocaleString()}
              </div>
              <div class="financial-change ${market.change >= 0 ? 'up' : 'down'}">
                ${market.change >= 0 ? '+' : ''}${market.changePercent.toFixed(2)}%
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderPolicyApplicationsWide(): string {
  const sectorIcons: Record<string, string> = {
    auto: '🚗',
    chip: '🔲',
    robotics: '🤖',
    ai: '🧠'
  }
  const statusLabels: Record<string, string> = {
    open: '申报中',
    closing: '即将截止',
    closed: '已截止'
  }
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">📋</div>
          <span>政策申报</span>
        </div>
      </div>
      <div class="card-body">
        <div class="policy-wide-list">
          ${policyApplications.slice(0, 4).map(app => `
            <div class="policy-wide-item ${app.status}">
              <div class="policy-wide-left">
                <span class="policy-wide-icon">${sectorIcons[app.sector]}</span>
                <div class="policy-wide-info">
                  <div class="policy-wide-title">${app.title}</div>
                  <div class="policy-wide-dept">${app.department} · ${app.region}</div>
                </div>
              </div>
              <div class="policy-wide-right">
                <span class="policy-wide-amount">${app.amount}</span>
                <span class="policy-wide-deadline">${app.deadline}</span>
                <span class="policy-wide-status">${statusLabels[app.status]}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

// ==================== 页面渲染 ====================

function renderDashboardPage(): string {
  return `
    <div class="page-section active" id="page-dashboard">
      ${renderIndustryTicker()}
      <div class="dashboard-grid-compact">
        <div class="dashboard-main">
          ${renderWorldMap()}
          ${renderNewsCompact()}
          ${renderMarketPerformanceCompact()}
          <div class="two-column-row">
            ${renderAIInsightsCompact()}
            ${renderStartupFundingCompact()}
          </div>
          ${renderPolicyApplicationsWide()}
        </div>
        <div class="dashboard-sidebar">
          ${renderAlertCompact()}
          ${renderSentimentCompact()}
          ${renderCompanyNewsCompact()}
          ${renderTechRadarCompact()}
          ${renderTechNewsCompact()}
          ${renderSupplyChainCompact()}
          ${renderPolicyCompact()}
          ${renderFinancialMarketsCompact()}
        </div>
      </div>
    </div>
  `
}

function renderSemiconductorPage(): string {
  return `
    <div class="page-section active" id="page-semiconductor">
      <div class="main-container">
        <div class="main-column">
          <div class="stats-row">
            <div class="stat-box">
              <div class="stat-label">半导体指数 <span class="stat-source">(费城半导体指数 SOX)</span></div>
              <div class="stat-value up">4,256.78</div>
              <div class="stat-change up">+1.07%</div>
              <div class="stat-data-source">数据来源: Bloomberg</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">晶圆厂产能 <span class="stat-source">(全球先进制程)</span></div>
              <div class="stat-value up">92%</div>
              <div class="stat-change up">+5%</div>
              <div class="stat-data-source">数据来源: SEMI</div>
            </div>
            <div class="stat-box alert">
              <div class="stat-label">芯片交期 <span class="stat-source">(全球平均)</span></div>
              <div class="stat-value down">40周</div>
              <div class="stat-change up">+8周</div>
              <div class="stat-data-source">数据来源: Susquehanna</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Q1 营收 <span class="stat-source">(全球半导体产业)</span></div>
              <div class="stat-value up">$156B</div>
              <div class="stat-change up">+23%</div>
              <div class="stat-data-source">数据来源: SIA</div>
            </div>
          </div>
          ${renderNewsCompact('semiconductor')}
          ${renderMarketPerformanceCompact()}
        </div>
        <div class="side-column">
          ${renderSupplyChainCompact()}
          ${renderPolicyCompact()}
          ${renderTechRadarCompact()}
        </div>
      </div>
    </div>
  `
}

function renderAutomotivePage(): string {
  return `
    <div class="page-section active" id="page-automotive">
      <div class="main-container">
        <div class="main-column">
          <div class="stats-row">
            <div class="stat-box">
              <div class="stat-label">汽车指数 <span class="stat-source">(中证智能汽车指数)</span></div>
              <div class="stat-value down">1,856.34</div>
              <div class="stat-change down">-1.25%</div>
              <div class="stat-data-source">数据来源: 中证指数</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">新能源车销量 <span class="stat-source">(中国月度)</span></div>
              <div class="stat-value up">285万</div>
              <div class="stat-change up">+15%</div>
              <div class="stat-data-source">数据来源: 中汽协</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">智驾渗透率 <span class="stat-source">(L2+级辅助驾驶)</span></div>
              <div class="stat-value up">32%</div>
              <div class="stat-change up">+8%</div>
              <div class="stat-data-source">数据来源: 高工智能汽车</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">电池价格 <span class="stat-source">(三元锂电芯)</span></div>
              <div class="stat-value down">$45/kWh</div>
              <div class="stat-change down">-12%</div>
              <div class="stat-data-source">数据来源: BloombergNEF</div>
            </div>
          </div>
          ${renderNewsCompact('automotive')}
          ${renderMarketPerformanceCompact()}
          ${renderAIInsightsCompact()}
        </div>
        <div class="side-column">
          ${renderAlertCompact()}
          ${renderTechRadarCompact()}
          ${renderPolicyCompact()}
        </div>
      </div>
    </div>
  `
}

function renderRoboticsPage(): string {
  return `
    <div class="page-section active" id="page-robotics">
      <div class="main-container">
        <div class="main-column">
          <div class="stats-row">
            <div class="stat-box">
              <div class="stat-label">机器人指数 <span class="stat-source">(中证机器人指数)</span></div>
              <div class="stat-value up">2,456.89</div>
              <div class="stat-change up">+2.84%</div>
              <div class="stat-data-source">数据来源: 中证指数</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">人形机器人出货量 <span class="stat-source">(全球年度预测)</span></div>
              <div class="stat-value up">12.5万</div>
              <div class="stat-change up">+180%</div>
              <div class="stat-data-source">数据来源: IFR</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">工业机器人密度 <span class="stat-source">(中国每万人)</span></div>
              <div class="stat-value up">392</div>
              <div class="stat-change up">+15%</div>
              <div class="stat-data-source">数据来源: IFR</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">核心零部件国产化率 <span class="stat-source">(减速器/伺服系统)</span></div>
              <div class="stat-value up">68%</div>
              <div class="stat-change up">+8%</div>
              <div class="stat-data-source">数据来源: GGII</div>
            </div>
          </div>
          ${renderNewsCompact('robotics')}
          ${renderRoboticsCompaniesCompact()}
          ${renderStartupFundingCompact()}
        </div>
        <div class="side-column">
          ${renderAlertCompact()}
          ${renderRoboticsTechRadarCompact()}
          ${renderPolicyApplicationsCompact()}
        </div>
      </div>
    </div>
  `
}

function renderRoboticsCompaniesCompact(): string {
  const roboticsCompanies = [
    { name: '波士顿动力', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '-', threat: 'high' as const },
    { name: '特斯拉Optimus', ticker: 'TSLA', price: 245.67, change: 5.23, changePercent: 2.18, marketCap: '780B', threat: 'high' },
    { name: '宇树科技', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '15B', threat: 'medium' as const },
    { name: '智元机器人', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '12B', threat: 'medium' as const },
    { name: '傅利叶智能', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '8B', threat: 'medium' as const },
    { name: 'Agility Robotics', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '-', threat: 'medium' as const }
  ]
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">🏭</div>
          <span>机器人企业动态</span>
        </div>
      </div>
      <div class="card-body">
        <div class="market-row">
          ${roboticsCompanies.slice(0, 6).map(comp => `
            <div class="market-mini">
              <div class="market-info">
                <div class="market-name">${comp.name}</div>
              </div>
              <div class="market-data">
                <div class="market-price ${comp.change >= 0 ? 'up' : 'down'}">
                  ${comp.price > 0 ? '$' + comp.price.toFixed(2) : '未上市'}
                </div>
                ${comp.price > 0 ? `<div class="market-change ${comp.change >= 0 ? 'up' : 'down'}">${comp.change >= 0 ? '↑' : '↓'} ${Math.abs(comp.changePercent).toFixed(2)}%</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderRoboticsTechRadarCompact(): string {
  const roboticsTech = [
    { name: '具身智能', icon: '🧠', heat: 95, patents: 156, status: 'hot' as const },
    { name: '灵巧手', icon: '🖐️', heat: 82, patents: 89, status: 'hot' as const },
    { name: '谐波减速器', icon: '⚙️', heat: 78, patents: 124, status: 'hot' as const },
    { name: '力控传感器', icon: '📊', heat: 65, patents: 67, status: 'warm' as const },
    { name: '视觉伺服', icon: '👁️', heat: 58, patents: 45, status: 'warm' as const }
  ]
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">🔬</div>
          <span>机器人技术雷达</span>
        </div>
      </div>
      <div class="card-body">
        <div class="tech-list">
          ${roboticsTech.slice(0, 5).map(tech => `
            <div class="tech-mini">
              <div class="tech-icon">${tech.icon}</div>
              <div class="tech-info">
                <div class="tech-name">${tech.name}</div>
                <div class="tech-heat-bar ${tech.status}" style="width: ${tech.heat}%"></div>
              </div>
              <div class="tech-count">${tech.patents}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderAIPage(): string {
  return `
    <div class="page-section active" id="page-ai">
      <div class="main-container">
        <div class="main-column">
          <div class="stats-row">
            <div class="stat-box">
              <div class="stat-label">AI指数 <span class="stat-source">(中证人工智能主题指数)</span></div>
              <div class="stat-value up">3,256.45</div>
              <div class="stat-change up">+2.82%</div>
              <div class="stat-data-source">数据来源: 中证指数</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">大模型备案数 <span class="stat-source">(中国生成式AI)</span></div>
              <div class="stat-value up">218个</div>
              <div class="stat-change up">+35%</div>
              <div class="stat-data-source">数据来源: 网信办</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">AI算力规模 <span class="stat-source">(中国智能算力)</span></div>
              <div class="stat-value up">850 EFLOPS</div>
              <div class="stat-change up">+68%</div>
              <div class="stat-data-source">数据来源: IDC/浪潮</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">端侧AI渗透率 <span class="stat-source">(智能手机/PC)</span></div>
              <div class="stat-value up">28%</div>
              <div class="stat-change up">+12%</div>
              <div class="stat-data-source">数据来源: Counterpoint</div>
            </div>
          </div>
          ${renderNewsCompact('ai')}
          ${renderAICompaniesCompact()}
          ${renderAIInsightsCompact()}
        </div>
        <div class="side-column">
          ${renderAlertCompact()}
          ${renderAITechRadarCompact()}
          ${renderTechNewsCompact()}
          ${renderFinancialMarketsCompact()}
        </div>
      </div>
    </div>
  `
}

function renderAICompaniesCompact(): string {
  const aiCompanies = [
    { name: '英伟达', ticker: 'NVDA', price: 875.28, change: 12.45, changePercent: 1.44, marketCap: '2.16T', threat: 'high' as const },
    { name: '微软', ticker: 'MSFT', price: 425.32, change: 3.21, changePercent: 0.76, marketCap: '3.15T', threat: 'high' },
    { name: '谷歌', ticker: 'GOOGL', price: 175.98, change: -1.23, changePercent: -0.69, marketCap: '2.18T', threat: 'high' },
    { name: 'OpenAI', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '80B', threat: 'high' as const },
    { name: '百度', ticker: 'BIDU', price: 98.45, change: 2.15, changePercent: 2.23, marketCap: '34B', threat: 'medium' as const },
    { name: '商汤科技', ticker: '0020.HK', price: 1.25, change: -0.05, changePercent: -3.85, marketCap: '4B', threat: 'medium' as const }
  ]
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">🧠</div>
          <span>AI企业动态</span>
        </div>
      </div>
      <div class="card-body">
        <div class="market-row">
          ${aiCompanies.slice(0, 6).map(comp => `
            <div class="market-mini">
              <div class="market-info">
                <div class="market-name">${comp.name}</div>
                <div class="market-ticker">${comp.ticker}</div>
              </div>
              <div class="market-data">
                <div class="market-price ${comp.change >= 0 ? 'up' : 'down'}">
                  ${comp.price > 0 ? '$' + comp.price.toFixed(2) : '未上市'}
                </div>
                ${comp.price > 0 ? `<div class="market-change ${comp.change >= 0 ? 'up' : 'down'}">${comp.change >= 0 ? '↑' : '↓'} ${Math.abs(comp.changePercent).toFixed(2)}%</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderAITechRadarCompact(): string {
  const aiTech = [
    { name: '大语言模型', icon: '📚', heat: 98, patents: 523, status: 'hot' as const },
    { name: '多模态AI', icon: '🎨', heat: 92, patents: 312, status: 'hot' as const },
    { name: 'AI Agent', icon: '🤖', heat: 88, patents: 189, status: 'hot' as const },
    { name: '端侧推理', icon: '📱', heat: 75, patents: 156, status: 'warm' as const },
    { name: 'RAG技术', icon: '🔍', heat: 68, patents: 98, status: 'warm' as const }
  ]
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">🔬</div>
          <span>AI技术雷达</span>
        </div>
      </div>
      <div class="card-body">
        <div class="tech-list">
          ${aiTech.slice(0, 5).map(tech => `
            <div class="tech-mini">
              <div class="tech-icon">${tech.icon}</div>
              <div class="tech-info">
                <div class="tech-name">${tech.name}</div>
                <div class="tech-heat-bar ${tech.status}" style="width: ${tech.heat}%"></div>
              </div>
              <div class="tech-count">${tech.patents}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderPolicyApplicationsCompact(): string {
  const sectorIcons: Record<string, string> = {
    auto: '🚗',
    chip: '🔲',
    robotics: '🤖',
    ai: '🧠'
  }
  return `
    <div class="card ultra-compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">📋</div>
          <span>政策申报</span>
        </div>
      </div>
      <div class="card-body">
        <div class="compact-list">
          ${policyApplications.slice(0, 3).map(app => `
            <div class="compact-item">
              <span class="compact-icon">${sectorIcons[app.sector]}</span>
              <span class="compact-text" title="${app.title}">${app.department} · ${app.amount}</span>
              <span class="compact-badge ${app.status}">${app.deadline.slice(5)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderApp(): string {
  const pageContent = currentPage === 'dashboard' ? renderDashboardPage() :
                      currentPage === 'semiconductor' ? renderSemiconductorPage() :
                      currentPage === 'automotive' ? renderAutomotivePage() :
                      currentPage === 'robotics' ? renderRoboticsPage() :
                      currentPage === 'ai' ? renderAIPage() :
                      renderDashboardPage()
  
  return `
    <div class="app-container">
      ${renderHeader()}
      <main class="main-content">
        ${pageContent}
      </main>
    </div>
  `
}

// ==================== 图表初始化 ====================

function initCharts() {
  const ctx = document.getElementById('marketChart') as HTMLCanvasElement
  if (!ctx) return

  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  const data1 = Array.from({ length: 24 }, () => 4000 + Math.random() * 500)
  const data2 = Array.from({ length: 24 }, () => 1800 + Math.random() * 300)

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '半导体指数',
          data: data1,
          borderColor: '#00d4ff',
          backgroundColor: 'rgba(0, 212, 255, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4
        },
        {
          label: '智能汽车指数',
          data: data2,
          borderColor: '#00ff88',
          backgroundColor: 'rgba(0, 255, 136, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#94a3b8',
            font: { size: 11 },
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(94, 234, 212, 0.2)',
          borderWidth: 1,
          padding: 10,
          displayColors: false
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(148, 163, 184, 0.05)'
          },
          ticks: {
            color: '#64748b',
            font: { size: 10 },
            maxTicksLimit: 8
          }
        },
        y: {
          grid: {
            color: 'rgba(148, 163, 184, 0.05)'
          },
          ticks: {
            color: '#64748b',
            font: { size: 10 }
          }
        }
      }
    }
  })
}

// ==================== 事件绑定 ====================

function bindEvents() {
  // 导航交互
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'))
      item.classList.add('active')
      const page = item.getAttribute('data-page')
      if (page) {
        currentPage = page
        const app = document.querySelector<HTMLDivElement>('#app')
        if (app) {
          app.innerHTML = renderApp()
          bindEvents()
          // 等待 DOM 更新后重新渲染图表和地图
          requestAnimationFrame(() => {
            if (page === 'dashboard' || page === 'automotive') {
              initCharts()
              renderWorldMapD3()
            }
          })
        }
      }
    })
  })

  // 刷新按钮 - 手动刷新
  const refreshBtn = document.getElementById('refreshBtn')
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      if (refreshBtn.classList.contains('spinning')) return // 防止重复点击
      refreshBtn.classList.add('spinning')
      refreshBtn.setAttribute('disabled', 'true')
      console.log('=== MANUAL REFRESH TRIGGERED ===')
      try {
        await performFullRefresh()
        showRefreshNotification()
      } catch (e) {
        console.error('Manual refresh failed:', e)
      }
      // performFullRefresh 会重渲染 DOM，需要重新获取按钮
      const newBtn = document.getElementById('refreshBtn')
      if (newBtn) {
        newBtn.classList.remove('spinning')
        newBtn.removeAttribute('disabled')
      }
    })
  }

  // 新闻筛选按钮
  document.querySelectorAll('.card-action[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter') as 'all' | 'competitor' | 'market'
      currentNewsFilter = filter
      const app = document.querySelector<HTMLDivElement>('#app')
      if (app) {
        app.innerHTML = renderApp()
        bindEvents()
        if (currentPage === 'dashboard' || currentPage === 'automotive') {
          requestAnimationFrame(() => {
            initCharts()
            renderWorldMapD3()
          })
        }
        // CRITICAL: 重新渲染地图 - 修复筛选按钮导致地图消失的问题
        requestAnimationFrame(() => {
          setTimeout(() => renderWorldMapD3(), 150)
        })
      }
    })
  })
}

// ==================== 初始化 ====================

async function init() {
  console.log('Initializing Oritek World Monitor...')
  const app = document.querySelector<HTMLDivElement>('#app')
  if (app) {
    try {
      console.log('Fetching all data from RSS sources...')
      
      // 并行获取所有数据
      const [allNews, indices, hotspots, stocks] = await Promise.all([
        fetchAllNews(),
        fetchIndustryIndices(),
        fetchGlobalHotspots(),
        fetchStockData(['NVDA', 'QCOM', 'MBLY', '09660.HK', '02533.HK', '603893.SH'])
      ])
      
      console.log('All data fetched:', {
        news: allNews.news.length,
        alerts: allNews.alerts.length,
        aiInsights: allNews.aiInsights.length,
        startupFunding: allNews.startupFunding.length,
        financialMarkets: allNews.financialMarkets.length,
        indices: indices.length,
        hotspots: hotspots.length,
        stocks: stocks.length
      })
      
      // 初始化全局数据 - 使用从RSS获取的真实数据
      newsData = allNews.news
      alertData = allNews.alerts
      aiInsights = allNews.aiInsights
      startupFunding = allNews.startupFunding
      financialMarkets = allNews.financialMarkets
      globalHotspots = hotspots
      industryIndices = indices.map(idx => ({
        name: idx.name,
        value: idx.value,
        change: idx.change,
        changePercent: idx.changePercent,
        icon: idx.icon,
        timestamp: idx.timestamp
      }))
      
      // 更新市场表现数据
      marketPerformance = stocks.map(stock => ({
        name: stock.name,
        ticker: stock.symbol,
        price: stock.price,
        change: stock.change,
        changePercent: stock.changePercent,
        marketCap: stock.marketCap || '-',
        threat: (stock.symbol === 'NVDA' || stock.symbol === '09660.HK' ? 'high' : 'medium') as 'high' | 'medium' | 'low'
      }))
      competitors = marketPerformance

      // 从新闻派生各类数据
      const allNewsList = allNews.news
      sentimentData = generateSentimentFromNews(allNewsList)
      techTrends = generateTechTrendsFromNews(allNewsList)
      supplyChain = generateSupplyChainFromNews(allNewsList)
      policies = generatePoliciesFromNews(allNewsList)
      // 政策申报：仅在有匹配数据时才覆盖硬编码兜底数据
      const generatedPolicyApps = generatePolicyApplicationsFromNews(allNewsList)
      if (generatedPolicyApps.length > 0) {
        policyApplications = generatedPolicyApps
      }
      techNews = generateTechNewsFromNews(allNewsList)
      globalHeadlines = generateHeadlinesFromNews(allNewsList)

      console.log('All data loaded from RSS')
      
      app.innerHTML = renderApp()
      console.log('App rendered')
      
      bindEvents()
      console.log('Events bound')
      
      initCharts()
      console.log('Charts initialized')
      
      startAutoRefresh()
      console.log('Auto refresh started (5 minutes interval)')

      // 延迟渲染地图，等待 DOM 更新
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          console.log('Triggering initial map render...')
          renderWorldMapD3()
        })
      })
      
    } catch (error) {
      console.error('Error during initialization:', error)
      // 即使出错也渲染基本页面
      if (!app.innerHTML) {
        app.innerHTML = renderApp()
        bindEvents()
        initCharts()
      }
      setTimeout(() => renderWorldMapD3(), 500)
    }
  } else {
    console.error('App element not found')
  }
}

// 启动应用
init()

console.log('Oritek World Monitor initialized')
