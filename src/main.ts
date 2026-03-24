import './style.css'
import { Chart, registerables } from 'chart.js'
import * as d3 from 'd3'
import * as d3Geo from 'd3-geo'
import * as topojson from 'topojson-client'
import { 
  type NewsItem,
  type IndustryIndex,
  type GlobalHotspot
} from './dataService'
Chart.register(...registerables)

// 世界地图数据缓存
let worldMapData: any = null

// ==================== 本地数据类型定义 ====================
interface AlertItem {
  id: string
  title: string
  description: string
  level: 'critical' | 'warning' | 'info'
  time: string
  icon: string
}

interface Competitor {
  name: string
  ticker: string
  price: number
  change: number
  changePercent: number
  marketCap: string
  threat: 'high' | 'medium' | 'low'
}

interface TechTrend {
  name: string
  icon: string
  heat: number
  patents: number
  status: 'hot' | 'warm' | 'cool'
}

interface SupplyItem {
  name: string
  region: string
  status: 'normal' | 'warning' | 'critical'
  trend: number
}

interface PolicyItem {
  date: string
  title: string
  description: string
  urgent: boolean
}

// ==================== 模拟数据 ====================
let newsData: NewsItem[] = [
  { id: '1', title: '英伟达发布 Thor 芯片，算力 2000 TOPS 直接对标征程 6', source: '36氪', time: '10:32', category: 'competitor', priority: 'critical', summary: '英伟达 GTC 发布新一代自动驾驶芯片' },
  { id: '2', title: '小米 SU7 订单破 10 万，智驾芯片需求激增', source: '汽车之家', time: '09:45', category: 'market', priority: 'info', summary: '小米汽车产能爬坡中' },
  { id: '3', title: '美国商务部拟对华 AI 芯片出口实施新限制', source: '财联社', time: '08:20', category: 'policy', priority: 'critical', summary: '可能影响自动驾驶训练芯片' },
  { id: '4', title: '台积电 3nm 产能满载，汽车芯片交期延长至 40 周', source: '集微网', time: '昨天', category: 'supply', priority: 'warning', summary: '产能受 AI 芯片挤压' },
  { id: '5', title: '地平线征程 6 获比亚迪定点，Q3 量产', source: '盖世汽车', time: '昨天', category: 'competitor', priority: 'info', summary: '本土智驾芯片突破' },
  { id: '6', title: '宇树科技发布人形机器人 H1，售价 9.9 万起', source: '机器之心', time: '昨天', category: 'tech', priority: 'info', summary: '人形机器人商业化加速' }
]

let alertData: AlertItem[] = [
  { id: '1', title: '竞争对手新品发布', description: '英伟达 Thor 芯片算力领先 30%', level: 'critical', time: '5分钟前', icon: '🚨' },
  { id: '2', title: '供应链风险', description: '光刻胶价格上涨 25%', level: 'warning', time: '15分钟前', icon: '⚠️' },
  { id: '3', title: '舆情预警', description: '检测到 5 篇负面报道', level: 'warning', time: '1小时前', icon: '💬' },
  { id: '4', title: '专利到期提醒', description: '3 项核心专利 60 天内到期', level: 'info', time: '2小时前', icon: '📋' }
]

// 市场表现数据（芯片/自动驾驶相关上市公司）
let marketPerformance: Competitor[] = [
  { name: '英伟达', ticker: 'NVDA', price: 875.28, change: 12.45, changePercent: 1.44, marketCap: '2.16T', threat: 'high' },
  { name: '高通', ticker: 'QCOM', price: 168.92, change: 3.21, changePercent: 1.94, marketCap: '188B', threat: 'medium' },
  { name: 'Mobileye', ticker: 'MBLY', price: 28.45, change: -1.23, changePercent: -4.14, marketCap: '23B', threat: 'medium' },
  { name: '地平线', ticker: '09660.HK', price: 6.85, change: -0.32, changePercent: -4.46, marketCap: '89B', threat: 'high' },
  { name: '黑芝麻', ticker: '02533.HK', price: 18.52, change: 0.45, changePercent: 2.49, marketCap: '12B', threat: 'medium' },
  { name: '瑞芯微', ticker: '603893.SH', price: 78.35, change: 2.15, changePercent: 2.82, marketCap: '32B', threat: 'medium' },
  { name: '爱芯元智', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '8B', threat: 'medium' },
  { name: '华为海思', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '-', threat: 'high' }
]

// 兼容旧代码
let competitors = marketPerformance

let industryIndices = [
  { name: '半导体', value: 4256.78, change: 45.23, changePercent: 1.07, icon: '💎', timestamp: new Date().toISOString() },
  { name: '智能汽车', value: 1856.34, change: -23.45, changePercent: -1.25, icon: '🚗', timestamp: new Date().toISOString() },
  { name: '机器人', value: 2456.89, change: 67.89, changePercent: 2.84, icon: '🤖', timestamp: new Date().toISOString() },
  { name: 'AI', value: 3256.45, change: 89.34, changePercent: 2.82, icon: '🧠', timestamp: new Date().toISOString() },
  { name: '新能源', value: 2156.23, change: -12.34, changePercent: -0.57, icon: '⚡', timestamp: new Date().toISOString() }
]

let techTrends: TechTrend[] = [
  { name: '端到端大模型', icon: '🧠', heat: 92, patents: 234, status: 'hot' },
  { name: '纯视觉方案', icon: '👁️', heat: 78, patents: 156, status: 'hot' },
  { name: '4D 毫米波雷达', icon: '📡', heat: 65, patents: 89, status: 'warm' },
  { name: 'Chiplet 架构', icon: '🔲', heat: 58, patents: 67, status: 'warm' },
  { name: '固态激光雷达', icon: '🔦', heat: 45, patents: 34, status: 'cool' }
]

