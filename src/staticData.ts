// 静态数据文件 - 所有配置、模板、基准数据集中管理
// 业务逻辑文件（dataService.ts）从此模块导入静态数据

// 行业类型
export type NewsIndustry = 'semiconductor' | 'automotive' | 'robotics' | 'ai' | 'all'

// ==================== 更新频率配置 ====================
export const API_CONFIG = {
  refreshInterval: {
    news: 3 * 60 * 1000,       // 新闻：3分钟
    stock: 60 * 1000,           // 股票：1分钟
    indices: 60 * 1000,         // 指数：1分钟
    hotspots: 5 * 60 * 1000     // 热点：5分钟
  }
}

// ==================== RSS2JSON API ====================
export const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json'
export const RSS2JSON_API_KEY = '5pqyispe2bx5hz4cxnqfv36tyk3s4x6l6up4cr6f'

// ==================== 数据接口 ====================
export interface NewsItem {
  id: string
  title: string
  source: string
  time: string
  category: 'competitor' | 'market' | 'policy' | 'tech' | 'supply' | 'finance' | 'ai' | 'robotics' | 'auto' | 'general'
  industry: 'semiconductor' | 'automotive' | 'robotics' | 'ai' | 'all'
  priority: 'critical' | 'warning' | 'info'
  summary: string
  url?: string
  publishedAt?: string
  verified?: boolean  // P2-5: 内容来源验证标记
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

// ==================== RSS来源可信度评分 (P2-4) ====================
// 评分标准：知名机构媒体=90-100，专业垂直媒体=70-89，综合科技媒体=50-69，聚合器/未知=30-49
// 评分仅反映来源声誉，不代替抓取成功率（后者由 healthScore 独立计算）
export const SOURCE_CREDIBILITY: Record<string, number> = {
  'EE Times': 92,
  'Semi Engineering': 93,
  'The Robot Report': 88,
  'NVIDIA Blog': 95,
  'TechCrunch': 82,
  'The Verge': 80,
  'Wired': 80,
  'Semiconductor Today': 90,
  'Digitimes': 78,
  'Supply Chain Dive': 76,
  'BBC世界': 91,
  'BBC科技': 91,
  '路透科技': 90,
  'Al Jazeera': 85,
  'France24': 77,
  '德国之声': 88,
  'NHK世界': 90,
  '36氪': 68,
  'SemiWiki': 72,
  'Electronics Weekly': 70,
  'Semi Digest': 65,
  'SemiAnalysis': 75,
  '工信部公告': 98,
}

// ==================== 基础新闻RSS源（仅保留实测有效的URL）====================
export const NEWS_RSS_SOURCES: Array<{
  name: string
  url: string
  category: 'tech' | 'market' | 'policy' | 'supply' | 'competitor'
  industry: NewsIndustry
}> = [
  { name: 'EE Times', url: 'https://www.eetimes.com/feed/',          category: 'tech', industry: 'semiconductor' },
  { name: 'Semi Engineering', url: 'https://semiengineering.com/feed/', category: 'tech', industry: 'semiconductor' },
  { name: 'The Robot Report', url: 'https://www.therobotreport.com/feed/', category: 'tech', industry: 'robotics' },
  { name: '36氪',   url: 'https://36kr.com/feed',                    category: 'tech', industry: 'ai' },
  { name: 'NVIDIA Blog', url: 'https://blogs.nvidia.com/feed/',      category: 'tech', industry: 'ai' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/',         category: 'tech', industry: 'all' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech', industry: 'all' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', category: 'tech', industry: 'all' },
  { name: 'Semiconductor Today', url: 'https://www.semiconductor-today.com/rss/news.xml', category: 'tech', industry: 'semiconductor' },
  { name: 'Digitimes', url: 'https://www.digitimes.com/rss/daily.xml', category: 'competitor', industry: 'semiconductor' },
  // SupplyChainBrain /rss/ 返回HTML索引页而非RSS feed，替换为实测有效的 Supply Chain Dive
  { name: 'Supply Chain Dive', url: 'https://www.supplychaindive.com/feeds/news/', category: 'supply', industry: 'all' },
]

// ==================== 全球热点RSS源（仅保留实测有效的URL）====================
export const GLOBAL_HOTSPOT_SOURCES = [
  { name: 'BBC世界', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', region: '国际' },
  { name: 'BBC科技', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', region: '国际' },
  // CNN RSS 在国内被墙（ERR_CONNECTION_CLOSED），替换为路透社科技
  { name: '路透科技', url: 'https://www.reuters.com/technology/rss', region: '国际' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', region: '中东' },
  { name: 'France24', url: 'https://www.france24.com/en/rss', region: '欧洲' },
  { name: '德国之声', url: 'https://rss.dw.com/rdf/rss-de-all', region: '欧洲' },
  { name: 'NHK世界', url: 'https://www3.nhk.or.jp/rss/news/cat0.xml', region: '日本' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', region: '美国' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', region: '美国' },
]

// ==================== 扩展RSS新闻源（仅保留实测有效的URL）====================
export const EXTENDED_NEWS_SOURCES: Array<{
  name: string
  url: string
  category: 'tech' | 'market' | 'policy' | 'supply' | 'competitor' | 'ai' | 'robotics' | 'auto' | 'finance' | 'general'
  industry: NewsIndustry
}> = [
  // 半导体行业
  { name: 'Semiconductor Today', url: 'https://www.semiconductor-today.com/rss/news.xml', category: 'tech', industry: 'semiconductor' },
  { name: 'Semi Engineering', url: 'https://semiengineering.com/feed/', category: 'tech', industry: 'semiconductor' },
  { name: 'Digitimes每日', url: 'https://www.digitimes.com/rss/daily.xml', category: 'competitor', industry: 'semiconductor' },
  { name: 'SemiWiki', url: 'https://semiwiki.com/feed/', category: 'competitor', industry: 'semiconductor' },
  { name: 'Electronics Weekly', url: 'https://www.electronicsweekly.com/feed/', category: 'competitor', industry: 'semiconductor' },
  { name: 'Semi Digest', url: 'https://www.semiconductor-digest.com/feed/', category: 'market', industry: 'semiconductor' },
  { name: 'SemiAnalysis', url: 'https://semianalysis.com/feed/', category: 'market', industry: 'semiconductor' },
  // AI行业
  { name: '36氪', url: 'https://36kr.com/feed', category: 'ai', industry: 'ai' },
  { name: 'NVIDIA Blog', url: 'https://blogs.nvidia.com/feed/', category: 'ai', industry: 'ai' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'ai', industry: 'ai' },
  { name: 'TechCrunch-AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'ai', industry: 'ai' },
  // 通用科技
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'general', industry: 'all' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', category: 'general', industry: 'all' },
  // 供应链
  // SupplyChainBrain /rss/ 返回HTML索引页而非RSS feed，替换为实测有效的 Supply Chain Dive
  { name: 'Supply Chain Dive', url: 'https://www.supplychaindive.com/feeds/news/', category: 'supply', industry: 'all' },
  // 政策动态 (注：依赖第三方RSSHub实例 rsshub.feeddd.org，稳定性取决于上游服务)
  { name: '工信部公告', url: 'https://rsshub.feeddd.org/https://www.miit.gov.cn/api-gateway/jpaas-plugins-web-server/front/rss/getinfo?webId=8d828e408d90447786ddbe128d495e9e&columnIds=925fa8f4afd44e53818794ed96d9876e,30f92eeafcfd4685984dfb793a2c5fff', category: 'policy', industry: 'all' },
  // VC融资（专项源）
  { name: '36氪-创投', url: 'https://36kr.com/feed', category: 'finance', industry: 'all' },
]

// ==================== 财经RSS源（仅保留实测有效的URL）====================
export const FINANCIAL_RSS_SOURCES: Array<{ name: string; url: string; symbol: string }> = [
  // 注：东方财富 feed.eastmoney.com *.xml 已失效（重定向到首页）
  // 华尔街见闻 wallstreetcn.com/rss 已失效（404）
  // 新浪财经 feed.mix.sina.com.cn 非标准RSS格式
  // 财经数据改用 dataService 中的 generateFinancialFromNews() 从 BASE_INDICES 派生
]

// ==================== AI洞察RSS源（仅保留实测有效的URL）====================
export const AI_INSIGHTS_RSS_SOURCES = [
  { name: '36氪-AI', url: 'https://36kr.com/feed', keywords: ['AI', '人工智能', '大模型', 'LLM', '机器人', '智能驾驶', '算力', 'AIGC', 'GPT', '融资'] },
  { name: 'NVIDIA博客', url: 'https://blogs.nvidia.com/feed/', keywords: ['AI', 'GPU', 'deep learning', 'LLM', 'neural', 'model'] },
  { name: 'TechCrunch-AI', url: 'https://techcrunch.com/feed/', keywords: ['AI', 'artificial intelligence', 'machine learning', 'LLM', 'robotics'] },
]

// ==================== VC融资RSS源（仅保留实测有效的URL）====================
export const VC_FUNDING_RSS_SOURCES = [
  { name: '36氪-创投', url: 'https://36kr.com/feed', keywords: ['融资', '投资', '轮', '万美元', '亿', '估值', '天使', 'A轮', 'B轮', 'C轮', 'IPO', '上市'] },
  { name: 'TechCrunch-AI', url: 'https://techcrunch.com/feed/', keywords: ['funding', 'raised', 'million', 'billion', 'series', 'seed', 'IPO', 'valuation'] },
]

// ==================== 股票基准数据（来源：NeoData 2026-05-14/15）====================
export const BASE_STOCK_DATA: Record<string, StockData> = {
  'NVDA': { symbol: 'NVDA', name: '英伟达', price: 235.74, change: 9.91, changePercent: 4.39, volume: 180782857, marketCap: '5.71T', timestamp: new Date('2026-05-14T16:00:01Z').toISOString() },
  'INTC': { symbol: 'INTC', name: '英特尔', price: 115.93, change: -4.36, changePercent: -3.62, volume: 118279791, marketCap: '582.7B', timestamp: new Date('2026-05-14T16:00:01Z').toISOString() },
  'QCOM': { symbol: 'QCOM', name: '高通', price: 200.08, change: -13.09, changePercent: -6.14, volume: 24883884, marketCap: '210.9B', timestamp: new Date('2026-05-14T16:00:01Z').toISOString() },
  'AMD': { symbol: 'AMD', name: 'AMD', price: 449.70, change: 4.20, changePercent: 0.94, volume: 26113570, marketCap: '733.3B', timestamp: new Date('2026-05-14T16:00:01Z').toISOString() },
  'MSFT': { symbol: 'MSFT', name: '微软', price: 409.43, change: 4.22, changePercent: 1.04, volume: 27077542, marketCap: '3.04T', timestamp: new Date('2026-05-14T16:00:01Z').toISOString() },
  'GOOGL': { symbol: 'GOOGL', name: '谷歌', price: 401.07, change: -1.55, changePercent: -0.38, volume: 21136716, marketCap: '4.86T', timestamp: new Date('2026-05-14T16:00:01Z').toISOString() },
  'TSLA': { symbol: 'TSLA', name: '特斯拉', price: 443.30, change: -1.97, changePercent: -0.44, volume: 46070361, marketCap: '1.66T', timestamp: new Date('2026-05-14T16:00:01Z').toISOString() },
  'TSM': { symbol: 'TSM', name: '台积电', price: 417.72, change: 17.92, changePercent: 4.48, volume: 18577103, marketCap: '2.17T', timestamp: new Date('2026-05-14T16:04:01Z').toISOString() },
  'MU': { symbol: 'MU', name: '美光科技', price: 776.01, change: -27.62, changePercent: -3.44, volume: 42142707, marketCap: '875.1B', timestamp: new Date('2026-05-14T16:00:01Z').toISOString() },
  'AVGO': { symbol: 'AVGO', name: '博通', price: 439.79, change: 23.00, changePercent: 5.52, volume: 19733760, marketCap: '2.08T', timestamp: new Date('2026-05-14T16:00:01Z').toISOString() },
  'ASML': { symbol: 'ASML', name: '阿斯麦', price: 1584.51, change: 2.93, changePercent: 0.19, volume: 1412600, marketCap: '610.7B', timestamp: new Date('2026-05-14T16:00:01Z').toISOString() },
  'AMAT': { symbol: 'AMAT', name: '应用材料', price: 440.56, change: 3.95, changePercent: 0.90, volume: 14936202, marketCap: '349.6B', timestamp: new Date('2026-05-14T16:00:01Z').toISOString() },
  'LRCX': { symbol: 'LRCX', name: '泛林集团', price: 299.15, change: 3.71, changePercent: 1.26, volume: 6404921, marketCap: '374.1B', timestamp: new Date('2026-05-14T16:00:01Z').toISOString() },
  'KLAC': { symbol: 'KLAC', name: '科磊', price: 1892.94, change: 43.23, changePercent: 2.34, volume: 810282, marketCap: '247.3B', timestamp: new Date('2026-05-14T16:00:01Z').toISOString() },
  'MRVL': { symbol: 'MRVL', name: '迈威尔', price: 182.58, change: 4.63, changePercent: 2.60, volume: 32661057, marketCap: '159.9B', timestamp: new Date('2026-05-14T16:00:01Z').toISOString() },
  '9868.HK': { symbol: '9868.HK', name: '小鹏汽车', price: 61.30, change: -0.95, changePercent: -1.53, volume: 11318504, marketCap: '1,173.5亿港元', timestamp: new Date('2026-05-15T16:09:19Z').toISOString() },
  '09888.HK': { symbol: '09888.HK', name: '百度集团', price: 135.80, change: -5.10, changePercent: -3.62, volume: 11216349, marketCap: '3,696.5亿港元', timestamp: new Date('2026-05-15T16:09:19Z').toISOString() },
  '0020.HK': { symbol: '0020.HK', name: '商汤科技', price: 1.86, change: -0.07, changePercent: -3.63, volume: 399737384, marketCap: '785.2亿港元', timestamp: new Date('2026-05-15T16:09:19Z').toISOString() },
  '9866.HK': { symbol: '9866.HK', name: '蔚来汽车', price: 38.92, change: -0.85, changePercent: -2.14, volume: 12000000, marketCap: '82B', timestamp: new Date().toISOString() },
  '2015.HK': { symbol: '2015.HK', name: '理想汽车', price: 75.60, change: -1.25, changePercent: -1.63, volume: 12094423, marketCap: '1,550.0亿港元', timestamp: new Date('2026-05-15T16:09:18Z').toISOString() },
  '09660.HK': { symbol: '09660.HK', name: '地平线机器人', price: 6.26, change: 0.00, changePercent: 0.00, volume: 215499344, marketCap: '915.2亿港元', timestamp: new Date('2026-05-15T16:09:14Z').toISOString() },
  '688981.SH': { symbol: '688981.SH', name: '中芯国际', price: 119.02, change: 1.12, changePercent: 0.95, volume: 132810054, marketCap: '9,537.3亿', timestamp: new Date('2026-05-15T16:14:34Z').toISOString() },
  '603501.SH': { symbol: '603501.SH', name: '韦尔股份', price: 108.45, change: 2.35, changePercent: 2.21, volume: 3200000, marketCap: '128B', timestamp: new Date().toISOString() },
  '002049.SZ': { symbol: '002049.SZ', name: '紫光国微', price: 65.32, change: -0.85, changePercent: -1.29, volume: 4500000, marketCap: '55B', timestamp: new Date().toISOString() },
  '300782.SZ': { symbol: '300782.SZ', name: '卓胜微', price: 78.92, change: 1.45, changePercent: 1.87, volume: 1800000, marketCap: '42B', timestamp: new Date().toISOString() },
  '688012.SH': { symbol: '688012.SH', name: '中微公司', price: 185.45, change: 3.85, changePercent: 2.12, volume: 1200000, marketCap: '115B', timestamp: new Date().toISOString() },
  '688396.SH': { symbol: '688396.SH', name: '华润微', price: 48.56, change: 0.65, changePercent: 1.36, volume: 2100000, marketCap: '64B', timestamp: new Date().toISOString() },
  '603893.SH': { symbol: '603893.SH', name: '瑞芯微', price: 125.32, change: 2.85, changePercent: 2.33, volume: 980000, marketCap: '52B', timestamp: new Date().toISOString() },
  '688608.SH': { symbol: '688608.SH', name: '恒玄科技', price: 168.45, change: 3.25, changePercent: 1.97, volume: 650000, marketCap: '20B', timestamp: new Date().toISOString() },
  '300223.SZ': { symbol: '300223.SZ', name: '北京君正', price: 72.15, change: 1.25, changePercent: 1.76, volume: 1200000, marketCap: '35B', timestamp: new Date().toISOString() },
  '688595.SH': { symbol: '688595.SH', name: '芯海科技', price: 35.68, change: 0.45, changePercent: 1.28, volume: 850000, marketCap: '5B', timestamp: new Date().toISOString() },
}

// ==================== 行业指数基准数据 ====================
export const BASE_INDICES: IndustryIndex[] = [
  { name: '费城半导体', value: 4856.32, change: 89.45, changePercent: 1.88, icon: '🔷', timestamp: new Date('2026-05-14T16:00:01Z').toISOString() },
  { name: '中证半导体', value: 4256.78, change: 95.32, changePercent: 2.29, icon: '💎', timestamp: new Date('2026-05-15T16:00:00Z').toISOString() },
  { name: '智能汽车', value: 2892.45, change: 45.32, changePercent: 1.59, icon: '🚗', timestamp: new Date('2026-05-15T16:00:00Z').toISOString() },
  { name: '机器人指数', value: 2156.89, change: 68.45, changePercent: 3.28, icon: '🤖', timestamp: new Date('2026-05-15T16:00:00Z').toISOString() },
  { name: 'AI算力指数', value: 4521.89, change: 156.78, changePercent: 3.59, icon: '🧠', timestamp: new Date('2026-05-15T16:00:00Z').toISOString() },
  { name: '新能源指数', value: 1856.32, change: -23.45, changePercent: -1.25, icon: '⚡', timestamp: new Date('2026-05-15T16:00:00Z').toISOString() },
]

// ==================== 新闻数据模板（已清空：不再使用硬编码假数据作为兜底）====================
export const NEWS_TEMPLATES: NewsItem[] = []

// ==================== 全球热点模板（已清空：不再使用硬编码假数据）====================
export const HOTSPOT_TEMPLATES: GlobalHotspot[] = []

// ==================== 热点坐标字典 ====================
export const HOTSPOT_COORDINATES: Record<string, [number, number]> = {
  '美国': [-98.5794, 39.8283],
  '中国': [116.4074, 39.9042],
  '欧洲': [4.9041, 52.3676],
  '德国': [13.4050, 52.5200],
  '英国': [-0.1276, 51.5074],
  '法国': [2.2137, 48.8566],
  '荷兰': [4.9041, 52.3676],
  '俄罗斯': [37.6173, 55.7558],
  '日本': [139.6917, 35.6895],
  '韩国': [126.9780, 37.5665],
  '印度': [77.1025, 28.7041],
  '东南亚': [103.8198, 1.3521],
  '新加坡': [103.8198, 1.3521],
  '中国台湾': [121.5654, 25.0330],
  '台湾': [121.5654, 25.0330],
  '以色列': [35.2137, 31.7683],
  '中东': [46.6753, 24.7136],
  '沙特': [46.6753, 24.7136],
  '阿联酋': [53.8478, 23.4241],
  '伊朗': [53.6880, 32.4279],
  '澳大利亚': [149.1300, -35.2809],
  '巴西': [-51.9253, -14.2350],
  '加拿大': [-75.6972, 45.4215],
  '墨西哥': [-99.1332, 19.4326],
  '阿根廷': [-58.3816, -34.6037],
  '土耳其': [32.8597, 39.9334],
  '意大利': [12.4964, 41.9028],
  '西班牙': [-3.7038, 40.4168],
  '波兰': [21.0122, 52.2297],
  '瑞士': [7.4474, 46.9480],
  '瑞典': [18.6435, 60.1282],
  '挪威': [10.7522, 63.4305],
  '丹麦': [12.5683, 55.6761],
  '比利时': [4.3517, 50.8503],
  '奥地利': [16.3738, 48.2082],
  '菲律宾': [120.9842, 14.5995],
  '越南': [105.8342, 21.0278],
  '泰国': [100.5018, 13.7563],
  '印尼': [106.8650, -6.1751],
  '马来西亚': [101.6869, 3.1390],
  '缅甸': [96.1951, 16.8661],
  '巴基斯坦': [67.0011, 33.6844],
  '哈萨克斯坦': [71.4491, 51.1694],
  '乌克兰': [30.5234, 50.4501],
  '埃及': [31.2357, 30.0444],
  '南非': [18.4234, -33.9249],
  '肯尼亚': [36.8219, -1.2921],
  '尼日利亚': [3.3792, 6.5244],
  '摩洛哥': [-7.5898, 31.7917],
}
