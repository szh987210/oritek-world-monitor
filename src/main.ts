import './style.css'
import { Chart, registerables } from 'chart.js'
import * as d3 from 'd3'
import * as d3Geo from 'd3-geo'
import * as topojson from 'topojson-client'
import { getBasePath } from './renderHelpers'
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
  generatePolicyApplicationsFromNews,
  generateRoboticsCompaniesFromNews,
  generateAICompaniesFromNews,
  generateRoboticsTechFromNews,
  generateAITechFromNews,
  getSourceHealthStats,
  runHealthCheck,
  getAllSourceScores,
  type RssSourceHealth,
} from './dataService'
Chart.register(...registerables)

// 网络/连接状态追踪
let isOnline = true
let lastNetworkError = ''

// 新闻搜索状态
let newsSearchQuery = ''

// 世界地图数据缓存
let worldMapData: any = null
let isMapRendering = false
let mapRenderRetryCount = 0
const MAX_MAP_RETRY = 3

// ResizeObserver 专用：跟踪上一次渲染的实际尺寸（避免闭包捕获初始值导致 resize 失效）
let mapLastRenderedWidth = 0
let mapLastRenderedHeight = 0

// Chart.js 实例追踪（全局变量，防止内存泄漏）
let marketChartInstance: Chart | null = null

// ==================== 配置 ====================
// 自动刷新间隔：5分钟
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000

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
// 并发防护：防止多个刷新同时执行
let isRefreshing = false

