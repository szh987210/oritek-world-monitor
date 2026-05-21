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

// ==================== 基础新闻RSS源 ====================
export const NEWS_RSS_SOURCES: Array<{
  name: string
  url: string
  category: 'tech' | 'market' | 'policy' | 'supply' | 'competitor'
  industry: NewsIndustry
}> = [
  { name: '集微网', url: 'https://laoyaoba.com/rss',                   category: 'tech', industry: 'semiconductor' },
  { name: 'AnandTech', url: 'https://www.anandtech.com/feeds.xml',   category: 'tech', industry: 'semiconductor' },
  { name: 'EE Times', url: 'https://www.eetimes.com/feed/',          category: 'tech', industry: 'semiconductor' },
  { name: '半导体行业观察', url: 'https://semiinsider.com/feed',      category: 'tech', industry: 'semiconductor' },
  { name: '车云网', url: 'http://www.cheyun.com/rss.xml',            category: 'market', industry: 'automotive' },
  { name: '盖世汽车', url: 'https://auto.gasgoo.com/rss/',           category: 'market', industry: 'automotive' },
  { name: '第一电动', url: 'https://www.d1ev.com/rss',                category: 'market', industry: 'automotive' },
  { name: '机器之心', url: 'https://www.jiqizhixin.com/rss',         category: 'tech', industry: 'robotics' },
  { name: 'AI科技媒体', url: 'https://www.therobotreport.com/feed/', category: 'tech', industry: 'robotics' },
  { name: '36氪',   url: 'https://36kr.com/feed',                    category: 'tech', industry: 'ai' },
  { name: '虎嗅',   url: 'https://www.huxiu.com/rss/0.xml',         category: 'tech', industry: 'ai' },
  { name: 'AI Blog', url: 'https://blogs.nvidia.com/feed/',          category: 'tech', industry: 'ai' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/',         category: 'tech', industry: 'all' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech', industry: 'all' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech', industry: 'all' },
]

// ==================== 全球热点RSS源 ====================
export const GLOBAL_HOTSPOT_SOURCES = [
  { name: 'BBC世界', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', region: '国际' },
  { name: 'BBC科技', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', region: '国际' },
  { name: 'CNN国际', url: 'https://rss.cnn.com/rss/edition_world.rss', region: '国际' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', region: '中东' },
  { name: 'France24', url: 'https://www.france24.com/en/rss', region: '欧洲' },
  { name: '德国之声', url: 'https://rss.dw.com/rdf/rss-de-all', region: '欧洲' },
  { name: 'NHK世界', url: 'https://www3.nhk.or.jp/rss/news/cat0.xml', region: '日本' },
  { name: '财联社', url: 'https://www.cls.cn/rss', region: '中国' },
  { name: '环球时报', url: 'https://www.huanqiu.com/rss', region: '中国' },
  { name: '参考消息', url: 'https://www.cankaoxiaoxi.com/rss/', region: '中国' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', region: '美国' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', region: '美国' },
]

// ==================== 扩展RSS新闻源 ====================
export const EXTENDED_NEWS_SOURCES: Array<{
  name: string
  url: string
  category: 'tech' | 'market' | 'policy' | 'supply' | 'competitor' | 'ai' | 'robotics' | 'auto' | 'finance' | 'general'
  industry: NewsIndustry
}> = [
  // 半导体行业
  { name: 'Semiconductor Today', url: 'https://www.semiconductor-today.com/rss/news.xml', category: 'tech', industry: 'semiconductor' },
  { name: 'EE Times半导体', url: 'https://www.eetimes.com/tag/semiconductors/feed/', category: 'tech', industry: 'semiconductor' },
  { name: 'TechXplore半导体', url: 'https://techxplore.com/rss-feed/semiconductors-news/', category: 'tech', industry: 'semiconductor' },
  { name: 'Semi Engineering', url: 'https://semiengineering.com/feed/', category: 'tech', industry: 'semiconductor' },
  // 智能汽车行业
  { name: '盖世汽车-行业', url: 'https://www.gasgoo.com/ClassRss.aspx?ClassId=108', category: 'auto', industry: 'automotive' },
  { name: '盖世汽车-智驾', url: 'https://www.gasgoo.com/ClassRss.aspx?ClassId=601', category: 'auto', industry: 'automotive' },
  { name: '盖世汽车-新技术', url: 'https://www.gasgoo.com/ClassRss.aspx?ClassId=409', category: 'auto', industry: 'automotive' },
  { name: '新浪汽车', url: 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2514&k=&num=20&page=1', category: 'auto', industry: 'automotive' },
  // 机器人行业
  { name: 'Robot.tv', url: 'https://news.robot.tv/feed.xml', category: 'robotics', industry: 'robotics' },
  { name: 'Semi Engineering', url: 'https://semiengineering.com/feed/', category: 'robotics', industry: 'robotics' },
  // AI行业
  { name: '36氪', url: 'https://36kr.com/feed', category: 'ai', industry: 'ai' },
  { name: 'NVIDIA Blog', url: 'https://blogs.nvidia.com/feed/', category: 'ai', industry: 'ai' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'ai', industry: 'ai' },
  // 通用科技
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'general', industry: 'all' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'general', industry: 'all' },
  // 金融财经
  { name: '新浪财经', url: 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2514&k=&num=20&page=1', category: 'finance', industry: 'all' },
  // 竞争动态
  { name: 'Digitimes每日', url: 'https://www.digitimes.com/rss/daily.xml', category: 'competitor', industry: 'semiconductor' },
  { name: 'SemiWiki', url: 'https://semiwiki.com/feed/', category: 'competitor', industry: 'semiconductor' },
  { name: 'Evertiq', url: 'https://feeds2.feedburner.com/EvertiqCom/All', category: 'competitor', industry: 'semiconductor' },
  // 市场动态
  { name: 'Semi Digest', url: 'https://www.semiconductor-digest.com/feed/', category: 'market', industry: 'semiconductor' },
  { name: 'SemiAnalysis', url: 'https://semianalysis.com/feed/', category: 'market', industry: 'semiconductor' },
  { name: 'TechXplore半导体', url: 'https://techxplore.com/rss-feed/semiconductors-news/', category: 'market', industry: 'semiconductor' },
  // 供应链动态
  { name: 'Semi Today供应链', url: 'https://www.semiconductor-today.com/rss/news.xml', category: 'supply', industry: 'semiconductor' },
  { name: 'SupplyChainBrain', url: 'https://www.supplychainbrain.com/rss/', category: 'supply', industry: 'all' },
  // 政策动态
  { name: '工信部公告', url: 'https://rsshub.feeddd.org/https://www.miit.gov.cn/api-gateway/jpaas-plugins-web-server/front/rss/getinfo?webId=8d828e408d90447786ddbe128d495e9e&columnIds=925fa8f4afd44e53818794ed96d9876e,30f92eeafcfd4685984dfb793a2c5fff', category: 'policy', industry: 'all' },
  // AI洞察（专项源）
  { name: '机器之心-AI', url: 'https://www.jiqizhixin.com/rss', category: 'ai', industry: 'ai' },
  { name: '虎嗅-AI', url: 'https://www.huxiu.com/rss/0.xml', category: 'ai', industry: 'ai' },
  { name: 'NVIDIA Blog', url: 'https://blogs.nvidia.com/feed/', category: 'ai', industry: 'ai' },
  { name: 'TechCrunch-AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'ai', industry: 'ai' },
  // VC融资（专项源）
  { name: '36氪-创投', url: 'https://36kr.com/feed', category: 'finance', industry: 'all' },
  { name: '投中网', url: 'https://www.chinaventure.com.cn/rss/', category: 'finance', industry: 'all' },
  { name: '猎云网', url: 'https://lieyun.pro/feed/', category: 'finance', industry: 'all' },
]

// ==================== 财经RSS源 ====================
export const FINANCIAL_RSS_SOURCES = [
  { name: '东方财富-大盘', url: 'https://feed.eastmoney.com/market.xml', symbol: 'INDEX' },
  { name: '东方财富-财经', url: 'https://feed.eastmoney.com/caifu.xml', symbol: 'FINANCE' },
  { name: '华尔街见闻', url: 'https://wallstreetcn.com/rss', symbol: 'FINANCE' },
  { name: '新浪财经', url: 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2514&k=&num=20&page=1', symbol: 'INDEX' },
]

// ==================== AI洞察RSS源 ====================
export const AI_INSIGHTS_RSS_SOURCES = [
  { name: '机器之心', url: 'https://www.jiqizhixin.com/rss', keywords: ['AI', '大模型', 'LLM', '神经网络', 'GPT', '深度学习', '人工智能', 'AIGC', '多模态', '算力'] },
  { name: '36氪-AI', url: 'https://36kr.com/feed', keywords: ['AI', '人工智能', '大模型', 'LLM', '机器人', '智能驾驶', '算力', 'AIGC', 'GPT', '融资'] },
  { name: '虎嗅-AI', url: 'https://www.huxiu.com/rss/0.xml', keywords: ['AI', '大模型', '人工智能', 'GPT', '算力', '机器人', '自动驾驶'] },
  { name: 'NVIDIA博客', url: 'https://blogs.nvidia.com/feed/', keywords: ['AI', 'GPU', 'deep learning', 'LLM', 'neural', 'model'] },
  { name: 'TechCrunch-AI', url: 'https://techcrunch.com/feed/', keywords: ['AI', 'artificial intelligence', 'machine learning', 'LLM', 'robotics'] },
]

// ==================== VC融资RSS源 ====================
export const VC_FUNDING_RSS_SOURCES = [
  { name: '36氪-创投', url: 'https://36kr.com/feed', keywords: ['融资', '投资', '轮', '万美元', '亿', '估值', '天使', 'A轮', 'B轮', 'C轮', 'IPO', '上市'] },
  { name: '机器之心-资本', url: 'https://www.jiqizhixin.com/rss', keywords: ['融资', '投资', '初创', 'VC', 'PE', '亿美元', '估值'] },
  { name: '投中网', url: 'https://www.chinaventure.com.cn/rss/', keywords: ['融资', '投资', '初创', 'VC', 'PE', 'IPO'] },
  { name: '猎云网', url: 'https://lieyun.pro/feed/', keywords: ['融资', '投资', '创业', '融资'] },
  { name: '动脉网', url: 'https://vcbeat.top/rss/', keywords: ['融资', '投资', '创业'] },
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

// ==================== 新闻数据模板（兜底用）====================
export const NEWS_TEMPLATES: NewsItem[] = [
  // ========== 竞争动态 competitor ==========
  { id: 'c1', title: '英伟达发布新一代自动驾驶芯片Thor，算力达2000 TOPS', source: '36氪', time: '10:32', category: 'competitor', industry: 'semiconductor', priority: 'critical', summary: '英伟达 GTC 大会发布新一代 GPU，专为自动驾驶优化，直接对标地平线征程6' },
  { id: 'c2', title: 'Mobileye Q1营收超预期，与宝马合作深化', source: '路透社', time: '2天前', category: 'competitor', industry: 'semiconductor', priority: 'warning', summary: 'EyeQ6 芯片将用于下一代高端车型，年收入同比增长 24%' },
  { id: 'c3', title: '华为昇腾910C芯片性能超越英伟达A100', source: 'TechWeb', time: '3天前', category: 'competitor', industry: 'semiconductor', priority: 'critical', summary: '国产 AI 芯片竞争力持续增强，挑战英伟达数据中心霸主地位' },
  { id: 'c4', title: '地平线征程6芯片通过多家主机厂车规认证', source: '公司官网', time: '11:15', category: 'competitor', industry: 'semiconductor', priority: 'warning', summary: '量产准备就绪，预计 Q2 批量出货，目标年出货量 500 万颗' },
  { id: 'c5', title: 'Mobileye发布EyeQ6 Ultra，算力达176 TOPS', source: 'AnandTech', time: '1天前', category: 'competitor', industry: 'semiconductor', priority: 'warning', summary: '基于 5nm 工艺，支持 L4 级自动驾驶' },
  { id: 'c6', title: '黑芝麻智能华山A1000 Pro量产提速', source: '盖世汽车', time: '今天', category: 'competitor', industry: 'automotive', priority: 'warning', summary: '已获多家头部车企定点，预计年底月出货量突破 10 万颗' },
  { id: 'c7', title: '特斯拉FSD V13全面推送，端到端方案效果超预期', source: 'Electrek', time: '2天前', category: 'competitor', industry: 'automotive', priority: 'warning', summary: '特斯拉自动驾驶系统升级至端到端大模型，安全性提升 50%' },
  // ========== 市场动态 market ==========
  { id: 'm1', title: '小米汽车销量创新高，智驾需求持续强劲', source: '汽车之家', time: '09:45', category: 'market', industry: 'automotive', priority: 'info', summary: '小米 SU7 月交付量突破 2 万台，智驾功能成核心卖点' },
  { id: 'm2', title: '黑芝麻智能通过港交所聆讯，最快年内上市', source: '证券时报', time: '2天前', category: 'market', industry: 'automotive', priority: 'warning', summary: '国产智驾芯片厂商加速上市进程，募资约 15 亿港元' },
  { id: 'm3', title: '比亚迪自研智驾芯片"璇玑"流片成功', source: '汽车之家', time: '4天前', category: 'market', industry: 'automotive', priority: 'warning', summary: '垂直整合趋势加速，供应链格局或将生变' },
  { id: 'm4', title: '蔚来ET9智驾系统实测，端到端大模型效果优异', source: '懂车帝', time: '今天', category: 'market', industry: 'automotive', priority: 'info', summary: '纯视觉方案 + 端到端大模型成为国内智驾主流方向' },
  { id: 'm5', title: '全球智驾芯片市场2025年规模将突破200亿美元', source: 'IDC', time: '3天前', category: 'market', industry: 'semiconductor', priority: 'info', summary: 'L2+渗透率持续提升，国产芯片份额快速增长' },
  { id: 'm6', title: '人形机器人市场规模2030年预计达380亿美元', source: '麦肯锡', time: '5天前', category: 'market', industry: 'robotics', priority: 'info', summary: '制造业和商业场景同步渗透，年复合增长率超40%' },
  // ========== 半导体行业 tech ==========
  { id: 't1', title: '台积电先进制程产能持续紧张，汽车芯片交期延长', source: '电子时报', time: '昨天', category: 'supply', industry: 'semiconductor', priority: 'warning', summary: '3nm 订单已排至 2026 年底，2nm 试产良率超预期' },
  { id: 't2', title: '英特尔Lunar Lake芯片发布，集成NPU算力大幅提升', source: 'AnandTech', time: '4天前', category: 'tech', industry: 'semiconductor', priority: 'info', summary: '端侧 AI 算力竞争进入新阶段，X86 生态 AI 化加速' },
  { id: 't3', title: 'RISC-V架构在汽车芯片领域渗透加速', source: '半导体行业观察', time: '5天前', category: 'tech', industry: 'semiconductor', priority: 'info', summary: '多家汽车主机厂表示将优先选用 RISC-V 架构 MCU' },
  { id: 't4', title: '韩国三星新一代HBM4存储正式量产', source: '韩国先驱报', time: '1天前', category: 'supply', industry: 'semiconductor', priority: 'warning', summary: 'AI训练加速器存储带宽大幅提升，SK海力士同步跟进' },
  // ========== 政策动态 policy ==========
  { id: 'p1', title: '美国拟扩大对华半导体出口管制范围', source: '财联社', time: '08:20', category: 'policy', industry: 'semiconductor', priority: 'critical', summary: '新规可能影响 14nm 以下先进制程设备，国产替代压力加大' },
  { id: 'p2', title: '欧盟《芯片法案》补贴计划首批项目落地', source: '彭博社', time: '3天前', category: 'policy', industry: 'semiconductor', priority: 'info', summary: '430 亿欧元支持本土芯片制造业，台积电德国工厂获批' },
  { id: 'p3', title: '日本政府宣布新一轮半导体补贴，总额超1万亿日元', source: '日经新闻', time: '1天前', category: 'policy', industry: 'semiconductor', priority: 'info', summary: '重点扶持 Rapidus 先进制程和汽车芯片企业' },
  // ========== AI / 机器人 tech ==========
  { id: 'ai1', title: 'Figure AI 发布新一代人形机器人', source: 'TechCrunch', time: '昨天', category: 'tech', industry: 'robotics', priority: 'warning', summary: '人形机器人商业化加速，多场景落地' },
  { id: 'ai2', title: 'GPT-5 发布，多模态能力大幅提升', source: 'OpenAI', time: '今天', category: 'tech', industry: 'ai', priority: 'critical', summary: '下一代大语言模型能力飞跃，推理能力提升 10 倍' },
  { id: 'ai3', title: 'AI芯片全球短缺延续，订单能见度延伸至18个月', source: 'Digitimes', time: '今天', category: 'supply', industry: 'semiconductor', priority: 'critical', summary: 'H100/H200 需求远超供给，客户转向国产替代方案' },
]

// ==================== 全球热点模板 ====================
export const HOTSPOT_TEMPLATES: GlobalHotspot[] = [
  { id: '1', title: '美国对华半导体出口管制再度升级', region: '美国', category: 'policy', impact: 'high', time: '2小时前', summary: '新规将影响先进制程设备，EDA软件或纳入管控' },
  { id: '2', title: '台积电海外工厂建设提速', region: '台湾', category: 'tech', impact: 'high', time: '3小时前', summary: '亚利桑那、日本、德国三地工厂同步推进' },
  { id: '3', title: '日本扩大半导体设备对华出口限制', region: '日本', category: 'policy', impact: 'high', time: '8小时前', summary: '涉及 23 种先进半导体制造设备' },
  { id: '4', title: '台积电美国工厂良率问题导致投产延期', region: '美国', category: 'tech', impact: 'high', time: '昨天', summary: '亚利桑那工厂 4nm 制程良率不达标，投产推迟' },
  { id: '5', title: '英伟达AI芯片需求持续火爆', region: '美国', category: 'tech', impact: 'high', time: '5小时前', summary: 'H200订单已排至2027年，营收预期再创新高' },
  { id: '6', title: '华为昇腾910C算力测试超越英伟达A100', region: '中国', category: 'tech', impact: 'high', time: '4小时前', summary: '国产AI芯片竞争力持续提升' },
  { id: '7', title: '欧盟芯片法案补贴计划首批落地', region: '欧洲', category: 'policy', impact: 'medium', time: '4小时前', summary: '430 亿欧元支持本土芯片制造' },
  { id: '8', title: '韩国三星先进制程良率持续提升', region: '韩国', category: 'tech', impact: 'medium', time: '10小时前', summary: '3nm GAA 工艺良率已超 60%' },
  { id: '9', title: '中东主权基金大举投资芯片产业', region: '中东', category: 'economy', impact: 'medium', time: '12小时前', summary: '沙特阿美联合筹建中东首家先进晶圆厂' },
  { id: '10', title: '中国新能源汽车出口高速增长', region: '中国', category: 'economy', impact: 'medium', time: '3小时前', summary: 'Q1 出口同比增长 45%' },
  { id: '11', title: '印度半导体激励政策吸引多家厂商', region: '印度', category: 'economy', impact: 'medium', time: '5小时前', summary: '塔塔集团与 PSMC 合作建厂' },
  { id: '12', title: '东南亚半导体封装测试产业崛起', region: '东南亚', category: 'economy', impact: 'medium', time: '6小时前', summary: '马来西亚、泰国成封装产能转移首选地' },
  { id: '13', title: '英国脱欧后科技产业重振计划', region: '英国', category: 'policy', impact: 'medium', time: '15小时前', summary: 'ARM 再度成为英国科技王冠，加大研发投入' },
  { id: '14', title: '德国加速半导体产业布局', region: '德国', category: 'policy', impact: 'medium', time: '7小时前', summary: '英飞凌、博世加大本土芯片产能投资' },
  { id: '15', title: '澳大利亚稀土出口管控调整', region: '澳大利亚', category: 'policy', impact: 'low', time: '20小时前', summary: '关键原材料供应链出现新变化' },
  { id: '16', title: '巴西半导体产业扶持政策', region: '巴西', category: 'policy', impact: 'low', time: '昨天', summary: '南美最大经济体启动芯片产业计划' },
  { id: '17', title: '阿联酋AI数据中心建设加速', region: '阿联酋', category: 'tech', impact: 'low', time: '18小时前', summary: '海湾国家争相布局AI算力基础设施' },
]

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
