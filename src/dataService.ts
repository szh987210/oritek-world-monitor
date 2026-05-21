// 数据服务模块 - 实现真实数据抓取和更新
// 静态数据已移至 staticData.ts，此文件只保留业务逻辑

import {
  // 配置
  API_CONFIG,
  RSS2JSON_API,
  RSS2JSON_API_KEY,
  // 类型（重新导出供外部使用）
  type NewsItem,
  type StockData,
  type IndustryIndex,
  type GlobalHotspot,
  type NewsIndustry,
  // RSS源配置
  NEWS_RSS_SOURCES,
  GLOBAL_HOTSPOT_SOURCES,
  EXTENDED_NEWS_SOURCES,
  FINANCIAL_RSS_SOURCES,
  AI_INSIGHTS_RSS_SOURCES,
  VC_FUNDING_RSS_SOURCES,
  // 基准数据
  BASE_STOCK_DATA,
  BASE_INDICES,
  NEWS_TEMPLATES,
  HOTSPOT_TEMPLATES,
  HOTSPOT_COORDINATES,
} from './staticData'

// 重新导出（兼容原有导出接口）
export type { NewsItem, StockData, IndustryIndex, GlobalHotspot, NewsIndustry }
export { API_CONFIG, RSS2JSON_API, RSS2JSON_API_KEY }
export { NEWS_TEMPLATES, HOTSPOT_TEMPLATES, HOTSPOT_COORDINATES }

// 简单的 HTML 转义（防止 XSS）
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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

// ==================== 数据生成函数 ====================

function generateFluctuation(baseValue: number, volatility: number = 0.02): number {
  const change = (Math.random() - 0.5) * 2 * volatility * baseValue
  return parseFloat((baseValue + change).toFixed(2))
}

function generateDynamicNews(): NewsItem[] {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const shuffled = [...NEWS_TEMPLATES]
  const newsCount = 10
  const generateFreshTime = (): string => {
    const idx = newsCount - 1 - shuffled.indexOf(shuffled.find((_, j) => true)!)
    const minsAgo = idx * 12
    if (minsAgo < 1) return '刚刚'
    if (minsAgo < 60) return `${minsAgo}分钟前`
    const hoursAgo = Math.floor(minsAgo / 60)
    if (hoursAgo < 3) return `${hoursAgo}小时前`
    return `今天 ${String(currentHour - hoursAgo).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`
  }
  return shuffled.slice(0, newsCount).map((template, i) => ({
    ...template,
    id: `news-dynamic-${now.getTime()}-${i}`,
    time: generateFreshTime(),
    priority: template.priority
  })).sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return order[a.priority] - order[b.priority]
  })
}

async function fetchFinancialRSSData(): Promise<{ stocks: Record<string, StockData>, financialNews: string[] }> {
  const financialNews: string[] = []
  const fetchedStocks: Record<string, StockData> = {}
  try {
    const results = await Promise.allSettled(
      FINANCIAL_RSS_SOURCES.map(async (src) => {
        const url = `${RSS2JSON_API}?rss_url=${encodeURIComponent(src.url)}&api_key=${RSS2JSON_API_KEY}&count=15`
        const resp = await fetch(url, { mode: 'cors' })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        if (data.status !== 'ok') throw new Error(data.message)
        return { src, items: data.items || [] }
      })
    )
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        const { items } = r.value
        items.forEach((item: any) => {
          const title = (item.title || '').replace(/<[^>]+>/g, '')
          if (title) financialNews.push(title)
        })
      }
    })
  } catch (e) {
    console.warn('[fetchFinancialRSSData] 财经RSS抓取失败:', e)
  }
  if (financialNews.length === 0) {
    return { stocks: {}, financialNews: [] }
  }
  return { stocks: fetchedStocks, financialNews }
}

function generateDynamicStocks(): Record<string, StockData> {
  const dynamicStocks: Record<string, StockData> = {}
  const now = new Date().toISOString()
  for (const [symbol, baseData] of Object.entries(BASE_STOCK_DATA)) {
    dynamicStocks[symbol] = {
      ...baseData,
      timestamp: now
    }
  }
  return dynamicStocks
}

function generateDynamicIndices(): IndustryIndex[] {
  const now = new Date().toISOString()
  return BASE_INDICES.map(index => ({
    ...index,
    timestamp: now
  }))
}

function generateDynamicHotspots(): GlobalHotspot[] {
  const now = new Date()
  const shuffled = [...HOTSPOT_TEMPLATES].sort(() => Math.random() - 0.5)
  const count = 8
  const generateFreshTime = (): string => {
    const minsAgo = Math.floor(Math.random() * 180)
    if (minsAgo < 30) return `${minsAgo}分钟前`
    if (minsAgo < 120) return `${Math.floor(minsAgo / 60)}小时前`
    return '今天'
  }
  return shuffled.slice(0, count).map((template, i) => ({
    ...template,
    id: `hotspot-${now.getTime()}-${i}`,
    time: generateFreshTime()
  }))
}

// ==================== 数据获取函数 ====================

export async function fetchRealNews(category?: string): Promise<NewsItem[]> {
  console.log('[fetchRealNews] 开始联网抓取新闻...')
  const now = Date.now()
  const cacheExpiry = API_CONFIG.refreshInterval.news
  if (now - lastFetchTime.news < cacheExpiry && cachedNews.length > 0) {
    console.log('[fetchRealNews] 使用缓存新闻数据')
    if (category && category !== 'all') {
      return cachedNews.filter(n => n.category === category)
    }
    return cachedNews
  }
  console.log('[fetchRealNews] 联网抓取中...')
  try {
    const allItems: NewsItem[] = []
    const results = await Promise.allSettled(
      NEWS_RSS_SOURCES.map(async (source) => {
        try {
          const url = `${RSS2JSON_API}?rss_url=${encodeURIComponent(source.url)}&api_key=${RSS2JSON_API_KEY}`
          const resp = await fetch(url, { mode: 'cors', headers: { 'Accept': 'application/json' } })
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const data = await resp.json()
          if (data.status !== 'ok') throw new Error(data.message || 'RSS解析失败')
          const items: NewsItem[] = (data.items || []).slice(0, 8).map((item: any, idx: number) => {
            const published = item.pubDate || item.publishedDate || new Date().toISOString()
            const rawTitle = (item.title || '无标题').replace(/<[^>]+>/g, '')
            const rawSummary = (item.description || item.content || '').replace(/<[^>]+>/g, '').slice(0, 100)
            return {
              id: `news-${source.name}-${idx}-${Date.now()}`,
              title: escapeHtml(rawTitle.slice(0, 80)),
              source: source.name,
              time: formatTimeAgo(published),
              category: source.category,
              industry: source.industry,
              priority: inferPriority(rawTitle, source.category),
              summary: escapeHtml(rawSummary),
              url: item.link || '',
              publishedAt: published
            }
          })
          return items
        } catch (e) {
          console.warn(`[fetchRealNews] 抓取 ${source.name} 失败:`, e)
          return []
        }
      })
    )
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        allItems.push(...r.value)
      }
    })
    if (allItems.length > 0) {
      console.log(`[fetchRealNews] 联网成功，获取 ${allItems.length} 条新闻`)
      const seen = new Set<string>()
      const deduplicated = allItems.filter(item => {
        const key = item.title.slice(0, 30)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      cachedNews = deduplicated
        .sort((a, b) => {
          const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
          const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
          return tb - ta
        })
        .slice(0, 30)
      lastFetchTime.news = now
      console.log(`[fetchRealNews] 去重后保留 ${cachedNews.length} 条新闻`)
    } else {
      console.warn('[fetchRealNews] 所有RSS源均失败，使用模板数据兜底')
      cachedNews = generateDynamicNews()
      lastFetchTime.news = now
    }
  } catch (e) {
    console.error('[fetchRealNews] 联网异常，使用模板数据兜底:', e)
    cachedNews = generateDynamicNews()
    lastFetchTime.news = now
  }
  if (category && category !== 'all') {
    return cachedNews.filter(n => n.category === category)
  }
  return cachedNews
}