async function performFullRefresh() {
  // 并发防护：如果已有刷新在进行，跳过本次
  if (isRefreshing) {
    console.log('[performFullRefresh] 刷新正在进行中，跳过本次请求')
    return
  }
  isRefreshing = true

  console.log('=== PERFORMING FULL DATA REFRESH ===')
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) {
    isRefreshing = false
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
    
    // 9. 科技动态热度更新（基于真实新闻来源权重，不再使用 Math.random）
    // 来源权重表：知名来源热度更高
    const sourceWeight: Record<string, number> = {
      'Digitimes': 3, 'NVIDIA': 3, 'TSMC': 3, '台积电': 3, 'Tesla': 3, '特斯拉': 3,
      'TechCrunch': 2, 'The Verge': 2, 'Ars Technica': 2, 'BBC': 2, 'CNN': 2,
      'Semi Engineering': 2, 'EE Times': 2, 'Semiconductor Today': 2,
      '36氪': 1, 'SemiWiki': 1, 'Evertiq': 1, 'The Robot Report': 1, 'Semi Digest': 1
    }
    const now = new Date()
    const minuteSeed = now.getMinutes()
    techNews = techNews.map((news, i) => {
      const weight = sourceWeight[news.source] || 1
      const heatAdjustment = (weight * 3) + ((minuteSeed + i) % 7) - 3
      return {
        ...news,
        heat: Math.max(50, Math.min(99, news.heat + heatAdjustment)),
        time: `${minuteSeed + i * 15}分钟前`
      }
    })

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

    // 10. 从新闻动态派生技术趋势、供应链、政策、申报数据 (P2-3)
    if (newsData.length > 0) {
      const freshTechTrends = generateTechTrendsFromNews(newsData)
      if (freshTechTrends.length > 0) techTrends = freshTechTrends

      const freshSupply = generateSupplyChainFromNews(newsData)
      if (freshSupply.length > 0) supplyChain = freshSupply

      const freshPolicies = generatePoliciesFromNews(newsData)
      if (freshPolicies.length > 0) policies = freshPolicies

      const freshApplications = generatePolicyApplicationsFromNews(newsData)
      if (freshApplications.length > 0) policyApplications = freshApplications

      const freshRobotics = generateRoboticsCompaniesFromNews(newsData)
      if (freshRobotics.length > 0) roboticsCompanies = freshRobotics

      const freshAI = generateAICompaniesFromNews(newsData)
      if (freshAI.length > 0) aiCompanies = freshAI

      const freshRoboticsTech = generateRoboticsTechFromNews(newsData)
      if (freshRoboticsTech.length > 0) roboticsTech = freshRoboticsTech

      const freshAITech = generateAITechFromNews(newsData)
      if (freshAITech.length > 0) aiTech = freshAITech

      console.log('[performFullRefresh] 派生数据: 技术趋势', freshTechTrends.length, '供应链', freshSupply.length, '政策', freshPolicies.length, '申报', freshApplications.length)
    }

    // 11. RSS源健康统计更新 (P2-2)
    sourceHealthStats = getSourceHealthStats()

    // 重置地图渲染状态（不重置地图数据缓存）
    isMapRendering = false
    mapRenderRetryCount = 0
    isOnline = true
    lastNetworkError = ''
    
    // 重新渲染整个页面
    app.innerHTML = renderApp()
    bindEvents()
    
    // 等待 DOM 更新后再渲染地图 - 使用 requestAnimationFrame 确保 DOM 已更新
    requestAnimationFrame(async () => {
      console.log('DOM updated, rendering map and charts...')
      initCharts()
      await renderWorldMapD3()
      // 重启实时情报自动滚动
      setTimeout(() => startIntelAutoScroll(), 800)
      console.log('=== FULL REFRESH COMPLETED ===')
    })
  } catch (error) {
    console.error('Error during full refresh:', error)
    isOnline = false
    lastNetworkError = error instanceof Error ? error.message : '网络连接失败'
    // 出错也尝试重渲染
    app.innerHTML = renderApp()
    bindEvents()
    setTimeout(() => renderWorldMapD3(), 300)
  } finally {
    isRefreshing = false
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

  /* ========== 热点地图脉冲动画 ========== */
  @keyframes hs-pulse-high {
    0%   { r: 10px; opacity: 0.9; stroke-width: 2.5px; }
    50%  { r: 30px; opacity: 0.15; stroke-width: 1px; }
    100% { r: 10px; opacity: 0.9; stroke-width: 2.5px; }
  }
  @keyframes hs-ring-high {
    0%   { r: 14px; opacity: 0.5; }
    50%  { r: 38px; opacity: 0; }
    100% { r: 14px; opacity: 0.5; }
  }
  @keyframes hs-pulse-medium {
    0%   { r: 10px; opacity: 0.9; stroke-width: 2.5px; }
    50%  { r: 26px; opacity: 0.15; stroke-width: 1px; }
    100% { r: 10px; opacity: 0.9; stroke-width: 2.5px; }
  }
  @keyframes hs-ring-medium {
    0%   { r: 14px; opacity: 0.5; }
    50%  { r: 32px; opacity: 0; }
    100% { r: 14px; opacity: 0.5; }
  }
  @keyframes hs-pulse-low {
    0%   { r: 8px; opacity: 0.9; stroke-width: 2px; }
    50%  { r: 20px; opacity: 0.2; stroke-width: 1px; }
    100% { r: 8px; opacity: 0.9; stroke-width: 2px; }
  }
  @keyframes hs-ring-low {
    0%   { r: 12px; opacity: 0.4; }
    50%  { r: 26px; opacity: 0; }
    100% { r: 12px; opacity: 0.4; }
  }

  /* 热点脉冲圆圈应用动画 */
  .hs-pulse-high {
    animation: hs-pulse-high 2s ease-in-out infinite;
    transform-origin: center;
    transform-box: fill-box;
  }
  .hs-ring-high {
    animation: hs-ring-high 2s ease-out infinite;
    transform-origin: center;
    transform-box: fill-box;
  }
  .hs-pulse-medium {
    animation: hs-pulse-medium 2.2s ease-in-out infinite;
    transform-origin: center;
    transform-box: fill-box;
  }
  .hs-ring-medium {
    animation: hs-ring-medium 2.2s ease-out infinite;
    transform-origin: center;
    transform-box: fill-box;
  }
  .hs-pulse-low {
    animation: hs-pulse-low 2.5s ease-in-out infinite;
    transform-origin: center;
    transform-box: fill-box;
  }
  .hs-ring-low {
    animation: hs-ring-low 2.5s ease-out infinite;
    transform-origin: center;
    transform-box: fill-box;
  }

  /* ========== 公司新闻垂直滚动播放 ========== */
  /* 参考实时情报的上下滚动形式 - 可同时显示5条新闻 */
  @keyframes company-news-scroll-up {
    0%   { transform: translateY(0); }
    100% { transform: translateY(-50%); }
  }
  .company-news-marquee-wrap {
    overflow: hidden;
    position: relative;
    height: 280px; /* 固定高度，可同时显示5条新闻 */
  }
  .company-news-track {
    display: flex;
    flex-direction: column;
    gap: 8px;
    animation: company-news-scroll-up 30s linear infinite; /* 8条新闻，30秒滚动 */
  }
  .company-news-track:hover {
    animation-play-state: paused;
  }
  .company-news-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
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

  /* ========== 数据来源标注徽章 (P2-3) ========== */
  .data-source-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 3px;
    margin-left: 6px;
    font-weight: 500;
    letter-spacing: 0.5px;
  }
  .data-source-badge.live {
    background: rgba(0, 212, 255, 0.15);
    color: #00d4ff;
  }
  .data-source-badge.base {
    background: rgba(255, 149, 0, 0.15);
    color: #ff9500;
  }

  /* ========== 数据源健康面板 ========== */
  .health-panel {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 11px;
    color: var(--text-muted);
  }
  .health-indicator {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 10px;
  }
  .health-indicator.good { background: rgba(0, 200, 100, 0.12); color: #00c864; }
  .health-indicator.warn { background: rgba(255, 149, 0, 0.12); color: #ff9500; }
  .health-indicator.bad  { background: rgba(255, 50, 50, 0.12); color: #ff3250; }

  /* ========== 来源验证标记 (P2-5) ========== */
  .verify-badge {
    font-size: 10px;
    padding: 1px 4px;
    border-radius: 3px;
    margin-left: 2px;
  }
  .verify-badge.fail {
    background: rgba(255, 50, 50, 0.12);
    color: #ff3250;
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

// 全局数据源健康状态
let sourceHealthStats: RssSourceHealth[] = []

// 技术趋势数据（从新闻动态分析派生，初始为空）
let techTrends: TechTrend[] = []

// 供应链数据（从新闻分析供应链状况）
interface SupplyItem {
  name: string
  region: string
  status: 'normal' | 'warning' | 'critical'
  trend: number
}

// 供应链数据（从新闻动态分析派生，初始为空）
let supplyChain: SupplyItem[] = []

// 合规政策数据（从政策RSS新闻派生）
interface PolicyItem {
  date: string
  title: string
  description: string
  urgent: boolean
}

// 合规政策数据（从RSS新闻动态派生，初始为空）
let policies: PolicyItem[] = []

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

// 科技动态数据（从真实新闻派生，初始为空，首次渲染后由数据服务填充）
// 已清除硬编码默认值：不再使用假数据作为页面初始状态
let techNews: TechNews[] = []

// 公司新闻数据
let companyNews: CompanyNews[] = []

// 地图热点tooltip状态跟踪（防止闪烁）
let _currentTooltipSpotId: string | null = null
let _tooltipTimeout: number | null = null

// 金融市场数据（从新闻+基准指数动态派生，初始为空）
let financialMarkets: FinancialMarket[] = []

// 企业动态数据（从新闻+基准股价派生）
interface CompanyDynamic {
  name: string
  ticker: string
  price: number
  change: number
  changePercent: number
  marketCap: string
  latestNews: string
}

let roboticsCompanies: CompanyDynamic[] = []
let aiCompanies: CompanyDynamic[] = []

// 子页面技术雷达（从新闻关键词统计派生）
let roboticsTech: TechTrend[] = []
let aiTech: TechTrend[] = []

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

// 政策申报数据（从RSS新闻动态派生，初始为空）
let policyApplications: PolicyApplication[] = []

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

// ==================== 骨架屏渲染 ====================

function renderSkeleton(): string {
  const sk = (w = '100%', h = '14px', mt = '0') =>
    `<div class="skeleton" style="width:${w};height:${h};margin-top:${mt};border-radius:4px;"></div>`
  const skCard = (title: string) => `
    <div class="card compact skeleton-card" style="animation:none;">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon skeleton" style="width:20px;height:20px;border-radius:4px;"></div>
          <div class="skeleton" style="width:80px;height:14px;border-radius:4px;"></div>
        </div>
      </div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:8px;">
        ${sk('85%')}
        ${sk('70%')}
        ${sk('90%')}
        ${sk('60%')}
      </div>
    </div>
  `

  return `
    <div class="app-container">
      ${renderHeader()}
      <div class="ticker-bar" style="margin-top:var(--header-height);background:rgba(0,10,30,0.6);border-bottom:1px solid var(--border-color);padding:8px 16px;display:flex;align-items:center;gap:12px;overflow:hidden;">
        <div class="skeleton" style="width:80px;height:12px;border-radius:4px;flex-shrink:0;"></div>
        <div style="display:flex;gap:20px;flex:1;overflow:hidden;">
          <div class="skeleton" style="width:100px;height:12px;border-radius:4px;"></div>
          <div class="skeleton" style="width:120px;height:12px;border-radius:4px;"></div>
          <div class="skeleton" style="width:90px;height:12px;border-radius:4px;"></div>
          <div class="skeleton" style="width:110px;height:12px;border-radius:4px;"></div>
        </div>
      </div>
      <div class="dashboard-grid">
        <div class="grid-cell main-cell">
          <div class="stats-row">
            ${[1,2,3,4].map(() => `
              <div class="stat-box" style="animation:none;">
                <div class="skeleton" style="width:60%;height:11px;border-radius:4px;margin-bottom:10px;"></div>
                <div class="skeleton" style="width:80%;height:28px;border-radius:4px;margin-bottom:8px;"></div>
                <div class="skeleton" style="width:40%;height:11px;border-radius:4px;"></div>
              </div>
            `).join('')}
          </div>
          <div class="card" style="animation:none;">
            <div class="card-header">
              <div class="card-title">
                <div class="skeleton" style="width:20px;height:20px;border-radius:4px;"></div>
                <div class="skeleton" style="width:100px;height:14px;border-radius:4px;"></div>
              </div>
              <div class="card-actions">
                ${['全部','竞争','市场','科技','政策','供应链'].map(t =>
                  `<button class="card-action skeleton" style="width:${30 + t.length * 7}px;height:24px;border-radius:4px;opacity:0.4;"></button>`
                ).join('')}
              </div>
            </div>
            <div class="card-body">
              ${[1,2,3,4,5,6].map(() => `
                <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
                  <div class="skeleton" style="width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px;"></div>
                  <div style="flex:1;">
                    <div class="skeleton" style="width:85%;height:13px;border-radius:4px;margin-bottom:6px;"></div>
                    <div class="skeleton" style="width:50%;height:10px;border-radius:4px;"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="world-map-container" style="animation:none;">
            <div class="world-map-header">
              <div class="card-title">
                <div class="skeleton" style="width:20px;height:20px;border-radius:4px;"></div>
                <div class="skeleton" style="width:100px;height:14px;border-radius:4px;"></div>
              </div>
            </div>
            <div class="world-map" id="worldMapContainer" style="position:relative;">
              <div id="mapLoadingOverlay" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:10;">
                <div style="font-size:32px;animation:pulse 1.5s ease-in-out infinite;">🌍</div>
                <div class="skeleton" style="width:200px;height:4px;border-radius:2px;overflow:hidden;position:relative;">
                  <div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(0,212,255,0.5),transparent);animation:shimmer 1s infinite;background-size:200% 100%;"></div>
                </div>
                <div style="color:var(--text-muted);font-size:12px;">正在加载地图数据...</div>
              </div>
              <svg viewBox="0 0 1600 800" class="world-map-svg" id="worldMapSvg" style="width:100%;height:100%;display:block;opacity:0.3;background:rgba(0,10,30,0.4);">
                <defs>
                  <radialGradient id="oceanGradient" cx="50%" cy="50%" r="70%">
                    <stop offset="0%" stop-color="rgba(0, 40, 100, 0.3)" />
                    <stop offset="100%" stop-color="rgba(0, 0, 0, 0)" />
                  </radialGradient>
                </defs>
                <rect class="map-bg" width="1600" height="800" fill="url(#oceanGradient)" />
              </svg>
            </div>
          </div>
        </div>
        <div class="grid-cell side-cell">
          ${skCard('风险预警')}
          ${skCard('舆情监控')}
          ${skCard('科技动态')}
          ${skCard('合规政策')}
        </div>
      </div>
    </div>
  `
}

// ==================== 组件渲染函数 ====================

// 渲染数据源健康状态指示器 (P2-2)
function renderHealthIndicator(): string {
  if (sourceHealthStats.length === 0) return '<span class="health-indicator warn">📡 健康检查中...</span>'
  const total = sourceHealthStats.length
  const active = sourceHealthStats.filter(s => s.active).length
  const ratio = total > 0 ? active / total : 0
  const cls = ratio >= 0.8 ? 'good' : ratio >= 0.5 ? 'warn' : 'bad'
  
  // P2-4: 计算平均可信度评分
  const scores = getAllSourceScores()
  const avgComposite = scores.length > 0 ? Math.round(scores.reduce((a, s) => a + s.composite, 0) / scores.length) : 0
  const credCls = avgComposite >= 80 ? 'good' : avgComposite >= 60 ? 'warn' : 'bad'
  
  return `<span class="health-indicator ${cls}" title="RSS源: ${active}/${total} 活跃 | 平均可信度: ${avgComposite}/100">📡 ${active}/${total}</span>
    <span class="health-indicator ${credCls}" title="RSS来源平均综合评分: ${avgComposite}/100">⭐ ${avgComposite}</span>`
}

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
        <div class="header-search">
          <input type="text" id="newsSearchInput" placeholder="搜索新闻..." value="${newsSearchQuery}" autocomplete="off" />
          <span class="search-icon">🔍</span>
        </div>
        <div class="status ${isOnline ? '' : 'status-error'}">
          <div class="status-indicator ${isOnline ? '' : 'error'}"></div>
          <span class="status-text">${isOnline ? 'LIVE' : '离线'}</span>
        </div>
        <div class="last-update">${lastNetworkError ? `<span class="update-error" title="${lastNetworkError}">⚠️ 更新失败</span>` : `更新于 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}</div>
        <div class="health-panel" id="healthPanel" title="RSS数据源健康状态">
          ${renderHealthIndicator()}
        </div>
        <button class="header-btn refresh-btn" id="refreshBtn" title="手动刷新">🔄</button>
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
    // P3-3: 移除地图加载遮罩
    const overlay = document.getElementById('mapLoadingOverlay')
    if (overlay) {
      overlay.style.transition = 'opacity 0.4s ease'
      overlay.style.opacity = '0'
      setTimeout(() => overlay.remove(), 400)
    }
    // P3-4: 启动数字计数动画
    setTimeout(() => animateCountUp(), 200)
  }
}

// P3-4: 数字计数递增动画
function animateCountUp() {
  document.querySelectorAll('[data-count-target]').forEach(el => {
    const target = parseFloat((el as HTMLElement).dataset.countTarget || '0')
    const decimals = parseInt((el as HTMLElement).dataset.countDecimals || '0')
    const prefix = (el as HTMLElement).dataset.countPrefix || ''
    const suffix = (el as HTMLElement).dataset.countSuffix || ''
    const useComma = (el as HTMLElement).dataset.countComma === 'true'
    const duration = 800
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      const current = target * eased
      let formatted = current.toFixed(decimals)
      if (useComma) {
        const parts = formatted.split('.')
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        formatted = parts.join('.')
      }
      el.textContent = prefix + formatted + suffix
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  })
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
    
    // 外圈脉冲环 - 使用 CSS 动画（更流畅的呼吸效果）
    const animClass = `hs-pulse-${spot.impact}`
    marker.append('circle')
      .attr('class', animClass)
      .attr('r', 10)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2.5)
      .attr('opacity', 0.9)
      .attr('filter', 'url(#hotspotGlow)')

    // 第二层外扩脉冲（更大范围）
    marker.append('circle')
      .attr('class', `hs-ring-${spot.impact}`)
      .attr('r', 14)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1)
      .attr('opacity', 0.5)
      .attr('filter', 'url(#hotspotGlow)')

    // 实心中心点
    marker.append('circle')
      .attr('r', 6)
      .attr('fill', color)
      .attr('filter', 'url(#hotspotGlow)')
      .attr('opacity', 0.95)

    // 内圈高亮
    marker.append('circle')
      .attr('r', 2.5)
      .attr('fill', '#ffffff')
      .attr('opacity', 0.9)
    
    // 外圈边框（静态）
    marker.append('circle')
      .attr('r', 8)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1)
      .attr('opacity', 0.5)
    
    // hover 交互：显示详情浮窗 - 修复闪烁问题（添加延迟和状态跟踪）
    marker
      .on('mouseenter', function(event: MouseEvent) {
        // 如果当前显示的是同一个热点，不重复处理
        if (_currentTooltipSpotId === spot.id) return
        _currentTooltipSpotId = spot.id
        
        // 延迟显示tooltip，避免快速移入移出导致闪烁
        if (_tooltipTimeout) { clearTimeout(_tooltipTimeout); _tooltipTimeout = null }
        _tooltipTimeout = window.setTimeout(() => {
          // 高亮当前标记
          d3.select(this).select('circle[fill]')
            .attr('r', 7)
            .attr('opacity', 1)
          
          // 显示浮窗 - 使用固定偏移，避免随鼠标抖动
          const tooltip = d3.select('#mapTooltip')
          if (!tooltip.empty()) {
            const container = document.querySelector('#worldMapContainer')
            if (container) {
              const rect = container.getBoundingClientRect()
              // 使用相对稳定的偏移量（固定15px右边，-15px上边）
              const x = event.clientX - rect.left + 15
              const y = event.clientY - rect.top - 15
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
        }, 50)
      })
      .on('mousemove', function(event: MouseEvent) {
        // 仅当当前热点匹配时才更新位置
        if (_currentTooltipSpotId !== spot.id) return
        const tooltip = d3.select('#mapTooltip')
        if (!tooltip.empty() && tooltip.style('display') !== 'none') {
          const container = document.querySelector('#worldMapContainer')
          if (container) {
            const rect = container.getBoundingClientRect()
            const x = event.clientX - rect.left + 15
            const y = event.clientY - rect.top - 15
            tooltip
              .style('left', x + 'px')
              .style('top', y + 'px')
          }
        }
      })
      .on('mouseleave', function() {
        // 清除待显示的tooltip
        if (_tooltipTimeout) { clearTimeout(_tooltipTimeout); _tooltipTimeout = null }
        if (_currentTooltipSpotId === spot.id) {
          _currentTooltipSpotId = null
          d3.select(this).select('circle[fill]')
            .attr('r', 6)
            .attr('opacity', 0.95)
          d3.select('#mapTooltip').style('display', 'none')
        }
      })
  })
  
  console.log(`✅ Hotspot markers rendered: ${hotspotsToRender.filter(s => hotspotCoordinates[s.region]).length} points`)
}

