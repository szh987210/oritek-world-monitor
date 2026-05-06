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
  { id: '1', title: '英伟达发布新一代自动驾驶芯片Thor，算力达2000 TOPS', source: '36氪', time: '10:32', category: 'competitor', priority: 'critical', summary: '英伟达 GTC 大会发布新一代 GPU，专为自动驾驶优化，直接对标地平线征程6' },
  { id: '2', title: '小米汽车销量创新高，智驾需求持续强劲', source: '汽车之家', time: '09:45', category: 'market', priority: 'info', summary: '小米 SU7 月交付量突破 2 万台，智驾功能成核心卖点' },
  { id: '3', title: '美国拟扩大对华半导体出口管制范围', source: '财联社', time: '08:20', category: 'policy', priority: 'critical', summary: '新规可能影响 14nm 以下先进制程设备，国产替代压力加大' },
  { id: '4', title: '地平线征程6芯片通过多家主机厂车规认证', source: '公司官网', time: '11:15', category: 'competitor', priority: 'warning', summary: '量产准备就绪，预计 Q2 批量出货，目标年出货量 500 万颗' },
  { id: '5', title: '台积电先进制程产能持续紧张，汽车芯片交期延长', source: '电子时报', time: '昨天', category: 'supply', priority: 'warning', summary: '3nm 订单已排至 2026 年底，2nm 试产良率超预期' },
  { id: '6', title: 'Mobileye Q1营收超预期，与宝马合作深化', source: '路透社', time: '2天前', category: 'competitor', priority: 'info', summary: 'EyeQ6 芯片将用于下一代高端车型，年收入同比增长 24%' },
  { id: '7', title: '黑芝麻智能通过港交所聆讯，最快年内上市', source: '证券时报', time: '2天前', category: 'market', priority: 'warning', summary: '国产智驾芯片厂商加速上市进程，募资约 15 亿港元' },
  { id: '8', title: '华为昇腾910C芯片性能超越英伟达A100', source: 'TechWeb', time: '3天前', category: 'competitor', priority: 'critical', summary: '国产 AI 芯片竞争力持续增强，挑战英伟达数据中心霸主地位' },
  { id: '9', title: '欧盟《芯片法案》补贴计划首批项目落地', source: '彭博社', time: '3天前', category: 'policy', priority: 'info', summary: '430 亿欧元支持本土芯片制造业，台积电德国工厂获批' },
  { id: '10', title: '比亚迪自研智驾芯片"璇玑"流片成功', source: '汽车之家', time: '4天前', category: 'market', priority: 'warning', summary: '垂直整合趋势加速，供应链格局或将生变' },
  { id: '11', title: '英特尔Lunar Lake芯片发布，集成NPU算力大幅提升', source: 'AnandTech', time: '4天前', category: 'tech', priority: 'info', summary: '端侧 AI 算力竞争进入新阶段，X86 生态 AI 化加速' },
  { id: '12', title: 'RISC-V架构在汽车芯片领域渗透加速', source: '半导体行业观察', time: '5天前', category: 'tech', priority: 'info', summary: '多家汽车主机厂表示将优先选用 RISC-V 架构 MCU' },
  { id: '13', title: '韩国三星新一代HBM4存储正式量产', source: '韩国先驱报', time: '1天前', category: 'supply', priority: 'warning', summary: 'AI训练加速器存储带宽大幅提升，SK海力士同步跟进' },
  { id: '14', title: '日本政府宣布新一轮半导体补贴，总额超1万亿日元', source: '日经新闻', time: '1天前', category: 'policy', priority: 'info', summary: '重点扶持 Rapidus 先进制程和汽车芯片企业' },
  { id: '15', title: '蔚来ET9智驾系统实测，端到端大模型效果优异', source: '懂车帝', time: '今天', category: 'market', priority: 'info', summary: '纯视觉方案 + 端到端大模型成为国内智驾主流方向' },
  { id: '16', title: 'AI芯片全球短缺延续，订单能见度延伸至18个月', source: 'Digitimes', time: '今天', category: 'supply', priority: 'critical', summary: 'H100/H200 需求远超供给，客户转向国产替代方案' },
]

// 全球热点模板
const HOTSPOT_TEMPLATES: GlobalHotspot[] = [
  { id: '1', title: '美国对华半导体出口管制再度升级', region: '美国', category: 'policy', impact: 'high', time: '2小时前', summary: '新规将影响先进制程设备，EDA软件或纳入管控' },
  { id: '2', title: '欧盟芯片法案补贴计划首批落地', region: '欧洲', category: 'policy', impact: 'medium', time: '4小时前', summary: '430 亿欧元支持本土芯片制造，台积电德国获批' },
  { id: '3', title: '台积电海外工厂建设提速', region: '美国', category: 'economy', impact: 'medium', time: '6小时前', summary: '亚利桑那、日本、德国三地工厂同步推进' },
  { id: '4', title: '日本扩大半导体设备对华出口限制', region: '日本', category: 'policy', impact: 'high', time: '8小时前', summary: '涉及 23 种先进半导体制造设备' },
  { id: '5', title: '韩国三星先进制程良率持续提升', region: '韩国', category: 'tech', impact: 'medium', time: '10小时前', summary: '3nm GAA 工艺良率已超 60%，挑战台积电地位' },
  { id: '6', title: '中东主权基金大举投资芯片产业', region: '中东', category: 'economy', impact: 'medium', time: '12小时前', summary: '沙特阿美联合 TSMC 筹建中东首家先进晶圆厂' },
  { id: '7', title: '中国新能源汽车出口高速增长', region: '中国', category: 'economy', impact: 'medium', time: '3小时前', summary: 'Q1 出口同比增长 45%，东南亚和欧洲市场持续拓展' },
  { id: '8', title: '台积电美国工厂良率问题导致投产延期', region: '美国', category: 'tech', impact: 'high', time: '昨天', summary: '亚利桑那工厂 4nm 制程良率不达标，投产推迟至 2027' },
  { id: '9', title: '印度半导体激励政策吸引多家厂商', region: '印度', category: 'economy', impact: 'medium', time: '5小时前', summary: '塔塔集团与 PSMC 合作建厂，印度芯片雄心初见成效' },
  { id: '10', title: '英国脱欧后科技产业重振计划发布', region: '欧洲', category: 'policy', impact: 'low', time: '15小时前', summary: 'ARM 再度成为英国科技王冠，政府加大半导体研发投入' },
]