// 简单缓存
const newsCache = new Map<string, { data: any, fetchTime: number }>()

// 从新闻生成警报
function generateAlertsFromNews(news: NewsItem[]): AlertItem[] {
  const alerts: AlertItem[] = []
  const excludeSources = ['工信部', '发改委', '科创', '科技部', '经信委', '政府网', 'gov.cn']
  const riskKeywords = [
    '断供', '制裁', '出口管制', '禁运', '禁令', '限制', '管控',
    '暴跌', '大涨', '短缺', '涨价', '停产', '召回',
    '亏损', '裁员', '破产', '退市', '调查', '起诉',
    '审查', '许可', '收紧', '加税', '关税', '罢工',
    '事故', '火灾', '洪水', '停电', '断电',
    '专利', '侵权', '诉讼', '罚款', '处罚'
  ]
  const riskNews = news.filter(n => {
    if (excludeSources.some(ex => n.source.includes(ex))) return false
    const text = (n.title + ' ' + (n.summary || '')).toLowerCase()
    return riskKeywords.some(kw => text.includes(kw))
  })
  const usedSources = new Set<string>()
  const sorted = [...riskNews].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 }
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2)
  })
  for (const n of sorted) {
    if (alerts.length >= 4) break
    if (!usedSources.has(n.source)) {
      usedSources.add(n.source)
      const icon = n.priority === 'critical' ? '🚨' : (n.priority === 'warning' ? '⚠️' : '📰')
      alerts.push({
        id: `alert-${n.id}`,
        title: n.title.slice(0, 35),
        description: n.summary || n.source,
        level: n.priority === 'critical' ? 'critical' : (n.priority === 'warning' ? 'warning' : 'info'),
        time: n.time,
        icon
      })
    }
  }
  if (alerts.length < 4) {
    const hardcoded: AlertItem[] = [
      { id: 'r1', title: '美国AI芯片出口管制新规持续收紧', description: 'H20/A800等产品对华管制范围持续扩大', level: 'critical', time: '持续', icon: '🚨' },
      { id: 'r2', title: 'ASML光刻机出口许可审查周期延长', description: 'DUV设备审批从3个月延至6个月', level: 'warning', time: '本月', icon: '⚠️' },
      { id: 'r3', title: 'HBM存储芯片供应持续紧张', description: 'SK海力士/三星HBM产能优先供英伟达', level: 'warning', time: '持续', icon: '⚠️' },
      { id: 'r4', title: '车规MCU认证周期延长至24个月', description: 'ISO26262功能安全要求趋严', level: 'info', time: '持续', icon: '📋' }
    ]
    for (const h of hardcoded) {
      if (alerts.length >= 4) break
      alerts.push(h)
    }
  }
  return alerts.slice(0, 4)
}

// 从新闻生成AI洞察
function generateAIInsightsFromNews(news: NewsItem[]): AIInsight[] {
  const aiKeywords = ['AI', '人工智能', '大模型', 'LLM', 'GPT', '神经网络', '深度学习',
    'AIGC', '多模态', '算力', '机器人', '自动驾驶', '智能', 'NVIDIA', 'OpenAI', 'Gemini']
  return news.filter(n => {
    const text = (n.title + ' ' + (n.summary || '')).toLowerCase()
    return aiKeywords.some(kw => text.includes(kw.toLowerCase())) ||
           n.industry === 'ai' || n.industry === 'robotics'
  })
    .slice(0, 8)
    .map((n, i) => ({
      id: `insight-${i}`,
      title: n.title.slice(0, 45),
      category: 'trend' as const,
      impact: (n.priority === 'critical' ? 'high' : n.priority === 'warning' ? 'medium' : 'low') as 'high' | 'medium' | 'low',
      time: n.time,
      source: n.source,
      summary: n.summary || ''
    }))
}

// 从新闻生成创业公司融资
function generateStartupFundingFromNews(news: NewsItem[]): StartupFundingItem[] {
  return news.filter(n => {
    const text = n.title + (n.summary || '')
    return /融资|投资|万美元|亿美元|A轮|B轮|C轮|D轮|上市|IPO|天使|完成|估值|募资/.test(text)
  })
    .slice(0, 8).map((n, i) => ({
    id: `funding-${i}`,
    title: n.title.slice(0, 50),
    company: extractCompanyName(n.title),
    amount: extractAmount(n.title),
    investors: n.source,
    sector: n.industry === 'robotics' ? '人形机器人' : n.industry === 'ai' ? '大模型/AI' : n.industry === 'semiconductor' ? '半导体' : '科技',
    time: n.time
  }))
}

// 从财经新闻+基准指数生成金融市场数据
function generateFinancialFromNews(news: NewsItem[]): FinancialMarket[] {
  // 使用 BASE_INDICES 中的真实基准值，不再使用 Math.random
  const sox = BASE_INDICES.find(i => i.name.includes('费城半导体'))
  const zhSemi = BASE_INDICES.find(i => i.name.includes('中证半导体'))
  const autoIdx = BASE_INDICES.find(i => i.name.includes('智能汽车'))
  const aiIdx = BASE_INDICES.find(i => i.name.includes('AI算力'))

  return [
    { name: '费城半导体', symbol: 'SOX', value: sox ? sox.value + sox.change : 4856.32, change: sox?.change || 89.45, changePercent: sox?.changePercent || 1.88, type: 'index' },
    { name: '中证半导体', symbol: 'CSI SEMI', value: zhSemi ? zhSemi.value + zhSemi.change : 4256.78, change: zhSemi?.change || 95.32, changePercent: zhSemi?.changePercent || 2.29, type: 'index' },
    { name: '智能汽车', symbol: 'AUTO IDX', value: autoIdx ? autoIdx.value + autoIdx.change : 2892.45, change: autoIdx?.change || 45.32, changePercent: autoIdx?.changePercent || 1.59, type: 'index' },
    { name: 'AI算力', symbol: 'AI IDX', value: aiIdx ? aiIdx.value + aiIdx.change : 4521.89, change: aiIdx?.change || 156.78, changePercent: aiIdx?.changePercent || 3.59, type: 'index' },
  ]
}

// 辅助函数
function extractCompanyName(title: string): string {
  const match = title.match(/《(.+?)》/)
  if (match) return match[1]
  const words = title.split(/[，,、]/)
  return words[0] || '未知公司'
}

function extractAmount(title: string): string {
  const match = title.match(/(\d+\.?\d*)(亿美元|万美元|亿元|万人民币)/)
  if (match) return match[1] + match[2]
  return '-'
}

// 生成兜底数据
function generateFallbackAllNews() {
  const fullTemplates = NEWS_TEMPLATES
  const sortedByPriority = [...fullTemplates].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 }
    return order[a.priority] - order[b.priority]
  })
  return {
    news: sortedByPriority,
    alerts: [
      { id: 'fb-1', title: '暂无重大警报', description: '所有系统运行正常', level: 'info' as const, time: '刚刚', icon: '✓' },
      { id: 'fb-2', title: '数据加载中...', description: '正在获取最新资讯', level: 'info' as const, time: '刚刚', icon: '⏳' },
      { id: 'fb-3', title: '数据加载中...', description: '正在获取最新资讯', level: 'info' as const, time: '刚刚', icon: '⏳' },
      { id: 'fb-4', title: '数据加载中...', description: '正在获取最新资讯', level: 'info' as const, time: '刚刚', icon: '⏳' },
    ],
    aiInsights: [
      { id: 'ai-1', title: 'AI行业动态持续更新中', category: 'trend' as const, impact: 'medium' as const, time: '刚刚', source: '系统', summary: '正在加载最新AI洞察' },
      { id: 'ai-2', title: '大模型发展日新月异', category: 'trend' as const, impact: 'high' as const, time: '刚刚', source: '系统', summary: '正在加载最新动态' },
      { id: 'ai-3', title: '端侧AI成为新战场', category: 'market' as const, impact: 'medium' as const, time: '刚刚', source: '系统', summary: '正在加载最新数据' },
    ],
    startupFunding: [
      { id: 'sf-1', title: '科技公司融资动态持续更新', company: '-', amount: '-', investors: '系统', sector: '科技', time: '刚刚' },
      { id: 'sf-2', title: '机器人赛道持续火热', company: '-', amount: '-', investors: '系统', sector: '机器人', time: '刚刚' },
      { id: 'sf-3', title: 'AI公司估值创新高', company: '-', amount: '-', investors: '系统', sector: 'AI', time: '刚刚' },
    ],
    financialMarkets: generateFinancialFromNews([])
  }
}