let supplyChain: SupplyItem[] = [
  { name: '先进制程晶圆', region: '台湾/韩国', status: 'critical', trend: 35 },
  { name: 'HBM 高带宽存储', region: '韩国', status: 'warning', trend: 28 },
  { name: '高端光刻胶', region: '日本', status: 'warning', trend: 25 },
  { name: '车规级 MCU', region: '中国/欧洲', status: 'normal', trend: -5 },
  { name: '功率半导体', region: '中国/欧洲', status: 'normal', trend: 8 }
]

let policies: PolicyItem[] = [
  { date: '2026-03-25', title: '美国对华 AI 芯片出口管制新规生效', description: '扩大管制范围至自动驾驶训练芯片', urgent: true },
  { date: '2026-04-01', title: '半导体设备进口税收优惠延续', description: '关键设备进口关税减免政策延长 2 年', urgent: false },
  { date: '2026-04-15', title: '大基金三期投资计划公布', description: '重点投向先进制程和汽车芯片', urgent: false }
]

// AI洞察数据
interface AIInsight {
  id: string
  title: string
  category: 'trend' | 'breakthrough' | 'policy' | 'market'
  impact: 'high' | 'medium' | 'low'
  time: string
  source: string
  summary: string
}

let aiInsights: AIInsight[] = [
  { id: '1', title: 'GPT-5 预计 Q3 发布，多模态能力大幅提升', category: 'breakthrough', impact: 'high', time: '2小时前', source: 'OpenAI', summary: '推理能力较 GPT-4 提升 10 倍，支持实时视频理解' },
  { id: '2', title: '中国大模型备案数量突破 200 个', category: 'policy', impact: 'medium', time: '5小时前', source: '网信办', summary: '生成式 AI 服务监管框架日趋完善' },
  { id: '3', title: '端侧 AI 芯片需求激增 300%', category: 'market', impact: 'high', time: '昨天', source: 'Counterpoint', summary: '手机/PC/汽车端侧推理成为新战场' },
  { id: '4', title: 'AI Agent 商业化元年开启', category: 'trend', impact: 'medium', time: '昨天', source: 'Gartner', summary: '企业级 AI Agent 市场规模预计达 280 亿美元' }
]

// 创业公司与风投数据 - 投融资新闻事件
interface StartupFunding {
  id: string
  title: string
  company: string
  amount: string
  investors: string
  sector: string
  time: string
}

let startupFunding: StartupFunding[] = [
  { id: '1', title: '智元机器人完成 1.5 亿美元 B 轮融资，红杉中国领投', company: '智元机器人', amount: '$150M', investors: '红杉中国、高瓴、比亚迪', sector: '人形机器人', time: '2小时前' },
  { id: '2', title: '月之暗面获 3 亿美元 C 轮融资，估值突破 30 亿美元', company: '月之暗面', amount: '$300M', investors: '阿里、腾讯、红杉', sector: '大模型', time: '5小时前' },
  { id: '3', title: '星动纪元完成 8000 万美元 A 轮融资，IDG 领投', company: '星动纪元', amount: '$80M', investors: 'IDG、顺为资本', sector: '具身智能', time: '昨天' },
  { id: '4', title: '面壁智能获 5000 万美元 Pre-B 轮融资，华为哈勃参投', company: '面壁智能', amount: '$50M', investors: '春华资本、华为哈勃', sector: '端侧AI', time: '2天前' }
]

// 科技动态数据
interface TechNews {
  id: string
  title: string
  category: 'chip' | 'auto' | 'robotics' | 'cloud'
  time: string
  source: string
  heat: number
}

let techNews: TechNews[] = [
  { id: '1', title: '台积电 2nm 工艺良率突破 60%', category: 'chip', time: '3小时前', source: 'Digitimes', heat: 95 },
  { id: '2', title: '特斯拉 FSD V13 开始推送', category: 'auto', time: '5小时前', source: 'Tesla', heat: 88 },
  { id: '3', title: 'Figure AI 发布新一代人形机器人', category: 'robotics', time: '昨天', source: 'Figure', heat: 82 },
  { id: '5', title: 'AWS 推出 Trainium3 训练芯片', category: 'cloud', time: '昨天', source: 'AWS', heat: 75 }
]

// 金融市场数据
interface FinancialMarket {
  name: string
  symbol: string
  value: number
  change: number
  changePercent: number
  type: 'index' | 'commodity' | 'forex' | 'crypto'
}

let financialMarkets: FinancialMarket[] = [
  { name: '纳斯达克', symbol: 'IXIC', value: 18285.32, change: 125.45, changePercent: 0.69, type: 'index' },
  { name: '费城半导体', symbol: 'SOX', value: 4856.78, change: 68.92, changePercent: 1.44, type: 'index' },
  { name: '上证指数', symbol: '000001', value: 3285.65, change: -12.35, changePercent: -0.37, type: 'index' },
  { name: '恒生科技', symbol: 'HSTECH', value: 4256.89, change: 85.23, changePercent: 2.04, type: 'index' },
  { name: '比特币', symbol: 'BTC', value: 68542, change: 1250, changePercent: 1.86, type: 'crypto' },
  { name: '黄金', symbol: 'XAU', value: 2185.30, change: 12.50, changePercent: 0.57, type: 'commodity' }
]

// 政策申报数据
interface PolicyApplication {
  id: string
  title: string
  department: string
  region: string
  sector: 'auto' | 'chip' | 'robotics' | 'ai'
  deadline: string
  amount: string
  status: 'open' | 'closing' | 'closed'
}

