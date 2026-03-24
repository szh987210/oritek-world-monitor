// 数据服务模块 - 用于接入真实数据源

// ==================== 配置 ====================
const API_CONFIG = {
  // 新闻 API 配置（示例：使用 NewsAPI 或自定义 API）
  newsApi: {
    baseUrl: 'https://newsapi.org/v2',
    apiKey: 'YOUR_API_KEY', // 需要替换为真实的 API Key
    endpoints: {
      everything: '/everything',
      topHeadlines: '/top-headlines'
    }
  },
  // 股票/指数 API 配置（示例：使用 Alpha Vantage 或新浪财经）
  stockApi: {
    baseUrl: 'https://query1.finance.yahoo.com/v8/finance/chart',
    // 或使用新浪财经：http://hq.sinajs.cn/list=
  },
  // 更新频率配置（毫秒）
  refreshInterval: {
    news: 5 * 60 * 1000,      // 新闻：5分钟
    stock: 30 * 1000,         // 股票：30秒
    indices: 60 * 1000,       // 指数：1分钟
    hotspots: 10 * 60 * 1000  // 热点：10分钟
  }
}

// ==================== 数据接口定义 ====================
export interface NewsItem {
  id: string
  title: string
  source: string
  time: string
  category: 'competitor' | 'market' | 'policy' | 'tech' | 'supply'
  priority: 'critical' | 'warning' | 'info'
  summary: string
  url?: string
  publishedAt?: string
}

export interface StockData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume?: number
  marketCap?: string
  timestamp: string
}

export interface IndustryIndex {
  name: string
  value: number
  change: number
  changePercent: number
  icon: string
  timestamp: string
}

export interface GlobalHotspot {
  id: string
  title: string
  region: string
  category: 'conflict' | 'diplomacy' | 'economy' | 'tech' | 'policy'
  impact: 'high' | 'medium' | 'low'
  time: string
  summary: string
  source?: string
}

// ==================== 真实数据获取函数 ====================

/**
 * 获取实时新闻数据
 * 示例：接入 NewsAPI 或自定义新闻 API
 */
export async function fetchRealNews(category?: string): Promise<NewsItem[]> {
  try {
    // 示例：使用 NewsAPI
    // const response = await fetch(
    //   `${API_CONFIG.newsApi.baseUrl}${API_CONFIG.newsApi.endpoints.everything}?` +
    //   `q=semiconductor+OR+AI+OR+autonomous+driving&` +
    //   `language=zh&` +
    //   `sortBy=publishedAt&` +
    //   `apiKey=${API_CONFIG.newsApi.apiKey}`
    // )
    // const data = await response.json()
    // return data.articles.map(transformNewsArticle)

    // 临时返回模拟数据，接入真实 API 时替换
    console.log('Fetching real news data...')
    return getMockNews()
  } catch (error) {
    console.error('Failed to fetch news:', error)
    return getMockNews()
  }
}

/**
 * 获取股票/指数数据
 * 示例：接入新浪财经或 Yahoo Finance API
 */
export async function fetchStockData(symbols: string[]): Promise<StockData[]> {
  try {
    // 示例：使用新浪财经 API
    // const symbolStr = symbols.join(',')
    // const response = await fetch(`http://hq.sinajs.cn/list=${symbolStr}`)
    // const data = await response.text()
    // return parseSinaStockData(data)

    // 临时返回模拟数据
    console.log('Fetching real stock data for:', symbols)
    return getMockStockData(symbols)
  } catch (error) {
    console.error('Failed to fetch stock data:', error)
    return getMockStockData(symbols)
  }
}

/**
 * 获取行业指数数据
 */
export async function fetchIndustryIndices(): Promise<IndustryIndex[]> {
  try {
    // 接入真实指数 API
    console.log('Fetching industry indices...')
    return getMockIndices()
  } catch (error) {
    console.error('Failed to fetch indices:', error)
    return getMockIndices()
  }
}

/**
 * 获取全球热点数据
 */