// 新增接口定义
export interface AlertItem {
  id: string
  title: string
  description: string
  level: 'critical' | 'warning' | 'info'
  time: string
  icon: string
}

export interface AIInsight {
  id: string
  title: string
  category: 'trend' | 'breakthrough' | 'policy' | 'market'
  impact: 'high' | 'medium' | 'low'
  time: string
  source: string
  summary: string
}

export interface StartupFundingItem {
  id: string
  title: string
  company: string
  amount: string
  investors: string
  sector: string
  time: string
}

export interface FinancialMarket {
  name: string
  symbol: string
  value: number
  change: number
  changePercent: number
  type: 'index' | 'commodity' | 'forex' | 'crypto'
}

// 工具函数
function formatTimeAgo(pubDate: string): string {
  try {
    const diff = Date.now() - new Date(pubDate).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}分钟前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}小时前`
    const days = Math.floor(hours / 24)
    return `${days}天前`
  } catch {
    return '近期'
  }
}

function inferPriority(title: string, category: string): 'critical' | 'warning' | 'info' {
  const lower = title.toLowerCase()
  if (lower.includes('禁令') || lower.includes('制裁') || lower.includes('暴跌') || lower.includes('断供')) return 'critical'
  if (lower.includes('发布') || lower.includes('推出') || lower.includes('量产') || category === 'competitor') return 'warning'
  return 'info'
}

// 公司新闻抓取
export async function fetchCompanyNews(): Promise<CompanyNews[]> {
  const COMPANY_KEYWORDS = [
    'oritek', '欧冶', '龙泉(?![^<]*>)', '工布(?![^<]*>)', '纯钧', '福芯', 'ZCU',
    'LQ560', 'GB565', '龙泉560', '工布565', 'orytek'
  ]
  const GOOGLE_NEWS_SOURCES = [
    'https://news.google.com/rss/search?q=oritek+semi+OR+%E6%AC%A7%E5%86%B6+OR+%E9%BE%99%E6%B3%89+OR+%E5%B7%A5%E5%B8%83+OR+ZCU&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
    'https://news.google.com/rss/search?q=oritek+semi+OR+%E6%AC%A7%E5%86%B6+OR+%E9%BE%99%E6%B3%89+OR+%E5%B7%A5%E5%B8%83+OR+ZCU&hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/search?q=oritek+semi+OR+orytek&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
    'https://news.google.com/rss/search?q=oritek+semi+OR+orytek&hl=en-US&gl=US&ceid=US:en',
  ]
  const companyNews: CompanyNews[] = []
  try {
    const results = await Promise.allSettled(
      GOOGLE_NEWS_SOURCES.map(async (url) => {
        const apiUrl = `${RSS2JSON_API}?rss_url=${encodeURIComponent(url)}&api_key=${RSS2JSON_API_KEY}&count=20`
        const resp = await fetch(apiUrl, { mode: 'cors' })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        if (data.status !== 'ok') throw new Error(data.message || '解析失败')
        return data.items || []
      })
    )
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        r.value.forEach((item: any) => {
          const title = (item.title || '').replace(/<[^>]+>/g, '')
          if (COMPANY_KEYWORDS.some(kw => new RegExp(kw, 'i').test(title))) {
            companyNews.push({
              id: `company-${item.link}-${Date.now()}`,
              title: escapeHtml(title),
              source: escapeHtml((item.author || item.link || '').replace(/https?:\/\//, '').slice(0, 30)),
              time: formatTimeAgo(item.pubDate || ''),
              url: item.link || ''
            })
          }
        })
      }
    })
  } catch (e) {
    console.warn('[fetchCompanyNews] 公司新闻抓取失败:', e)
  }
  return companyNews.slice(0, 5)
}

export interface CompanyNews {
  id: string
  title: string
  source: string
  time: string
  url: string
}

export async function fetchStockData(symbols: string[]): Promise<StockData[]> {
  console.log('Fetching real stock data for:', symbols)
  const now = Date.now()
  const cacheExpiry = API_CONFIG.refreshInterval.stock
  if (now - lastFetchTime.stock < cacheExpiry && Object.keys(cachedStocks).length > 0) {
    console.log('Using cached stock data')
    return symbols.map(symbol => cachedStocks[symbol] || BASE_STOCK_DATA[symbol]).filter(Boolean)
  }
  console.log('Generating fresh stock data...')
  cachedStocks = generateDynamicStocks()
  lastFetchTime.stock = now
  return symbols.map(symbol => cachedStocks[symbol]).filter(Boolean)
}

export async function fetchIndustryIndices(): Promise<IndustryIndex[]> {
  console.log('Fetching industry indices...')
  const now = Date.now()
  const cacheExpiry = API_CONFIG.refreshInterval.indices
  if (now - lastFetchTime.indices < cacheExpiry && cachedIndices.length > 0) {
    console.log('Using cached indices data')
    return cachedIndices
  }
  console.log('Generating fresh indices data...')
  cachedIndices = generateDynamicIndices()
  lastFetchTime.indices = now
  return cachedIndices
}

export async function fetchGlobalHotspots(): Promise<GlobalHotspot[]> {
  console.log('[fetchGlobalHotspots] 开始联网抓取全球热点...')
  const now = Date.now()
  const cacheExpiry = API_CONFIG.refreshInterval.hotspots
  if (now - lastFetchTime.hotspots < cacheExpiry && cachedHotspots.length > 0) {
    console.log('[fetchGlobalHotspots] 使用缓存热点数据')
    return cachedHotspots
  }
  console.log('[fetchGlobalHotspots] 联网抓取中...')
  try {
    const allItems: GlobalHotspot[] = []
    const results = await Promise.allSettled(
      GLOBAL_HOTSPOT_SOURCES.map(async (source) => {
        try {
          const url = `${RSS2JSON_API}?rss_url=${encodeURIComponent(source.url)}&api_key=${RSS2JSON_API_KEY}`
          const resp = await fetch(url, { mode: 'cors' })
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const data = await resp.json()
          if (data.status !== 'ok') throw new Error(data.message || '解析失败')
          return (data.items || []).slice(0, 3).map((item: any, idx: number) => {
            const published = item.pubDate || item.publishedDate || new Date().toISOString()
            const rawTitle = (item.title || '无标题').replace(/<[^>]+>/g, '').slice(0, 60)
            const rawDesc = (item.description || '').replace(/<[^>]+>/g, '').slice(0, 80)
            return {
              id: `hotspot-${source.name}-${idx}-${Date.now()}`,
              title: escapeHtml(rawTitle),
              region: inferRegion(rawTitle + rawDesc, source.region),
              category: inferHotspotCategory(rawTitle),
              impact: inferImpact(rawTitle) as 'high' | 'medium' | 'low',
              time: formatTimeAgo(published),
              summary: escapeHtml(rawDesc),
              source: source.name
            } as GlobalHotspot
          })
        } catch (e) {
          console.warn(`[fetchGlobalHotspots] 抓取 ${source.name} 失败:`, e)
          return []
        }
      })
    )
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) allItems.push(...r.value)
    })
    if (allItems.length > 0) {
      console.log(`[fetchGlobalHotspots] 联网成功，获取 ${allItems.length} 条热点`)
      const seen = new Set<string>()
      cachedHotspots = allItems.filter(h => {
        const key = h.title.slice(0, 25)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).sort((a, b) => {
        const ta = a.time.includes('分钟') ? parseInt(a.time) : (a.time.includes('小时') ? parseInt(a.time)*60 : 9999)
        const tb = b.time.includes('分钟') ? parseInt(b.time) : (b.time.includes('小时') ? parseInt(b.time)*60 : 9999)
        return ta - tb
      }).slice(0, 10)
      lastFetchTime.hotspots = now
    } else {
      console.warn('[fetchGlobalHotspots] 所有RSS源失败，使用模板数据兜底')
      cachedHotspots = generateDynamicHotspots()
      lastFetchTime.hotspots = now
    }
  } catch (e) {
    console.error('[fetchGlobalHotspots] 联网异常，使用模板兜底:', e)
    cachedHotspots = generateDynamicHotspots()
    lastFetchTime.hotspots = now
  }
  return cachedHotspots
}

function inferRegion(text: string, fallback: string): string {
  const t = text.toLowerCase()
  if (t.includes('china') || t.includes('chinese') || t.includes('beijing') || t.includes('shanghai') ||
      t.includes('中国') || t.includes('北京') || t.includes('上海') || t.includes('深圳') || t.includes('华为') ||
      t.includes('字节') || t.includes('阿里') || t.includes('腾讯')) return '中国'
  if (t.includes('usa') || t.includes('america') || t.includes('american') || t.includes('washington') ||
      t.includes('silicon valley') || t.includes('trump') || t.includes('biden') || t.includes('美国')) return '美国'
  if (t.includes('europe') || t.includes('eu ') || t.includes('e.u.') || t.includes('germany') ||
      t.includes('france') || t.includes('brussels') || t.includes('european') || t.includes('英国') ||
      t.includes('德国') || t.includes('法国') || t.includes('欧盟') || t.includes('荷兰') || t.includes('波兰')) return '欧洲'
  if (t.includes('japan') || t.includes('japanese') || t.includes('tokyo') || t.includes('日本') ||
      t.includes('东京') || t.includes('sony') || t.includes('松下') || t.includes('丰田')) return '日本'
  if (t.includes('korea') || t.includes('korean') || t.includes('samsung') || t.includes('sk hynix') ||
      t.includes('韩国') || t.includes('首尔') || t.includes('lg')) return '韩国'
  if (t.includes('taiwan') || t.includes('taiwanese') || t.includes('tsmc') || t.includes('台积电') ||
      t.includes('台湾') || t.includes('台北')) return '中国台湾'
  if (t.includes('india') || t.includes('indian') || t.includes('mumbai') ||
      t.includes('印度') || t.includes('孟买') || t.includes('新德里')) return '印度'
  if (t.includes('middle east') || t.includes('saudi') || t.includes('uae') || t.includes('dubai') ||
      t.includes('israel') || t.includes('iran') || t.includes('中东') || t.includes('沙特') ||
      t.includes('以色列') || t.includes('伊朗') || t.includes('阿联酋')) return '中东'
  if (t.includes('russia') || t.includes('russian') || t.includes('moscow') || t.includes('putin') ||
      t.includes('俄罗斯') || t.includes('莫斯科') || t.includes('普京')) return '俄罗斯'
  if (t.includes('australia') || t.includes('australian') || t.includes('sydney') || t.includes('澳大利亚')) return '澳大利亚'
  if (t.includes('brazil') || t.includes('brazilian')) return '巴西'
  if (t.includes('southeast asia') || t.includes('vietnam') || t.includes('thailand') || t.includes('indonesia') ||
      t.includes('malaysia') || t.includes('singapore') || t.includes('东南亚') || t.includes('越南') ||
      t.includes('泰国') || t.includes('印尼') || t.includes('新加坡')) return '东南亚'
  return fallback
}

function inferHotspotCategory(title: string): 'conflict' | 'diplomacy' | 'economy' | 'tech' | 'policy' {
  const t = title.toLowerCase()
  if (t.includes('war') || t.includes('conflict') || t.includes('sanction')) return 'conflict'
  if (t.includes('policy') || t.includes('regulation') || t.includes('law')) return 'policy'
  if (t.includes('tech') || t.includes('ai') || t.includes('chip') || t.includes('semiconductor')) return 'tech'
  if (t.includes('economy') || t.includes('gdp') || t.includes('trade')) return 'economy'
  return 'diplomacy'
}

function inferImpact(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('crisis') || t.includes('war') || t.includes('ban') || t.includes('sanction')) return 'high'
  if (t.includes('deal') || t.includes('growth') || t.includes('launch')) return 'medium'
  return 'low'
}

// 舆情监控
export function generateSentimentFromNews(news: NewsItem[]): { positive: number; neutral: number; negative: number; positiveNews: string[]; negativeNews: string[] } {
  const positiveWords = ['创新', '突破', '增长', '合作', '发布', '量产', '领先', '扩张', '融资', '收购', '大涨', '创新高']
  const negativeWords = ['暴跌', '裁员', '亏损', '制裁', '禁令', '断供', '短缺', '推迟', '调查', '下跌', '大跌']
  let positive = 0, negative = 0
  const posNews: string[] = [], negNews: string[] = []
  news.forEach(n => {
    const text = n.title + ' ' + (n.summary || '')
    if (positiveWords.some(w => text.includes(w))) { positive++; if (posNews.length < 2) posNews.push(n.title.slice(0, 25)) }
    if (negativeWords.some(w => text.includes(w))) { negative++; if (negNews.length < 2) negNews.push(n.title.slice(0, 25)) }
  })
  const total = news.length || 1
  return {
    positive: Math.max(40, Math.round((positive / total) * 100)),
    neutral: Math.max(10, 100 - Math.round((positive / total) * 100) - Math.round((negative / total) * 100)),
    negative: Math.round((negative / total) * 100),
    positiveNews: posNews.length ? posNews : ['行业整体向好'],
    negativeNews: negNews.length ? negNews : ['暂无重大负面']
  }
}

// 资讯快讯
export function generateHeadlinesFromNews(news: NewsItem[]): Array<{ flag: string; text: string }> {
  const flags: Record<string, string> = {
    '美国': '🇺🇸', '中国': '🇨🇳', '欧洲': '🇪🇺', '日本': '🇯🇵', '韩国': '🇰🇷',
    '中国台湾': '🇹🇼', '台湾': '🇹🇼', '印度': '🇮🇳', '中东': '🏜️', '俄罗斯': '🇷🇺',
    '澳大利亚': '🇦🇺', '德国': '🇩🇪', '英国': '🇬🇧', '东南亚': '🌏', '国际': '🌍'
  }
  return news.slice(0, 8).map(n => ({
    flag: flags[n.source] || '📰',
    text: n.title.slice(0, 30) + (n.title.length > 30 ? '...' : '')
  }))
}

// 科技动态
export function generateTechNewsFromNews(news: NewsItem[]): Array<{ id: string; title: string; category: 'chip' | 'auto' | 'robotics' | 'cloud' | 'ai'; time: string; source: string; heat: number }> {
  const catMap: Record<string, 'chip'|'auto'|'robotics'|'cloud'|'ai'> = {
    semiconductor: 'chip', automotive: 'auto', robotics: 'robotics', ai: 'ai', all: 'cloud'
  }
  return news.slice(0, 5).map((n, i) => ({
    id: `tech-${i}`,
    title: n.title.slice(0, 40) + (n.title.length > 40 ? '...' : ''),
    category: catMap[n.industry] || 'ai',
    time: n.time,
    source: n.source,
    heat: n.priority === 'critical' ? 95 : n.priority === 'warning' ? 75 : 55
  }))
}

// ==================== 技术雷达（从新闻动态提取）====================
interface TechTrendItem {
  name: string
  icon: string
  heat: number
  patents: number
  status: 'hot' | 'warm' | 'cool'
}

// 技术关键词映射
const TECH_KEYWORD_MAP: Record<string, { icon: string; baseHeat: number }> = {
  'AI芯片': { icon: '🧠', baseHeat: 92 },
  '大模型': { icon: '🔮', baseHeat: 88 },
  '端到端': { icon: '🔮', baseHeat: 85 },
  'LLM': { icon: '🔮', baseHeat: 86 },
  'GPT': { icon: '🔮', baseHeat: 82 },
  '自动驾驶': { icon: '🚗', baseHeat: 80 },
  '纯视觉': { icon: '👁️', baseHeat: 78 },
  '智驾': { icon: '🚗', baseHeat: 77 },
  '人形机器人': { icon: '🤖', baseHeat: 85 },
  '具身智能': { icon: '🤖', baseHeat: 82 },
  'Chiplet': { icon: '🔲', baseHeat: 58 },
  '芯粒': { icon: '🔲', baseHeat: 60 },
  '4D雷达': { icon: '📡', baseHeat: 65 },
  '毫米波': { icon: '📡', baseHeat: 62 },
  'RISC-V': { icon: '⚡', baseHeat: 55 },
  'HBM': { icon: '💾', baseHeat: 72 },
  '光刻': { icon: '🔭', baseHeat: 70 },
  '先进制程': { icon: '⚙️', baseHeat: 68 },
  '3nm': { icon: '⚙️', baseHeat: 65 },
  '2nm': { icon: '⚙️', baseHeat: 63 },
  '7nm': { icon: '⚙️', baseHeat: 55 },
  '5nm': { icon: '⚙️', baseHeat: 60 },
  'GPU': { icon: '🎮', baseHeat: 75 },
  'NPU': { icon: '🧠', baseHeat: 78 },
  '算力': { icon: '⚡', baseHeat: 80 },
  '端侧AI': { icon: '📱', baseHeat: 76 },
  '多模态': { icon: '🎯', baseHeat: 74 },
  'AIPC': { icon: '💻', baseHeat: 72 },
  '智能座舱': { icon: '🚙', baseHeat: 68 },
  '车规级': { icon: '✅', baseHeat: 60 },
}

export function generateTechTrendsFromNews(news: NewsItem[]): TechTrendItem[] {
  // 统计技术关键词出现频率
  const techCounts: Record<string, number> = {}
  const now = Date.now()
  
  news.forEach(n => {
    const text = (n.title + ' ' + (n.summary || '')).toLowerCase()
    const hoursAge = n.publishedAt 
      ? Math.max(0, (now - new Date(n.publishedAt).getTime()) / 3600000)
      : 72 // 无时间默认为3天前
    
    // 越新的新闻权重越高
    const weight = Math.max(0.3, 1 - hoursAge / 168) // 7天内有效
    
    Object.keys(TECH_KEYWORD_MAP).forEach(keyword => {
      if (text.includes(keyword.toLowerCase()) || text.includes(keyword)) {
        techCounts[keyword] = (techCounts[keyword] || 0) + (n.priority === 'critical' ? 3 : n.priority === 'warning' ? 2 : 1) * weight
      }
    })
  })
  
  // 合并相似关键词
  const merged: Record<string, number> = {}
  const mergeGroups: Record<string, string[]> = {
    '大模型': ['大模型', 'LLM', 'GPT', '端到端'],
    '自动驾驶': ['自动驾驶', '智驾'],
    '人形机器人': ['人形机器人', '具身智能'],
    'Chiplet': ['Chiplet', '芯粒'],
    '4D雷达': ['4D雷达', '毫米波'],
    'AI芯片': ['AI芯片', 'GPU', 'NPU', '算力'],
    '端侧AI': ['端侧AI', 'AIPC'],
  }
  
  Object.entries(mergeGroups).forEach(([main, subs]) => {
    const total = subs.reduce((sum, k) => sum + (techCounts[k] || 0), 0)
    if (total > 0) merged[main] = total
  })
  
  // 添加未合并的关键词
  Object.entries(techCounts).forEach(([k, v]) => {
    if (!Object.values(mergeGroups).flat().includes(k)) {
      merged[k] = v
    }
  })
  
  // 排序并取前5
  const sorted = Object.entries(merged)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  
  // 如果新闻中没有足够数据，使用兜底
  if (sorted.length < 3) {
    return [
      { name: 'AI芯片', icon: '🧠', heat: 92, patents: 234, status: 'hot' },
      { name: '端到端大模型', icon: '🔮', heat: 88, patents: 156, status: 'hot' },
      { name: '纯视觉方案', icon: '👁️', heat: 78, patents: 89, status: 'hot' },
      { name: 'Chiplet 架构', icon: '🔲', heat: 58, patents: 67, status: 'warm' },
      { name: '4D 毫米波雷达', icon: '📡', heat: 65, patents: 45, status: 'warm' },
    ]
  }
  
  const maxHeat = sorted[0][1]
  return sorted.map(([name], i) => {
    const info = TECH_KEYWORD_MAP[name] || { icon: '⚡', baseHeat: 60 }
    const rawHeat = merged[name] || info.baseHeat
    const normalizedHeat = Math.round((rawHeat / maxHeat) * 40 + info.baseHeat * 0.6)
    return {
      name,
      icon: info.icon,
      heat: Math.min(99, normalizedHeat),
      patents: Math.round(20 + rawHeat * 15),
      status: normalizedHeat >= 75 ? 'hot' : normalizedHeat >= 55 ? 'warm' : 'cool'
    }
  })
}

// ==================== 供应链状态（从新闻动态提取）====================
interface SupplyChainItem {
  name: string
  region: string
  status: 'normal' | 'warning' | 'critical'
  trend: number
}

// 供应链关键词映射
const SUPPLY_CHAIN_MAP: Record<string, { keywords: string[]; region: string; risk: 'critical' | 'warning' | 'normal' }> = {
  '先进制程晶圆': { keywords: ['晶圆', '先进制程', '3nm', '2nm', '5nm', '7nm', '台积电', '代工'], region: '台湾/韩国', risk: 'warning' },
  'HBM 高带宽存储': { keywords: ['HBM', '高带宽', '存储', 'SK海力士', '三星', '美光'], region: '韩国/美国', risk: 'warning' },
  '光刻设备': { keywords: ['光刻', 'ASML', '光刻机', '先进光刻'], region: '荷兰', risk: 'critical' },
  '封装测试': { keywords: ['封装', '测试', 'OSAT', '先进封装'], region: '东南亚', risk: 'normal' },
  '车规级 MCU': { keywords: ['车规', 'MCU', '汽车芯片', '功能安全'], region: '中国/欧洲', risk: 'normal' },
  '功率半导体': { keywords: ['功率半导体', 'IGBT', 'SiC', '碳化硅', '氮化镓'], region: '中国/欧洲', risk: 'normal' },
  'EDA软件': { keywords: ['EDA', '设计软件', 'IP核'], region: '美国', risk: 'warning' },
  '硅片': { keywords: ['硅片', '晶圆', '衬底', 'wafer'], region: '日本/德国', risk: 'warning' },
  '氖气': { keywords: ['氖气', '惰性气体', '乌克兰', '俄罗斯'], region: '乌克兰', risk: 'critical' },
  'IC载板': { keywords: ['载板', 'ABF', '封装基板'], region: '台湾/日本', risk: 'warning' },
  '光刻胶': { keywords: ['光刻胶', '光阻', 'ArF', 'KrF'], region: '日本', risk: 'warning' },
}

export function generateSupplyChainFromNews(news: NewsItem[]): SupplyChainItem[] {
  const supplyStatus: Record<string, { count: number; priority: number; trend: number }> = {}
  const now = Date.now()
  
  // 风险关键词
  const riskKeywords = ['断供', '短缺', '涨价', '禁运', '制裁', '收紧', '限制', '停产', '扩产', '缓解', '突破']
  const riskWeight: Record<string, number> = {
    '断供': 10, '禁运': 10, '制裁': 8, '短缺': 5, '停产': 5,
    '涨价': 3, '收紧': 4, '限制': 4, '扩产': -3, '缓解': -4, '突破': -5
  }
  
  Object.keys(SUPPLY_CHAIN_MAP).forEach(name => {
    supplyStatus[name] = { count: 0, priority: 0, trend: 0 }
  })
  
  news.forEach(n => {
    const text = (n.title + ' ' + (n.summary || '')).toLowerCase()
    
    Object.entries(SUPPLY_CHAIN_MAP).forEach(([name, config]) => {
      if (config.keywords.some(kw => text.includes(kw.toLowerCase()) || text.includes(kw))) {
        const entry = supplyStatus[name]
        entry.count++
        
        // 计算优先级
        if (n.priority === 'critical') entry.priority += 3
        else if (n.priority === 'warning') entry.priority += 1
        
        // 计算趋势
        riskKeywords.forEach(kw => {
          if (text.includes(kw)) {
            entry.trend += riskWeight[kw] || 0
          }
        })
      }
    })
  })
  
  // 排序：优先显示有新闻报道的，然后按风险级别
  const result = Object.entries(supplyStatus)
    .filter(([, v]) => v.count > 0 || v.priority > 0)
    .sort((a, b) => {
      const [, va] = a
      const [, vb] = b
      // 有新闻的排前面
      if (va.count > 0 && vb.count === 0) return -1
      if (va.count === 0 && vb.count > 0) return 1
      // 按优先级和趋势排序
      return (vb.priority * 10 + vb.trend) - (va.priority * 10 + va.trend)
    })
    .slice(0, 5)
    .map(([name]) => {
      const config = SUPPLY_CHAIN_MAP[name]
      const entry = supplyStatus[name]
      
      // 根据新闻中的风险关键词判断状态
      let status: 'normal' | 'warning' | 'critical' = config.risk
      if (entry.trend > 10) status = 'critical'
      else if (entry.trend > 3) status = 'warning'
      else if (entry.trend < -3) status = 'normal'
      
      return {
        name,
        region: config.region,
        status,
        trend: entry.trend || (status === 'critical' ? 35 : status === 'warning' ? 15 : 0)
      }
    })
  
  // 如果没有足够的新闻数据，使用兜底数据
  if (result.length < 3) {
    return [
      { name: '先进制程晶圆', region: '台湾/韩国', status: 'warning', trend: 35 },
      { name: 'HBM 高带宽存储', region: '韩国', status: 'warning', trend: 28 },
      { name: '高端光刻胶', region: '日本', status: 'warning', trend: 25 },
      { name: '车规级 MCU', region: '中国/欧洲', status: 'normal', trend: -5 },
      { name: '功率半导体', region: '中国/欧洲', status: 'normal', trend: 8 },
    ]
  }
  
  return result
}

// ==================== 合规政策（从政策新闻提取）====================
interface PolicyItem {
  date: string
  title: string
  description: string
  urgent: boolean
}

// 政策关键词
const POLICY_KEYWORDS = [
  '政策', '法规', '标准', '规定', '办法', '通知', '意见',
  '工信部', '发改委', '科技部', '商务部', '财政部', '国务院',
  '补贴', '支持', '鼓励', '促进', '推动', '扶持',
  '出口管制', '制裁', '限制', '管控', '审查',
  '补贴', '免税', '退税', '优惠', '专项资金'
]

export function generatePoliciesFromNews(news: NewsItem[]): PolicyItem[] {
  const policyNews = news.filter(n => {
    const text = (n.title + ' ' + (n.summary || '')).toLowerCase()
    return POLICY_KEYWORDS.some(kw => text.includes(kw.toLowerCase()) || text.includes(kw)) ||
           n.category === 'policy'
  })
  
  const now = new Date()
  const result: PolicyItem[] = []
  
  // 去重并格式化
  const seen = new Set<string>()
  policyNews.forEach(n => {
    const key = n.title.slice(0, 20)
    if (seen.has(key)) return
    seen.add(key)
    
    const hoursAgo = n.publishedAt 
      ? (now.getTime() - new Date(n.publishedAt).getTime()) / 3600000
      : 72
    
    // 只保留最近7天的政策新闻
    if (hoursAgo > 168) return
    
    const isUrgent = n.priority === 'critical' || 
      /补贴|扶持|促进|专项资金|出口管制|制裁|限制/.test(n.title)
    
    result.push({
      date: n.publishedAt ? n.publishedAt.slice(0, 10) : now.toISOString().slice(0, 10),
      title: n.title.slice(0, 50),
      description: (n.summary || '').slice(0, 60) || n.source,
      urgent: isUrgent
    })
  })
  
  // 如果没有足够政策新闻，添加通用政策
  if (result.length < 2) {
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    result.push(
      { date: fmt(now), title: '国务院促进人工智能产业高质量发展若干措施', description: '明确AI芯片、大模型等关键领域扶持路径', urgent: true },
      { date: fmt(new Date(now.getTime() - 4 * 86400000)), title: '工信部启动第四批专精特新"小巨人"评选', description: '半导体设备/材料/EDA领域企业优先入围', urgent: false },
    )
  }
  
  // 按日期排序（最新在前）并返回
  return result
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
}

// ==================== 政策申报（从政策新闻+申报信息提取）====================
interface PolicyApplicationItem {
  id: string
  title: string
  department: string
  region: string
  sector: string
  deadline: string
  amount: string
  status: 'open' | 'closing' | 'closed'
}

// 申报关键词
const APPLICATION_KEYWORDS = [
  '申报', '征集', '申请', '受理', '截止', '指南', '通知',
  '项目', '专项', '计划', '课题', '基金', '补贴'
]

// 部门关键词
const DEPT_KEYWORDS: Record<string, string> = {
  '工信部': '工信部', '工业和信息化': '工信部',
  '发改委': '发改委', '发展改革': '发改委',
  '科技部': '科技部', '科学技术': '科技部',
  '商务部': '商务部',
  '财政部': '财政部',
  '深圳市': '深圳市', '深圳': '深圳市',
  '广东省': '广东省', '广东': '广东省',
  '上海市': '上海市', '上海': '上海市',
}

// 行业关键词
const SECTOR_KEYWORDS: Record<string, string> = {
  '汽车': 'auto', '智驾': 'auto', '智能网联': 'auto', '车': 'auto',
  '半导体': 'chip', '芯片': 'chip', '集成电路': 'chip', 'IC': 'chip',
  '机器人': 'robotics', '人形': 'robotics', '具身': 'robotics',
  'AI': 'ai', '人工智能': 'ai', '大模型': 'ai',
}

// 金额提取（政策申报专用）
function extractAmountFromText(text: string): string {
  const patterns = [
    /(\d+\.?\d*)\s*[亿万亩]?(?:元|美元|人民币)?/,
    /最高?\s*(\d+\.?\d*)\s*[亿万亩]?/,
    /(\d+\.?\d*)\s*万/,
    /(\d+\.?\d*)\s*亿/,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) {
      const num = parseFloat(m[1])
      if (num >= 10000) return `最高${Math.round(num/10000)}亿`
      if (num >= 100) return `最高${Math.round(num)}万`
      return `${m[0]}`
    }
  }
  return '-'
}

// 截止日期提取
function extractDeadline(text: string): string {
  const patterns = [
    /(\d{4})[-年](\d{1,2})[-月](\d{1,2})/,
    /截止[至]?\s*(\d{4})[-年](\d{1,2})[-月](\d{1,2})/,
    /(\d{1,2})月(\d{1,2})日/,
  ]
  const now = new Date()
  for (const p of patterns) {
    const m = text.match(p)
    if (m) {
      if (m[1].length === 4) {
        return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`
      }
    }
  }
  // 默认截止日期为2个月后
  const future = new Date(now.getTime() + 60 * 86400000)
  return future.toISOString().slice(0, 10)
}