// 热点数据默认模板（已清空：不再使用硬编码假数据）
function getDefaultHotspots(): GlobalHotspot[] {
  return []
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
let currentNewsFilter: 'all' | 'competitor' | 'market' | 'tech' | 'policy' | 'supply' = 'all'

// 分类中文映射
const CATEGORY_LABELS: Record<string, string> = {
  'competitor': '竞争',
  'market': '市场',
  'tech': '科技',
  'policy': '政策',
  'supply': '供应链'
}

// 行业中文+图标映射
const INDUSTRY_LABELS: Record<string, { label: string; icon: string; cls: string }> = {
  'semiconductor': { label: '半导体', icon: '💾', cls: 'ind-semiconductor' },
  'automotive':   { label: '智能汽车', icon: '🚗', cls: 'ind-automotive' },
  'robotics':     { label: '机器人', icon: '🤖', cls: 'ind-robotics' },
  'ai':           { label: 'AI', icon: '🧠', cls: 'ind-ai' },
  'all':          { label: '综合', icon: '🌐', cls: 'ind-all' }
}

function renderNewsCompact(industry: NewsIndustry = 'all'): string {
  // 按行业和类型过滤新闻
  let filteredNews = newsData
  if (industry !== 'all') {
    filteredNews = filteredNews.filter(n => n.industry === industry || n.industry === 'all')
  }

  // 新闻全文搜索
  if (newsSearchQuery.trim()) {
    const q = newsSearchQuery.toLowerCase().trim()
    filteredNews = filteredNews.filter(n =>
      n.title.toLowerCase().includes(q) ||
      (n.summary && n.summary.toLowerCase().includes(q)) ||
      n.source.toLowerCase().includes(q) ||
      n.category.toLowerCase().includes(q)
    )
  }

  const filteredByCategory = newsSearchQuery.trim()
    ? filteredNews  // 搜索时显示所有匹配结果，不按分类筛选
    : (currentNewsFilter === 'all'
      ? filteredNews
      : filteredNews.filter(n => n.category === currentNewsFilter))

  // 全行业模式：显示更多条目（15条），其他行业页面显示8条
  const displayCount = industry === 'all' ? 15 : 8
  const displayNews = filteredByCategory.slice(0, displayCount)
  const hasSearch = newsSearchQuery.trim()

  const industryName = hasSearch
    ? `搜索: "${newsSearchQuery}"`
    : ({
    'all': '全行业',
    'semiconductor': '半导体',
    'automotive': '智能汽车',
    'robotics': '机器人',
    'ai': 'AI'
  }[industry] || '全行业')

  // 全行业模式下按行业颜色分组展示，并启用自动滚动
  const isAllIndustry = industry === 'all'
  const feedId = `newsFeed_${industry}`
  
  return `
    <div class="card compact${isAllIndustry ? ' intel-feed-card' : ''}">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">📡</div>
          <span>实时情报 · ${industryName}</span>
          ${isAllIndustry ? `<span class="intel-live-badge">● LIVE</span>` : ''}
        </div>
        <div class="card-actions">
          <button class="card-action ${currentNewsFilter === 'all' ? 'active' : ''}" data-filter="all">全部</button>
          <button class="card-action ${currentNewsFilter === 'competitor' ? 'active' : ''}" data-filter="competitor">竞争</button>
          <button class="card-action ${currentNewsFilter === 'market' ? 'active' : ''}" data-filter="market">市场</button>
          <button class="card-action ${currentNewsFilter === 'tech' ? 'active' : ''}" data-filter="tech">科技</button>
          <button class="card-action ${currentNewsFilter === 'policy' ? 'active' : ''}" data-filter="policy">政策</button>
          <button class="card-action ${currentNewsFilter === 'supply' ? 'active' : ''}" data-filter="supply">供应链</button>
        </div>
      </div>
      <div class="card-body">
        <div class="news-feed compact${isAllIndustry ? ' intel-scroll-feed' : ''}" id="${feedId}">
          ${displayNews.length > 0 ? displayNews.map(news => {
            const indInfo = INDUSTRY_LABELS[news.industry] || INDUSTRY_LABELS['all']
            const catLabel = CATEGORY_LABELS[news.category] || news.category
            return `
            <div class="news-item ${news.priority}">
              <div class="news-time">${news.time}</div>
              <div class="news-content">
                <a class="news-title" href="${news.url || '#'}" target="_blank" rel="noopener noreferrer" title="在浏览器中打开">${news.title}</a>
                <div class="news-meta">
                  ${isAllIndustry ? `<span class="news-tag industry-tag ${indInfo.cls}">${indInfo.icon} ${indInfo.label}</span>` : ''}
                  <span class="news-tag ${news.category}">${catLabel}</span>
                  <span class="news-source">${news.source}</span>
                  ${news.verified === false ? '<span class="verify-badge fail" title="内容来源验证未通过">⚠️ 未验证</span>' : ''}
                </div>
              </div>
            </div>`
          }).join('') : `
            <div class="news-item info">
              <div class="news-time">--</div>
              <div class="news-content">
                <div class="news-title">暂无该分类数据，正在从RSS源获取...</div>
                <div class="news-meta"><span class="news-tag tech">科技</span><span class="news-source">系统</span></div>
              </div>
            </div>`}
        </div>
        ${isAllIndustry ? `
        <div class="intel-feed-footer">
          <span class="intel-total">共 ${filteredByCategory.length} 条情报</span>
          <span class="intel-industries">
            ${['semiconductor','automotive','robotics','ai'].map(ind => {
              const cnt = filteredNews.filter(n => n.industry === ind).length
              const inf = INDUSTRY_LABELS[ind]
              return cnt > 0 ? `<span class="intel-ind-chip ${inf.cls}">${inf.icon}${inf.label} ${cnt}</span>` : ''
            }).join('')}
          </span>
        </div>` : ''}
      </div>
    </div>
  `
}

function renderAlertCompact(): string {
  // 无数据时显示加载状态，不再使用假警报数据
  const displayAlerts = alertData.length >= 2 ? alertData.slice(0, 4) : []
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
          ${displayAlerts.length > 0 ? displayAlerts.map(alert => `
            <div class="alert-item ${alert.level}">
              <div class="alert-icon">${alert.icon}</div>
              <div class="alert-content">
                <div class="alert-title">${alert.title}</div>
                <div class="alert-desc">${alert.description || ''}</div>
              </div>
            </div>
          `).join('') : `<div class="alert-item info">
            <div class="alert-icon">⏳</div>
            <div class="alert-content">
              <div class="alert-title">数据加载中...</div>
              <div class="alert-desc">正在从RSS源获取最新警报数据</div>
            </div>
          </div>`}
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
          <span class="data-source-badge ${techTrends.length > 0 ? 'live' : 'init'}">${techTrends.length > 0 ? '动态分析' : '初始化'}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="tech-list">
          ${techTrends.length > 0 ? techTrends.slice(0, 4).map(tech => `
            <div class="tech-mini">
              <div class="tech-icon">${tech.icon}</div>
              <div class="tech-info">
                <div class="tech-name">${tech.name}</div>
                <div class="tech-heat-bar ${tech.status}" style="width: ${tech.heat}%"></div>
              </div>
              <div class="tech-count">${tech.patents}</div>
            </div>
          `).join('') : `<div class="tech-mini" style="justify-content:center;padding:12px;">
            <span style="color:var(--text-muted);font-size:13px;">⏳ 正在加载数据...</span>
          </div>`}
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
          <span class="data-source-badge ${supplyChain.length > 0 ? 'live' : 'init'}">${supplyChain.length > 0 ? '动态分析' : '初始化'}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="supply-list compact">
          ${supplyChain.length > 0 ? supplyChain.slice(0, 4).map(item => `
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
          `).join('') : `<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:13px;">⏳ 正在加载数据...</div>`}
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
          ${policies.length >= 2 ? policies.slice(0, 3).map(policy => `
            <div class="timeline-item ${policy.urgent ? 'urgent' : ''}">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-title">${policy.title}</div>
                ${policy.description ? `<div class="timeline-desc">${policy.description}</div>` : ''}
                <div class="timeline-date">${policy.date}</div>
              </div>
            </div>
          `).join('') : `<div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-title">⏳ 正在加载数据...</div>
              <div class="timeline-desc">数据加载完成后自动更新</div>
              <div class="timeline-date">${new Date().toISOString().slice(0, 10)}</div>
            </div>
          </div>`}
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
  const categoryLabels: Record<string, string> = {
    product: '产品',
    event: '活动',
    finance: '融资',
    partner: '合作'
  }
  const displayNews = companyNews.slice(0, 8)
  // 判断数据来源类型
  const hasDynamic = displayNews.some(n => n.id.startsWith('company-gn-') || n.id.startsWith('company-gd-') || n.id.startsWith('company-cache-'))
  const dataLabel = displayNews.length === 0 ? '初始化' : (hasDynamic ? '动态' : '行业参考')

  // 渲染单条新闻（用于静态展示和滚动轨道）
  const renderNewsItem = (news: any) => `
    <div class="company-news-item">
      <div class="company-news-icon">${categoryIcons[news.category] || '📰'}</div>
      <div class="company-news-content">
        <a class="company-news-title" href="${news.url || '#'}" target="_blank" rel="noopener noreferrer" title="在浏览器中打开">${news.title}</a>
        <div class="company-news-meta">
          <span class="company-cat-tag">${categoryLabels[news.category] || news.category}</span>
          <span>${news.source}</span>
          <span>${news.time}</span>
        </div>
      </div>
    </div>`

  // 全部垂直滚动
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">🏢</div>
          <span>公司新闻</span>
          <span class="data-source-badge ${displayNews.length > 0 ? (hasDynamic ? 'live' : 'base') : 'init'}">${dataLabel}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="company-news-marquee-wrap">
          <div class="company-news-track">
            ${displayNews.length > 0
              ? [...displayNews, ...displayNews].map(renderNewsItem).join('')
              : `<div class="company-news-item">
                <div class="company-news-icon">⏳</div>
                <div class="company-news-content">
                  <div class="company-news-title">正在获取欧冶半导体及智能汽车芯片行业最新动态...</div>
                  <div class="company-news-meta"><span>系统</span><span>${new Date().toLocaleDateString()}</span></div>
                </div>
              </div>`}
          </div>
        </div>
      </div>
    </div>`
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
          ${aiInsights.slice(0, 6).map(insight => `
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
          ${startupFunding.slice(0, 6).map(startup => `
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
    chip: '💾',
    auto: '🚗',
    robotics: '🤖',
    cloud: '☁️',
    ai: '🧠'
  }
  const categoryLabels: Record<string, string> = {
    chip: '芯片',
    auto: '汽车',
    robotics: '机器人',
    cloud: '云计算',
    ai: 'AI'
  }
  const displayTech = techNews.slice(0, 4)
  const renderLoadingItem = () => `
            <div class="tech-news-item">
              <div class="tech-news-icon">⏳</div>
              <div class="tech-news-content">
                <div class="tech-news-title">数据加载中，正在从RSS源获取最新科技动态...</div>
                <div class="tech-news-meta">
                  <span>系统</span>
                  <span>${new Date().toLocaleDateString()}</span>
                </div>
              </div>
              <div class="tech-news-heat">
                <div class="heat-bar" style="width: 0%"></div>
                <span>--</span>
              </div>
            </div>`
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">⚡</div>
          <span>科技动态</span>
        </div>
      </div>
      <div class="card-body">
        <div class="tech-news-list">
          ${displayTech.length > 0 ? displayTech.map(news => `
            <div class="tech-news-item">
              <div class="tech-news-icon">${categoryIcons[news.category] || '📡'}</div>
              <div class="tech-news-content">
                <div class="tech-news-title">${news.title}</div>
                <div class="tech-news-meta">
                  <span class="tech-cat-label">${categoryLabels[news.category] || news.category}</span>
                  <span>${news.source}</span>
                  <span>${news.time}</span>
                </div>
              </div>
              <div class="tech-news-heat">
                <div class="heat-bar" style="width: ${news.heat}%"></div>
                <span>${news.heat}</span>
              </div>
            </div>
          `).join('') : renderLoadingItem()}
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
          <span class="data-source-badge ${financialMarkets.length > 0 ? 'live' : 'base'}">${financialMarkets.length > 0 ? '派生' : '加载中'}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="financial-list">
          ${financialMarkets.length > 0 ? financialMarkets.slice(0, 6).map(market => `
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
          `).join('') : `<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:13px;">⏳ 正在从基准指数派生金融数据...</div>`}
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
          <span class="data-source-badge ${policyApplications.length > 0 ? 'live' : 'init'}">${policyApplications.length > 0 ? '动态分析' : '初始化'}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="policy-wide-list">
          ${policyApplications.length > 0 ? policyApplications.slice(0, 4).map(app => `
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
          `).join('') : `<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:13px;">⏳ 正在从政策新闻动态提取申报信息...</div>`}
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
              <div class="stat-value up" data-count-target="4856.32" data-count-decimals="2" data-count-prefix="" data-count-suffix="" data-count-comma="true">4,856.32</div>
              <div class="stat-change up">+89.45 (+1.88%)</div>
              <div class="stat-data-source">数据来源: Bloomberg / 数据截至: 2026-05-14</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">晶圆厂产能 <span class="stat-source">(全球先进制程)</span></div>
              <div class="stat-value up" data-count-target="92" data-count-decimals="0" data-count-prefix="" data-count-suffix="%">92%</div>
              <div class="stat-change up">+5pp YoY</div>
              <div class="stat-data-source">数据来源: SEMI / 季度指标</div>
            </div>
            <div class="stat-box alert">
              <div class="stat-label">芯片交期 <span class="stat-source">(全球平均)</span></div>
              <div class="stat-value down" data-count-target="40" data-count-decimals="0" data-count-prefix="" data-count-suffix="周">40周</div>
              <div class="stat-change up">+8周</div>
              <div class="stat-data-source">数据来源: Susquehanna / 月度指标</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Q1 营收 <span class="stat-source">(全球半导体产业)</span></div>
              <div class="stat-value up" data-count-target="156" data-count-decimals="0" data-count-prefix="$" data-count-suffix="B">$156B</div>
              <div class="stat-change up">+23% YoY</div>
              <div class="stat-data-source">数据来源: SIA / 季度指标</div>
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
              <div class="stat-value down" data-count-target="2892.45" data-count-decimals="2" data-count-prefix="" data-count-suffix="" data-count-comma="true">2,892.45</div>
              <div class="stat-change up">+45.32 (+1.59%)</div>
              <div class="stat-data-source">数据来源: 中证指数 / 数据截至: 2026-05-15</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">新能源车销量 <span class="stat-source">(中国月度)</span></div>
              <div class="stat-value up" data-count-target="285" data-count-decimals="0" data-count-prefix="" data-count-suffix="万">285万</div>
              <div class="stat-change up">+15% YoY</div>
              <div class="stat-data-source">数据来源: 中汽协 / 月度指标</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">智驾渗透率 <span class="stat-source">(L2+级辅助驾驶)</span></div>
              <div class="stat-value up" data-count-target="32" data-count-decimals="0" data-count-prefix="" data-count-suffix="%">32%</div>
              <div class="stat-change up">+8pp YoY</div>
              <div class="stat-data-source">数据来源: 高工智能汽车 / 月度指标</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">电池价格 <span class="stat-source">(三元锂电芯)</span></div>
              <div class="stat-value down" data-count-target="45" data-count-decimals="0" data-count-prefix="$" data-count-suffix="/kWh">$45/kWh</div>
              <div class="stat-change down">-12% YoY</div>
              <div class="stat-data-source">数据来源: BloombergNEF / 季度指标</div>
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
              <div class="stat-value up">2,156.89</div>
              <div class="stat-change up">+68.45 (+3.28%)</div>
              <div class="stat-data-source">数据来源: 中证指数 / 数据截至: 2026-05-15</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">人形机器人出货量 <span class="stat-source">(全球年度预测)</span></div>
              <div class="stat-value up">12.5万</div>
              <div class="stat-change up">+180% YoY</div>
              <div class="stat-data-source">数据来源: IFR / 年度预测</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">工业机器人密度 <span class="stat-source">(中国每万人)</span></div>
              <div class="stat-value up">392</div>
              <div class="stat-change up">+15% YoY</div>
              <div class="stat-data-source">数据来源: IFR / 年度指标</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">核心零部件国产化率 <span class="stat-source">(减速器/伺服系统)</span></div>
              <div class="stat-value up">68%</div>
              <div class="stat-change up">+8pp YoY</div>
              <div class="stat-data-source">数据来源: GGII / 年度指标</div>
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
  const companies = roboticsCompanies.length > 0 ? roboticsCompanies : [
    { name: '波士顿动力', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '-', latestNews: '等待RSS数据...' },
    { name: '特斯拉Optimus', ticker: 'TSLA', price: 0, change: 0, changePercent: 0, marketCap: '-', latestNews: '等待RSS数据...' },
    { name: '宇树科技', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '-', latestNews: '等待RSS数据...' },
    { name: '智元机器人', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '-', latestNews: '等待RSS数据...' },
    { name: '傅利叶智能', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '-', latestNews: '等待RSS数据...' },
    { name: 'Agility Robotics', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '-', latestNews: '等待RSS数据...' }
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
          ${companies.slice(0, 6).map(comp => `
            <div class="market-mini">
              <div class="market-info">
                <div class="market-name">${comp.name}</div>
                ${comp.latestNews ? `<div class="market-source" style="font-size:10px;color:var(--text-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">${comp.latestNews}</div>` : ''}
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
  const techItems = roboticsTech.length > 0 ? roboticsTech : [
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
          ${techItems.slice(0, 5).map(tech => `
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
              <div class="stat-value up" data-count-target="4521.89" data-count-decimals="2" data-count-prefix="" data-count-suffix="" data-count-comma="true">4,521.89</div>
              <div class="stat-change up">+156.78 (+3.59%)</div>
              <div class="stat-data-source">数据来源: 中证指数 / 数据截至: 2026-05-15</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">大模型备案数 <span class="stat-source">(中国生成式AI)</span></div>
              <div class="stat-value up" data-count-target="218" data-count-decimals="0" data-count-prefix="" data-count-suffix="个">218个</div>
              <div class="stat-change up">+35% YoY</div>
              <div class="stat-data-source">数据来源: 网信办 / 截至2026-Q1</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">AI算力规模 <span class="stat-source">(中国智能算力)</span></div>
              <div class="stat-value up" data-count-target="850" data-count-decimals="0" data-count-prefix="" data-count-suffix=" EFLOPS">850 EFLOPS</div>
              <div class="stat-change up">+68% YoY</div>
              <div class="stat-data-source">数据来源: IDC/浪潮 / 年度指标</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">端侧AI渗透率 <span class="stat-source">(智能手机/PC)</span></div>
              <div class="stat-value up" data-count-target="28" data-count-decimals="0" data-count-prefix="" data-count-suffix="%">28%</div>
              <div class="stat-change up">+12pp YoY</div>
              <div class="stat-data-source">数据来源: Counterpoint / 年度预测</div>
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
  const companies = aiCompanies.length > 0 ? aiCompanies : [
    { name: '英伟达', ticker: 'NVDA', price: 0, change: 0, changePercent: 0, marketCap: '-', latestNews: '等待RSS数据...' },
    { name: '微软', ticker: 'MSFT', price: 0, change: 0, changePercent: 0, marketCap: '-', latestNews: '等待RSS数据...' },
    { name: '谷歌', ticker: 'GOOGL', price: 0, change: 0, changePercent: 0, marketCap: '-', latestNews: '等待RSS数据...' },
    { name: 'OpenAI', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '-', latestNews: '等待RSS数据...' },
    { name: '百度', ticker: 'BIDU', price: 0, change: 0, changePercent: 0, marketCap: '-', latestNews: '等待RSS数据...' },
    { name: '商汤科技', ticker: '0020.HK', price: 0, change: 0, changePercent: 0, marketCap: '-', latestNews: '等待RSS数据...' }
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
          ${companies.slice(0, 6).map(comp => `
            <div class="market-mini">
              <div class="market-info">
                <div class="market-name">${comp.name}</div>
                <div class="market-ticker">${comp.ticker}</div>
                ${comp.latestNews ? `<div class="market-source" style="font-size:10px;color:var(--text-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">${comp.latestNews}</div>` : ''}
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
  const techItems = aiTech.length > 0 ? aiTech : [
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
          ${techItems.slice(0, 5).map(tech => `
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

  // 销毁旧实例，防止内存泄漏和DOM重绘冲突
  if (marketChartInstance) {
    marketChartInstance.destroy()
    marketChartInstance = null
  }

  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  // 使用 BASE_INDICES 基准值生成确定性趋势数据
  const soxBase = 4856.32
  const autoBase = 2892.45
  const data1 = Array.from({ length: 24 }, (_, i) => soxBase - 80 + i * 6.5 + Math.sin(i * 0.5) * 30)
  const data2 = Array.from({ length: 24 }, (_, i) => autoBase - 40 + i * 3.2 + Math.cos(i * 0.4) * 15)

  marketChartInstance = new Chart(ctx, {
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

// P3-2: 页面切换过渡动画
function switchPage(targetPage: string) {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app || targetPage === currentPage) return

  // 短暂淡出后切换
  app.style.opacity = '0'
  app.style.transition = 'opacity 0.15s ease'
  setTimeout(() => {
    currentPage = targetPage
    // 切换页面时重置新闻筛选为全部
    currentNewsFilter = 'all'
    newsSearchQuery = ''
    app.innerHTML = renderApp()
    app.style.opacity = '1'
    bindEvents()
    requestAnimationFrame(() => {
      if (targetPage === 'dashboard' || targetPage === 'automotive') {
        initCharts()
        renderWorldMapD3()
      }
    })
  }, 150)
}

function bindEvents() {
  // P3-5: 全局键盘快捷键
  // 先移除旧监听器防止重复绑定（使用命名函数引用）
  if ((window as any).__monitorKeyHandler) {
    document.removeEventListener('keydown', (window as any).__monitorKeyHandler)
  }
  const keyHandler = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA'

    // / 或 Ctrl+K → 聚焦搜索框
    if (!inInput && (e.key === '/' || (e.ctrlKey && e.key === 'k'))) {
      e.preventDefault()
      const inp = document.getElementById('newsSearchInput') as HTMLInputElement
      inp?.focus()
      return
    }

    // F5 或 R（大写）→ 手动刷新
    if (e.key === 'F5' || (e.key === 'r' && !inInput)) {
      e.preventDefault()
      const btn = document.getElementById('refreshBtn')
      if (btn && !btn.classList.contains('spinning')) {
        btn.click()
      }
      return
    }

    // ← / → → 切换页面
    if (!inInput && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const pages = ['dashboard', 'semiconductor', 'automotive', 'robotics', 'ai']
      const idx = pages.indexOf(currentPage)
      let next = idx + (e.key === 'ArrowRight' ? 1 : -1)
      if (next < 0) next = pages.length - 1
      if (next >= pages.length) next = 0
      const navItems = document.querySelectorAll('.nav-item')
      navItems.forEach(item => {
        if (item.getAttribute('data-page') === pages[next]) {
          item.classList.add('active')
        } else {
          item.classList.remove('active')
        }
      })
      switchPage(pages[next])
    }
  }
  ;(window as any).__monitorKeyHandler = keyHandler
  document.addEventListener('keydown', keyHandler)

  // 导航交互
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page')
      if (page) {
        switchPage(page)
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

  // 新闻全文搜索
  const searchInput = document.getElementById('newsSearchInput') as HTMLInputElement
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      newsSearchQuery = searchInput.value
      const app = document.querySelector<HTMLDivElement>('#app')
      if (app) {
        app.innerHTML = renderApp()
        bindEvents()
        // 聚焦回搜索框
        const newInput = document.getElementById('newsSearchInput') as HTMLInputElement
        if (newInput) {
          newInput.focus()
          newInput.setSelectionRange(newInput.value.length, newInput.value.length)
        }
        if (currentPage === 'dashboard' || currentPage === 'automotive') {
          requestAnimationFrame(() => {
            initCharts()
            renderWorldMapD3()
          })
        }
      }
    })
    // 回车键搜索
    searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        searchInput.value = ''
        newsSearchQuery = ''
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
        }
      }
    })
  }

  // 新闻筛选按钮
  document.querySelectorAll('.card-action[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter') as 'all' | 'competitor' | 'market' | 'tech' | 'policy' | 'supply'
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
      }
    })
  })
}