let policyApplications: PolicyApplication[] = [
  { id: '1', title: '2026年智能网联汽车创新专项申报', department: '工信部', region: '全国', sector: 'auto', deadline: '2026-04-15', amount: '最高5000万', status: 'open' },
  { id: '2', title: '集成电路产业高质量发展专项资金', department: '发改委', region: '全国', sector: 'chip', deadline: '2026-04-30', amount: '最高1亿', status: 'open' },
  { id: '3', title: '人形机器人关键技术攻关项目', department: '科技部', region: '全国', sector: 'robotics', deadline: '2026-04-10', amount: '最高3000万', status: 'closing' },
  { id: '4', title: '深圳市人工智能产业扶持计划', department: '深圳市工信局', region: '深圳', sector: 'ai', deadline: '2026-05-20', amount: '最高2000万', status: 'open' },
  { id: '5', title: '广东省新能源汽车产业集群项目', department: '广东省发改委', region: '广东', sector: 'auto', deadline: '2026-04-25', amount: '最高8000万', status: 'open' },
  { id: '6', title: '上海市集成电路产业研发专项', department: '上海市科委', region: '上海', sector: 'chip', deadline: '2026-04-08', amount: '最高5000万', status: 'closing' }
]

let globalHotspots: GlobalHotspot[] = [
  { id: '1', title: '美国对华 AI 芯片出口管制升级', region: '美国', category: 'diplomacy', impact: 'high', time: '2小时前', summary: '美方拟扩大对华 AI 芯片出口管制范围' },
  { id: '2', title: '欧盟碳边境税正式实施', region: '欧洲', category: 'economy', impact: 'medium', time: '5小时前', summary: '新能源汽车出口成本将增加 15%' },
  { id: '3', title: '中东地缘政治紧张', region: '中东', category: 'conflict', impact: 'medium', time: '昨天', summary: '油价上涨可能影响全球物流成本' },
  { id: '4', title: '日本半导体设备出口管制', region: '日本', category: 'tech', impact: 'high', time: '昨天', summary: '23 类先进设备对华出口受限' },
  { id: '5', title: '韩国 HBM 存储芯片扩产', region: '韩国', category: 'tech', impact: 'medium', time: '3小时前', summary: '三星、SK海力士增加HBM产能投资' },
  { id: '6', title: '印度半导体激励政策', region: '印度', category: 'economy', impact: 'medium', time: '6小时前', summary: '推出100亿美元芯片制造补贴计划' },
  { id: '7', title: '中国新能源汽车出口创新高', region: '中国', category: 'economy', impact: 'medium', time: '4小时前', summary: 'Q1新能源车出口同比增长 45%' },
  { id: '8', title: '台积电美国工厂投产延期', region: '美国', category: 'tech', impact: 'high', time: '昨天', summary: '亚利桑那工厂投产推迟至 2027 年' }
]

// 热点地理坐标 - 使用真实经纬度 [经度, 纬度]
const hotspotCoordinates: Record<string, { lon: number; lat: number }> = {
  '美国': { lon: -95, lat: 37 },           // 美国中部
  '中国': { lon: 105, lat: 35 },           // 中国中部
  '欧洲': { lon: 10, lat: 50 },            // 西欧
  '中东': { lon: 45, lat: 25 },            // 中东/沙特
  '日本': { lon: 138, lat: 36 },           // 日本东京
  '韩国': { lon: 127, lat: 37 },           // 韩国首尔
  '印度': { lon: 78, lat: 20 },            // 印度中部
  '台湾': { lon: 121, lat: 24 },           // 台湾
  '俄罗斯': { lon: 105, lat: 60 },         // 俄罗斯
  '英国': { lon: -2, lat: 54 },            // 英国
  '德国': { lon: 10, lat: 51 },            // 德国
  '法国': { lon: 2, lat: 46 },             // 法国
  '新加坡': { lon: 104, lat: 1 }           // 新加坡
}

let currentPage = 'dashboard'
// 自动刷新间隔（保留以备后续使用）
// let autoRefreshInterval: number | null = null