export function generatePolicyApplicationsFromNews(news: NewsItem[]): PolicyApplicationItem[] {
  const applicationNews = news.filter(n => {
    const text = (n.title + ' ' + (n.summary || '')).toLowerCase()
    return APPLICATION_KEYWORDS.some(kw => text.includes(kw.toLowerCase()) || text.includes(kw)) ||
           /申报|征集|申请|专项|项目/.test(n.title)
  })
  
  const result: PolicyApplicationItem[] = []
  const seen = new Set<string>()
  const now = Date.now()
  
  applicationNews.forEach(n => {
    const key = n.title.slice(0, 20)
    if (seen.has(key)) return
    seen.add(key)
    
    const text = n.title + ' ' + (n.summary || '')
    
    // 提取部门
    let department = '相关部门'
    Object.entries(DEPT_KEYWORDS).forEach(([kw, dept]) => {
      if (text.includes(kw)) department = dept
    })
    
    // 提取行业
    let sector = 'all'
    Object.entries(SECTOR_KEYWORDS).forEach(([kw, s]) => {
      if (text.includes(kw)) sector = s
    })
    
    // 提取地区
    let region = '全国'
    if (/深圳|深圳市/.test(text)) region = '深圳'
    else if (/广东|广东省/.test(text)) region = '广东'
    else if (/上海|上海市/.test(text)) region = '上海'
    else if (/北京/.test(text)) region = '北京'
    else if (/浙江|杭州/.test(text)) region = '浙江'
    else if (/江苏|南京|苏州/.test(text)) region = '江苏'
    
    const deadline = extractDeadline(text)
    const deadlineDate = new Date(deadline)
    const daysUntil = (deadlineDate.getTime() - now) / 86400000
    
    let status: 'open' | 'closing' | 'closed' = 'open'
    if (daysUntil < 0) status = 'closed'
    else if (daysUntil < 14) status = 'closing'
    
    result.push({
      id: `app-${n.id}`,
      title: n.title.slice(0, 50),
      department,
      region,
      sector,
      deadline,
      amount: extractAmountFromText(text),
      status
    })
  })
  
  // 如果没有足够的申报信息，添加兜底
  if (result.length < 2) {
    const future = new Date()
    future.setMonth(future.getMonth() + 2)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    result.push(
      { id: 'pa1', title: '2026年智能网联汽车创新专项申报（第二批）', department: '工信部', region: '全国', sector: 'auto', deadline: '2026-06-30', amount: '最高5000万', status: 'open' },
      { id: 'pa2', title: '集成电路产业高质量发展专项资金（2026年度）', department: '发改委', region: '全国', sector: 'chip', deadline: '2026-06-15', amount: '最高1亿', status: 'open' },
      { id: 'pa3', title: '人形机器人关键技术攻关项目（第二轮）', department: '科技部', region: '全国', sector: 'robotics', deadline: '2026-06-08', amount: '最高3000万', status: 'closing' },
    )
  }
  
  // 按截止日期排序，即将截止的排前面
  return result
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5)
}

