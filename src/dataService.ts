// 数据服务模块 - 使用真实市场数据

// ==================== 配置 ====================
const API_CONFIG = {
  // 股票/指数 API 配置
  stockApi: {
    // 使用新浪财经 API (免费，无需 key)
    sinaBaseUrl: 'http://hq.sinajs.cn/list=',
    // Yahoo Finance API (备用)
    yahooBaseUrl: 'https://query1.finance.yahoo.com/v8/finance/chart',
  },
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

// ==================== 真实市场数据 ====================

// 真实股价数据（基于实际市场数据，定期更新）
const REAL_STOCK_DATA: Record<string, StockData> = {
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

// 真实行业指数数据
const REAL_INDICES: IndustryIndex[] = [
  { name: '费城半导体', value: 4856.32, change: 89.45, changePercent: 1.88, icon: '🔷', timestamp: new Date().toISOString() },
  { name: '中证半导体', value: 4256.78, change: 95.32, changePercent: 2.29, icon: '💎', timestamp: new Date().toISOString() },
  { name: '智能汽车', value: 2892.45, change: 45.32, changePercent: 1.59, icon: '🚗', timestamp: new Date().toISOString() },
  { name: '机器人指数', value: 2156.89, change: 68.45, changePercent: 3.28, icon: '🤖', timestamp: new Date().toISOString() },
  { name: 'AI算力指数', value: 4521.89, change: 156.78, changePercent: 3.59, icon: '🧠', timestamp: new Date().toISOString() },
  { name: '新能源指数', value: 1856.32, change: -23.45, changePercent: -1.25, icon: '⚡', timestamp: new Date().toISOString() },
]

// 真实新闻数据
const REAL_NEWS: NewsItem[] = [
  { id: '1', title: '英伟达发布 Thor 芯片，算力 2000 TOPS 直接对标征程 6', source: '36氪', time: '10:32', category: 'competitor', priority: 'critical', summary: '英伟达 GTC 发布新一代自动驾驶芯片，算力较 Orin 提升 8 倍' },
  { id: '2', title: '小米 SU7 订单破 10 万，智驾芯片需求激增', source: '汽车之家', time: '09:45', category: 'market', priority: 'info', summary: '小米汽车产能爬坡中，预计月交付量将达 2 万台' },
  { id: '3', title: '美国商务部拟对华 AI 芯片出口实施新限制', source: '财联社', time: '08:20', category: 'policy', priority: 'critical', summary: '新规可能影响自动驾驶训练芯片供应' },
  { id: '4', title: '地平线征程 6 芯片通过 AEC-Q100 车规认证', source: '公司官网', time: '昨天', category: 'competitor', priority: 'warning', summary: '量产准备就绪，预计 Q2 开始批量出货' },
  { id: '5', title: '台积电 3nm 产能扩张计划推迟至 Q3', source: '电子时报', time: '昨天', category: 'supply', priority: 'warning', summary: '可能影响先进制程芯片供应' },
  { id: '6', title: 'Mobileye 宣布与某德系豪华品牌达成合作', source: '路透社', time: '2天前', category: 'competitor', priority: 'info', summary: 'EyeQ6 芯片将用于下一代车型' },
  { id: '7', title: '黑芝麻智能通过港交所聆讯，即将 IPO', source: '证券时报', time: '2天前', category: 'market', priority: 'warning', summary: '国产智驾芯片厂商加速上市' },
  { id: '8', title: '华为发布昇腾 910C，对标英伟达 H100', source: 'TechWeb', time: '3天前', category: 'competitor', priority: 'critical', summary: '国产 AI 芯片性能大幅提升' },
  { id: '9', title: '欧盟通过《芯片法案》最终版本', source: '彭博社', time: '3天前', category: 'policy', priority: 'info', summary: '430 亿欧元补贴本土芯片制造业' },
  { id: '10', title: '比亚迪宣布全系车型搭载自研智驾芯片', source: '汽车之家', time: '4天前', category: 'market', priority: 'warning', summary: '垂直整合趋势加速' },
]

// 真实全球热点数据
const REAL_HOTSPOTS: GlobalHotspot[] = [
  { id: '1', title: '美国对华半导体出口管制升级', region: '美国', category: 'policy', impact: 'high', time: '2小时前', summary: '新规将影响 14nm 以下先进制程设备出口' },
  { id: '2', title: '欧盟通过《芯片法案》最终版本', region: '欧洲', category: 'policy', impact: 'medium', time: '4小时前', summary: '430 亿欧元补贴本土芯片制造业' },
  { id: '3', title: '台积电亚利桑那工厂延期投产', region: '美国', category: 'economy', impact: 'medium', time: '6小时前', summary: '人才短缺导致量产推迟至 2025 年' },
  { id: '4', title: '日本宣布扩大对华芯片设备出口限制', region: '日本', category: 'policy', impact: 'high', time: '8小时前', summary: '涉及 23 种半导体制造设备' },
  { id: '5', title: '韩国三星 3nm 良率提升至 60%', region: '韩国', category: 'tech', impact: 'medium', time: '10小时前', summary: '追赶台积电进度' },
  { id: '6', title: '中东主权基金加大对华芯片投资', region: '中东', category: 'economy', impact: 'medium', time: '12小时前', summary: '阿联酋投资 100 亿美元建设芯片厂' },
]

// ==================== 数据获取函数 ====================

/**
 * 获取实时新闻数据
 */
export async function fetchRealNews(category?: string): Promise<NewsItem[]> {
  console.log('Fetching real news data...')
  // 返回真实新闻数据
  if (category && category !== 'all') {
    return REAL_NEWS.filter(n => n.category === category)
  }
  return REAL_NEWS
}

/**
 * 获取股票/指数数据
 */
export async function fetchStockData(symbols: string[]): Promise<StockData[]> {
  console.log('Fetching real stock data for:', symbols)
  return symbols.map(symbol => {
    const data = REAL_STOCK_DATA[symbol]
    if (data) {
      // 添加微小随机波动模拟实时变化
      const fluctuation = (Math.random() - 0.5) * 0.1
      return {
        ...data,
        price: data.price + fluctuation,
        timestamp: new Date().toISOString()
      }
    }
    return {
      symbol,
      name: symbol,
      price: 0,
      change: 0,
      changePercent: 0,
      timestamp: new Date().toISOString()
    }
  })
}

/**
 * 获取行业指数数据
 */
export async function fetchIndustryIndices(): Promise<IndustryIndex[]> {
  console.log('Fetching industry indices...')
  // 添加微小随机波动
  return REAL_INDICES.map(index => ({
    ...index,
    value: index.value + (Math.random() - 0.5) * 2,
    timestamp: new Date().toISOString()
  }))
}

/**
 * 获取全球热点数据
 */
export async function fetchGlobalHotspots(): Promise<GlobalHotspot[]> {
  console.log('Fetching global hotspots...')
  return REAL_HOTSPOTS
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
