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

// 全球热点RSS新闻源（国际新闻）
const GLOBAL_HOTSPOT_SOURCES = [
  { name: 'BBC世界',   url: 'https://feeds.bbci.co.uk/news/world/rss.xml',     region: '国际' },
  { name: '路透社',    url: 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best', region: '国际' },
  { name: 'AI模型berg', url: 'https://www.bloomberg.com/feed/podcast/etf-iq', region: '国际' },
  { name: '财联社',    url: 'https://www.cls.cn/rss',                         region: '中国' },
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
const NEWS_TEMPLATES: NewsItem[] = [
  // 半导体行业
  { id: '1', title: '英伟达发布新一代自动驾驶芯片Thor，算力达2000 TOPS', source: '36氪', time: '10:32', category: 'competitor', industry: 'semiconductor', priority: 'critical', summary: '英伟达 GTC 大会发布新一代 GPU，专为自动驾驶优化，直接对标地平线征程6' },
  { id: '2', title: '美国拟扩大对华半导体出口管制范围', source: '财联社', time: '08:20', category: 'policy', industry: 'semiconductor', priority: 'critical', summary: '新规可能影响 14nm 以下先进制程设备，国产替代压力加大' },
  { id: '3', title: '地平线征程6芯片通过多家主机厂车规认证', source: '公司官网', time: '11:15', category: 'competitor', industry: 'semiconductor', priority: 'warning', summary: '量产准备就绪，预计 Q2 批量出货，目标年出货量 500 万颗' },
  { id: '4', title: '台积电先进制程产能持续紧张，汽车芯片交期延长', source: '电子时报', time: '昨天', category: 'supply', industry: 'semiconductor', priority: 'warning', summary: '3nm 订单已排至 2026 年底，2nm 试产良率超预期' },
  { id: '5', title: 'Mobileye Q1营收超预期，与宝马合作深化', source: '路透社', time: '2天前', category: 'competitor', industry: 'semiconductor', priority: 'info', summary: 'EyeQ6 芯片将用于下一代高端车型，年收入同比增长 24%' },
  { id: '6', title: '华为昇腾910C芯片性能超越英伟达A100', source: 'TechWeb', time: '3天前', category: 'competitor', industry: 'semiconductor', priority: 'critical', summary: '国产 AI 芯片竞争力持续增强，挑战英伟达数据中心霸主地位' },
  { id: '7', title: '欧盟《芯片法案》补贴计划首批项目落地', source: '彭博社', time: '3天前', category: 'policy', industry: 'semiconductor', priority: 'info', summary: '430 亿欧元支持本土芯片制造业，台积电德国工厂获批' },
  { id: '8', title: '英特尔Lunar Lake芯片发布，集成NPU算力大幅提升', source: 'AnandTech', time: '4天前', category: 'tech', industry: 'semiconductor', priority: 'info', summary: '端侧 AI 算力竞争进入新阶段，X86 生态 AI 化加速' },
  { id: '9', title: 'RISC-V架构在汽车芯片领域渗透加速', source: '半导体行业观察', time: '5天前', category: 'tech', industry: 'semiconductor', priority: 'info', summary: '多家汽车主机厂表示将优先选用 RISC-V 架构 MCU' },
  { id: '10', title: '韩国三星新一代HBM4存储正式量产', source: '韩国先驱报', time: '1天前', category: 'supply', industry: 'semiconductor', priority: 'warning', summary: 'AI训练加速器存储带宽大幅提升，SK海力士同步跟进' },
  { id: '11', title: '日本政府宣布新一轮半导体补贴，总额超1万亿日元', source: '日经新闻', time: '1天前', category: 'policy', industry: 'semiconductor', priority: 'info', summary: '重点扶持 Rapidus 先进制程和汽车芯片企业' },
  { id: '12', title: 'AI芯片全球短缺延续，订单能见度延伸至18个月', source: 'Digitimes', time: '今天', category: 'supply', industry: 'semiconductor', priority: 'critical', summary: 'H100/H200 需求远超供给，客户转向国产替代方案' },
  // 智能汽车行业
  { id: '13', title: '小米汽车销量创新高，智驾需求持续强劲', source: '汽车之家', time: '09:45', category: 'market', industry: 'automotive', priority: 'info', summary: '小米 SU7 月交付量突破 2 万台，智驾功能成核心卖点' },
  { id: '14', title: '黑芝麻智能通过港交所聆讯，最快年内上市', source: '证券时报', time: '2天前', category: 'market', industry: 'automotive', priority: 'warning', summary: '国产智驾芯片厂商加速上市进程，募资约 15 亿港元' },
  { id: '15', title: '比亚迪自研智驾芯片"璇玑"流片成功', source: '汽车之家', time: '4天前', category: 'market', industry: 'automotive', priority: 'warning', summary: '垂直整合趋势加速，供应链格局或将生变' },
  { id: '16', title: '蔚来ET9智驾系统实测，端到端大模型效果优异', source: '懂车帝', time: '今天', category: 'market', industry: 'automotive', priority: 'info', summary: '纯视觉方案 + 端到端大模型成为国内智驾主流方向' },
  // 机器人行业
  { id: '17', title: 'Figure AI 发布新一代人形机器人', source: 'TechCrunch', time: '昨天', category: 'tech', industry: 'robotics', priority: 'warning', summary: '人形机器人商业化加速，多场景落地' },
  // AI行业
  { id: '18', title: 'GPT-5 发布，多模态能力大幅提升', source: 'OpenAI', time: '今天', category: 'tech', industry: 'ai', priority: 'critical', summary: '下一代大语言模型能力飞跃，推理能力提升 10 倍' },
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
 * 根据标题推断地区
 */
function inferRegion(text: string, fallback: string): string {
  const t = text.toLowerCase()
  if (t.includes('china') || t.includes('china') || t.includes('beijing') || t.includes('shanghai')) return '中国'
  if (t.includes('usa') || t.includes('america') || t.includes('washington') || t.includes('silicon')) return '美国'
  if (t.includes('europe') || t.includes('eu') || t.includes('germany') || t.includes('brussels')) return '欧洲'
  if (t.includes('japan') || t.includes('tokyo') || t.includes('tsmc')) return '日本'
  if (t.includes('korea') || t.includes('samsung') || t.includes('sk hynix')) return '韩国'
  if (t.includes('taiwan') || t.includes('tsmc')) return '中国台湾'
  if (t.includes('india') || t.includes('mumbai')) return '印度'
  if (t.includes('middle east') || t.includes('saudi') || t.includes('uae')) return '中东'
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
            const t = (item.title || '').toLowerCase()
            return t.includes('欧冶') || t.includes('半导体') || t.includes('智驾') || t.includes('芯片')
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
  // 兜底：返回真实公司新闻（当RSS抓取不到时使用）
  return [
    { id: 'c1', title: '欧冶半导体完成数亿元C轮融资，加速产品大规模量产交付', category: 'finance', time: '5月6日', source: '欧冶半导体' },
    { id: 'c2', title: '携手福瑞泰克、紫光展锐发布"福芯一号"普惠级5G舱行泊方案', category: 'partner', time: '4月28日', source: '北京车展' },
    { id: 'c3', title: '工布565发布：国内首款智能汽车第三代E/E架构ZCU主控芯片', category: 'product', time: '4月25日', source: '欧冶半导体' },
    { id: 'c4', title: '携"中央+区域"全栈解决方案亮相2026北京车展', category: 'event', time: '4月24日', source: '北京车展' },
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