// ==================== 数据生成函数 ====================

/**
 * 生成随机波动数据（模拟实时市场变化）
 */
function generateFluctuation(baseValue: number, volatility: number = 0.02): number {
  const change = (Math.random() - 0.5) * 2 * volatility * baseValue
  return parseFloat((baseValue + change).toFixed(2))
}

/**
 * 生成动态新闻数据 - 每次刷新使用不同的新闻组合
 */
function generateDynamicNews(): NewsItem[] {
  const now = new Date()
  
  // 完全随机打乱模板顺序，确保每次内容不同
  const shuffled = [...NEWS_TEMPLATES].sort(() => Math.random() - 0.5)
  const newsCount = 7 + Math.floor(Math.random() * 4) // 7-10条新闻
  
  const timeFormats = [
    '刚刚', '1分钟前', '3分钟前', '5分钟前', '8分钟前', '12分钟前',
    '15分钟前', '20分钟前', '30分钟前', '45分钟前', '1小时前',
    '2小时前', '3小时前', '5小时前', '8小时前', '昨天', '2天前'
  ]
  
  return shuffled.slice(0, newsCount).map((template, i) => ({
    ...template,
    id: `news-${now.getTime()}-${i}`,
    time: timeFormats[Math.floor(Math.random() * timeFormats.length)],
    // 随机调整优先级（但保持原始基调）
    priority: (Math.random() > 0.8 
      ? 'critical' 
      : (Math.random() > 0.4 ? template.priority : 'info')
    ) as 'critical' | 'warning' | 'info'
  })).sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return order[a.priority] - order[b.priority]
  })
}

/**
 * 生成动态股票数据 - 每次刷新产生明显价格波动
 */
function generateDynamicStocks(): Record<string, StockData> {
  const dynamicStocks: Record<string, StockData> = {}
  const now = new Date().toISOString()
  // 市场整体情绪（随机多/空倾向）
  const marketSentiment = (Math.random() - 0.45) * 0.01 // -0.45% ~ +0.55% 偏多
  
  for (const [symbol, baseData] of Object.entries(BASE_STOCK_DATA)) {
    const volatility = 0.02 + Math.random() * 0.015 // 2%-3.5% 波动率，更明显
    const sentimentBias = baseData.price * marketSentiment
    const randomChange = (Math.random() - 0.5) * 2 * volatility * baseData.price
    const totalChange = randomChange + sentimentBias
    const newPrice = parseFloat((baseData.price + totalChange).toFixed(2))
    const changePercent = parseFloat(((totalChange / baseData.price) * 100).toFixed(2))
    
    dynamicStocks[symbol] = {
      ...baseData,
      price: newPrice,
      change: parseFloat(totalChange.toFixed(2)),
      changePercent,
      timestamp: now
    }
  }
  
  return dynamicStocks
}

/**
 * 生成动态行业指数 - 每次刷新有明显变动
 */
function generateDynamicIndices(): IndustryIndex[] {
  const now = new Date().toISOString()
  const marketTrend = (Math.random() - 0.4) * 0.015 // 偏多倾向
  
  return BASE_INDICES.map(index => {
    const volatility = 0.01 + Math.random() * 0.01 // 1%-2% 波动率
    const trendBias = index.value * marketTrend
    const randomChange = (Math.random() - 0.5) * 2 * volatility * index.value
    const totalChange = randomChange + trendBias
    const newValue = parseFloat((index.value + totalChange).toFixed(2))
    const changePercent = parseFloat(((totalChange / index.value) * 100).toFixed(2))
    
    return {
      ...index,
      value: newValue,
      change: parseFloat(totalChange.toFixed(2)),
      changePercent,
      timestamp: now
    }
  })
}

/**
 * 生成动态全球热点 - 每次随机组合不同热点
 */
function generateDynamicHotspots(): GlobalHotspot[] {
  const now = new Date()
  
  // 完全随机打乱，取 5-7 个
  const shuffled = [...HOTSPOT_TEMPLATES].sort(() => Math.random() - 0.5)
  const count = 5 + Math.floor(Math.random() * 3)
  
  const timeFormats = [
    '刚刚', '15分钟前', '30分钟前', '1小时前', '2小时前',
    '3小时前', '5小时前', '8小时前', '12小时前', '今天', '昨天'
  ]
  
  return shuffled.slice(0, count).map((template, i) => ({
    ...template,
    id: `hotspot-${now.getTime()}-${i}`,
    time: timeFormats[Math.floor(Math.random() * timeFormats.length)]
  }))
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