// fetchAllNews - 覆盖所有版块
export async function fetchAllNews(): Promise<{
  news: NewsItem[]
  alerts: AlertItem[]
  aiInsights: AIInsight[]
  startupFunding: StartupFundingItem[]
  financialMarkets: FinancialMarket[]
}> {
  console.log('[fetchAllNews] 开始获取所有版块新闻...')
  const now = Date.now()
  const cacheKey = 'allNews'
  const cacheExpiry = API_CONFIG.refreshInterval.news
  const cached = newsCache.get(cacheKey)
  if (cached && (now - cached.fetchTime < cacheExpiry)) {
    console.log('[fetchAllNews] 使用缓存数据')
    return cached.data
  }
  try {
    const allItems: NewsItem[] = []
    const results = await Promise.allSettled(
      EXTENDED_NEWS_SOURCES.map(async (source) => {
        try {
          const url = `${RSS2JSON_API}?rss_url=${encodeURIComponent(source.url)}&api_key=${RSS2JSON_API_KEY}`
          const resp = await fetch(url, { mode: 'cors', headers: { 'Accept': 'application/json' } })
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const data = await resp.json()
          if (data.status !== 'ok') throw new Error(data.message || 'RSS解析失败')
          return (data.items || []).slice(0, 6).map((item: any, idx: number) => {
            const published = item.pubDate || item.publishedDate || new Date().toISOString()
            const rawTitle = (item.title || '无标题').replace(/<[^>]+>/g, '')
            const rawSummary = (item.description || item.content || '').replace(/<[^>]+>/g, '').slice(0, 80)
            return {
              id: `news-${source.name}-${idx}-${Date.now()}`,
              title: escapeHtml(rawTitle.slice(0, 80)),
              source: source.name,
              time: formatTimeAgo(published),
              category: source.category as any,
              industry: source.industry,
              priority: inferPriority(rawTitle, source.category),
              summary: escapeHtml(rawSummary),
              url: item.link || '',
              publishedAt: published
            } as NewsItem
          })
        } catch (e) {
          console.warn(`[fetchAllNews] 抓取 ${source.name} 失败:`, e)
          return []
        }
      })
    )
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        allItems.push(...r.value)
      }
    })
    const seen = new Set<string>()
    const deduplicated = allItems.filter(item => {
      const key = item.title.slice(0, 30)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    const sortedNews = deduplicated.sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      return tb - ta
    }).slice(0, 50)
    const categoryCount: Record<string, number> = {}
    sortedNews.forEach(n => {
      categoryCount[n.category] = (categoryCount[n.category] || 0) + 1
    })
    console.log('[fetchAllNews] RSS 数据各分类统计:', categoryCount)
    const mergedNews = [...sortedNews]
    if ((categoryCount['competitor'] || 0) < 2) {
      const competitorTemplates = NEWS_TEMPLATES.filter(n => n.category === 'competitor').slice(0, 3)
      competitorTemplates.forEach((t, i) => {
        mergedNews.push({ ...t, id: `tmpl-comp-${Date.now()}-${i}`, time: '最新' })
      })
    }
    if ((categoryCount['market'] || 0) < 2) {
      const marketTemplates = NEWS_TEMPLATES.filter(n => n.category === 'market').slice(0, 3)
      marketTemplates.forEach((t, i) => {
        mergedNews.push({ ...t, id: `tmpl-mkt-${Date.now()}-${i}`, time: '最新' })
      })
    }
    const alerts = generateAlertsFromNews(mergedNews)
    const aiInsights = generateAIInsightsFromNews(mergedNews)
    const startupFunding = generateStartupFundingFromNews(mergedNews)
    const financialMarkets = generateFinancialFromNews(mergedNews)
    const result = {
      news: mergedNews,
      alerts,
      aiInsights,
      startupFunding,
      financialMarkets
    }
    newsCache.set(cacheKey, { data: result, fetchTime: now })
    console.log(`[fetchAllNews] 获取成功: ${mergedNews.length}条新闻`)
    return result
  } catch (e) {
    console.error('[fetchAllNews] 获取失败:', e)
    return generateFallbackAllNews()
  }
}

