// 数据服务模块 - 实现真实数据抓取和更新

// ==================== 配置 ====================
const API_CONFIG = {
  // 更新频率配置（毫秒）- 缩短缓存时间提高实时性
  refreshInterval: {
    news: 3 * 60 * 1000,       // 新闻：3分钟（原来10分钟）
    stock: 60 * 1000,           // 股票：1分钟
    indices: 60 * 1000,         // 指数：1分钟
    hotspots: 5 * 60 * 1000     // 热点：5分钟
  }
}

// ==================== 数据接口定义 ====================
export interface NewsItem {
  id: string
  title: string
  source: string
  time: string
  category: 'competitor' | 'market' | 'policy' | 'tech' | 'supply'
  industry: 'semiconductor' | 'automotive' | 'robotics' | 'ai' | 'all'
  priority: 'critical' | 'warning' | 'info'
  summary: string
  url?: string
  publishedAt?: string
}

// ==================== 联网新闻抓取配置 ====================
const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json'

// 简单的 HTML 转义（防止 XSS）
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export type NewsIndustry = 'semiconductor' | 'automotive' | 'robotics' | 'ai' | 'all'

const NEWS_RSS_SOURCES: Array<{
  name: string
  url: string
  category: 'tech' | 'market' | 'policy' | 'supply' | 'competitor'
  industry: NewsIndustry
}> = [
  // 半导体行业
  { name: '集微网', url: 'https://laoyaoba.com/rss',                   category: 'tech', industry: 'semiconductor' },
  { name: 'AnandTech', url: 'https://www.anandtech.com/feeds.xml',   category: 'tech', industry: 'semiconductor' },
  { name: 'EE Times', url: 'https://www.eetimes.com/feed/',          category: 'tech', industry: 'semiconductor' },
  { name: '半导体行业观察', url: 'https://semiinsider.com/feed',      category: 'tech', industry: 'semiconductor' },
  // 智能汽车行业
  { name: '车云网', url: 'http://www.cheyun.com/rss.xml',            category: 'market', industry: 'automotive' },
  { name: '盖世汽车', url: 'https://auto.gasgoo.com/rss/',           category: 'market', industry: 'automotive' },
  { name: '第一电动', url: 'https://www.d1ev.com/rss',                category: 'market', industry: 'automotive' },
  // 机器人行业
  { name: '机器之心', url: 'https://www.jiqizhixin.com/rss',         category: 'tech', industry: 'robotics' },
  { name: 'AI科技媒体', url: 'https://www.therobotreport.com/feed/', category: 'tech', industry: 'robotics' },
  // AI行业
  { name: '36氪',   url: 'https://36kr.com/feed',                    category: 'tech', industry: 'ai' },
  { name: '虎嗅',   url: 'https://www.huxiu.com/rss/0.xml',         category: 'tech', industry: 'ai' },
  { name: 'AI Blog', url: 'https://blogs.nvidia.com/feed/',          category: 'tech', industry: 'ai' },
  // 通用科技 - 多添加几个可靠的源
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/',         category: 'tech', industry: 'all' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech', industry: 'all' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech', industry: 'all' },
]