export async function fetchGlobalHotspots(): Promise<GlobalHotspot[]> {
  try {
    // 接入真实热点数据 API
    console.log('Fetching global hotspots...')
    return getMockHotspots()
  } catch (error) {
    console.error('Failed to fetch hotspots:', error)
    return getMockHotspots()
  }
}

// ==================== 数据转换函数 ====================

function transformNewsArticle(article: any): NewsItem {
  return {
    id: article.url || String(Date.now()),
    title: article.title,
    source: article.source?.name || '未知来源',
    time: formatTime(article.publishedAt),
    category: categorizeNews(article.title),
    priority: determinePriority(article.title),
    summary: article.description || article.title,
    url: article.url,
    publishedAt: article.publishedAt
  }
}

function categorizeNews(title: string): NewsItem['category'] {
  const lower = title.toLowerCase()
  if (lower.includes('芯片') || lower.includes('半导体') || lower.includes('nvidia') || lower.includes('intel')) {
    return 'competitor'
  }
  if (lower.includes('政策') || lower.includes('法规') || lower.includes('限制') || lower.includes('出口')) {
    return 'policy'
  }
  if (lower.includes('ai') || lower.includes('人工智能') || lower.includes('自动驾驶')) {
    return 'tech'
  }
  if (lower.includes('供应链') || lower.includes('产能') || lower.includes('缺货')) {
    return 'supply'
  }
  return 'market'
}

function determinePriority(title: string): NewsItem['priority'] {
  const lower = title.toLowerCase()
  if (lower.includes('紧急') || lower.includes('突发') || lower.includes('禁令') || lower.includes('制裁')) {
    return 'critical'
  }
  if (lower.includes('警告') || lower.includes('风险') || lower.includes('下跌')) {
    return 'warning'
  }
  return 'info'
}

function formatTime(publishedAt: string): string {
  const date = new Date(publishedAt)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  return date.toLocaleDateString('zh-CN')
}

// ==================== 模拟数据（临时使用）====================

function getMockNews(): NewsItem[] {
  return [
    { id: '1', title: '英伟达发布 Thor 芯片，算力 2000 TOPS 直接对标征程 6', source: '36氪', time: '10:32', category: 'competitor', priority: 'critical', summary: '英伟达 GTC 发布新一代自动驾驶芯片' },
    { id: '2', title: '小米 SU7 订单破 10 万，智驾芯片需求激增', source: '汽车之家', time: '09:45', category: 'market', priority: 'info', summary: '小米汽车产能爬坡中' },
    { id: '3', title: '美国商务部拟对华 AI 芯片出口实施新限制', source: '财联社', time: '08:20', category: 'policy', priority: 'critical', summary: '可能影响自动驾驶训练芯片' },
    { id: '4', title: '地平线征程 6 芯片通过 AEC-Q100 车规认证', source: '公司官网', time: '昨天', category: 'competitor', priority: 'warning', summary: '量产准备就绪' },
    { id: '5', title: '台积电 3nm 产能扩张计划推迟至 Q3', source: '电子时报', time: '昨天', category: 'supply', priority: 'warning', summary: '可能影响芯片供应' },
    { id: '6', title: 'Mobileye 宣布与某德系豪华品牌达成合作', source: '路透社', time: '2天前', category: 'competitor', priority: 'info', summary: 'EyeQ6 芯片将用于下一代车型' }
  ]
}

function getMockStockData(symbols: string[]): StockData[] {
  const mockData: Record<string, StockData> = {
    'NVDA': { symbol: 'NVDA', name: '英伟达', price: 875.28, change: 12.35, changePercent: 1.43, timestamp: new Date().toISOString() },
    'INTC': { symbol: 'INTC', name: '英特尔', price: 43.12, change: -0.85, changePercent: -1.93, timestamp: new Date().toISOString() },
    'QCOM': { symbol: 'QCOM', name: '高通', price: 168.45, change: 2.15, changePercent: 1.29, timestamp: new Date().toISOString() }
  }
  
  return symbols.map(s => mockData[s] || {
    symbol: s,
    name: s,
    price: Math.random() * 200 + 50,
    change: (Math.random() - 0.5) * 10,
    changePercent: (Math.random() - 0.5) * 5,
    timestamp: new Date().toISOString()
  })
}