// ==================== 组件渲染函数 ====================

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
        <div class="status">
          <div class="status-indicator"></div>
          <span class="status-text">LIVE</span>
        </div>
        <div class="last-update">更新于 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
        <button class="header-btn" id="refreshBtn">🔄</button>
        <button class="header-btn">🔔</button>
        <button class="header-btn primary">+ 新建监控</button>
      </div>
    </header>
  `
}

function renderIndustryTicker(): string {
  return `
    <div class="ticker-bar">
      <div class="ticker-label">产业指数</div>
      <div class="ticker-items">
        ${industryIndices.map(idx => `
          <div class="ticker-item">
            <span class="ticker-icon">${idx.icon}</span>
            <span class="ticker-name">${idx.name}</span>
            <span class="ticker-value">${idx.value.toFixed(2)}</span>
            <span class="ticker-change ${idx.change >= 0 ? 'up' : 'down'}">${idx.change >= 0 ? '↑' : '↓'} ${Math.abs(idx.changePercent).toFixed(2)}%</span>
          </div>
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

  // 在返回 HTML 之前，强制调用真实地图渲染函数
  // 这个方法不会被 Tree Shaking 移除
  setTimeout(async () => {
    console.log('=== RENDERING REAL WORLD MAP ===')
    await renderRealWorldMap()
    console.log('=== REAL WORLD MAP RENDERED ===')
  }, 50)

  // 简化版地图渲染，先确保基本结构正确显示
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
      <div class="world-map" id="worldMapContainer">
        <svg viewBox="0 0 1050 520" class="world-map-svg" preserveAspectRatio="xMidYMid meet" id="worldMapSvg" style="width:100%;height:300px;background:rgba(0,20,40,0.3);">
          <defs>
            <radialGradient id="oceanGradient" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stop-color="rgba(0, 40, 100, 0.25)" />
              <stop offset="50%" stop-color="rgba(0, 20, 50, 0.12)" />
              <stop offset="100%" stop-color="rgba(0, 0, 0, 0)" />
            </radialGradient>
            <filter id="continentGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur"/>
              <feFlood flood-color="rgba(0, 200, 255, 0.25)" result="color"/>
              <feComposite in="color" in2="blur" operator="in" result="shadow"/>
              <feMerge>
                <feMergeNode in="shadow"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <!-- 海洋背景 -->
          <rect width="1050" height="520" fill="url(#oceanGradient)" />
          
          <!-- 世界地图路径组 - 真实地图数据 -->
          <g class="world-continents" fill="rgba(20, 35, 55, 0.95)" stroke="rgba(0, 200, 255, 0.5)" stroke-width="0.8" filter="url(#continentGlow)" id="worldMapPaths">
            <!-- 地图路径将通过 D3 动态生成 -->
          </g>
          
          <!-- 经纬网格 -->
          <g stroke="rgba(0, 200, 255, 0.05)" stroke-width="0.5">
            ${Array.from({length: 22}, (_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="520" />`).join('')}
            ${Array.from({length: 11}, (_, i) => `<line x1="0" y1="${i * 52}" x2="1050" y2="${i * 52}" />`).join('')}
          </g>
          
          <!-- 热点标记将由 D3 动态生成 -->
        </svg>
        
        <!-- 热点信息卡片 -->
        <div class="hotspot-overlay">
          ${globalHotspots.slice(0, 4).map(spot => `
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
    </div>
  `
}

// 当前新闻筛选状态
let currentNewsFilter: 'all' | 'competitor' | 'market' = 'all'

function renderNewsCompact(): string {
  const filteredNews = currentNewsFilter === 'all' 
    ? newsData 
    : newsData.filter(n => n.category === currentNewsFilter)
  
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">📰</div>
          <span>实时情报</span>
        </div>
        <div class="card-actions">
          <button class="card-action ${currentNewsFilter === 'all' ? 'active' : ''}" data-filter="all">全部</button>
          <button class="card-action ${currentNewsFilter === 'competitor' ? 'active' : ''}" data-filter="competitor">竞争</button>
          <button class="card-action ${currentNewsFilter === 'market' ? 'active' : ''}" data-filter="market">市场</button>
        </div>
      </div>
      <div class="card-body">
        <div class="news-feed compact" id="newsFeed">
          ${filteredNews.slice(0, 5).map(news => `
            <div class="news-item ${news.priority}">
              <div class="news-time">${news.time}</div>
              <div class="news-content">
                <div class="news-title">${news.title}</div>
                <div class="news-meta">
                  <span class="news-tag ${news.category}">${news.category}</span>
                  <span>${news.source}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderAlertCompact(): string {
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
          ${alertData.slice(0, 3).map(alert => `
            <div class="alert-item ${alert.level}">
              <div class="alert-icon">${alert.icon}</div>
              <div class="alert-content">
                <div class="alert-title">${alert.title}</div>
                <div class="alert-desc">${alert.description}</div>
              </div>
            </div>
          `).join('')}
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

// 兼容旧代码
function renderCompetitorCompact(): string {
  return renderMarketPerformanceCompact()
}

function renderTechRadarCompact(): string {
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">🔬</div>
          <span>技术雷达</span>
        </div>
      </div>
      <div class="card-body">
        <div class="tech-list">
          ${techTrends.slice(0, 4).map(tech => `
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

function renderSupplyChainCompact(): string {
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">🔗</div>
          <span>供应链</span>
        </div>
      </div>
      <div class="card-body">
        <div class="supply-list compact">
          ${supplyChain.slice(0, 4).map(item => `
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
          `).join('')}
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
          ${policies.slice(0, 3).map(policy => `
            <div class="timeline-item ${policy.urgent ? 'urgent' : ''}">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-title">${policy.title}</div>
                <div class="timeline-date">${policy.date}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

// 市场趋势图表组件（保留以备后续使用）
// function renderChartCompact(): string {
//   return `
//     <div class="card compact">
//       <div class="card-header">
//         <div class="card-title">
//           <div class="card-title-icon">📈</div>
//           <span>市场趋势</span>
//         </div>
//         <div class="card-actions">
//           <button class="card-action active">1D</button>
//           <button class="card-action">1W</button>
//           <button class="card-action">1M</button>
//         </div>
//       </div>
//       <div class="card-body">
//         <div class="chart-container compact">
//           <canvas id="marketChart"></canvas>
//         </div>
//       </div>
//     </div>
//   `
// }

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
            <div class="sentiment-segment positive" style="width: 58%"></div>
            <div class="sentiment-segment neutral" style="width: 24%"></div>
            <div class="sentiment-segment negative" style="width: 18%"></div>
          </div>
          <div class="sentiment-legend-mini">
            <span><span class="dot positive"></span>正面 58%</span>
            <span><span class="dot neutral"></span>中性 24%</span>
            <span><span class="dot negative"></span>负面 18%</span>
          </div>
        </div>
      </div>
    </div>
  `
}

// AI洞察模块 - 超紧凑版本
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
          ${aiInsights.slice(0, 3).map(insight => `
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

// 创业公司与风投模块 - 投融资新闻事件形式
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
          ${startupFunding.slice(0, 3).map(startup => `
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

// 科技动态模块
function renderTechNewsCompact(): string {
  const categoryIcons: Record<string, string> = {
    chip: '🔲',
    auto: '🚗',
    robotics: '🤖',
    cloud: '☁️'
  }
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">⚡</div>
          <span>科技</span>
        </div>
      </div>
      <div class="card-body">
        <div class="tech-news-list">
          ${techNews.slice(0, 4).map(news => `
            <div class="tech-news-item">
              <div class="tech-news-icon">${categoryIcons[news.category]}</div>
              <div class="tech-news-content">
                <div class="tech-news-title">${news.title}</div>
                <div class="tech-news-meta">
                  <span>${news.source}</span>
                  <span>${news.time}</span>
                </div>
              </div>
              <div class="tech-news-heat">
                <div class="heat-bar" style="width: ${news.heat}%"></div>
                <span>${news.heat}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

// 金融市场模块
function renderFinancialMarketsCompact(): string {
  return `
    <div class="card compact">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">💹</div>
          <span>金融</span>
        </div>
      </div>
      <div class="card-body">
        <div class="financial-list">
          ${financialMarkets.slice(0, 6).map(market => `
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
          `).join('')}
        </div>
      </div>
    </div>
  `
}

// 政策申报模块 - 超紧凑版本
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

// 政策申报模块 - 宽版（横向排列）
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
        </div>
      </div>
      <div class="card-body">
        <div class="policy-wide-list">
          ${policyApplications.slice(0, 4).map(app => `
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
          `).join('')}
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
        <!-- 左侧主列 -->
        <div class="dashboard-main">
          ${renderWorldMap()}
          ${renderNewsCompact()}
          ${renderMarketPerformanceCompact()}
          <!-- AI洞察和创业公司与风投两个模块一排 -->
          <div class="two-column-row">
            ${renderAIInsightsCompact()}
            ${renderStartupFundingCompact()}
          </div>
          <!-- 政策申报一个长条 -->
          ${renderPolicyApplicationsWide()}
        </div>
        <!-- 右侧侧边栏 -->
        <div class="dashboard-sidebar">
          ${renderAlertCompact()}
          ${renderSentimentCompact()}
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
              <div class="stat-value up">4,256.78</div>
              <div class="stat-change up">+1.07%</div>
              <div class="stat-data-source">数据来源: Bloomberg</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">晶圆厂产能 <span class="stat-source">(全球先进制程)</span></div>
              <div class="stat-value up">92%</div>
              <div class="stat-change up">+5%</div>
              <div class="stat-data-source">数据来源: SEMI</div>
            </div>
            <div class="stat-box alert">
              <div class="stat-label">芯片交期 <span class="stat-source">(全球平均)</span></div>
              <div class="stat-value down">40周</div>
              <div class="stat-change up">+8周</div>
              <div class="stat-data-source">数据来源: Susquehanna</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Q1 营收 <span class="stat-source">(全球半导体产业)</span></div>
              <div class="stat-value up">$156B</div>
              <div class="stat-change up">+23%</div>
              <div class="stat-data-source">数据来源: SIA</div>
            </div>
          </div>
          ${renderNewsCompact()}
          ${renderCompetitorCompact()}
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
              <div class="stat-value down">1,856.34</div>
              <div class="stat-change down">-1.25%</div>
              <div class="stat-data-source">数据来源: 中证指数</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">新能源车销量 <span class="stat-source">(中国月度)</span></div>
              <div class="stat-value up">285万</div>
              <div class="stat-change up">+15%</div>
              <div class="stat-data-source">数据来源: 中汽协</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">智驾渗透率 <span class="stat-source">(L2+级辅助驾驶)</span></div>
              <div class="stat-value up">32%</div>
              <div class="stat-change up">+8%</div>
              <div class="stat-data-source">数据来源: 高工智能汽车</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">电池价格 <span class="stat-source">(三元锂电芯)</span></div>
              <div class="stat-value down">$45/kWh</div>
              <div class="stat-change down">-12%</div>
              <div class="stat-data-source">数据来源: BloombergNEF</div>
            </div>
          </div>
          ${renderNewsCompact()}
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

// 机器人产业监测页面
function renderRoboticsPage(): string {
  return `
    <div class="page-section active" id="page-robotics">
      <div class="main-container">
        <div class="main-column">
          <div class="stats-row">
            <div class="stat-box">
              <div class="stat-label">机器人指数 <span class="stat-source">(中证机器人指数)</span></div>
              <div class="stat-value up">2,456.89</div>
              <div class="stat-change up">+2.84%</div>
              <div class="stat-data-source">数据来源: 中证指数</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">人形机器人出货量 <span class="stat-source">(全球年度预测)</span></div>
              <div class="stat-value up">12.5万</div>
              <div class="stat-change up">+180%</div>
              <div class="stat-data-source">数据来源: IFR</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">工业机器人密度 <span class="stat-source">(中国每万人)</span></div>
              <div class="stat-value up">392</div>
              <div class="stat-change up">+15%</div>
              <div class="stat-data-source">数据来源: IFR</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">核心零部件国产化率 <span class="stat-source">(减速器/伺服系统)</span></div>
              <div class="stat-value up">68%</div>
              <div class="stat-change up">+8%</div>
              <div class="stat-data-source">数据来源: GGII</div>
            </div>
          </div>
          ${renderNewsCompact()}
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

// 机器人公司市场表现
function renderRoboticsCompaniesCompact(): string {
  const roboticsCompanies = [
    { name: '波士顿动力', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '-', threat: 'high' as const },
    { name: '特斯拉Optimus', ticker: 'TSLA', price: 245.67, change: 5.23, changePercent: 2.18, marketCap: '780B', threat: 'high' },
    { name: '宇树科技', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '15B', threat: 'medium' as const },
    { name: '智元机器人', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '12B', threat: 'medium' as const },
    { name: '傅利叶智能', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '8B', threat: 'medium' as const },
    { name: 'Agility Robotics', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '-', threat: 'medium' as const }
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
          ${roboticsCompanies.slice(0, 6).map(comp => `
            <div class="market-mini">
              <div class="market-info">
                <div class="market-name">${comp.name}</div>
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

// 机器人技术雷达
function renderRoboticsTechRadarCompact(): string {
  const roboticsTech = [
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
          ${roboticsTech.slice(0, 5).map(tech => `
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

// AI产业监测页面
function renderAIPage(): string {
  return `
    <div class="page-section active" id="page-ai">
      <div class="main-container">
        <div class="main-column">
          <div class="stats-row">
            <div class="stat-box">
              <div class="stat-label">AI指数 <span class="stat-source">(中证人工智能主题指数)</span></div>
              <div class="stat-value up">3,256.45</div>
              <div class="stat-change up">+2.82%</div>
              <div class="stat-data-source">数据来源: 中证指数</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">大模型备案数 <span class="stat-source">(中国生成式AI)</span></div>
              <div class="stat-value up">218个</div>
              <div class="stat-change up">+35%</div>
              <div class="stat-data-source">数据来源: 网信办</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">AI算力规模 <span class="stat-source">(中国智能算力)</span></div>
              <div class="stat-value up">850 EFLOPS</div>
              <div class="stat-change up">+68%</div>
              <div class="stat-data-source">数据来源: IDC/浪潮</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">端侧AI渗透率 <span class="stat-source">(智能手机/PC)</span></div>
              <div class="stat-value up">28%</div>
              <div class="stat-change up">+12%</div>
              <div class="stat-data-source">数据来源: Counterpoint</div>
            </div>
          </div>
          ${renderNewsCompact()}
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

// AI公司市场表现
function renderAICompaniesCompact(): string {
  const aiCompanies = [
    { name: '英伟达', ticker: 'NVDA', price: 875.28, change: 12.45, changePercent: 1.44, marketCap: '2.16T', threat: 'high' as const },
    { name: '微软', ticker: 'MSFT', price: 425.32, change: 3.21, changePercent: 0.76, marketCap: '3.15T', threat: 'high' },
    { name: '谷歌', ticker: 'GOOGL', price: 175.98, change: -1.23, changePercent: -0.69, marketCap: '2.18T', threat: 'high' },
    { name: 'OpenAI', ticker: '-', price: 0, change: 0, changePercent: 0, marketCap: '80B', threat: 'high' as const },
    { name: '百度', ticker: 'BIDU', price: 98.45, change: 2.15, changePercent: 2.23, marketCap: '34B', threat: 'medium' as const },
    { name: '商汤科技', ticker: '0020.HK', price: 1.25, change: -0.05, changePercent: -3.85, marketCap: '4B', threat: 'medium' as const }
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
          ${aiCompanies.slice(0, 6).map(comp => `
            <div class="market-mini">
              <div class="market-info">
                <div class="market-name">${comp.name}</div>
                <div class="market-ticker">${comp.ticker}</div>
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

// AI技术雷达
function renderAITechRadarCompact(): string {
  const aiTech = [
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
          ${aiTech.slice(0, 5).map(tech => `
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

// 通用页面渲染函数（保留以备后续使用）
// function renderGenericPage(title: string, icon: string): string {
//   return `
//     <div class="page-section active" id="page-generic">
//       <div class="main-container">
//         <div style="grid-column: 1 / -1; text-align: center; padding: 100px 20px;">
//           <div style="font-size: 64px; margin-bottom: 20px;">${icon}</div>
//           <h2 style="font-size: 24px; margin-bottom: 12px; color: var(--oritek-cyan);">${title}</h2>
//           <p style="color: var(--text-muted);">该模块正在开发中，敬请期待...</p>
//         </div>
//       </div>
//     </div>
//   `
// }

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

  // 生成模拟数据
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  const data1 = Array.from({ length: 24 }, () => 4000 + Math.random() * 500)
  const data2 = Array.from({ length: 24 }, () => 1800 + Math.random() * 300)

  new Chart(ctx, {
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

// ==================== 自动刷新 ====================

function refreshData() {
  // 模拟数据更新
  industryIndices.forEach(idx => {
    idx.changePercent += (Math.random() - 0.5) * 0.5
    idx.change = idx.value * idx.changePercent / 100
    idx.value += idx.change
  })
  
  competitors.forEach(comp => {
    if (comp.price > 0) {
      comp.changePercent += (Math.random() - 0.5) * 2
      comp.change = comp.price * comp.changePercent / 100
      comp.price += comp.change
    }
  })

  // 重新渲染
  const app = document.querySelector<HTMLDivElement>('#app')
  if (app) {
    app.innerHTML = renderApp()
    bindEvents()
    if (currentPage === 'dashboard' || currentPage === 'automotive') {
      setTimeout(initCharts, 100)
    }
  }
}

// 自动刷新功能
function startAutoRefresh() {
  // 每5分钟刷新一次
  window.setInterval(refreshData, 5 * 60 * 1000)
}

// 停止自动刷新功能（保留以备后续使用）
// function stopAutoRefresh() {
//   if (autoRefreshInterval) {
//     clearInterval(autoRefreshInterval)
//     autoRefreshInterval = null
//   }
// }

// ==================== 事件绑定 ====================

function bindEvents() {
  // 导航交互
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'))
      item.classList.add('active')
      const page = item.getAttribute('data-page')
      if (page) {
        currentPage = page
        const app = document.querySelector<HTMLDivElement>('#app')
        if (app) {
          app.innerHTML = renderApp()
          bindEvents()
          if (page === 'dashboard' || page === 'automotive') {
            setTimeout(initCharts, 100)
          }
        }
      }
    })
  })

  // 刷新按钮
  const refreshBtn = document.getElementById('refreshBtn')
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.classList.add('spinning')
      refreshData()
      setTimeout(() => refreshBtn.classList.remove('spinning'), 1000)
    })
  }

  // 新闻筛选按钮
  document.querySelectorAll('.card-action[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter') as 'all' | 'competitor' | 'market'
      currentNewsFilter = filter
      const app = document.querySelector<HTMLDivElement>('#app')
      if (app) {
        app.innerHTML = renderApp()
        bindEvents()
        if (currentPage === 'dashboard' || currentPage === 'automotive') {
          setTimeout(initCharts, 100)
        }
      }
    })
  })
}

// ==================== 世界地图渲染 ====================

async function renderRealWorldMap() {
  console.log('=== Starting to render world map ===')
  console.log('worldMapData cache:', worldMapData)
  
  try {
    // 直接内联加载地图数据，避免 Tree Shaking
    let mapData = worldMapData
    if (!mapData) {
      console.log('Loading map data from server...')
      try {
        const response = await fetch('/oritek-world-monitor/world-110m.json?t=' + Date.now())
        console.log('Fetch response status:', response.status)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const topology = await response.json()
        console.log('Topology loaded, objects:', Object.keys(topology.objects))
        mapData = topojson.feature(topology, topology.objects.countries)
        console.log('Map features created:', mapData?.features?.length)
        worldMapData = mapData
      } catch (error) {
        console.error('Failed to load world map data:', error)
        // 显示错误到页面
        const errorDiv = document.createElement('div')
        errorDiv.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:red;color:white;padding:20px;z-index:9999'
        errorDiv.textContent = '地图数据加载失败: ' + error
        document.querySelector('.world-map-container')?.appendChild(errorDiv)
        return
      }
    }
    
    if (!mapData) {
      console.error('Failed to load map data')
      return
    }
    console.log('Map data loaded successfully:', mapData.features.length, 'features')

    // 确保 SVG 元素存在
    const svgContainer = document.getElementById('worldMapContainer')
    console.log('svgContainer found:', !!svgContainer)
    if (!svgContainer) {
      console.error('Map container #worldMapContainer not found')
      console.log('Available IDs:', Array.from(document.querySelectorAll('[id]')).map(el => el.id).join(', '))
      // 创建一个提示信息
      const errorDiv = document.createElement('div')
      errorDiv.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:red;color:white;padding:20px;z-index:9999'
      errorDiv.textContent = '地图容器未找到'
      document.querySelector('.world-map-container')?.appendChild(errorDiv)
      return
    }
    
    const svg = d3.select('#worldMapSvg')
    console.log('SVG found:', !svg.empty())
    if (svg.empty()) {
      console.error('SVG element #worldMapSvg not found')
      // 创建 SVG 元素
      const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      newSvg.setAttribute('id', 'worldMapSvg')
      newSvg.setAttribute('viewBox', '0 0 1050 520')
      newSvg.setAttribute('class', 'world-map-svg')
      newSvg.style.cssText = 'width:100%;height:300px;background:rgba(0,20,40,0.3);'
      svgContainer.appendChild(newSvg)
      return
    }
    console.log('SVG element found')

    const width = 1050
    const height = 520

    // 使用 Natural Earth 投影
    const projection = d3Geo.geoNaturalEarth1()
      .scale(175)
      .translate([width / 2, height / 2])

    const path = d3Geo.geoPath().projection(projection)

    // 渲染国家
    const pathsGroup = svg.select('#worldMapPaths')
    if (pathsGroup.empty()) {
      console.error('Paths group #worldMapPaths not found, creating it')
      svg.append('g').attr('id', 'worldMapPaths')
    }

    console.log('Rendering', mapData.features.length, 'country paths')
    
    pathsGroup
      .selectAll('path')
      .data(mapData.features)
      .enter()
      .append('path')
      .attr('d', path as any)
      .attr('fill', 'rgba(30, 45, 65, 0.9)')
      .attr('stroke', 'rgba(0, 200, 255, 0.4)')
      .attr('stroke-width', 0.5)
    
    console.log('Country paths rendered successfully')

    // 渲染热点标记
    const impactColors: Record<string, string> = {
      high: '#ff3366',
      medium: '#ff9500',
      low: '#00d4ff'
    }

    const markersGroup = svg.append('g').attr('class', 'hotspot-markers')

    globalHotspots.slice(0, 8).forEach(spot => {
      const coord = hotspotCoordinates[spot.region]
      if (!coord) return

      const [x, y] = projection([coord.lon, coord.lat]) || [0, 0]
      const color = impactColors[spot.impact]

      const marker = markersGroup.append('g')
        .attr('class', `hotspot-marker ${spot.impact}`)
        .attr('data-id', spot.id)
        .attr('transform', `translate(${x}, ${y})`)

      // 脉冲外圈
      marker.append('circle')
        .attr('r', 20)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('opacity', 0.4)
        .append('animate')
        .attr('attributeName', 'r')
        .attr('values', '10;32;10')
        .attr('dur', '2s')
        .attr('repeatCount', 'indefinite')

      marker.select('circle')
        .append('animate')
        .attr('attributeName', 'opacity')
        .attr('values', '0.6;0;0.6')
        .attr('dur', '2s')
        .attr('repeatCount', 'indefinite')

      // 中心点
      marker.append('circle')
        .attr('r', 8)
        .attr('fill', color)

      // 外圈
      marker.append('circle')
        .attr('r', 12)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.6)
    })
    
    console.log('Hotspot markers rendered successfully')
    
    // 添加成功标记，让用户知道地图已渲染
    const container = document.querySelector('.world-map-container') as HTMLElement | null
    if (container) {
      container.style.border = '3px solid #00ff88'
      container.insertAdjacentHTML('beforeend', '<div style="position:absolute;top:10px;right:10px;background:#00ff88;color:#000;padding:5px 10px;border-radius:5px;font-size:12px;">🗺️ 地图已加载</div>')
    }
  } catch (error) {
    console.error('Error rendering world map:', error)
    // 显示错误信息
    const container = document.querySelector('.world-map-container') as HTMLElement | null
    if (container) {
      container.style.border = '3px solid red'
      container.insertAdjacentHTML('beforeend', `<div style="position:absolute;top:10px;right:10px;background:red;color:#fff;padding:5px 10px;border-radius:5px;font-size:12px;">❌ 错误: ${error}</div>`)
    }
  }
}

// ==================== 自动滚动功能 ====================

// 自动滚动功能
function startAutoScroll() {
  // 每30秒自动滚动到页面不同位置，模拟实时监控效果
  window.setInterval(() => {
    const mainContent = document.querySelector('.main-content')
    if (!mainContent) return
    
    const maxScroll = mainContent.scrollHeight - mainContent.clientHeight
    
    // 随机滚动到不同位置
    const targetScroll = Math.random() * maxScroll
    mainContent.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    })
  }, 30000) // 30秒滚动一次
}



// 新闻自动轮播
function startNewsRotation() {
  // 每10秒更新一次新闻数据，模拟实时更新
  window.setInterval(() => {
    // 随机更新一些数据
    industryIndices.forEach(idx => {
      idx.changePercent += (Math.random() - 0.5) * 0.3
      idx.change = idx.value * idx.changePercent / 100
      idx.value += idx.change
    })
    
    // 更新最后更新时间
    const lastUpdateEl = document.querySelector('.last-update')
    if (lastUpdateEl) {
      lastUpdateEl.textContent = `更新于 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    }
    
    // 如果有可见的更新提示，可以在这里添加
    const tickerItems = document.querySelectorAll('.ticker-value')
    tickerItems.forEach(el => {
      el.classList.add('value-updated')
      setTimeout(() => el.classList.remove('value-updated'), 500)
    })
  }, 10000) // 10秒更新一次
}



// ==================== 初始化 ====================

async function init() {
  console.log('Initializing Oritek World Monitor...')
  const app = document.querySelector<HTMLDivElement>('#app')
  if (app) {
    try {
      app.innerHTML = renderApp()
      console.log('App rendered')
      
      bindEvents()
      console.log('Events bound')
      
      initCharts()
      console.log('Charts initialized')
      
      startAutoRefresh()
      startAutoScroll() // 启动自动滚动
      startNewsRotation() // 启动新闻轮播
      console.log('Auto features started')

      // 强制渲染世界地图 - 使用 setTimeout 确保 DOM 完全加载
      console.log('Starting world map rendering...')
      setTimeout(async () => {
        await renderRealWorldMap()
        console.log('World map rendering completed')
      }, 100)
    } catch (error) {
      console.error('Error during initialization:', error)
    }
  } else {
    console.error('App element not found')
  }
}

init()

// 全局函数，确保地图渲染不被 Tree Shaking
(window as any).renderWorldMapNow = async function() {
  console.log('=== FORCE RENDERING WORLD MAP ===')
  const container = document.querySelector('.world-map-container') as HTMLElement | null
  if (container) {
    container.style.border = '5px solid yellow'
    container.insertAdjacentHTML('beforeend', '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:yellow;color:#000;padding:20px;font-size:18px;font-weight:bold;">🗺️ 强制渲染地图中...</div>')
  }
  await renderRealWorldMap()
  console.log('=== WORLD MAP RENDERING COMPLETED ===')
}

// 页面加载完成后立即渲染地图
setTimeout(() => {
  console.log('=== PAGE LOADED, TRIGGERING MAP RENDER ===')
  ;(window as any).renderWorldMapNow()
}, 500)

// 注册全局事件监听器，确保地图渲染
window.addEventListener('load', async () => {
  console.log('=== WINDOW LOADED, CHECKING MAP ===')
  
  // 等待 1 秒确保所有脚本加载完成
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const container = document.querySelector('.world-map-container')
  if (!container) {
    console.error('=== MAP CONTAINER NOT FOUND ===')
    return
  }
  
  // 检查地图是否已渲染
  const hasMapPaths = document.querySelector('.world-map-svg path')
  if (!hasMapPaths) {
    console.log('=== MAP NOT RENDERED, FORCING RENDER ===')
    // 添加明显的视觉提示
    const containerEl = container as HTMLElement
    containerEl.style.border = '8px solid yellow'
    containerEl.style.position = 'relative'
    containerEl.insertAdjacentHTML('beforeend', '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:yellow;color:#000;padding:30px;font-size:24px;font-weight:bold;z-index:9999;border:3px solid red;">🗺️ 强制渲染地图中...</div>')
    
    // 强制调用渲染函数
    try {
      await renderRealWorldMap()
      console.log('=== MAP RENDER SUCCESS ===')
    } catch (e) {
      console.error('=== MAP RENDER FAILED ===', e)
      container.insertAdjacentHTML('beforeend', `<div style="position:absolute;top:10px;right:10px;background:red;color:#fff;padding:10px;">错误: ${e}</div>`)
    }
  } else {
    console.log('=== MAP ALREADY RENDERED ===')
  }
})

console.log('Oritek World Monitor initialized')