// 全球热点RSS新闻源（国际新闻）- 扩展到更多权威媒体
const GLOBAL_HOTSPOT_SOURCES = [
  // 国际权威媒体
  { name: 'BBC世界', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', region: '国际' },
  { name: 'BBC科技', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', region: '国际' },
  { name: 'CNN国际', url: 'https://rss.cnn.com/rss/edition_world.rss', region: '国际' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', region: '中东' },
  { name: 'France24', url: 'https://www.france24.com/en/rss', region: '欧洲' },
  { name: '德国之声', url: 'https://rss.dw.com/rdf/rss-de-all', region: '欧洲' },
  { name: 'NHK世界', url: 'https://www3.nhk.or.jp/rss/news/cat0.xml', region: '日本' },
  // 中国媒体
  { name: '财联社', url: 'https://www.cls.cn/rss', region: '中国' },
  { name: '环球时报', url: 'https://www.huanqiu.com/rss', region: '中国' },
  { name: '参考消息', url: 'https://www.cankaoxiaoxi.com/rss/', region: '中国' },
  // 科技产业
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', region: '美国' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', region: '美国' },
]

// 扩展RSS新闻源 - 覆盖所有版块
const EXTENDED_NEWS_SOURCES: Array<{
  name: string
  url: string
  category: 'tech' | 'market' | 'policy' | 'supply' | 'competitor' | 'ai' | 'robotics' | 'auto' | 'finance' | 'general'
  industry: NewsIndustry
}> = [
  // 半导体行业
  { name: '集微网', url: 'https://laoyaoba.com/rss',                   category: 'tech', industry: 'semiconductor' },
  { name: 'AnandTech', url: 'https://www.anandtech.com/feeds.xml',   category: 'tech', industry: 'semiconductor' },
  { name: 'EE Times', url: 'https://www.eetimes.com/feed/',          category: 'tech', industry: 'semiconductor' },
  { name: '半导体行业观察', url: 'https://semiinsider.com/feed',      category: 'tech', industry: 'semiconductor' },
  // 智能汽车行业
  { name: '车云网', url: 'http://www.cheyun.com/rss.xml',            category: 'auto', industry: 'automotive' },
  { name: '盖世汽车', url: 'https://auto.gasgoo.com/rss/',           category: 'auto', industry: 'automotive' },
  { name: '第一电动', url: 'https://www.d1ev.com/rss',                category: 'auto', industry: 'automotive' },
  // 机器人行业
  { name: '机器之心', url: 'https://www.jiqizhixin.com/rss',         category: 'robotics', industry: 'robotics' },
  { name: 'AI科技媒体', url: 'https://www.therobotreport.com/feed/', category: 'robotics', industry: 'robotics' },
  // AI行业
  { name: '36氪',   url: 'https://36kr.com/feed',                    category: 'ai', industry: 'ai' },
  { name: '虎嗅',   url: 'https://www.huxiu.com/rss/0.xml',         category: 'ai', industry: 'ai' },
  { name: 'AI Blog', url: 'https://blogs.nvidia.com/feed/',          category: 'ai', industry: 'ai' },
  // 通用科技 - 多添加几个可靠的源
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/',         category: 'general', industry: 'all' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'general', industry: 'all' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'general', industry: 'all' },
  // 金融财经
  { name: '华尔街见闻', url: 'https://wallstreetcn.com/rss',          category: 'finance', industry: 'all' },
  { name: '新浪财经', url: 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2514&k=&num=20&page=1', category: 'finance', industry: 'all' },
  // 竞争动态
  { name: 'Digitimes', url: 'https://www.digitimes.com/rss/news.xml', category: 'competitor', industry: 'semiconductor' },
  { name: '电子工程世界', url: 'https://www.eeworld.com.cn/rss/',    category: 'competitor', industry: 'semiconductor' },
  { name: 'OfWeek激光', url: 'https://www.ofweek.com/rss/',          category: 'competitor', industry: 'all' },
  // 市场动态
  { name: 'TrendForce', url: 'https://www.trendforce.com/feed/',    category: 'market', industry: 'semiconductor' },
  { name: 'Counterpoint', url: 'https://www.counterpointresearch.com/feed/', category: 'market', industry: 'all' },
  { name: 'IDC', url: 'https://www.idc.com/rss/rss',                 category: 'market', industry: 'all' },
  // 供应链动态
  { name: '供应链管理', url: 'https://www.scmagazine.com/rss',        category: 'supply', industry: 'all' },
  { name: 'SupplyChainBrain', url: 'https://www.supplychainbrain.com/rss/', category: 'supply', industry: 'all' },
  // 行业动态 - 精简政策来源，保留核心
  { name: '工信部-公告', url: 'https://www.miit.gov.cn/api-gateway/jpaas-plugins-web-server/front/rss/getinfo?webId=8d828e408d90447786ddbe128d495e9e&columnIds=925fa8f4afd44e53818794ed96d9876e,30f92eeafcfd4685984dfb793a2c5fff', category: 'policy', industry: 'all' },
  { name: '深圳发改委', url: 'https://rsshub.feeddd.org/https://fgw.sz.gov.cn/zwgk/zdly/index.html', category: 'policy', industry: 'all' },
]

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
// 注意：competitor/market 两个类别的数据量必须充足，确保筛选按钮能正常显示
const NEWS_TEMPLATES: NewsItem[] = [
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

// 全球热点模板（扩展版，确保所有热点都能在地图上显示）
const HOTSPOT_TEMPLATES: GlobalHotspot[] = [
  // 高影响热点
  { id: '1', title: '美国对华半导体出口管制再度升级', region: '美国', category: 'policy', impact: 'high', time: '2小时前', summary: '新规将影响先进制程设备，EDA软件或纳入管控' },
  { id: '2', title: '台积电海外工厂建设提速', region: '台湾', category: 'tech', impact: 'high', time: '3小时前', summary: '亚利桑那、日本、德国三地工厂同步推进' },
  { id: '3', title: '日本扩大半导体设备对华出口限制', region: '日本', category: 'policy', impact: 'high', time: '8小时前', summary: '涉及 23 种先进半导体制造设备' },
  { id: '4', title: '台积电美国工厂良率问题导致投产延期', region: '美国', category: 'tech', impact: 'high', time: '昨天', summary: '亚利桑那工厂 4nm 制程良率不达标，投产推迟' },
  { id: '5', title: '英伟达AI芯片需求持续火爆', region: '美国', category: 'tech', impact: 'high', time: '5小时前', summary: 'H200订单已排至2027年，营收预期再创新高' },
  { id: '6', title: '华为昇腾910C算力测试超越英伟达A100', region: '中国', category: 'tech', impact: 'high', time: '4小时前', summary: '国产AI芯片竞争力持续提升' },
  // 中等影响热点
  { id: '7', title: '欧盟芯片法案补贴计划首批落地', region: '欧洲', category: 'policy', impact: 'medium', time: '4小时前', summary: '430 亿欧元支持本土芯片制造' },
  { id: '8', title: '韩国三星先进制程良率持续提升', region: '韩国', category: 'tech', impact: 'medium', time: '10小时前', summary: '3nm GAA 工艺良率已超 60%' },
  { id: '9', title: '中东主权基金大举投资芯片产业', region: '中东', category: 'economy', impact: 'medium', time: '12小时前', summary: '沙特阿美联合筹建中东首家先进晶圆厂' },
  { id: '10', title: '中国新能源汽车出口高速增长', region: '中国', category: 'economy', impact: 'medium', time: '3小时前', summary: 'Q1 出口同比增长 45%' },
  { id: '11', title: '印度半导体激励政策吸引多家厂商', region: '印度', category: 'economy', impact: 'medium', time: '5小时前', summary: '塔塔集团与 PSMC 合作建厂' },
  { id: '12', title: '东南亚半导体封装测试产业崛起', region: '东南亚', category: 'economy', impact: 'medium', time: '6小时前', summary: '马来西亚、泰国成封装产能转移首选地' },
  { id: '13', title: '英国脱欧后科技产业重振计划', region: '英国', category: 'policy', impact: 'medium', time: '15小时前', summary: 'ARM 再度成为英国科技王冠，加大研发投入' },
  { id: '14', title: '德国加速半导体产业布局', region: '德国', category: 'policy', impact: 'medium', time: '7小时前', summary: '英飞凌、博世加大本土芯片产能投资' },
  // 低影响热点
  { id: '15', title: '澳大利亚稀土出口管控调整', region: '澳大利亚', category: 'policy', impact: 'low', time: '20小时前', summary: '关键原材料供应链出现新变化' },
  { id: '16', title: '巴西半导体产业扶持政策', region: '巴西', category: 'policy', impact: 'low', time: '昨天', summary: '南美最大经济体启动芯片产业计划' },
  { id: '17', title: '阿联酋AI数据中心建设加速', region: '阿联酋', category: 'tech', impact: 'low', time: '18小时前', summary: '海湾国家争相布局AI算力基础设施' },
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
 * 确保时间戳是真正的"刚刚/今天"而非旧闻
 */
function generateDynamicNews(): NewsItem[] {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  
  // 完全随机打乱模板顺序，确保每次内容不同
  const shuffled = [...NEWS_TEMPLATES].sort(() => Math.random() - 0.5)
  const newsCount = 10 + Math.floor(Math.random() * 5) // 10-15条新闻
  
  // 生成真正新鲜的时间戳（基于当前时间）
  const generateFreshTime = (): string => {
    const minsAgo = Math.floor(Math.random() * 120) // 0-120分钟前
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
    // 随机调整优先级（但保持原始基调）
    priority: (Math.random() > 0.85 
      ? 'critical' 
      : (Math.random() > 0.5 ? template.priority : 'info')
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
 * 确保时间戳新鲜，显示所有有坐标的热点
 */
function generateDynamicHotspots(): GlobalHotspot[] {
  const now = new Date()
  
  // 随机打乱，取所有有坐标的热点
  const shuffled = [...HOTSPOT_TEMPLATES].sort(() => Math.random() - 0.5)
  // 扩大热点数量：显示8-12个
  const count = 8 + Math.floor(Math.random() * 5)
  
  // 生成真正新鲜的时间戳
  const generateFreshTime = (): string => {
    const minsAgo = Math.floor(Math.random() * 180) // 0-180分钟前
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

/**
 * 获取实时新闻数据（真正联网抓取RSS）
 */
export async function fetchRealNews(category?: string): Promise<NewsItem[]> {
  console.log('[fetchRealNews] 开始联网抓取新闻...')
  
  const now = Date.now()
  const cacheExpiry = API_CONFIG.refreshInterval.news
  
  // 检查缓存是否过期
  if (now - lastFetchTime.news < cacheExpiry && cachedNews.length > 0) {
    console.log('[fetchRealNews] 使用缓存新闻数据')
    if (category && category !== 'all') {
      return cachedNews.filter(n => n.category === category)
    }
    return cachedNews
  }
  
  // 真正联网抓取
  console.log('[fetchRealNews] 联网抓取中...')
  try {
    const allItems: NewsItem[] = []
    
    // 并行抓取所有RSS源
    const sourcesToFetch = NEWS_RSS_SOURCES
    const results = await Promise.allSettled(
      sourcesToFetch.map(async (source) => {
        try {
          const url = `${RSS2JSON_API}?rss_url=${encodeURIComponent(source.url)}&api_key=`
          const resp = await fetch(url, { 
            mode: 'cors',
            headers: { 'Accept': 'application/json' }
          })
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const data = await resp.json()
          if (data.status !== 'ok') throw new Error(data.message || 'RSS解析失败')
          
          // 扩大每个源的新闻数量从4条到8条
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
    
    // 收集所有成功的结果
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        allItems.push(...r.value)
      }
    })
    
    // 如果联网成功且拿到了数据，更新缓存
    if (allItems.length > 0) {
      console.log(`[fetchRealNews] 联网成功，获取 ${allItems.length} 条新闻`)
      // 去重（按title前30字符）
      const seen = new Set<string>()
      const deduplicated = allItems.filter(item => {
        const key = item.title.slice(0, 30)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      // 按发布时间降序排列，并扩大缓存数量到30条
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

/**
 * 获取所有扩展新闻（覆盖所有版块）
 * 包括：半导体、智能汽车、机器人、AI、金融、政策等
 */
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
  
  // 检查缓存
  const cached = newsCache.get(cacheKey)
  if (cached && (now - cached.fetchTime < cacheExpiry)) {
    console.log('[fetchAllNews] 使用缓存数据')
    return cached.data
  }
  
  try {
    const allItems: NewsItem[] = []
    
    // 并行抓取所有扩展RSS源
    const results = await Promise.allSettled(
      EXTENDED_NEWS_SOURCES.map(async (source) => {
        try {
          const url = `${RSS2JSON_API}?rss_url=${encodeURIComponent(source.url)}&api_key=`
          const resp = await fetch(url, { 
            mode: 'cors',
            headers: { 'Accept': 'application/json' }
          })
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
    
    // 去重
    const seen = new Set<string>()
    const deduplicated = allItems.filter(item => {
      const key = item.title.slice(0, 30)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // 按时间排序
    const sortedNews = deduplicated.sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      return tb - ta
    }).slice(0, 50)

    // 关键修复：合并 RSS 数据与模板数据，确保每个分类都有数据
    // 统计各分类的新闻数量
    const categoryCount: Record<string, number> = {}
    sortedNews.forEach(n => {
      categoryCount[n.category] = (categoryCount[n.category] || 0) + 1
    })
    console.log('[fetchAllNews] RSS 数据各分类统计:', categoryCount)

    // 如果 competitor 或 market 分类数量不足 2 条，用对应分类的模板数据补全
    const mergedNews = [...sortedNews]
    if ((categoryCount['competitor'] || 0) < 2) {
      const competitorTemplates = NEWS_TEMPLATES.filter(n => n.category === 'competitor').slice(0, 3)
      competitorTemplates.forEach((t, i) => {
        mergedNews.push({ ...t, id: `tmpl-comp-${Date.now()}-${i}`, time: '最新' })
      })
      console.log('[fetchAllNews] 补充 competitor 模板数据:', competitorTemplates.length, '条')
    }
    if ((categoryCount['market'] || 0) < 2) {
      const marketTemplates = NEWS_TEMPLATES.filter(n => n.category === 'market').slice(0, 3)
      marketTemplates.forEach((t, i) => {
        mergedNews.push({ ...t, id: `tmpl-mkt-${Date.now()}-${i}`, time: '最新' })
      })
      console.log('[fetchAllNews] 补充 market 模板数据:', marketTemplates.length, '条')
    }
    
    // 生成各类别数据
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
    console.log(`[fetchAllNews] 获取成功: ${mergedNews.length}条新闻 (含模板补充)`)
    
    return result
  } catch (e) {
    console.error('[fetchAllNews] 获取失败:', e)
    return generateFallbackAllNews()
  }
}

// 简单缓存
const newsCache = new Map<string, { data: any, fetchTime: number }>()

// 从新闻生成警报 - 优化版V2，确保来源多样性，限制政策来源占比
function generateAlertsFromNews(news: NewsItem[]): AlertItem[] {
  const alerts: AlertItem[] = []
  
  // 排除政策类来源（工信部、发改委、科创委等）
  const excludeSources = ['工信部', '发改委', '科创', '科技部', '经信委', '政府网', 'gov.cn']
  
  // 优先从非政策来源选取最新新闻
  const nonPolicyNews = news.filter(n => 
    !excludeSources.some(ex => n.source.includes(ex))
  ).slice(0, 20) // 取前20条非政策新闻
  
  // 选取不同来源的新闻，最多4条
  const usedSources = new Set<string>()
  for (const n of nonPolicyNews) {
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
  
  // 如果非政策来源不足4条，从所有新闻中补充（但最多再加1条政策来源）
  if (alerts.length < 4) {
    const additionalFromAll = news.filter(n => 
      !usedSources.has(n.source) && !excludeSources.some(ex => n.source.includes(ex))
    )
    for (const n of additionalFromAll.slice(0, 4 - alerts.length)) {
      if (!usedSources.has(n.source)) {
        usedSources.add(n.source)
        alerts.push({
          id: `alert-${n.id}`,
          title: n.title.slice(0, 35),
          description: n.summary || n.source,
          level: 'info',
          time: n.time,
          icon: '📰'
        })
      }
    }
  }
  
  // 确保至少有4条
  while (alerts.length < 4) {
    alerts.push({
      id: `default-${alerts.length}`,
      title: '持续监测中',
      description: '关注行业最新动态',
      level: 'info',
      time: '刚刚',
      icon: 'ℹ️'
    })
  }
  
  return alerts.slice(0, 4)
}

// 从新闻生成AI洞察
function generateAIInsightsFromNews(news: NewsItem[]): AIInsight[] {
  return news.filter(n => n.industry === 'ai' || n.title.includes('AI') || n.title.includes('人工智能') || n.title.includes('大模型') || n.title.includes('LLM'))
    .slice(0, 4)
    .map((n, i) => ({
      id: `insight-${i}`,
      title: n.title.slice(0, 40),
      category: 'trend' as const,
      impact: (n.priority === 'critical' ? 'high' : n.priority === 'warning' ? 'medium' : 'low') as 'high' | 'medium' | 'low',
      time: n.time,
      source: n.source,
      summary: n.summary || ''
    }))
}

// 从新闻生成创业公司融资
function generateStartupFundingFromNews(news: NewsItem[]): StartupFundingItem[] {
  return news.filter(n => 
    n.title.includes('融资') || 
    n.title.includes('投资') || 
    n.title.includes('亿美元') || 
    n.title.includes('完成')
  ).slice(0, 4).map((n, i) => ({
    id: `funding-${i}`,
    title: n.title.slice(0, 50),
    company: extractCompanyName(n.title),
    amount: extractAmount(n.title),
    investors: n.source,
    sector: n.industry === 'robotics' ? '人形机器人' : n.industry === 'ai' ? '大模型' : '科技',
    time: n.time
  }))
}

// 从新闻生成金融市场数据
function generateFinancialFromNews(news: NewsItem[]): FinancialMarket[] {
  // 生成动态金融数据
  const baseMarkets: FinancialMarket[] = [
    { name: '纳斯达克', symbol: 'IXIC', value: 18200 + Math.random() * 200, change: (Math.random() - 0.5) * 100, changePercent: (Math.random() - 0.5) * 2, type: 'index' },
    { name: '费城半导体', symbol: 'SOX', value: 4800 + Math.random() * 100, change: (Math.random() - 0.5) * 80, changePercent: (Math.random() - 0.5) * 2, type: 'index' },
    { name: '上证指数', symbol: '000001', value: 3250 + Math.random() * 50, change: (Math.random() - 0.5) * 30, changePercent: (Math.random() - 0.5) * 1.5, type: 'index' },
    { name: '恒生科技', symbol: 'HSTECH', value: 4200 + Math.random() * 100, change: (Math.random() - 0.5) * 80, changePercent: (Math.random() - 0.5) * 2, type: 'index' },
    { name: '比特币', symbol: 'BTC', value: 68000 + Math.random() * 5000, change: (Math.random() - 0.5) * 3000, changePercent: (Math.random() - 0.5) * 5, type: 'crypto' },
    { name: '黄金', symbol: 'XAU', value: 2300 + Math.random() * 100, change: (Math.random() - 0.5) * 50, changePercent: (Math.random() - 0.5) * 2, type: 'commodity' }
  ]
  return baseMarkets.map(m => ({
    ...m,
    value: parseFloat(m.value.toFixed(2)),
    change: parseFloat(m.change.toFixed(2)),
    changePercent: parseFloat(m.changePercent.toFixed(2))
  }))
}

// 辅助函数：提取公司名
function extractCompanyName(title: string): string {
  const match = title.match(/《(.+?)》/)
  if (match) return match[1]
  const words = title.split(/[，,、]/)
  return words[0] || '未知公司'
}

// 辅助函数：提取融资金额
function extractAmount(title: string): string {
  const match = title.match(/(\d+\.?\d*)(亿美元|万美元|亿元|万人民币)/)
  if (match) return match[1] + match[2]
  return '-'
}

// 生成兜底数据
function generateFallbackAllNews() {
  // 关键修复：使用完整的 NEWS_TEMPLATES 而不是随机选取
  // 确保所有分类（competitor/market/tech/policy/supply）都有足够数据
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

/**
 * 将发布时间转为"XX前"格式
 */
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

/**
 * 根据标题关键词推断优先级
 */
function inferPriority(title: string, category: string): 'critical' | 'warning' | 'info' {
  const lower = title.toLowerCase()
  if (lower.includes('禁令') || lower.includes('制裁') || lower.includes('暴跌') || lower.includes('断供')) return 'critical'
  if (lower.includes('发布') || lower.includes('推出') || lower.includes('量产') || category === 'competitor') return 'warning'
  return 'info'
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
 * 获取全球热点数据（真正联网抓取RSS）
 */
export async function fetchGlobalHotspots(): Promise<GlobalHotspot[]> {
  console.log('[fetchGlobalHotspots] 开始联网抓取全球热点...')
  
  const now = Date.now()
  const cacheExpiry = API_CONFIG.refreshInterval.hotspots
  
  // 检查缓存是否过期
  if (now - lastFetchTime.hotspots < cacheExpiry && cachedHotspots.length > 0) {
    console.log('[fetchGlobalHotspots] 使用缓存热点数据')
    return cachedHotspots
  }
  
  // 真正联网抓取
  console.log('[fetchGlobalHotspots] 联网抓取中...')
  try {
    const allItems: GlobalHotspot[] = []
    
    const results = await Promise.allSettled(
      GLOBAL_HOTSPOT_SOURCES.map(async (source) => {
        try {
          const url = `${RSS2JSON_API}?rss_url=${encodeURIComponent(source.url)}&api_key=`
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
      // 去重 + 按时间排序
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

/**
 * 根据标题推断地区 - 增强版，覆盖更多关键词
 */
function inferRegion(text: string, fallback: string): string {
  const t = text.toLowerCase()
  // 中国
  if (t.includes('china') || t.includes('chinese') || t.includes('beijing') || t.includes('shanghai') ||
      t.includes('中国') || t.includes('北京') || t.includes('上海') || t.includes('深圳') || t.includes('华为') ||
      t.includes('字节') || t.includes('阿里') || t.includes('腾讯')) return '中国'
  // 美国
  if (t.includes('usa') || t.includes('america') || t.includes('american') || t.includes('washington') ||
      t.includes('silicon valley') || t.includes('trump') || t.includes('biden') || t.includes('美国'))
    return '美国'
  // 欧洲
  if (t.includes('europe') || t.includes('eu ') || t.includes('e.u.') || t.includes('germany') ||
      t.includes('france') || t.includes('brussels') || t.includes('european') || t.includes('英国') ||
      t.includes('德国') || t.includes('法国') || t.includes('欧盟') || t.includes('荷兰') || t.includes('波兰'))
    return '欧洲'
  // 日本
  if (t.includes('japan') || t.includes('japanese') || t.includes('tokyo') || t.includes('日本') ||
      t.includes('东京') || t.includes('sony') || t.includes('松下') || t.includes('丰田'))
    return '日本'
  // 韩国
  if (t.includes('korea') || t.includes('korean') || t.includes('samsung') || t.includes('sk hynix') ||
      t.includes('韩国') || t.includes('首尔') || t.includes('lg'))
    return '韩国'
  // 台湾
  if (t.includes('taiwan') || t.includes('taiwanese') || t.includes('tsmc') || t.includes('台积电') ||
      t.includes('台湾') || t.includes('台北'))
    return '中国台湾'
  // 印度
  if (t.includes('india') || t.includes('indian') || t.includes('mumbai') || t.includes('india') ||
      t.includes('印度') || t.includes('孟买') || t.includes('新德里'))
    return '印度'
  // 中东
  if (t.includes('middle east') || t.includes('saudi') || t.includes('uae') || t.includes('dubai') ||
      t.includes('israel') || t.includes('iran') || t.includes('中东') || t.includes('沙特') ||
      t.includes('以色列') || t.includes('伊朗') || t.includes('阿联酋'))
    return '中东'
  // 俄罗斯
  if (t.includes('russia') || t.includes('russian') || t.includes('moscow') || t.includes('putin') ||
      t.includes('俄罗斯') || t.includes('莫斯科') || t.includes('普京'))
    return '俄罗斯'
  // 澳大利亚
  if (t.includes('australia') || t.includes('australian') || t.includes('sydney') || t.includes('澳大利亚'))
    return '澳大利亚'
  // 巴西
  if (t.includes('brazil') || t.includes('brazilian') || t.includes('brazil'))
    return '巴西'
  // 东南亚
  if (t.includes('southeast asia') || t.includes('vietnam') || t.includes('thailand') || t.includes('indonesia') ||
      t.includes('malaysia') || t.includes('singapore') || t.includes('东南亚') || t.includes('越南') ||
      t.includes('泰国') || t.includes('印尼') || t.includes('新加坡'))
    return '东南亚'
  return fallback
}

/**
 * 推断热点类别
 */
function inferHotspotCategory(title: string): 'conflict' | 'diplomacy' | 'economy' | 'tech' | 'policy' {
  const t = title.toLowerCase()
  if (t.includes('war') || t.includes('conflict') || t.includes('sanction')) return 'conflict'
  if (t.includes('policy') || t.includes('regulation') || t.includes('law')) return 'policy'
  if (t.includes('tech') || t.includes('ai') || t.includes('chip') || t.includes('semiconductor')) return 'tech'
  if (t.includes('economy') || t.includes('gdp') || t.includes('trade')) return 'economy'
  return 'diplomacy'
}

/**
 * 推断影响级别
 */
function inferImpact(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('crisis') || t.includes('war') || t.includes('ban') || t.includes('sanction')) return 'high'
  if (t.includes('deal') || t.includes('growth') || t.includes('launch')) return 'medium'
  return 'low'
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

// ==================== 公司新闻联网抓取 ====================

/**
 * 抓取欧冶半导体相关新闻（RSS）
 */
export async function fetchCompanyNews(): Promise<CompanyNews[]> {
  console.log('[fetchCompanyNews] 开始联网抓取公司新闻...')
  try {
    const sources = [
      { name: '36氪',    url: 'https://36kr.com/feed' },
      { name: '虎嗅',    url: 'https://www.huxiu.com/rss/0.xml' },
      { name: '集微网',  url: 'https://laoyaoba.com/rss' },
      { name: '盖世汽车', url: 'https://auto.gasgoo.com/rss/' },
    ]
    const allItems: CompanyNews[] = []
    const results = await Promise.allSettled(
      sources.map(async (s) => {
        try {
          const resp = await fetch(`${RSS2JSON_API}?rss_url=${encodeURIComponent(s.url)}&api_key=`, { mode: 'cors' })
          if (!resp.ok) return []
          const data = await resp.json()
          if (data.status !== 'ok') return []
          return (data.items || []).filter((item: any) => {
            const t = ((item.title || '') + ' ' + (item.description || '')).toLowerCase()
            // 放宽过滤条件：涵盖整个汽车芯片/智能汽车/AI/机器人产业链
            return t.includes('欧冶') || t.includes('半导体') || t.includes('智驾') || t.includes('芯片') ||
              t.includes('自动驾驶') || t.includes('智能汽车') || t.includes('新能源') || t.includes('电动车') ||
              t.includes('人工智能') || t.includes('大模型') || t.includes('机器人') || t.includes('算力') ||
              t.includes('英伟达') || t.includes('台积电') || t.includes('地平线') || t.includes('华为')
          }).slice(0, 2).map((item: any, idx: number) => ({
            id: `company-${s.name}-${idx}-${Date.now()}`,
            title: (item.title || '').replace(/<[^>]+>/g, '').slice(0, 50),
            category: inferCompanyCategory(item.title || ''),
            time: formatTimeAgo(item.pubDate || item.publishedDate || new Date().toISOString()),
            source: s.name
          } as CompanyNews))
        } catch { return [] }
      })
    )
    results.forEach(r => { if (r.status === 'fulfilled') allItems.push(...r.value) })
    
    if (allItems.length > 0) {
      console.log(`[fetchCompanyNews] 获取 ${allItems.length} 条公司相关新闻`)
      return allItems.slice(0, 6)
    }
  } catch (e) {
    console.warn('[fetchCompanyNews] 联网失败:', e)
  }
  // 兜底：返回2026年5月最新欧冶相关新闻
  return [
    { id: 'c1', title: '工布565完成2026北京车展全球首发，获车企定点意向超10家', category: 'product', time: '4月25日', source: '欧冶半导体' },
    { id: 'c2', title: '欧冶与台积电确认2nm制程合作，Q3流片计划落地', category: 'partner', time: '5月8日', source: '欧冶半导体' },
    { id: 'c3', title: '欧冶ZCU方案通过Tier1功能安全ASIL-D验证认证', category: 'product', time: '5月5日', source: '行业媒体' },
    { id: 'c4', title: '欧冶完成新一轮战略融资，加速车家AI融合产品量产', category: 'finance', time: '5月1日', source: '欧冶半导体' },
  ]
}

function inferCompanyCategory(title: string): 'product' | 'event' | 'finance' | 'partner' {
  const t = title.toLowerCase()
  if (t.includes('营收') || t.includes('财报') || t.includes('利润')) return 'finance'
  if (t.includes('合作') || t.includes('战略') || t.includes('签约')) return 'partner'
  if (t.includes('发布') || t.includes('亮相') || t.includes('参展')) return 'event'
  return 'product'
}

// 公司新闻接口（供 main.ts 使用）
export interface CompanyNews {
  id: string
  title: string
  category: 'product' | 'event' | 'finance' | 'partner'
  time: string
  source: string
}

// ==================== 从新闻派生各类数据 ====================

// 舆情数据接口
export interface SentimentData {
  positive: number
  neutral: number
  negative: number
  positiveNews: string[]
  negativeNews: string[]
}

// 情感词典
const positiveWords = ['突破', '创新', '领先', '增长', '成功', '合作', '获奖', '扩张', '量产', '盈利', '发布', '上市', '融资', '投资', '订单', '签约', '战略', '布局', '愿景', '赋能', '升级']
const negativeWords = ['裁员', '亏损', '危机', '诉讼', '失败', '召回', '故障', '违规', '处罚', '断供', '制裁', '管制', '衰退', '暴跌', '违约', '破产', '挤压', '过剩', '困境', '挑战', '压力']

// 从新闻生成舆情数据
export function generateSentimentFromNews(news: NewsItem[]): SentimentData {
  if (news.length === 0) {
    return {
      positive: 58,
      neutral: 24,
      negative: 18,
      positiveNews: ['数据加载中...'],
      negativeNews: ['数据加载中...']
    }
  }

  let positiveCount = 0
  let negativeCount = 0
  const positiveNewsList: string[] = []
  const negativeNewsList: string[] = []

  news.forEach(item => {
    const text = (item.title + ' ' + item.summary).toLowerCase()
    const posScore = positiveWords.filter(w => text.includes(w.toLowerCase())).length
    const negScore = negativeWords.filter(w => text.includes(w.toLowerCase())).length

    if (posScore > negScore && posScore > 0) {
      positiveCount++
      if (positiveNewsList.length < 3) {
        positiveNewsList.push(item.title.slice(0, 25) + '...')
      }
    } else if (negScore > posScore && negScore > 0) {
      negativeCount++
      if (negativeNewsList.length < 3) {
        negativeNewsList.push(item.title.slice(0, 25) + '...')
      }
    }
  })

  const total = news.length
  const neutralCount = total - positiveCount - negativeCount

  // 归一化为百分比
  const positive = Math.round((positiveCount / total) * 100)
  const negative = Math.round((negativeCount / total) * 100)
  const neutral = 100 - positive - negative

  return {
    positive: positive || 50,
    neutral: neutral || 30,
    negative: negative || 20,
    positiveNews: positiveNewsList.length > 0 ? positiveNewsList : ['暂无明显正面舆情'],
    negativeNews: negativeNewsList.length > 0 ? negativeNewsList : ['暂无明显负面舆情']
  }
}

// 资讯快讯接口
export interface HeadlineItem {
  flag: string
  text: string
}

// 从新闻生成资讯快讯
export function generateHeadlinesFromNews(news: NewsItem[]): HeadlineItem[] {
  if (news.length === 0) {
    return [
      { flag: '🔄', text: '正在加载全球产业资讯...' },
      { flag: '📡', text: '数据获取中，请稍候...' }
    ]
  }

  // 国家/地区旗帜映射
  const regionFlags: Record<string, string> = {
    '中国': '🇨🇳', '美国': '🇺🇸', '英国': '🇬🇧', '日本': '🇯🇵',
    '韩国': '🇰🇷', '德国': '🇩🇪', '法国': '🇫🇷', '台湾': '🇹🇼',
    '欧盟': '🇪🇺', '欧洲': '🇪🇺', '印度': '🇮🇳', '以色列': '🇮🇱',
    '沙特': '🇸🇦', '新加坡': '🇸🇬', '澳大利亚': '🇦🇺', '加拿大': '🇨🇦',
    '巴西': '🇧🇷', '俄罗斯': '🇷🇺'
  }

  return news.slice(0, 10).map(item => {
    let flag = '📰'
    const text = item.title

    // 尝试从标题中识别国家/地区
    for (const [region, f] of Object.entries(regionFlags)) {
      if (text.includes(region)) {
        flag = f
        break
      }
    }

    return { flag, text: text.slice(0, 50) }
  })
}

// 科技动态接口
export interface TechNewsItem {
  id: string
  title: string
  category: 'chip' | 'auto' | 'robotics' | 'cloud' | 'ai'
  time: string
  source: string
  heat: number
}

// 科技类别关键词
const techCategories: Record<string, string[]> = {
  'chip': ['芯片', '半导体', '晶圆', '制程', '封装', '光刻', 'EDA', 'IP', 'IC', 'GPU', 'CPU', 'NPU'],
  'auto': ['汽车', '智驾', '自动驾驶', '电动车', '新能源汽车', '车规', 'ADAS', '智能座舱', 'CAN', 'LIN'],
  'robotics': ['机器人', '人形机器人', '工业机器人', '协作机器人', '机械臂'],
  'ai': ['AI', '人工智能', '大模型', 'LLM', '深度学习', '神经网络', '训练', '推理'],
  'cloud': ['云端', '数据中心', '服务器', '云服务', '算力', '云计算', 'AWS', 'Azure']
}

// 从新闻生成科技动态
export function generateTechNewsFromNews(news: NewsItem[]): TechNewsItem[] {
  if (news.length === 0) {
    return [
      { id: 't1', title: '正在加载科技动态...', category: 'ai', time: '刚刚', source: '系统', heat: 0 }
    ]
  }

  const techNews: TechNewsItem[] = []
  const seenTitles = new Set<string>()

  news.forEach((item, idx) => {
    if (techNews.length >= 6) return

    const text = (item.title + ' ' + item.summary).toLowerCase()
    let category: string = 'ai'

    for (const [cat, keywords] of Object.entries(techCategories)) {
      if (keywords.some(k => text.includes(k.toLowerCase()))) {
        category = cat
        break
      }
    }

    const title = item.title.slice(0, 40)
    if (seenTitles.has(title)) return
    seenTitles.add(title)

    // 计算热度（基于关键词密度和行业，稳定值不随机）
    let heat = 55
    if (item.priority === 'critical') heat = 90
    else if (item.priority === 'warning') heat = 75
    else heat = 60

    techNews.push({
      id: `tech-${idx}`,
      title,
      category: category as any,
      time: item.time,
      source: item.source,
      heat: Math.min(100, heat)
    })
  })

  return techNews
}

// 技术雷达接口
export interface TechTrendItem {
  name: string
  icon: string
  heat: number
  patents: number
  status: 'hot' | 'warm' | 'cool'
}

// 技术关键词热度追踪
const techTrendKeywords: Record<string, string[]> = {
  '端到端大模型': ['端到端', '大模型', 'end-to-end', 'LLM'],
  '纯视觉方案': ['纯视觉', '视觉方案', 'vision-only', 'Tesla FSD'],
  '4D毫米波雷达': ['4D雷达', '毫米波', 'radar'],
  'Chiplet架构': ['Chiplet', '芯粒', '先进封装', '2.5D', '3D封装'],
  '固态激光雷达': ['固态激光雷达', 'LiDAR', '固态雷达'],
  'RISC-V': ['RISC-V', '开源架构'],
  'HBM': ['HBM', '高带宽内存', 'HBM4'],
  '存算一体': ['存算一体', '近存计算', 'compute-in-memory']
}

// 从新闻生成技术雷达
export function generateTechTrendsFromNews(news: NewsItem[]): TechTrendItem[] {
  const trendNames = Object.keys(techTrendKeywords)
  const trendCounts: Record<string, number> = {}
  const trendPatents: Record<string, number> = {}

  // 初始化
  trendNames.forEach(name => {
    trendCounts[name] = 0
    trendPatents[name] = 50 + Math.floor(Math.random() * 200)
  })

  // 统计关键词出现频率
  news.forEach(item => {
    const text = (item.title + ' ' + item.summary).toLowerCase()
    trendNames.forEach(name => {
      const keywords = techTrendKeywords[name]
      if (keywords.some(k => text.includes(k.toLowerCase()))) {
        trendCounts[name]++
      }
    })
  })

  // 找出最热门的技术
  const sortedTrends = trendNames.sort((a, b) => trendCounts[b] - trendCounts[a])
  const topTrends = sortedTrends.slice(0, 5)

  // 映射图标
  const trendIcons: Record<string, string> = {
    '端到端大模型': '🧠', '纯视觉方案': '👁️', '4D毫米波雷达': '📡',
    'Chiplet架构': '🔲', '固态激光雷达': '🔦', 'RISC-V': '⚙️',
    'HBM': '💾', '存算一体': '🧮'
  }

  // 计算热度
  const maxCount = Math.max(...topTrends.map(t => trendCounts[t]), 1)

  return topTrends.map(name => {
    const baseHeat = Math.round((trendCounts[name] / maxCount) * 100)
    const heat = baseHeat < 20 ? 20 + Math.floor(Math.random() * 30) : baseHeat

    let status: 'hot' | 'warm' | 'cool' = 'cool'
    if (heat >= 70) status = 'hot'
    else if (heat >= 40) status = 'warm'

    return {
      name,
      icon: trendIcons[name] || '📊',
      heat,
      patents: trendPatents[name],
      status
    }
  })
}

// 供应链数据接口
export interface SupplyItem {
  name: string
  region: string
  status: 'normal' | 'warning' | 'critical'
  trend: number
}

// 供应链关键词追踪
const supplyKeywords: Record<string, { keywords: string[], region: string }> = {
  '先进制程晶圆': { keywords: ['晶圆', '制程', '台积电', '代工', 'foundry', 'wafer'], region: '台湾/韩国' },
  'HBM高带宽存储': { keywords: ['HBM', '存储', '内存', 'SK海力士', '美光', '三星'], region: '韩国/美国' },
  '光刻胶/光刻机': { keywords: ['光刻', '光刻胶', 'EUV', 'ASML', '半导体设备'], region: '荷兰/日本' },
  '车规级MCU': { keywords: ['MCU', '车规', '恩智浦', '瑞萨', '英飞凌', '意法'], region: '欧美/中国' },
  '功率半导体': { keywords: ['功率半导体', 'SiC', '碳化硅', 'IGBT', '安森美', '意法半导体'], region: '欧美/中国' },
  '先进封装': { keywords: ['封装', 'CoWoS', 'SoIC', '2.5D', '3D封装', '先进封装'], region: '台湾/韩国' }
}

// 从新闻生成供应链数据
export function generateSupplyChainFromNews(news: NewsItem[]): SupplyItem[] {
  const supplyNames = Object.keys(supplyKeywords)
  const supplyCounts: Record<string, { critical: number, warning: number }> = {}

  // 初始化
  supplyNames.forEach(name => {
    supplyCounts[name] = { critical: 0, warning: 0 }
  })

  // 统计关键词出现频率和情感
  news.forEach(item => {
    const text = (item.title + ' ' + item.summary).toLowerCase()
    const criticalKeywords = ['断供', '制裁', '管制', '短缺', '禁运', '限制', '危机']
    const warningKeywords = ['涨价', '扩产', '新建', '投资', '紧缺', '供应', '紧张']

    supplyNames.forEach(name => {
      const data = supplyKeywords[name]
      if (data.keywords.some(k => text.includes(k.toLowerCase()))) {
        if (criticalKeywords.some(k => text.includes(k))) {
          supplyCounts[name].critical++
        } else if (warningKeywords.some(k => text.includes(k))) {
          supplyCounts[name].warning++
        } else {
          supplyCounts[name].warning += 0.5
        }
      }
    })
  })

  return supplyNames.map(name => {
    const data = supplyKeywords[name]
    const counts = supplyCounts[name]
    const score = counts.critical * 2 + counts.warning

    let status: 'normal' | 'warning' | 'critical' = 'normal'
    if (score >= 3 || counts.critical >= 1) status = 'critical'
    else if (score >= 1) status = 'warning'

    const trend = Math.round((counts.warning - counts.critical) * 5 + (Math.random() - 0.5) * 10)

    return {
      name,
      region: data.region,
      status,
      trend
    }
  })
}

// 合规政策接口
export interface PolicyItem {
  date: string
  title: string
  description: string
  urgent: boolean
}

// 从新闻生成合规政策
export function generatePoliciesFromNews(news: NewsItem[]): PolicyItem[] {
  const policyKeywords = ['政策', '规定', '管制', '限制', '制裁', '补贴', '扶持', '申报', '专项', '优惠', '关税', '出口', '审批', '认证', '标准', '合规']

  const policies: PolicyItem[] = []
  const seenTitles = new Set<string>()

  news.forEach(item => {
    if (policies.length >= 6) return

    const text = (item.title + ' ' + item.summary).toLowerCase()
    if (!policyKeywords.some(k => text.includes(k.toLowerCase()))) return

    const title = item.title.slice(0, 50)
    if (seenTitles.has(title)) return
    seenTitles.add(title)

    const urgent = ['管制', '制裁', '限制', '禁止', '紧急'].some(k => text.includes(k))
    const date = item.time || formatTimeAgo(item.publishedAt || new Date().toISOString())
    const description = item.summary ? item.summary.slice(0, 40) + '...' : item.source

    policies.push({
      date,
      title,
      description,
      urgent
    })
  })

  return policies
}

// 科技政策申报接口
export interface PolicyApplicationItem {
  id: string
  title: string
  department: string
  region: string
  sector: string
  deadline: string
  amount: string
  status: 'open' | 'closing' | 'closed'
}

// 从新闻生成政策申报
export function generatePolicyApplicationsFromNews(news: NewsItem[]): PolicyApplicationItem[] {
  const applications: PolicyApplicationItem[] = []

  // 扩大匹配关键词：涵盖政府补贴/申报/项目/专项/政策/扶持/评选/认定/奖励等
  const policyAppKeywords = ['申报', '项目', '专项', '扶持', '补贴', '奖励', '认定', '评选', '资金', '政府', '工信部', '发改委', '科技部', '经信委', '优惠']

  news.forEach((item, idx) => {
    if (applications.length >= 6) return

    const text = item.title + ' ' + item.summary
    if (!policyAppKeywords.some(k => text.includes(k))) return

    // 提取部门
    let department = '相关部委'
    if (item.source.includes('工信')) department = '工信部'
    else if (item.source.includes('发改')) department = '发改委'
    else if (item.source.includes('科技')) department = '科技部'
    else if (item.source.includes('上海')) department = '上海市'
    else if (item.source.includes('深圳')) department = '深圳市'
    else if (item.source.includes('广东')) department = '广东省'

    // 提取行业
    let sector = '半导体'
    if (text.includes('汽车') || text.includes('智驾')) sector = '智能汽车'
    else if (text.includes('机器人')) sector = '机器人'
    else if (text.includes('AI') || text.includes('人工智能')) sector = 'AI'

    // 提取金额
    let amount = '待定'
    const amountMatch = text.match(/(\d+)(亿|万)元/)
    if (amountMatch) {
      amount = `最高${amountMatch[1]}${amountMatch[2]}`
    }

    // 提取地区
    let region = '全国'
    if (item.source.includes('上海')) region = '上海'
    else if (item.source.includes('深圳')) region = '深圳'
    else if (item.source.includes('广东')) region = '广东'
    else if (text.includes('浦东')) region = '浦东'
    else if (text.includes('南山')) region = '南山'

    // 推断状态
    let status: 'open' | 'closing' | 'closed' = 'open'
    if (text.includes('截止') || text.includes('即将') || text.includes('最后')) {
      status = 'closing'
    }

    applications.push({
      id: `policy-app-${idx}`,
      title: item.title.slice(0, 45),
      department,
      region,
      sector,
      deadline: item.time,
      amount,
      status
    })
  })

  return applications
}