function getMockIndices(): IndustryIndex[] {
  return [
    { name: '半导体指数', value: 3256.45, change: 89.32, changePercent: 2.82, icon: '🔷', timestamp: new Date().toISOString() },
    { name: '智能汽车指数', value: 1892.67, change: -23.45, changePercent: -1.22, icon: '🚗', timestamp: new Date().toISOString() },
    { name: 'AI 算力指数', value: 4521.89, change: 156.78, changePercent: 3.59, icon: '🧠', timestamp: new Date().toISOString() }
  ]
}

function getMockHotspots(): GlobalHotspot[] {
  return [
    { id: '1', title: '美国对华半导体出口管制升级', region: '美国', category: 'diplomacy', impact: 'high', time: '2小时前', summary: '新规将影响14nm以下先进制程设备出口' },
    { id: '2', title: '欧盟通过《芯片法案》最终版本', region: '欧洲', category: 'policy', impact: 'medium', time: '4小时前', summary: '430亿欧元补贴本土芯片制造业' },
    { id: '3', title: '台积电亚利桑那工厂延期投产', region: '美国', category: 'economy', impact: 'medium', time: '6小时前', summary: '人才短缺导致量产推迟至2025年' }
  ]
}

// ==================== 自动刷新管理器 ====================

export class DataRefreshManager {
  private intervals: Map<string, number> = new Map()
  private callbacks: Map<string, Function[]> = new Map()

  /**
   * 注册数据刷新回调
   */
  on(dataType: string, callback: Function) {
    if (!this.callbacks.has(dataType)) {
      this.callbacks.set(dataType, [])
    }
    this.callbacks.get(dataType)!.push(callback)
  }

  /**
   * 启动自动刷新
   */
  start(dataType: string, interval: number, fetchFn: () => Promise<any>) {
    // 清除已有的定时器
    this.stop(dataType)

    // 立即执行一次
    fetchFn().then(data => {
      this.notify(dataType, data)
    })

    // 设置定时刷新
    const timer = window.setInterval(async () => {
      try {
        const data = await fetchFn()
        this.notify(dataType, data)
      } catch (error) {
        console.error(`Failed to refresh ${dataType}:`, error)
      }
    }, interval)

    this.intervals.set(dataType, timer)
  }

  /**
   * 停止自动刷新
   */
  stop(dataType: string) {
    const timer = this.intervals.get(dataType)
    if (timer) {
      clearInterval(timer)
      this.intervals.delete(dataType)
    }
  }

  /**
   * 停止所有刷新
   */
  stopAll() {
    this.intervals.forEach((timer, type) => {
      clearInterval(timer)
    })
    this.intervals.clear()
  }

  /**
   * 通知所有回调
   */
  private notify(dataType: string, data: any) {
    const callbacks = this.callbacks.get(dataType) || []
    callbacks.forEach(cb => cb(data))
  }
}

// 导出单例实例
export const dataRefreshManager = new DataRefreshManager()

// ==================== 使用示例 ====================

/*
// 在 main.ts 中使用示例：

import { 
  fetchRealNews, 
  fetchStockData, 
  fetchIndustryIndices,
  dataRefreshManager,
  API_CONFIG 
} from './dataService'

// 启动新闻自动刷新
dataRefreshManager.on('news', (newsData) => {
  // 更新页面上的新闻显示
  updateNewsDisplay(newsData)
})

dataRefreshManager.start(
  'news', 
  API_CONFIG.refreshInterval.news, 
  () => fetchRealNews()
)

// 启动股票数据自动刷新
dataRefreshManager.on('stocks', (stockData) => {
  updateStockDisplay(stockData)
})

dataRefreshManager.start(
  'stocks',
  API_CONFIG.refreshInterval.stock,
  () => fetchStockData(['NVDA', 'INTC', 'QCOM'])
)
*/