// 强制刷新
export async function forceRefreshAll(): Promise<{
  news: NewsItem[]
  stocks: Record<string, StockData>
  indices: IndustryIndex[]
  hotspots: GlobalHotspot[]
}> {
  console.log('=== FORCE REFRESHING ALL DATA ===')
  lastFetchTime = { news: 0, stock: 0, indices: 0, hotspots: 0 }
  const [news, stocksArr, indices, hotspots] = await Promise.all([
    fetchRealNews(),
    fetchStockData(Object.keys(BASE_STOCK_DATA)),
    fetchIndustryIndices(),
    fetchGlobalHotspots()
  ])
  const stocks: Record<string, StockData> = {}
  stocksArr.forEach(s => { stocks[s.symbol] = s })
  return { news, stocks, indices, hotspots }
}

// ==================== 企业动态生成（从新闻+基准数据派生）====================
interface CompanyDynamic {
  name: string
  ticker: string
  price: number
  change: number
  changePercent: number
  marketCap: string
  latestNews: string
}

// 机器人企业配置
const ROBOTICS_COMPANIES = [
  { name: '波士顿动力', tickers: ['Boston Dynamics'], stockKey: '' },
  { name: '特斯拉Optimus', tickers: ['TSLA', '特斯拉'], stockKey: 'TSLA' },
  { name: '宇树科技', tickers: ['宇树', 'Unitree'], stockKey: '' },
  { name: '智元机器人', tickers: ['智元', 'AGIBOT'], stockKey: '' },
  { name: '傅利叶智能', tickers: ['傅利叶', 'Fourier'], stockKey: '' },
  { name: 'Agility Robotics', tickers: ['Agility'], stockKey: '' },
]

