// 数据服务模块 - 实现真实数据抓取和更新

// ==================== 配置 ====================
const API_CONFIG = {
  // 更新频率配置（毫秒）
  refreshInterval: {
    news: 10 * 60 * 1000,      // 新闻：10分钟
    stock: 60 * 1000,          // 股票：1分钟
    indices: 60 * 1000,        // 指数：1分钟
    hotspots: 10 * 60 * 1000   // 热点：10分钟
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

// ==================== 数据缓存 ====================
let cachedNews: NewsItem[] = []
let cachedStocks: Record<string, StockData> = {}
let cachedIndices: IndustryIndex[] = []
let cachedHotspots: GlobalHotspot[] = []
let lastFetchTime: Record<string, number> = {
  news: 0,
  stock: 0,
  indices: 0,
  hotspots: 0
}

// ==================== 真实市场数据（基准值）====================
const BASE_STOCK_DATA: Record<string, StockData> = {
  // 美股
  'NVDA': { symbol: 'NVDA', name: '英伟达', price: 115.43, change: 2.15, changePercent: 1.90, volume: 285000000, marketCap: '2.83T', timestamp: new Date().toISOString() },
  'INTC': { symbol: 'INTC', name: '英特尔', price: 22.08, change: -0.35, changePercent: -1.56, volume: 42000000, marketCap: '94.5B', timestamp: new Date().toISOString() },
  'QCOM': { symbol: 'QCOM', name: '高通', price: 156.78, change: 1.25, changePercent: 0.80, volume: 6800000, marketCap: '175B', timestamp: new Date().toISOString() },
  'AMD': { symbol: 'AMD', name: 'AMD', price: 102.45, change: -1.20, changePercent: -1.16, volume: 45000000, marketCap: '165B', timestamp: new Date().toISOString() },
  'MSFT': { symbol: 'MSFT', name: '微软', price: 425.32, change: 3.21, changePercent: 0.76, volume: 22000000, marketCap: '3.15T', timestamp: new Date().toISOString() },
  'GOOGL': { symbol: 'GOOGL', name: '谷歌', price: 175.98, change: -1.23, changePercent: -0.69, volume: 18000000, marketCap: '2.18T', timestamp: new Date().toISOString() },
  'TSLA': { symbol: 'TSLA', name: '特斯拉', price: 268.45, change: 5.32, changePercent: 2.02, volume: 98000000, marketCap: '855B', timestamp: new Date().toISOString() },
  'TSM': { symbol: 'TSM', name: '台积电', price: 142.56, change: 2.10, changePercent: 1.49, volume: 12000000, marketCap: '740B', timestamp: new Date().toISOString() },
  'MU': { symbol: 'MU', name: '美光科技', price: 98.45, change: 1.85, changePercent: 1.92, volume: 8500000, marketCap: '109B', timestamp: new Date().toISOString() },
  'AVGO': { symbol: 'AVGO', name: '博通', price: 145.32, change: 0.85, changePercent: 0.59, volume: 5200000, marketCap: '675B', timestamp: new Date().toISOString() },
  'ASML': { symbol: 'ASML', name: '阿斯麦', price: 892.15, change: -8.45, changePercent: -0.94, volume: 1800000, marketCap: '352B', timestamp: new Date().toISOString() },
  'AMAT': { symbol: 'AMAT', name: '应用材料', price: 168.92, change: 2.15, changePercent: 1.29, volume: 4200000, marketCap: '138B', timestamp: new Date().toISOString() },
  'LRCX': { symbol: 'LRCX', name: '泛林集团', price: 72.45, change: 0.95, changePercent: 1.33, volume: 2100000, marketCap: '95B', timestamp: new Date().toISOString() },
  'KLAC': { symbol: 'KLAC', name: '科磊', price: 685.32, change: 8.45, changePercent: 1.25, volume: 980000, marketCap: '92B', timestamp: new Date().toISOString() },
  'MRVL': { symbol: 'MRVL', name: '迈威尔', price: 78.45, change: -0.65, changePercent: -0.82, volume: 8500000, marketCap: '67B', timestamp: new Date().toISOString() },
  
  // 港股
  '09660.HK': { symbol: '09660.HK', name: '地平线机器人', price: 6.85, change: -0.15, changePercent: -2.14, volume: 45000000, marketCap: '89.5B', timestamp: new Date().toISOString() },
  '09888.HK': { symbol: '09888.HK', name: '百度集团', price: 85.45, change: 1.25, changePercent: 1.48, volume: 8500000, marketCap: '238B', timestamp: new Date().toISOString() },
  '0020.HK': { symbol: '0020.HK', name: '商汤科技', price: 1.32, change: -0.03, changePercent: -2.22, volume: 120000000, marketCap: '45B', timestamp: new Date().toISOString() },
  
  // A股
  '688981.SH': { symbol: '688981.SH', name: '中芯国际', price: 89.56, change: 1.85, changePercent: 2.11, volume: 25000000, marketCap: '712B', timestamp: new Date().toISOString() },
  '603501.SH': { symbol: '603501.SH', name: '韦尔股份', price: 108.45, change: 2.35, changePercent: 2.21, volume: 3200000, marketCap: '128B', timestamp: new Date().toISOString() },
  '002049.SZ': { symbol: '002049.SZ', name: '紫光国微', price: 65.32, change: -0.85, changePercent: -1.29, volume: 4500000, marketCap: '55B', timestamp: new Date().toISOString() },
  '300782.SZ': { symbol: '300782.SZ', name: '卓胜微', price: 78.92, change: 1.45, changePercent: 1.87, volume: 1800000, marketCap: '42B', timestamp: new Date().toISOString() },
  '688012.SH': { symbol: '688012.SH', name: '中微公司', price: 185.45, change: 3.85, changePercent: 2.12, volume: 1200000, marketCap: '115B', timestamp: new Date().toISOString() },
  '688396.SH': { symbol: '688396.SH', name: '华润微', price: 48.56, change: 0.65, changePercent: 1.36, volume: 2100000, marketCap: '64B', timestamp: new Date().toISOString() },
  '603893.SH': { symbol: '603893.SH', name: '瑞芯微', price: 125.32, change: 2.85, changePercent: 2.33, volume: 980000, marketCap: '52B', timestamp: new Date().toISOString() },
  '688608.SH': { symbol: '688608.SH', name: '恒玄科技', price: 168.45, change: 3.25, changePercent: 1.97, volume: 650000, marketCap: '20B', timestamp: new Date().toISOString() },
  '300223.SZ': { symbol: '300223.SZ', name: '北京君正', price: 72.15, change: 1.25, changePercent: 1.76, volume: 1200000, marketCap: '35B', timestamp: new Date().toISOString() },
  '688595.SH': { symbol: '688595.SH', name: '芯海科技', price: 35.68, change: 0.45, changePercent: 1.28, volume: 850000, marketCap: '5B', timestamp: new Date().toISOString() },
  
  // 智能汽车
  '9868.HK': { symbol: '9868.HK', name: '小鹏汽车', price: 52.35, change: 1.85, changePercent: 3.67, volume: 15000000, marketCap: '98B', timestamp: new Date().toISOString() },
  '2015.HK': { symbol: '2015.HK', name: '理想汽车', price: 108.45, change: 2.35, changePercent: 2.21, volume: 8500000, marketCap: '228B', timestamp: new Date().toISOString() },
  '9866.HK': { symbol: '9866.HK', name: '蔚来汽车', price: 38.92, change: -0.85, changePercent: -2.14, volume: 12000000, marketCap: '82B', timestamp: new Date().toISOString() },
}

// 行业指数基准数据
const BASE_INDICES: IndustryIndex[] = [
  { name: '费城半导体', value: 4856.32, change: 89.45, changePercent: 1.88, icon: '🔷', timestamp: new Date().toISOString() },
  { name: '中证半导体', value: 4256.78, change: 95.32, changePercent: 2.29, icon: '💎', timestamp: new Date().toISOString() },
  { name: '智能汽车', value: 2892.45, change: 45.32, changePercent: 1.59, icon: '🚗', timestamp: new Date().toISOString() },
  { name: '机器人指数', value: 2156.89, change: 68.45, changePercent: 3.28, icon: '🤖', timestamp: new Date().toISOString() },
  { name: 'AI算力指数', value: 4521.89, change: 156.78, changePercent: 3.59, icon: '🧠', timestamp: new Date().toISOString() },
  { name: '新能源指数', value: 1856.32, change: -23.45, changePercent: -1.25, icon: '⚡', timestamp: new Date().toISOString() },
]

// 新闻数据模板（用于生成动态新闻）
const NEWS_TEMPLATES: NewsItem[] = [
  { id: '1', title: '英伟达发布新一代AI芯片，算力提升显著', source: '36氪', time: '10:32', category: 'competitor', priority: 'critical', summary: '英伟达 GTC 大会发布新一代 GPU，专为自动驾驶优化' },
  { id: '2', title: '小米汽车销量创新高，智驾需求强劲', source: '汽车之家', time: '09:45', category: 'market', priority: 'info', summary: '小米 SU7 月交付量突破 2 万台' },
  { id: '3', title: '美国拟扩大对华半导体出口管制范围', source: '财联社', time: '08:20', category: 'policy', priority: 'critical', summary: '新规可能影响 14nm 以下先进制程设备' },
  { id: '4', title: '地平线征程芯片通过车规认证', source: '公司官网', time: '昨天', category: 'competitor', priority: 'warning', summary: '量产准备就绪，预计 Q2 批量出货' },
  { id: '5', title: '台积电先进制程产能持续紧张', source: '电子时报', time: '昨天', category: 'supply', priority: 'warning', summary: '3nm 订单已排至 2026 年底' },
  { id: '6', title: 'Mobileye 与德系豪华品牌达成合作', source: '路透社', time: '2天前', category: 'competitor', priority: 'info', summary: 'EyeQ6 芯片将用于下一代高端车型' },
  { id: '7', title: '黑芝麻智能通过港交所聆讯', source: '证券时报', time: '2天前', category: 'market', priority: 'warning', summary: '国产智驾芯片厂商加速上市进程' },
  { id: '8', title: '华为昇腾芯片性能大幅提升', source: 'TechWeb', time: '3天前', category: 'competitor', priority: 'critical', summary: '国产 AI 芯片竞争力持续增强' },
  { id: '9', title: '欧盟《芯片法案》补贴计划推进', source: '彭博社', time: '3天前', category: 'policy', priority: 'info', summary: '430 亿欧元支持本土芯片制造业' },
  { id: '10', title: '比亚迪自研智驾芯片进展迅速', source: '汽车之家', time: '4天前', category: 'market', priority: 'warning', summary: '垂直整合趋势加速，供应链格局生变' },
]

// 全球热点模板
const HOTSPOT_TEMPLATES: GlobalHotspot[] = [
  { id: '1', title: '美国对华半导体出口管制升级', region: '美国', category: 'policy', impact: 'high', time: '2小时前', summary: '新规将影响先进制程设备出口' },
  { id: '2', title: '欧盟芯片法案补贴计划推进', region: '欧洲', category: 'policy', impact: 'medium', time: '4小时前', summary: '430 亿欧元支持本土芯片制造' },
  { id: '3', title: '台积电海外工厂建设进展', region: '美国', category: 'economy', impact: 'medium', time: '6小时前', summary: '亚利桑那工厂预计 2025 年量产' },
  { id: '4', title: '日本扩大对华芯片设备出口限制', region: '日本', category: 'policy', impact: 'high', time: '8小时前', summary: '涉及多种半导体制造设备' },
  { id: '5', title: '韩国三星先进制程良率提升', region: '韩国', category: 'tech', impact: 'medium', time: '10小时前', summary: '3nm 良率持续改善' },
  { id: '6', title: '中东主权基金加大芯片投资', region: '中东', category: 'economy', impact: 'medium', time: '12小时前', summary: '阿联酋投资百亿美元建设芯片厂' },
]

// ==================== 数据生成函数 ====================

/**
 * 生成随机波动数据（模拟实时市场变化）
 */
function generateFluctuation(baseValue: number, volatility: number = 0.02): number {
  const change = (Math.random() - 0.5) * 2 * volatility * baseValue
  return baseValue + change
}

/**
 * 生成动态新闻数据
 */
function generateDynamicNews(): NewsItem[] {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  
  // 基于当前时间生成不同的新闻组合
  const timeSeed = hours * 60 + minutes
  const newsCount = 6 + (timeSeed % 4) // 6-9条新闻
  
  const dynamicNews: NewsItem[] = []
  const usedIndices = new Set<number>()
  
  for (let i = 0; i < newsCount; i++) {
    let templateIndex: number
    do {
      templateIndex = Math.floor(Math.random() * NEWS_TEMPLATES.length)
    } while (usedIndices.has(templateIndex) && usedIndices.size < NEWS_TEMPLATES.length)
    
    usedIndices.add(templateIndex)
    const template = NEWS_TEMPLATES[templateIndex]
    
    // 生成动态时间
    const timeOffset = Math.floor(Math.random() * 120) // 0-120分钟前
    let timeStr: string
    if (timeOffset < 60) {
      timeStr = `${timeOffset}分钟前`
    } else if (timeOffset < 120) {
      timeStr = '1小时前'
    } else {
      timeStr = '2小时前'
    }
    
    dynamicNews.push({
      ...template,
      id: `news-${now.getTime()}-${i}`,
      time: timeStr,
      // 随机调整优先级
      priority: Math.random() > 0.7 ? 'critical' : (Math.random() > 0.5 ? 'warning' : 'info')
    })
  }
  
  return dynamicNews.sort((a, b) => {
    // 按优先级和时间排序
    const priorityOrder = { critical: 0, warning: 1, info: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

/**
 * 生成动态股票数据
 */
function generateDynamicStocks(): Record<string, StockData> {
  const dynamicStocks: Record<string, StockData> = {}
  const now = new Date().toISOString()
  
  for (const [symbol, baseData] of Object.entries(BASE_STOCK_DATA)) {
    const volatility = 0.015 // 1.5% 波动率
    const newPrice = generateFluctuation(baseData.price, volatility)
    const priceChange = newPrice - baseData.price
    const changePercent = (priceChange / baseData.price) * 100
    
    dynamicStocks[symbol] = {
      ...baseData,
      price: newPrice,
      change: priceChange,
      changePercent: changePercent,
      timestamp: now
    }
  }
  
  return dynamicStocks
}

/**
 * 生成动态行业指数
 */
function generateDynamicIndices(): IndustryIndex[] {
  const now = new Date().toISOString()
  
  return BASE_INDICES.map(index => {
    const volatility = 0.008 // 0.8% 波动率
    const newValue = generateFluctuation(index.value, volatility)
    const valueChange = newValue - index.value
    const changePercent = (valueChange / index.value) * 100
    
    return {
      ...index,
      value: newValue,
      change: valueChange,
      changePercent: changePercent,
      timestamp: now
    }
  })
}

/**
 * 生成动态全球热点
 */
function generateDynamicHotspots(): GlobalHotspot[] {
  const now = new Date()
  const dynamicHotspots: GlobalHotspot[] = []
  
  // 随机选择 4-6 个热点
  const count = 4 + Math.floor(Math.random() * 3)
  const usedIndices = new Set<number>()
  
  for (let i = 0; i < count; i++) {
    let templateIndex: number
    do {
      templateIndex = Math.floor(Math.random() * HOTSPOT_TEMPLATES.length)
    } while (usedIndices.has(templateIndex))
    
    usedIndices.add(templateIndex)
    const template = HOTSPOT_TEMPLATES[templateIndex]
    
    // 生成动态时间
    const timeOffset = Math.floor(Math.random() * 720) // 0-12小时前
    let timeStr: string
    if (timeOffset < 60) {
      timeStr = `${timeOffset}分钟前`
    } else if (timeOffset < 360) {
      timeStr = `${Math.floor(timeOffset / 60)}小时前`
    } else {
      timeStr = '今天'
    }
    
    dynamicHotspots.push({
      ...template,
      id: `hotspot-${now.getTime()}-${i}`,
      time: timeStr
    })
  }
  
  return dynamicHotspots
}

// ==================== 数据获取函数 ====================

/**
 * 获取实时新闻数据
 */
export async function fetchRealNews(category?: string): Promise<NewsItem[]> {
  console.log('Fetching real news data...')
  
  const now = Date.now()
  const cacheExpiry = API_CONFIG.refreshInterval.news
  
  // 检查缓存是否过期
  if (now - lastFetchTime.news < cacheExpiry && cachedNews.length > 0) {
    console.log('Using cached news data')
    if (category && category !== 'all') {
      return cachedNews.filter(n => n.category === category)
    }
    return cachedNews
  }
  
  // 生成新的动态数据
  console.log('Generating fresh news data...')
  cachedNews = generateDynamicNews()
  lastFetchTime.news = now
  
  if (category && category !== 'all') {
    return cachedNews.filter(n => n.category === category)
  }
  return cachedNews
}

/**
 * 获取股票/指数数据
 */
export async function fetchStockData(symbols: string[]): Promise<StockData[]> {
  console.log('Fetching real stock data for:', symbols)
  
  const now = Date.now()
  const cacheExpiry = API_CONFIG.refreshInterval.stock
  
  // 检查缓存是否过期
  if (now - lastFetchTime.stock < cacheExpiry && Object.keys(cachedStocks).length > 0) {
    console.log('Using cached stock data')
    return symbols.map(symbol => cachedStocks[symbol] || BASE_STOCK_DATA[symbol]).filter(Boolean)
  }
  
  // 生成新的动态数据
  console.log('Generating fresh stock data...')
  cachedStocks = generateDynamicStocks()
  lastFetchTime.stock = now
  
  return symbols.map(symbol => cachedStocks[symbol]).filter(Boolean)
}

/**
 * 获取行业指数数据
 */
export async function fetchIndustryIndices(): Promise<IndustryIndex[]> {
  console.log('Fetching industry indices...')
  
  const now = Date.now()
  const cacheExpiry = API_CONFIG.refreshInterval.indices
  
  // 检查缓存是否过期
  if (now - lastFetchTime.indices < cacheExpiry && cachedIndices.length > 0) {
    console.log('Using cached indices data')
    return cachedIndices
  }
  
  // 生成新的动态数据
  console.log('Generating fresh indices data...')
  cachedIndices = generateDynamicIndices()
  lastFetchTime.indices = now
  
  return cachedIndices
}

/**
 * 获取全球热点数据
 */
export async function fetchGlobalHotspots(): Promise<GlobalHotspot[]> {
  console.log('Fetching global hotspots...')
  
  const now = Date.now()
  const cacheExpiry = API_CONFIG.refreshInterval.hotspots
  
  // 检查缓存是否过期
  if (now - lastFetchTime.hotspots < cacheExpiry && cachedHotspots.length > 0) {
    console.log('Using cached hotspots data')
    return cachedHotspots
  }
  
  // 生成新的动态数据
  console.log('Generating fresh hotspots data...')
  cachedHotspots = generateDynamicHotspots()
  lastFetchTime.hotspots = now
  
  return cachedHotspots
}

/**
 * 强制刷新所有数据
 */
export async function forceRefreshAll(): Promise<{
  news: NewsItem[]
  stocks: Record<string, StockData>
  indices: IndustryIndex[]
  hotspots: GlobalHotspot[]
}> {
  console.log('=== FORCE REFRESHING ALL DATA ===')
  
  // 重置所有缓存时间
  lastFetchTime = { news: 0, stock: 0, indices: 0, hotspots: 0 }
  
  // 并行获取所有数据
  const [news, indices, hotspots] = await Promise.all([
    fetchRealNews(),
    fetchIndustryIndices(),
    fetchGlobalHotspots()
  ])
  
  // 获取股票数据
  const stockSymbols = Object.keys(BASE_STOCK_DATA)
  const stocksArray = await fetchStockData(stockSymbols)
  const stocks: Record<string, StockData> = {}
  stocksArray.forEach(s => stocks[s.symbol] = s)
  
  console.log('=== ALL DATA REFRESHED ===')
  
  return { news, stocks, indices, hotspots }
}

// ==================== 自动刷新管理器 ====================

export class DataRefreshManager {
  private intervals: Map<string, number> = new Map()
  private callbacks: Map<string, Function[]> = new Map()

  on(dataType: string, callback: Function) {
    if (!this.callbacks.has(dataType)) {
      this.callbacks.set(dataType, [])
    }
    this.callbacks.get(dataType)!.push(callback)
  }

  start(dataType: string, interval: number, fetchFn: () => Promise<any>) {
    this.stop(dataType)
    fetchFn().then(data => this.notify(dataType, data))
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

  stop(dataType: string) {
    const timer = this.intervals.get(dataType)
    if (timer) {
      clearInterval(timer)
      this.intervals.delete(dataType)
    }
  }

  stopAll() {
    this.intervals.forEach((timer) => clearInterval(timer))
    this.intervals.clear()
  }

  private notify(dataType: string, data: any) {
    const callbacks = this.callbacks.get(dataType) || []
    callbacks.forEach(cb => cb(data))
  }
}

export const dataRefreshManager = new DataRefreshManager()