// ==================== 实时情报自动滚动 ====================
let _intelScrollTimer: number | null = null

function startIntelAutoScroll() {
  if (_intelScrollTimer) { clearInterval(_intelScrollTimer); _intelScrollTimer = null }
  const feed = document.getElementById('newsFeed_all')
  if (!feed) return
  _intelScrollTimer = window.setInterval(() => {
    const el = document.getElementById('newsFeed_all')
    if (!el) { clearInterval(_intelScrollTimer!); _intelScrollTimer = null; return }
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll <= 0) return
    const step = 1
    el.scrollTop += step
    if (el.scrollTop >= maxScroll) {
      // 到底后缓停3s再回顶
      setTimeout(() => { if (el) el.scrollTop = 0 }, 3000)
    }
  }, 60)
}

// ==================== 初始化 ====================

async function init() {
  console.log('Initializing Oritek World Monitor...')
  const app = document.querySelector<HTMLDivElement>('#app')
  if (app) {
    // 先展示骨架屏，提升感知加载速度
    app.innerHTML = renderSkeleton()
    console.log('Skeleton screen displayed')

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
      // 政策申报：使用生成器数据（含兜底）
      policyApplications = generatePolicyApplicationsFromNews(allNewsList)
      techNews = generateTechNewsFromNews(allNewsList)
      globalHeadlines = generateHeadlinesFromNews(allNewsList)
      roboticsCompanies = generateRoboticsCompaniesFromNews(allNewsList)
      aiCompanies = generateAICompaniesFromNews(allNewsList)
      roboticsTech = generateRoboticsTechFromNews(allNewsList)
      aiTech = generateAITechFromNews(allNewsList)

      // 成功：标记在线状态
      isOnline = true
      lastNetworkError = ''
      console.log('All data loaded from RSS')
      
      app.innerHTML = renderApp()
      console.log('App rendered')
      
      bindEvents()
      console.log('Events bound')
      
      initCharts()
      console.log('Charts initialized')
      
      startAutoRefresh()
      console.log('Auto refresh started (5 minutes interval)')

      // 异步执行RSS源健康检查（不阻塞页面加载）
      runHealthCheck().then(stats => {
        sourceHealthStats = stats
        // 健康检查完成后刷新header中的指示器
        const hp = document.getElementById('healthPanel')
        if (hp) hp.innerHTML = renderHealthIndicator()
      }).catch(e => console.warn('[init] 健康检查失败:', e))

      // 延迟渲染地图，等待骨架屏移除后 DOM 稳定
      requestAnimationFrame(() => {
        console.log('Triggering initial map render...')
        renderWorldMapD3()
        // 启动实时情报自动滚动
        setTimeout(() => startIntelAutoScroll(), 800)
      })
      
    } catch (error) {
      console.error('Error during initialization:', error)
      isOnline = false
      lastNetworkError = error instanceof Error ? error.message : '初始化失败'
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