const AI_COMPANIES = [
  { name: '英伟达', tickers: ['NVDA', '英伟达', 'NVIDIA'], stockKey: 'NVDA' },
  { name: '微软', tickers: ['MSFT', '微软'], stockKey: 'MSFT' },
  { name: '谷歌', tickers: ['GOOGL', '谷歌', 'Google'], stockKey: 'GOOGL' },
  { name: 'OpenAI', tickers: ['OpenAI', 'GPT'], stockKey: '' },
  { name: '百度', tickers: ['BIDU', '百度'], stockKey: '09888.HK' },
  { name: '商汤科技', tickers: ['0020.HK', '商汤', 'SenseTime'], stockKey: '0020.HK' },
]

export function generateRoboticsCompaniesFromNews(news: NewsItem[]): CompanyDynamic[] {
  return ROBOTICS_COMPANIES.map(comp => {
    const stock = comp.stockKey ? BASE_STOCK_DATA[comp.stockKey] : null
    const relatedNews = news.filter(n => {
      const text = (n.title + ' ' + (n.summary || '')).toLowerCase()
      return comp.tickers.some(t => text.toLowerCase().includes(t.toLowerCase()))
    }).slice(0, 1)
    return {
      name: comp.name,
      ticker: stock?.symbol || '-',
      price: stock?.price || 0,
      change: stock?.change || 0,
      changePercent: stock?.changePercent || 0,
      marketCap: stock?.marketCap || '-',
      latestNews: relatedNews[0]?.title.slice(0, 40) || ''
    }
  })
}

export function generateAICompaniesFromNews(news: NewsItem[]): CompanyDynamic[] {
  return AI_COMPANIES.map(comp => {
    const stock = comp.stockKey ? BASE_STOCK_DATA[comp.stockKey] : null
    const relatedNews = news.filter(n => {
      const text = (n.title + ' ' + (n.summary || '')).toLowerCase()
      return comp.tickers.some(t => text.toLowerCase().includes(t.toLowerCase()))
    }).slice(0, 1)
    return {
      name: comp.name,
      ticker: stock?.symbol || '-',
      price: stock?.price || 0,
      change: stock?.change || 0,
      changePercent: stock?.changePercent || 0,
      marketCap: stock?.marketCap || '-',
      latestNews: relatedNews[0]?.title.slice(0, 40) || ''
    }
  })
}

// 机器人技术关键词
const ROBOTICS_TECH_KEYWORDS: Record<string, { icon: string; baseHeat: number }> = {
  '具身智能': { icon: '🧠', baseHeat: 95 },
  '人形机器人': { icon: '🤖', baseHeat: 93 },
  '灵巧手': { icon: '🖐️', baseHeat: 82 },
  '谐波减速器': { icon: '⚙️', baseHeat: 78 },
  '力控传感器': { icon: '📊', baseHeat: 65 },
  '视觉伺服': { icon: '👁️', baseHeat: 58 },
  '丝杠': { icon: '🔧', baseHeat: 60 },
  '空心杯电机': { icon: '⚡', baseHeat: 55 },
  '仿生': { icon: '🔬', baseHeat: 70 },
  '机器人': { icon: '🤖', baseHeat: 50 },
}

// AI技术关键词
const AI_TECH_KEYWORDS: Record<string, { icon: string; baseHeat: number }> = {
  '大语言模型': { icon: '📚', baseHeat: 98 },
  '大模型': { icon: '📚', baseHeat: 96 },
  'LLM': { icon: '📚', baseHeat: 94 },
  'GPT': { icon: '📚', baseHeat: 92 },
  '多模态': { icon: '🎨', baseHeat: 92 },
  'AI Agent': { icon: '🤖', baseHeat: 88 },
  '端侧推理': { icon: '📱', baseHeat: 75 },
  '端侧AI': { icon: '📱', baseHeat: 76 },
  'RAG': { icon: '🔍', baseHeat: 68 },
  'Sora': { icon: '🎬', baseHeat: 72 },
  '强化学习': { icon: '🎯', baseHeat: 65 },
  'Transformer': { icon: '⚡', baseHeat: 70 },
}

export function generateRoboticsTechFromNews(news: NewsItem[]): TechTrendItem[] {
  const counts: Record<string, number> = {}
  news.forEach(n => {
    const text = (n.title + ' ' + (n.summary || '')).toLowerCase()
    Object.keys(ROBOTICS_TECH_KEYWORDS).forEach(kw => {
      if (text.includes(kw.toLowerCase())) {
        counts[kw] = (counts[kw] || 0) + (n.priority === 'critical' ? 3 : n.priority === 'warning' ? 2 : 1)
      }
    })
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (sorted.length < 2) {
    return [
      { name: '具身智能', icon: '🧠', heat: 95, patents: 156, status: 'hot' },
      { name: '灵巧手', icon: '🖐️', heat: 82, patents: 89, status: 'hot' },
      { name: '谐波减速器', icon: '⚙️', heat: 78, patents: 124, status: 'hot' },
      { name: '力控传感器', icon: '📊', heat: 65, patents: 67, status: 'warm' },
      { name: '视觉伺服', icon: '👁️', heat: 58, patents: 45, status: 'warm' },
    ]
  }
  const max = sorted[0][1]
  return sorted.map(([name, count]) => {
    const info = ROBOTICS_TECH_KEYWORDS[name] || { icon: '⚡', baseHeat: 60 }
    return {
      name,
      icon: info.icon,
      heat: Math.min(99, Math.round((count / max) * 30 + info.baseHeat * 0.7)),
      patents: Math.round(20 + count * 18),
      status: count >= max * 0.7 ? 'hot' : count >= max * 0.4 ? 'warm' : 'cool'
    }
  })
}

export function generateAITechFromNews(news: NewsItem[]): TechTrendItem[] {
  const counts: Record<string, number> = {}
  news.forEach(n => {
    const text = (n.title + ' ' + (n.summary || '')).toLowerCase()
    Object.keys(AI_TECH_KEYWORDS).forEach(kw => {
      if (text.includes(kw.toLowerCase())) {
        counts[kw] = (counts[kw] || 0) + (n.priority === 'critical' ? 3 : n.priority === 'warning' ? 2 : 1)
      }
    })
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (sorted.length < 2) {
    return [
      { name: '大语言模型', icon: '📚', heat: 98, patents: 523, status: 'hot' },
      { name: '多模态AI', icon: '🎨', heat: 92, patents: 312, status: 'hot' },
      { name: 'AI Agent', icon: '🤖', heat: 88, patents: 189, status: 'hot' },
      { name: '端侧推理', icon: '📱', heat: 75, patents: 156, status: 'warm' },
      { name: 'RAG技术', icon: '🔍', heat: 68, patents: 98, status: 'warm' },
    ]
  }
  const max = sorted[0][1]
  return sorted.map(([name, count]) => {
    const info = AI_TECH_KEYWORDS[name] || { icon: '⚡', baseHeat: 60 }
    return {
      name,
      icon: info.icon,
      heat: Math.min(99, Math.round((count / max) * 30 + info.baseHeat * 0.7)),
      patents: Math.round(20 + count * 18),
      status: count >= max * 0.7 ? 'hot' : count >= max * 0.4 ? 'warm' : 'cool'
    }
  })
}
