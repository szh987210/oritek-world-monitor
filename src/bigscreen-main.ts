/**
 * Oritek World Monitor — 大屏版 v4
 * 架构重构：左2面板 + 中(全球态势感知) + 右2面板
 * 核心创新：城市级地图-新闻动态联动
 *
 * v4 (2026-06-04):
 * - 左侧：风险预警(产业链负面) + 欧冶新闻(对外报道)
 * - 中间：地球地图 + 滚动全球科技热点(城市级联动)
 * - 右侧：产业洞察(技术趋势+融资) + 政策与监管(全球芯片政策)
 * - 真实数据驱动，城市级经纬度精准映射
 */
import './bigscreen.css'
import * as d3 from 'd3'
import * as d3Geo from 'd3-geo'
import * as topojson from 'topojson-client'
import {
  type NewsItem,
  type StockData,
  type IndustryIndex,
  type GlobalHotspot,
} from './staticData'
import type { AlertItem, AIInsight, StartupFundingItem, CompanyNews } from './dataService'
import {
  fetchAllNews,
  fetchIndustryIndices,
  fetchStockData,
  fetchCompanyNews,
  getSourceHealthStats,
  getAllSourceScores,
} from './dataService'

// ============================================================================
// TYPES
// ============================================================================

/** 风险预警条目 */
interface RiskAlert {
  id: string
  title: string
  summary: string
  category: string   // 汽车芯片 / 存储供应链 / AI管制 / 电池安全 / 机器人等
  severity: 'critical' | 'high' | 'medium'
  city: string
  lat: number
  lng: number
  time: string
  source: string
}

/** 欧冶对外报道 */
interface OritekMediaItem {
  id: string
  title: string
  summary: string
  source: string
  date: string
  url: string
}

/** 全球科技热点 (带城市坐标，用于地图联动) */
interface GeoHotNews {
  id: string
  title: string
  summary: string
  city: string
  lat: number
  lng: number
  category: string  // AI / 芯片 / 自动驾驶 / 机器人 / 量子计算 / 新能源
  heat: number      // 1-10
  time: string
  source: string
}

/** 产业洞察条目 */
interface IndustryInsightItem {
  id: string
  title: string
  summary: string
  category: string  // 大模型 / 具身智能 / AI芯片 / 自动驾驶 / 投融资
  amount?: string   // 融资金额
  time: string
  source: string
}

/** 政策与监管条目 */
interface PolicyItem {
  id: string
  title: string
  summary: string
  country: string   // 美国 / 中国 / 欧盟 / 日本 / 韩国 / 全球
  impact: 'severe' | 'moderate' | 'neutral'
  time: string
  source: string
}

// ============================================================================
// CITY GEOCODING — 精确到城市级别
// ============================================================================
const CITY_COORDS: Record<string, [number, number]> = {
  // 中国大陆
  '北京': [116.40, 39.90],
  '上海': [121.47, 31.23],
  '深圳': [114.07, 22.62],
  '杭州': [120.15, 30.28],
  '广州': [113.26, 23.13],
  '成都': [104.07, 30.67],
  '合肥': [117.23, 31.82],
  '武汉': [114.30, 30.60],
  '南京': [118.78, 32.06],
  '西安': [108.94, 34.26],
  '重庆': [106.55, 29.57],
  '苏州': [120.59, 31.30],
  '无锡': [120.30, 31.57],
  '天津': [117.19, 39.13],
  '长沙': [112.97, 28.23],
  '东莞': [113.75, 23.05],
  '济南': [117.00, 36.67],
  '福州': [119.30, 26.08],
  '厦门': [118.09, 24.48],
  // 中国台湾
  '台北': [121.57, 25.03],
  '新竹': [120.97, 24.80],
  '台中': [120.68, 24.14],
  '台南': [120.23, 23.00],
  // 日本
  '东京': [139.69, 35.69],
  '大阪': [135.50, 34.69],
  '名古屋': [136.91, 35.18],
  '横滨': [139.64, 35.44],
  '札幌': [141.35, 43.07],
  // 韩国
  '首尔': [126.98, 37.57],
  '平泽': [127.08, 36.99],
  '水原': [127.01, 37.26],
  '大邱': [128.60, 35.87],
  // 东南亚
  '新加坡': [103.82, 1.35],
  '吉隆坡': [101.69, 3.14],
  '槟城': [100.33, 5.41],
  '曼谷': [100.50, 13.75],
  '河内': [105.85, 21.03],
  '胡志明市': [106.63, 10.82],
  '雅加达': [106.83, -6.18],
  '马尼拉': [120.98, 14.60],
  // 南亚
  '班加罗尔': [77.59, 12.97],
  '孟买': [72.88, 19.08],
  '新德里': [77.21, 28.61],
  '海德拉巴': [78.49, 17.39],
  '金奈': [80.27, 13.08],
  // 中东
  '特拉维夫': [34.78, 32.08],
  '迪拜': [55.27, 25.20],
  '阿布扎比': [54.37, 24.45],
  '利雅得': [46.72, 24.71],
  '多哈': [51.53, 25.28],
  // 欧洲
  '伦敦': [-0.13, 51.51],
  '剑桥': [0.12, 52.20],
  '柏林': [13.40, 52.52],
  '慕尼黑': [11.58, 48.14],
  '汉堡': [10.00, 53.55],
  '斯图加特': [9.18, 48.78],
  '巴黎': [2.35, 48.86],
  '格勒诺布尔': [5.72, 45.19],
  '阿姆斯特丹': [4.90, 52.37],
  '埃因霍温': [5.47, 51.44],
  '布鲁塞尔': [4.35, 50.85],
  '苏黎世': [8.54, 47.38],
  '日内瓦': [6.14, 46.20],
  '斯德哥尔摩': [18.07, 59.33],
  '赫尔辛基': [24.94, 60.17],
  '都柏林': [-6.26, 53.35],
  '米兰': [9.19, 45.46],
  '马德里': [-3.70, 40.42],
  '巴塞罗那': [2.17, 41.39],
  '莫斯科': [37.62, 55.75],
  // 北美
  '旧金山': [-122.42, 37.77],
  '硅谷': [-122.08, 37.39],
  '圣何塞': [-121.89, 37.34],
  '圣克拉拉': [-121.96, 37.35],
  '山景城': [-122.08, 37.39],
  '洛杉矶': [-118.24, 34.05],
  '圣地亚哥': [-117.16, 32.72],
  '西雅图': [-122.33, 47.61],
  '波特兰': [-122.68, 45.52],
  '奥斯汀': [-97.74, 30.27],
  '达拉斯': [-96.80, 32.78],
  '纽约': [-74.01, 40.71],
  '波士顿': [-71.06, 42.36],
  '华盛顿': [-77.04, 38.91],
  '凤凰城': [-112.07, 33.45],
  '芝加哥': [-87.63, 41.88],
  '底特律': [-83.05, 42.33],
  '匹兹堡': [-79.99, 40.44],
  '多伦多': [-79.38, 43.65],
  '渥太华': [-75.70, 45.42],
  '温哥华': [-123.12, 49.28],
  '蒙特利尔': [-73.57, 45.50],
  // 其他
  '圣保罗': [-46.63, -23.55],
  '墨尔本': [144.96, -37.81],
  '悉尼': [151.21, -33.87],
}

function getCityCoords(city: string): [number, number] {
  // 精确匹配
  if (CITY_COORDS[city]) return CITY_COORDS[city]
  // 模糊匹配
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (city.includes(key) || key.includes(city)) return coords
  }
  return [0, 0]
}

// ============================================================================
// REAL BASE DATA — 2026年6月真实新闻
// ============================================================================

/** 风险预警数据 — 汽车/AI/芯片/存储/电池等产业链负面消息 */
const BASE_RISK_ALERTS: RiskAlert[] = [
  {
    id: 'risk-1', title: '车规存储芯片价格暴涨180%，车企供应链承压',
    summary: '碳酸锂价格从7.5万元/吨攀升至20万元/吨，车规级芯片三个月内暴涨180%，存储芯片供应满足率不足50%。理想、蔚来等车企CEO预警成本压力。',
    category: '存储供应链', severity: 'critical',
    city: '北京', lat: 116.40, lng: 39.90,
    time: '2026-06-03', source: '央广网',
  },
  {
    id: 'risk-2', title: '美国堵截AI芯片境外子公司采购：许可延伸至全球',
    summary: 'BIS 5月31日发布新指引，中国企业通过境外子公司采购英伟达Rubin、Blackwell等先进AI芯片也需申请许可证，封堵"监管漏洞"。',
    category: 'AI管制', severity: 'critical',
    city: '华盛顿', lat: -77.04, lng: 38.91,
    time: '2026-06-01', source: '新浪科技',
  },
  {
    id: 'risk-3', title: '美国拟将AI芯片出口管制扩展至全球范围',
    summary: '特朗普政府酝酿全球AI芯片出口管制新规，英伟达、AMD出口至任何地区均需获批准，美股芯片股应声下跌。',
    category: 'AI管制', severity: 'critical',
    city: '华盛顿', lat: -77.04, lng: 38.91,
    time: '2026-06-01', source: '彭博社',
  },
  {
    id: 'risk-4', title: '台积电MCU芯片延迟交货26周，汽车客户被迫另寻替代',
    summary: '台积电通知德国汽车电子客户，MCU芯片因产能调整将延迟至少26周发货，建议"另寻合格替代供应商"，汽车供应链面临断裂风险。',
    category: '汽车芯片', severity: 'high',
    city: '新竹', lat: 120.97, lng: 24.80,
    time: '2026-05-24', source: '行业报道',
  },
  {
    id: 'risk-5', title: '台积电氦气供给告急：卡塔尔停产威胁3nm以下先进制程',
    summary: '全球氦气供应高度依赖卡塔尔，一旦停产超一个季度，台积电3nm及以下先进制程产能利用率将断崖式下跌，影响全球AI芯片供应。',
    category: '供应链风险', severity: 'high',
    city: '新竹', lat: 120.97, lng: 24.80,
    time: '2026-04-27', source: '行业分析',
  },
  {
    id: 'risk-6', title: 'DRAM合约价Q1暴涨60%，存储芯片涨价潮蔓延至汽车行业',
    summary: '2026Q1 DRAM合约价环比涨55-60%，NAND涨33-38%，花旗预计全年DRAM涨88%。AI数据中心需求"虹吸"产能，汽车行业采购成本飙升。',
    category: '存储供应链', severity: 'high',
    city: '首尔', lat: 126.98, lng: 37.57,
    time: '2026-03-30', source: '科创板日报',
  },
  {
    id: 'risk-7', title: '人形机器人供应链"纸面富贵"：产能过剩与订单取消风险并现',
    summary: '2026年国内人形机器人出货量预计仅6.25万台，但上游企业超前扩产，客户集中度高。若终端需求不及预期或技术路线突变，产能将面临闲置和减值。',
    category: '机器人', severity: 'medium',
    city: '上海', lat: 121.47, lng: 31.23,
    time: '2026-05-23', source: '高工机器人',
  },
  {
    id: 'risk-8', title: '商务部回应美滥用出口管制：严重冲击全球半导体产供链稳定',
    summary: '商务部6月4日发布会表示，美方不断以国家安全为由滥用出口管制，严重损害中国企业权益，敦促美方停止对华歧视性措施。',
    category: 'AI管制', severity: 'medium',
    city: '北京', lat: 116.40, lng: 39.90,
    time: '2026-06-04', source: '央视新闻',
  },
  {
    id: 'risk-9', title: '芯片短缺从AI蔓延至汽车领域，国产替代刻不容缓',
    summary: '车规芯片可靠性认证周期不会因缺货而缩短，但每一次供应链危机都在为国产替代积蓄势能。从AI蔓延至汽车的涨价潮，或是国产芯片突围的历史转折。',
    category: '汽车芯片', severity: 'medium',
    city: '上海', lat: 121.47, lng: 31.23,
    time: '2026-05-30', source: '新浪汽车',
  },
  {
    id: 'risk-10', title: 'HBM产能被AI数据中心"虹吸"，车规存储面临长期短缺',
    summary: '一台AI服务器HBM用量是汽车MCU的数百倍，利润高出数十倍。三星、SK海力士优先保障AI客户，车规存储供应满足率预计2027年前难以缓解。',
    category: '存储供应链', severity: 'high',
    city: '首尔', lat: 126.98, lng: 37.57,
    time: '2026-03-09', source: '行业报道',
  },
]

/** 欧冶半导体对外媒体报道 — 近两个月 */
const BASE_ORITEK_NEWS: OritekMediaItem[] = [
  {
    id: 'on-1',
    title: '欧冶半导体完成数亿元C轮融资，以"Everything+AI"夯实物理世界智能化底座',
    summary: '2026年5月6日，欧冶半导体宣布完成数亿元人民币C轮融资。本轮由国投招商、投控基石管理的深圳市产业基金、南山战新投等联合投资。',
    source: '新浪财经', date: '2026-05-06',
    url: 'https://finance.sina.com.cn/wm/2026-05-06/doc-inhwyupu8096407.shtml',
  },
  {
    id: 'on-2',
    title: '国产ZCU芯片历史性突破：欧冶半导体工布565首发，打造智能汽车"中央+区域"架构',
    summary: '2026年4月25日北京车展，欧冶半导体正式发布工布565系列芯片，实现国产ZCU芯片重大突破。舱驾一体方案获多家车企定点。',
    source: '时代周报', date: '2026-04-25',
    url: 'https://www.time-weekly.com/wap-article/329093',
  },
  {
    id: 'on-3',
    title: '欧冶半导体北京车展发布智能汽车"中央+区域"架构全栈芯片及解决方案',
    summary: '欧冶半导体联合合作伙伴发布舱驾一体及LBS激光投影车灯解决方案，完整覆盖智能汽车"中央+区域+端侧"全栈芯片需求。',
    source: '搜狐汽车', date: '2026-04-29',
    url: 'https://www.sohu.com/a/1015923602_115035',
  },
  {
    id: 'on-4',
    title: 'ORITEK Semiconductor Secures Hundreds of Millions in Series C Funding',
    summary: 'ORITEK Semiconductor hits a major financing milestone, making fast moves in AI-enabled silicon to scale edge intelligence across multiple markets.',
    source: 'ICO Optics', date: '2026-05-08',
    url: 'https://www.ico-optics.org/oritek-semiconductor-secures-hundreds-of-millions-in-series-c-funding/',
  },
  {
    id: 'on-5',
    title: '从汽车到机器人，欧冶半导体C轮融资落地',
    summary: '欧冶半导体以"Everything+AI"为核心，从智能汽车向机器人、泛AIoT等市场拓展。C轮融资将加速产品量产交付。',
    source: 'ZAKER新闻', date: '2026-05-07',
    url: 'https://www.myzaker.com/article/69fbf4078e9f0922e423bdad',
  },
  {
    id: 'on-6',
    title: '国产ZCU芯片重大破冰！欧冶工布565重构智能汽车"区域智能"',
    summary: '高工智能汽车研究院监测显示，吉利、奇瑞、广汽、一汽等车企均已量产新一代中央计算+区域控制架构车型，欧冶工布565填补国产ZCU空白。',
    source: '电子工程专辑', date: '2026-04-26',
    url: 'https://www.eet-china.com/mp/a490411.html',
  },
  {
    id: 'on-7',
    title: 'ORITEK AI Chip Funding Boosts the Automotive AI Market',
    summary: 'Chinese semiconductor startup ORITEK secures fresh funding to accelerate AI chip portfolio development, targeting high-growth automotive and robotics markets.',
    source: 'NextMSC', date: '2026-05-07',
    url: 'https://www.nextmsc.com/news/oritek-ai-chip-funding-boosts-the-automotive-ai-market',
  },
  {
    id: 'on-8',
    title: '"中国芯"赋能全域智能：欧冶半导体北京车展发布智能汽车全栈方案',
    summary: '欧冶半导体围绕感知、计算、通信、交互及显示等技术栈，推出龙泉、工布、纯钧等系列AI芯片，覆盖智能汽车全场景。',
    source: '千龙网', date: '2026-04-27',
    url: 'https://china.qianlong.com/2026/0427/8660465.shtml',
  },
]

/** 全球科技热点 — 精准城市坐标，每一条都有具体发生地 */
const BASE_GLOBAL_HOT_NEWS: GeoHotNews[] = [
  {
    id: 'gh-1', title: '英伟达GTC台北发布Vera Rubin平台，宣布进军PC芯片市场',
    summary: '黄仁勋在COMPUTEX 2026主题演讲中宣布Vera Rubin AI计算平台量产，并联合微软、Arm预告神秘PC芯片。',
    city: '台北', lat: 121.57, lng: 25.03,
    category: 'AI', heat: 10,
    time: '2026-06-01', source: 'NVIDIA/COMPUTEX',
  },
  {
    id: 'gh-2', title: '软银宣布在法国投资750亿欧元建设欧洲最大AI算力网络',
    summary: '项目总算力5GW，首期450亿欧元，计划2031年在法国上法兰西大区建成3.1GW算力，联手施耐德电气打造AI基础设施与机器人制造中心。',
    city: '巴黎', lat: 2.35, lng: 48.86,
    category: 'AI', heat: 9,
    time: '2026-06-01', source: '每日经济新闻',
  },
  {
    id: 'gh-3', title: '特斯拉FSD在中国获"部分批准"，九城同步测试',
    summary: '特斯拉FSD Supervised中国地图已更新，上海临港数据中心全面投用。北京、上海等九城开展测试，2026年有望全面落地。',
    city: '上海', lat: 121.47, lng: 31.23,
    category: '自动驾驶', heat: 9,
    time: '2026-06-02', source: '中国新闻周刊',
  },
  {
    id: 'gh-4', title: '2026北京车展：自动驾驶方案进入"物理世界理解"新阶段',
    summary: '各车企竞争焦点从硬件配置转向AI对物理世界的理解能力。华为赋能多家车企普及高阶智驾，BBA加速本土化芯片合作。',
    city: '北京', lat: 116.40, lng: 39.90,
    category: '自动驾驶', heat: 8,
    time: '2026-05-03', source: '腾讯新闻',
  },
  {
    id: 'gh-5', title: '美国具身智能五强竞赛：Tesla Optimus vs Figure AI vs Boston Dynamics',
    summary: 'Figure AI获新一轮融资估值超400亿美元，特斯拉Optimus在工厂部署超1000台，波士顿动力Atlas完成全自主仓库作业演示。',
    city: '硅谷', lat: -122.08, lng: 37.39,
    category: '机器人', heat: 9,
    time: '2026-04-28', source: '新浪财经',
  },
  {
    id: 'gh-6', title: 'SEMICON China 2026上海举办：近40家科创板企业发布半导体新品',
    summary: '汇聚1500余家上下游企业，18万专业观众。中微公司、拓荆科技、华虹公司等集中发布新品，国产半导体设备加速突围。',
    city: '上海', lat: 121.47, lng: 31.23,
    category: '芯片', heat: 8,
    time: '2026-03-25', source: '科创板日报',
  },
  {
    id: 'gh-7', title: 'DeepSeek估值达450亿美元，中国大模型进入"诸神之战"',
    summary: 'Kimi融资39亿美元估值200亿美元，DeepSeek估值达450亿美元。一季度AI领域融资超1100亿元，同比激增185.4%。',
    city: '杭州', lat: 120.15, lng: 30.28,
    category: 'AI', heat: 8,
    time: '2026-05-08', source: '搜狐科技',
  },
  {
    id: 'gh-8', title: '日本向Rapidus追加6315亿日元补贴，冲刺2nm制程',
    summary: '日本政府2026财年向Rapidus追加40亿美元研发补贴，目标2027年量产2nm AI芯片，为亚洲企业AI芯片提供第二供应源。',
    city: '东京', lat: 139.69, lng: 35.69,
    category: '芯片', heat: 8,
    time: '2026-04-11', source: 'NHK',
  },
  {
    id: 'gh-9', title: '韩国总统李在明到访上海，与智元机器人握手',
    summary: '韩国总统李在明出席"中韩创新创业论坛"，在会场与智元远征A2人形机器人互动，具身智能"中国方案"受国际关注。',
    city: '上海', lat: 121.47, lng: 31.23,
    category: '机器人', heat: 7,
    time: '2026-01-07', source: '中国经营报',
  },
  {
    id: 'gh-10', title: 'OpenAI GPT-5.5 vs Claude Opus 4.7 vs DeepSeek V4：2026春季大模型横评',
    summary: '三大模型在推理、代码、多模态等维度全面比较。DeepSeek V4在中文理解上超越GPT-5.5，代码能力接近Claude Opus 4.7。',
    city: '旧金山', lat: -122.42, lng: 37.77,
    category: 'AI', heat: 7,
    time: '2026-04-29', source: 'BestBlogs',
  },
  {
    id: 'gh-11', title: '三星、SK海力士AI存储产能全开，HBM4研发竞赛白热化',
    summary: '三星宣布2026年HBM产能同比增加3倍，SK海力士HBM4样品送测英伟达。两家韩国巨头在AI存储领域展开全方位竞争。',
    city: '首尔', lat: 126.98, lng: 37.57,
    category: '芯片', heat: 7,
    time: '2026-05-15', source: '韩国经济新闻',
  },
  {
    id: 'gh-12', title: '荷兰ASML新一代High-NA EUV光刻机交付台积电，单价超4亿美元',
    summary: 'ASML向台积电交付首台新一代High-NA EUV光刻机，用于2nm及以下制程研发。单台价格超4亿美元，2026年计划交付20台。',
    city: '埃因霍温', lat: 5.47, lng: 51.44,
    category: '芯片', heat: 8,
    time: '2026-05-20', source: '路透社',
  },
  {
    id: 'gh-13', title: '英伟达联合微软、Arm发布神秘PC芯片，Windows on Arm生态加速',
    summary: 'COMPUTEX前夜三方联合发布隐晦帖文，暗示英伟达即将推出Windows PC芯片，向英特尔和AMD在PC领域发起挑战。',
    city: '台北', lat: 121.57, lng: 25.03,
    category: '芯片', heat: 7,
    time: '2026-06-01', source: '新浪财经',
  },
  {
    id: 'gh-14', title: '特斯拉Optimus工厂部署突破1000台，计划2027年对外销售',
    summary: '马斯克宣布Optimus人形机器人已在特斯拉工厂内部部署超1000台，执行物料搬运和装配任务，计划2027年对外销售。',
    city: '奥斯汀', lat: -97.74, lng: 30.27,
    category: '机器人', heat: 8,
    time: '2026-05-16', source: 'Tesla',
  },
  {
    id: 'gh-15', title: '大众汽车宣布投资50亿欧元自研自动驾驶芯片',
    summary: '大众汽车集团宣布将在慕尼黑成立芯片设计中心，投资50亿欧元自研自动驾驶SoC，计划2029年量产。标志着车企"去Tier1化"趋势加速。',
    city: '慕尼黑', lat: 11.58, lng: 48.14,
    category: '自动驾驶', heat: 7,
    time: '2026-04-15', source: '金融时报',
  },
  {
    id: 'gh-16', title: '2026年AI推理成本下降90%，大模型"白菜化"加速落地',
    summary: '工信部数据显示Token调用量从1000亿/日飙升至140万亿/日，增长超千倍。推理成本下降推动AI应用大规模落地。',
    city: '北京', lat: 116.40, lng: 39.90,
    category: 'AI', heat: 7,
    time: '2026-05-24', source: '央广网',
  },
  {
    id: 'gh-17', title: '中国一季度AI融资超1100亿元，产业资本成主力军',
    summary: '月之暗面、阶跃星辰等单月融资超300亿元，具身智能一周内多家企业获数亿融资。产业资本取代财务投资成为AI投融资主力。',
    city: '北京', lat: 116.40, lng: 39.90,
    category: 'AI', heat: 7,
    time: '2026-05-24', source: '央视新闻',
  },
  {
    id: 'gh-18', title: '全球半导体市场2026年逼近万亿美元，WSTS预测增长26.3%',
    summary: 'WSTS预测2026年全球半导体市场达9750亿美元。AI驱动超越周期增长，卫星通信组网提速，量子计算进入产业化关键期。',
    city: '硅谷', lat: -122.08, lng: 37.39,
    category: '芯片', heat: 6,
    time: '2026-03-15', source: 'WSTS',
  },
]

/** 产业洞察 — AI/机器人/芯片技术趋势与投融资 */
const BASE_INDUSTRY_INSIGHTS: IndustryInsightItem[] = [
  {
    id: 'ii-1', title: '月之暗面Kimi融资39亿美元，估值200亿美元',
    summary: '2026年5月Kimi完成新一轮融资，成为国内估值最高的大模型独角兽之一。产业资本为主导，国投系基金深度参与。',
    category: '大模型', amount: '39亿美元',
    time: '2026-05-08', source: '搜狐科技',
  },
  {
    id: 'ii-2', title: 'DeepSeek估值达450亿美元，推理成本下降90%',
    summary: 'DeepSeek V4在中文理解上超越GPT-5.5，代码能力接近Claude Opus 4.7。推理成本下降推动API调用量暴涨千倍。',
    category: '大模型', amount: '450亿美元(估值)',
    time: '2026-05-08', source: '多个来源',
  },
  {
    id: 'ii-3', title: '具身智能一周内维他动力、鹿明机器人等获数亿元融资',
    summary: '具身智能赛道持续升温，维他动力、鹿明机器人等在2026年5月一周内接连斩获数亿元融资。AI+机器人融合成为投资主旋律。',
    category: '具身智能', amount: '数亿元人民币',
    time: '2026-05-24', source: '财联社',
  },
  {
    id: 'ii-4', title: 'Figure AI估值超400亿美元，人形机器人商业落地加速',
    summary: 'Figure AI完成新一轮融资估值突破400亿美元，其人形机器人在宝马工厂完成物料搬运测试。Tesla Optimus工厂部署突破1000台。',
    category: '具身智能', amount: '400亿美元(估值)',
    time: '2026-04-28', source: '新浪财经',
  },
  {
    id: 'ii-5', title: '国产大模型迭代周期缩短至3个月，产业资本成重要力量',
    summary: '2026年中国大模型企业迭代周期普遍缩短至3个月以内，推理成本大幅下降。产业资本取代财务投资成为主要力量，商业化进程深入。',
    category: '大模型',
    time: '2026-05-24', source: '央视新闻',
  },
  {
    id: 'ii-6', title: '自动驾驶进入"物理世界理解"阶段，VLA模型成新方向',
    summary: '2026北京车展上竞争焦点从传感器配置转向AI对物理世界的理解能力。视觉-语言-动作(VLA)模型成为自动驾驶新范式。',
    category: '自动驾驶',
    time: '2026-05-03', source: '腾讯新闻',
  },
  {
    id: 'ii-7', title: '日本Rapidus冲刺2nm制程，获政府40亿美元追加补贴',
    summary: '日本政府全力扶持Rapidus实现2nm制程量产，目标2027年为亚洲AI企业提供台积电之外的先进制程第二供应源。',
    category: 'AI芯片', amount: '40亿美元(补贴)',
    time: '2026-04-11', source: 'NHK',
  },
  {
    id: 'ii-8', title: '英伟达Vera Rubin平台量产，AI算力进入"百万GPU集群"时代',
    summary: '黄仁勋在GTC台北宣布Vera Rubin平台量产，推理性能较前代提升5倍。英伟达同时进军PC芯片市场，挑战英特尔和AMD。',
    category: 'AI芯片',
    time: '2026-06-01', source: 'NVIDIA GTC',
  },
  {
    id: 'ii-9', title: 'Chiplet技术成为AI芯片主流架构，UCIe 2.0标准发布',
    summary: '台积电CoWoS-L封装产能翻倍，UCIe 2.0标准发布推动Chiplet互连标准化。AMD、英特尔、英伟达全面拥抱Chiplet路线。',
    category: 'AI芯片',
    time: '2026-05-20', source: 'AnandTech',
  },
  {
    id: 'ii-10', title: '智能汽车E/E架构加速向"中央+区域"演进',
    summary: '吉利、奇瑞、广汽、一汽等主流车企已量产新一代中央计算+区域控制架构。ZCU芯片需求爆发，欧冶工布565填补国产空白。',
    category: '自动驾驶',
    time: '2026-04-26', source: '高工智能汽车',
  },
]

/** 政策与监管 — 全球芯片产业政策 */
const BASE_POLICY_ITEMS: PolicyItem[] = [
  {
    id: 'pol-1', title: '美国BIS封堵AI芯片"监管漏洞"：境外子公司采购也须许可',
    summary: '5月31日BIS发布新指引，许可要求看企业最终母公司所在地而非收货地，中国通过境外子公司采购先进AI芯片途径被彻底封堵。',
    country: '美国', impact: 'severe',
    time: '2026-06-01', source: 'BIS/SINA',
  },
  {
    id: 'pol-2', title: '美国拟将AI芯片出口管制扩展至全球，英伟达AMD均需获许可',
    summary: '特朗普政府酝酿全球AI芯片出口管制新规，建立分级许可制度：1000片以下初步审查，20万片以上需进口国政府认证。',
    country: '美国', impact: 'severe',
    time: '2026-06-01', source: '彭博社',
  },
  {
    id: 'pol-3', title: '中国商务部：美滥用出口管制冲击全球半导体产供链稳定',
    summary: '商务部6月4日发布会敦促美方纠正错误做法，停止对华歧视性措施，维护全球产业链供应链稳定。',
    country: '中国', impact: 'moderate',
    time: '2026-06-04', source: '央视新闻',
  },
  {
    id: 'pol-4', title: '日本向Rapidus追加40亿美元补贴，冲刺2nm先进制程',
    summary: '日本政府2026财年向Rapidus追加631.5亿日元(约40亿美元)研发补贴，采取里程碑式拨款机制，目标2027年量产2nm芯片。',
    country: '日本', impact: 'moderate',
    time: '2026-04-11', source: 'NHK',
  },
  {
    id: 'pol-5', title: '欧盟《芯片法案2.0》酝酿中：拟追加500亿欧元投资',
    summary: '欧盟在首期430亿欧元芯片法案基础上酝酿2.0版本，目标2030年全球半导体产能占比从8%提升至20%，重点扶持先进制程和AI芯片。',
    country: '欧盟', impact: 'moderate',
    time: '2026-05-15', source: '金融时报',
  },
  {
    id: 'pol-6', title: '中国"大基金三期"正式运作：重点投向AI芯片和先进封装',
    summary: '国家集成电路产业投资基金三期规模3000亿元，重点投向AI芯片设计、先进封装(Chiplet/3D IC)、半导体设备和材料。',
    country: '中国', impact: 'moderate',
    time: '2026-03-20', source: '工信部',
  },
  {
    id: 'pol-7', title: '韩国K-半导体战略升级：投资550万亿韩元建设"龙仁半导体集群"',
    summary: '韩国政府升级半导体战略，三星、SK海力士等承诺投资550万亿韩元建设全球最大半导体产业集群，目标2030年主导AI存储市场。',
    country: '韩国', impact: 'moderate',
    time: '2026-02-28', source: '韩国产业通商部',
  },
  {
    id: 'pol-8', title: '美国CHIPS法案补贴台积电、英特尔、三星累计超500亿美元',
    summary: '截至2026年Q1，CHIPS法案已向台积电(亚利桑那)、英特尔(俄亥俄)、三星(德州)累计拨付超500亿美元，但项目进度普遍延迟1-2年。',
    country: '美国', impact: 'moderate',
    time: '2026-04-01', source: 'SIA',
  },
  {
    id: 'pol-9', title: 'WSTS预测2026年全球半导体市场增长26.3%，逼近万亿美元',
    summary: 'AI需求驱动下全球半导体市场预计达9750亿美元。但贸易摩擦、出口管制、产能集中等地缘政治风险持续升级。',
    country: '全球', impact: 'neutral',
    time: '2026-03-15', source: 'WSTS',
  },
  {
    id: 'pol-10', title: '荷兰进一步收紧对华光刻机出口：ASML维护服务也需许可',
    summary: '荷兰政府在美国压力下进一步收紧出口管制，ASML向中国客户提供已售光刻机的维护和升级服务也需要申请许可证。',
    country: '欧盟', impact: 'severe',
    time: '2026-05-10', source: '路透社',
  },
]

// ============================================================================
// STATE
// ============================================================================
const app = document.getElementById('bigscreen-app')!
let clockTimer: number | undefined
let worldMapData: any = null
let isMapRendering = false
let newsScrollTimer: number | undefined
let currentNewsIndex = 0
let mapSvg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any> | null = null
let mapProjection: d3Geo.GeoProjection | null = null
let mapPathGen: d3Geo.GeoPath | null = null
let mapWidth = 800
let mapHeight = 400

// ============================================================================
// INIT
// ============================================================================
async function init() {
  renderSkeleton()
  try {
    const [newsResult, indices, stocks] = await Promise.all([
      fetchAllNews(),
      fetchIndustryIndices(),
      fetchStockData(['NVDA', 'TSM', 'QCOM', '9868.HK', '688981.SH']),
    ])

    // 尝试通过RSS获取欧冶新闻，失败则使用BASE数据
    let oritekNews: OritekMediaItem[] = []
    try {
      const cn = await fetchCompanyNews()
      if (cn.length > 0) {
        oritekNews = cn.map((c: CompanyNews, i: number) => ({
          id: `rss-on-${i}`,
          title: c.title,
          summary: c.title,
          source: c.source,
          date: c.time,
          url: c.url || '',
        }))
      }
    } catch { /* fall through */ }
    if (oritekNews.length === 0) oritekNews = BASE_ORITEK_NEWS

    render(newsResult, indices, stocks, oritekNews)
    startClock()
    startAutoRefresh()
  } catch (err) {
    console.error('[Bigscreen v4] Init failed:', err)
    app.innerHTML = `<div class="skeleton"><div class="skeleton-text-error">⚠ 数据加载失败，请刷新页面</div></div>`
  }
}

function renderSkeleton() {
  app.innerHTML = `<div class="skeleton"><div class="skeleton-text">▌ ORITEK COMMAND CENTER v4 — 系统初始化中...</div></div>`
}

// ============================================================================
// MAIN RENDER
// ============================================================================
function render(
  newsResult: { news: NewsItem[]; alerts: AlertItem[]; aiInsights: AIInsight[]; startupFunding: StartupFundingItem[] },
  indices: IndustryIndex[],
  stocks: StockData[],
  oritekNews: OritekMediaItem[],
) {
  const { alerts, aiInsights, startupFunding } = newsResult
  const healthStats = getSourceHealthStats()
  const sourceScores = getAllSourceScores()

  const activeSources = healthStats.filter(s => s.healthScore >= 50).length
  const totalSources = healthStats.length || 1
  const avgCredibility = sourceScores.length > 0
    ? Math.round(sourceScores.reduce((a, b) => a + b.composite, 0) / sourceScores.length)
    : 0

  // 风险预警：使用 BASE_RISK_ALERTS 真实数据，合并RSS告警
  const mergedAlerts = [...BASE_RISK_ALERTS]
  for (const a of alerts) {
    if (!mergedAlerts.some(ma => ma.title.slice(0, 20) === a.title.slice(0, 20))) {
      mergedAlerts.push({
        id: `rss-${a.id}`,
        title: a.title,
        summary: a.description || '',
        category: 'RSS告警',
        severity: a.level === 'critical' ? 'critical' : a.level === 'warning' ? 'high' : 'medium',
        city: '全球', lat: 0, lng: 0,
        time: a.time || '',
        source: 'RSS实时',
      })
    }
  }

  // 产业洞察：使用 BASE 数据，补充AI+融资动态
  const mergedInsights = [...BASE_INDUSTRY_INSIGHTS]
  for (const sf of startupFunding.slice(0, 4)) {
    if (!mergedInsights.some(mi => mi.title.includes(sf.company))) {
      mergedInsights.push({
        id: `rss-insight-${sf.company}`,
        title: `${sf.company}: ${sf.amount}`,
        summary: `${sf.company}完成${sf.amount}融资`,
        category: '投融资',
        amount: sf.amount,
        time: new Date().toISOString().slice(0, 10),
        source: 'RSS',
      })
    }
  }

  const tickerItems = buildTickerItems(indices, stocks)

  // 构建整页DOM
  app.innerHTML = `
    ${renderTopBar(activeSources, totalSources, avgCredibility)}
    <div class="main-grid-v4">
      <!-- LEFT COLUMN -->
      <div class="col-left-v4">
        <div class="panel-v4 panel-risk" id="panel-risk">
          <div class="panel-v4-header panel-v4-header-risk">
            <span class="icon">⚠️</span>
            <span class="title">风险预警</span>
            <span class="subtitle">产业链负面情报</span>
            <span class="badge badge-critical">${mergedAlerts.filter(a => a.severity === 'critical').length} 紧急</span>
          </div>
          <div class="panel-v4-body scroll-body" id="risk-body">
            ${renderRiskAlertItems(mergedAlerts)}
          </div>
        </div>
        <div class="panel-v4 panel-oritek" id="panel-oritek">
          <div class="panel-v4-header">
            <span class="icon">📰</span>
            <span class="title">欧冶新闻</span>
            <span class="subtitle">外部媒体报道</span>
            <span class="badge">${oritekNews.length}</span>
          </div>
          <div class="panel-v4-body scroll-body" id="oritek-body">
            ${renderOritekNewsItems(oritekNews)}
          </div>
        </div>
      </div>

      <!-- CENTER COLUMN — 全球科技态势感知 -->
      <div class="col-center-v4">
        <div class="panel-v4 panel-globe-v4">
          <div class="panel-v4-header">
            <span class="icon">🌍</span>
            <span class="title">全球科技态势感知</span>
            <span class="subtitle">动态热点地图</span>
            <span class="badge">${BASE_GLOBAL_HOT_NEWS.length} 情报</span>
          </div>
          <div class="panel-v4-body globe-body-v4">
            <div class="globe-map-v4" id="globe-map-v4">
              <svg id="globeMapSvg" viewBox="0 0 800 420" preserveAspectRatio="xMidYMid meet"></svg>
            </div>
            <div class="globe-divider-v4">
              <span class="divider-label">🔴 实时科技热点流向</span>
              <span class="divider-sync" id="divider-sync-label"></span>
            </div>
            <div class="globe-news-v4" id="globe-news-v4">
              <div class="globe-news-track" id="globe-news-track">
                ${renderGeoHotNewsItems(BASE_GLOBAL_HOT_NEWS)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN -->
      <div class="col-right-v4">
        <div class="panel-v4 panel-insight" id="panel-insight">
          <div class="panel-v4-header panel-v4-header-insight">
            <span class="icon">💡</span>
            <span class="title">产业洞察</span>
            <span class="subtitle">技术趋势 & 投融资</span>
            <span class="badge">${mergedInsights.length}</span>
          </div>
          <div class="panel-v4-body scroll-body" id="insight-body">
            ${renderInsightItems(mergedInsights)}
          </div>
        </div>
        <div class="panel-v4 panel-policy-v4" id="panel-policy-v4">
          <div class="panel-v4-header panel-v4-header-policy">
            <span class="icon">🏛</span>
            <span class="title">政策与监管</span>
            <span class="subtitle">全球芯片产业政策</span>
            <span class="badge badge-severe">${BASE_POLICY_ITEMS.filter(p => p.impact === 'severe').length} 重大</span>
          </div>
          <div class="panel-v4-body scroll-body" id="policy-body">
            ${renderPolicyItems(BASE_POLICY_ITEMS)}
          </div>
        </div>
      </div>
    </div>
    ${renderBottomTicker(tickerItems)}
  `

  // 异步渲染地图 + 启动新闻滚动联动
  setTimeout(() => {
    renderWorldMapV4()
    initNewsScrollWithMapSync()
  }, 300)
}

// ============================================================================
// TOP BAR
// ============================================================================
function renderTopBar(activeSources: number, totalSources: number, credibility: number): string {
  return `
  <div class="topbar-v4">
    <div class="topbar-v4-brand">
      <svg viewBox="0 0 32 32" fill="none" class="brand-logo">
        <circle cx="16" cy="16" r="13" stroke="#06b6d4" stroke-width="2"/>
        <circle cx="16" cy="16" r="5" fill="#06b6d4" opacity="0.9"/>
        <line x1="16" y1="3" x2="16" y2="7" stroke="#06b6d4" stroke-width="1.5"/>
        <line x1="16" y1="25" x2="16" y2="29" stroke="#06b6d4" stroke-width="1.5"/>
        <line x1="3" y1="16" x2="7" y2="16" stroke="#06b6d4" stroke-width="1.5"/>
        <line x1="25" y1="16" x2="29" y2="16" stroke="#06b6d4" stroke-width="1.5"/>
      </svg>
      <span class="brand-text">ORITEK COMMAND CENTER</span>
      <span class="brand-ver">V4</span>
    </div>
    <div class="topbar-v4-divider"></div>
    <div class="topbar-v4-stat">
      <span class="stat-dot online"></span>
      <span class="stat-label">数据源</span>
      <span class="stat-val">${activeSources}/${totalSources}</span>
    </div>
    <div class="topbar-v4-stat">
      <span class="stat-dot trust"></span>
      <span class="stat-label">可信度</span>
      <span class="stat-val">${credibility}%</span>
    </div>
    <div class="topbar-v4-spacer"></div>
    <div class="topbar-v4-live">
      <span class="live-pulse"></span>LIVE
    </div>
    <div class="topbar-v4-clock" id="bigscreen-clock">--:--:--</div>
  </div>`
}

// ============================================================================
// LEFT: 风险预警
// ============================================================================
function renderRiskAlertItems(alerts: RiskAlert[]): string {
  if (alerts.length === 0) return `<div class="empty-state-v4">暂无风险告警</div>`
  const doubled = [...alerts, ...alerts, ...alerts]
  return `<div class="scroll-list-v4" style="animation-duration:${Math.max(40, alerts.length * 8)}s">
    ${doubled.map(a => `
    <div class="risk-item ${a.severity}">
      <div class="risk-badge">
        <span class="risk-level ${a.severity}">${a.severity === 'critical' ? '紧急' : a.severity === 'high' ? '高危' : '关注'}</span>
        <span class="risk-cat">${esc(a.category)}</span>
      </div>
      <div class="risk-title">${esc(a.title)}</div>
      <div class="risk-summary">${esc(a.summary)}</div>
      <div class="risk-meta">
        <span class="risk-city">📍 ${esc(a.city)}</span>
        <span class="risk-src">${esc(a.source)}</span>
        <span class="risk-time">${esc(a.time)}</span>
      </div>
    </div>`).join('')}
  </div>`
}

// ============================================================================
// LEFT: 欧冶新闻
// ============================================================================
function renderOritekNewsItems(items: OritekMediaItem[]): string {
  if (items.length === 0) return `<div class="empty-state-v4">暂无媒体报道</div>`
  const doubled = [...items, ...items, ...items]
  return `<div class="scroll-list-v4" style="animation-duration:${Math.max(35, items.length * 7)}s">
    ${doubled.map(n => `
    <div class="oritek-item">
      <div class="oritek-dot"></div>
      <div class="oritek-content">
        <div class="oritek-title">${esc(n.title)}</div>
        <div class="oritek-meta">
          <span>${esc(n.source)}</span>
          <span class="oritek-date">${esc(n.date)}</span>
        </div>
      </div>
    </div>`).join('')}
  </div>`
}

// ============================================================================
// CENTER: 全球科技热点 (带城市坐标，用于地图高亮)
// ============================================================================
function renderGeoHotNewsItems(items: GeoHotNews[]): string {
  // 三倍复制用于JS控制无缝滚动
  const tripled = [...items, ...items, ...items]
  return tripled.map((item, i) => `
    <div class="geo-news-item" data-city="${esc(item.city)}" data-lat="${item.lat}" data-lng="${item.lng}" data-heat="${item.heat}" data-idx="${i % items.length}">
      <div class="geo-news-heat" style="width:${item.heat * 10}%">
        <span class="heat-bar" style="width:100%"></span>
      </div>
      <div class="geo-news-body">
        <span class="geo-cat ${item.category === 'AI' ? 'cat-ai' : item.category === '芯片' ? 'cat-chip' : item.category === '自动驾驶' ? 'cat-auto' : 'cat-robo'}">${item.category}</span>
        <span class="geo-city">📍 ${esc(item.city)}</span>
        <span class="geo-title">${esc(item.title)}</span>
      </div>
      <div class="geo-news-meta">
        <span class="geo-src">${esc(item.source)}</span>
        <span class="geo-time">${esc(item.time)}</span>
      </div>
    </div>`).join('')
}

// ============================================================================
// RIGHT: 产业洞察
// ============================================================================
function renderInsightItems(items: IndustryInsightItem[]): string {
  if (items.length === 0) return `<div class="empty-state-v4">暂无产业动态</div>`
  const doubled = [...items, ...items, ...items]
  return `<div class="scroll-list-v4" style="animation-duration:${Math.max(40, items.length * 7)}s">
    ${doubled.map(item => `
    <div class="insight-item">
      <span class="insight-cat ${item.category === '大模型' ? 'cat-ai' : item.category === '具身智能' ? 'cat-robo' : item.category === 'AI芯片' ? 'cat-chip' : 'cat-auto'}">${item.category}</span>
      <div class="insight-content">
        <div class="insight-title">${esc(item.title)}</div>
        <div class="insight-summary">${esc(item.summary)}</div>
        ${item.amount ? `<div class="insight-amount">💰 ${esc(item.amount)}</div>` : ''}
      </div>
    </div>`).join('')}
  </div>`
}

// ============================================================================
// RIGHT: 政策与监管
// ============================================================================
function renderPolicyItems(items: PolicyItem[]): string {
  if (items.length === 0) return `<div class="empty-state-v4">暂无政策动态</div>`
  const doubled = [...items, ...items, ...items]
  return `<div class="scroll-list-v4" style="animation-duration:${Math.max(40, items.length * 7)}s">
    ${doubled.map(item => `
    <div class="policy-item-v4">
      <div class="policy-header-row">
        <span class="policy-country ${item.country === '美国' ? 'country-us' : item.country === '中国' ? 'country-cn' : item.country === '欧盟' ? 'country-eu' : item.country === '日本' ? 'country-jp' : item.country === '韩国' ? 'country-kr' : 'country-global'}">${item.country}</span>
        <span class="policy-impact ${item.impact}">${item.impact === 'severe' ? '⚡重大' : item.impact === 'moderate' ? '◆重要' : '○常规'}</span>
      </div>
      <div class="policy-title-v4">${esc(item.title)}</div>
      <div class="policy-summary-v4">${esc(item.summary)}</div>
      <div class="policy-meta">
        <span>${esc(item.source)}</span>
        <span>${esc(item.time)}</span>
      </div>
    </div>`).join('')}
  </div>`
}

// ============================================================================
// MAP + NEWS SYNC ENGINE
// ============================================================================

/** 渲染D3世界地图 */
async function renderWorldMapV4() {
  if (isMapRendering) return
  isMapRendering = true

  try {
    const svgEl = document.getElementById('globeMapSvg')
    if (!svgEl) { isMapRendering = false; return }

    mapSvg = d3.select('#globeMapSvg')
    const rect = svgEl.getBoundingClientRect()
    mapWidth = Math.max(rect.width, 400)
    mapHeight = Math.round(mapWidth * 0.525)

    mapSvg.attr('viewBox', `0 0 ${mapWidth} ${mapHeight}`)

    const scale = (mapWidth / (2 * Math.PI)) * 0.95
    mapProjection = d3Geo.geoEquirectangular()
      .scale(scale)
      .translate([mapWidth / 2, mapHeight / 2])
      .precision(0.1)

    mapPathGen = d3Geo.geoPath().projection(mapProjection)

    mapSvg.selectAll('*').remove()

    // Defs
    const defs = mapSvg.append('defs')

    // Ocean gradient
    const oceanGrad = defs.append('linearGradient').attr('id', 'v4Ocean').attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%')
    oceanGrad.append('stop').attr('offset', '0%').attr('stop-color', '#020d1c')
    oceanGrad.append('stop').attr('offset', '100%').attr('stop-color', '#061428')

    // Land gradient
    const landGrad = defs.append('linearGradient').attr('id', 'v4Land').attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%')
    landGrad.append('stop').attr('offset', '0%').attr('stop-color', '#0f2340')
    landGrad.append('stop').attr('offset', '100%').attr('stop-color', '#0a1a30')

    // Glow filter
    const glow = defs.append('filter').attr('id', 'v4Glow').attr('x', '-30%').attr('y', '-30%').attr('width', '160%').attr('height', '160%')
    glow.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'blur')
    glow.append('feFlood').attr('flood-color', 'rgba(6, 182, 212, 0.25)').attr('result', 'color')
    glow.append('feComposite').attr('in', 'color').attr('in2', 'blur').attr('operator', 'in').attr('result', 'glow')
    const merge = glow.append('feMerge')
    merge.append('feMergeNode').attr('in', 'glow')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Hotspot pulse animation
    defs.append('filter').attr('id', 'v4Pulse').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
      .append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur')
    // ... simple pulse

    // Background
    mapSvg.append('rect').attr('width', mapWidth).attr('height', mapHeight).attr('fill', 'url(#v4Ocean)')

    const mapGroup = mapSvg.append('g').attr('class', 'map-group-v4')

    // Load world map
    if (!worldMapData) {
      const basePath = '/oritek-world-monitor'
      const urls = [
        `${basePath}/world-110m.json`,
        'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
      ]
      for (const url of urls) {
        try {
          const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
          if (resp.ok) {
            const topology = await resp.json()
            if (topology.objects?.countries) {
              worldMapData = topojson.feature(topology, topology.objects.countries)
              break
            } else if (topology.objects?.land) {
              worldMapData = topojson.feature(topology, topology.objects.land)
              break
            }
          }
        } catch { continue }
      }
    }

    if (worldMapData?.features) {
      mapGroup.selectAll('path.country-v4')
        .data(worldMapData.features)
        .enter().append('path')
        .attr('class', 'country-v4')
        .attr('d', (d: any) => mapPathGen!(d) || '')
        .attr('fill', 'url(#v4Land)')
        .attr('stroke', 'rgba(6, 182, 212, 0.2)')
        .attr('stroke-width', Math.max(0.3, mapWidth / 3200))
    }

    // Graticule
    mapGroup.append('path')
      .datum(d3Geo.geoGraticule()())
      .attr('d', mapPathGen!)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(6, 182, 212, 0.05)')
      .attr('stroke-width', 0.4)

    // Render city markers
    renderCityMarkers()

    console.log(`[Bigscreen v4] Map rendered with ${BASE_GLOBAL_HOT_NEWS.length} hotspots`)
  } catch (e) {
    console.warn('[Bigscreen v4] Map render failed:', e)
  } finally {
    isMapRendering = false
  }
}

interface CityHeat {
  city: string
  lat: number
  lng: number
  count: number
  maxHeat: number
  categories: Set<string>
}

function renderCityMarkers(activeCity?: string) {
  if (!mapSvg || !mapProjection || !mapPathGen) return

  // 删除旧标记
  mapSvg.selectAll('.marker-group-v4').remove()

  // 按城市聚合热度
  const cityMap = new Map<string, CityHeat>()
  for (const news of BASE_GLOBAL_HOT_NEWS) {
    const key = news.city
    if (!cityMap.has(key)) {
      cityMap.set(key, { city: news.city, lat: news.lat, lng: news.lng, count: 0, maxHeat: 0, categories: new Set() })
    }
    const ch = cityMap.get(key)!
    ch.count++
    ch.maxHeat = Math.max(ch.maxHeat, news.heat)
    ch.categories.add(news.category)
  }

  const markerGroup = mapSvg.append('g').attr('class', 'marker-group-v4')

  for (const [_, ch] of cityMap) {
    const projected = mapProjection!([ch.lng, ch.lat])
    if (!projected) continue
    const [x, y] = projected
    if (x < -30 || x > mapWidth + 30 || y < -30 || y > mapHeight + 30) continue

    const isActive = activeCity === ch.city
    const radius = isActive ? 9 : Math.min(7, 3 + ch.count * 0.8)
    const opacity = isActive ? 1 : Math.min(0.9, 0.4 + ch.count * 0.1)

    // Color based on category mix
    let color = '#f59e0b' // default
    if (ch.categories.has('AI') && ch.categories.has('芯片')) color = '#06b6d4'
    else if (ch.categories.has('AI')) color = '#a855f7'
    else if (ch.categories.has('芯片')) color = '#3b82f6'
    else if (ch.categories.has('自动驾驶')) color = '#10b981'
    else if (ch.categories.has('机器人')) color = '#f59e0b'

    // Pulse ring
    markerGroup.append('circle')
      .attr('cx', x).attr('cy', y)
      .attr('r', radius + 4)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', isActive ? 2 : 1)
      .attr('opacity', isActive ? 0.8 : 0.3)
      .attr('class', isActive ? 'marker-pulse-active' : 'marker-pulse-idle')

    // Core dot
    markerGroup.append('circle')
      .attr('cx', x).attr('cy', y)
      .attr('r', radius)
      .attr('fill', color)
      .attr('stroke', '#fff')
      .attr('stroke-width', isActive ? 1.5 : 0.5)
      .attr('opacity', opacity)
      .attr('data-city', ch.city)
      .attr('class', isActive ? 'marker-active' : 'marker-idle')
      .style('cursor', 'pointer')
      .style('transition', 'all 0.6s ease')
      .on('mouseenter', function() {
        // 找到对应新闻并高亮
        highlightNewsForCity(ch.city)
      })

    // Label for larger cities
    if (ch.count >= 2 || isActive) {
      markerGroup.append('text')
        .attr('x', x + radius + 6)
        .attr('y', y + 3)
        .attr('fill', isActive ? '#fff' : '#94a3b8')
        .attr('font-size', isActive ? '11px' : '9px')
        .attr('font-weight', isActive ? '600' : '400')
        .attr('font-family', "'Noto Sans SC', sans-serif")
        .text(ch.city)
    }
  }
}

/** 高亮地图上对应城市的新闻条目 */
function highlightNewsForCity(city: string) {
  const allItems = document.querySelectorAll('.geo-news-item')
  const track = document.getElementById('globe-news-track')
  if (!track) return

  // 暂停自动滚动
  if (newsScrollTimer) clearInterval(newsScrollTimer)

  // 找到匹配城市的第一条新闻
  let targetEl: HTMLElement | null = null
  for (const item of allItems) {
    if ((item as HTMLElement).dataset.city === city) {
      targetEl = item as HTMLElement
      break
    }
  }

  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    // 高亮
    allItems.forEach(el => (el as HTMLElement).style.background = '')
    targetEl.style.background = 'rgba(6, 182, 212, 0.15)'
    targetEl.style.borderLeftColor = '#06b6d4'

    // 更新地图
    renderCityMarkers(city)
    const label = document.getElementById('divider-sync-label')
    if (label) label.textContent = `▸ ${city}`

    // 更新新闻项计数
    const newsIdx = parseInt(targetEl.dataset.idx || '0')
    currentNewsIndex = newsIdx
  }
}

/** 初始化新闻滚动与地图联动 */
function initNewsScrollWithMapSync() {
  const track = document.getElementById('globe-news-track')
  const container = document.getElementById('globe-news-v4')
  if (!track || !container) return

  const allItems = track.querySelectorAll('.geo-news-item')
  if (allItems.length === 0) return

  const uniqueCount = BASE_GLOBAL_HOT_NEWS.length
  if (uniqueCount <= 1) return

  const itemHeight = (allItems[0] as HTMLElement).offsetHeight + 4 // gap
  const intervalMs = Math.max(2500, Math.round(45000 / uniqueCount))

  function step() {
    const targetIdx = currentNewsIndex % uniqueCount
    const targetItem = allItems[targetIdx] as HTMLElement | undefined
    if (!targetItem) { currentNewsIndex = 0; return }

    // 滚动到对应位置
    const scrollTo = targetIdx * itemHeight
    track.style.transform = `translateY(-${scrollTo}px)`
    track.style.transition = 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)'

    // 清除所有高亮
    allItems.forEach(el => {
      (el as HTMLElement).style.background = ''
      ;(el as HTMLElement).style.borderLeftColor = 'transparent'
    })
    targetItem.style.background = 'rgba(6, 182, 212, 0.12)'
    targetItem.style.borderLeftColor = '#06b6d4'

    // 高亮地图对应城市
    const city = targetItem.dataset.city || ''
    if (city && city !== '全球') {
      renderCityMarkers(city)
      const label = document.getElementById('divider-sync-label')
      if (label) label.textContent = `▸ ${city}`
    }

    currentNewsIndex++
    if (currentNewsIndex >= uniqueCount) {
      // 一轮结束，重置到开头
      setTimeout(() => {
        track.style.transition = 'none'
        track.style.transform = 'translateY(0)'
        void track.offsetHeight // force reflow
        track.style.transition = 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)'
        currentNewsIndex = 0
      }, 800)
    }
  }

  // 启动
  setTimeout(step, 500)
  newsScrollTimer = window.setInterval(step, intervalMs)

  // 鼠标悬停暂停
  container.addEventListener('mouseenter', () => {
    if (newsScrollTimer) clearInterval(newsScrollTimer)
  })
  container.addEventListener('mouseleave', () => {
    if (newsScrollTimer) clearInterval(newsScrollTimer)
    newsScrollTimer = window.setInterval(step, intervalMs)
  })

  // 点击新闻项手动切换
  allItems.forEach((item, idx) => {
    ;(item as HTMLElement).addEventListener('click', () => {
      if (newsScrollTimer) clearInterval(newsScrollTimer)
      currentNewsIndex = idx % uniqueCount
      step()
      // 重启自动滚动
      if (newsScrollTimer) clearInterval(newsScrollTimer)
      newsScrollTimer = window.setInterval(step, intervalMs)
    })
  })
}

// ============================================================================
// BOTTOM TICKER
// ============================================================================
function buildTickerItems(indices: IndustryIndex[], stocks: StockData[]): string {
  const items: Array<{ name: string; value: string; changeStr: string; isUp: boolean }> = []
  for (const idx of indices.slice(0, 6)) {
    const isUp = idx.changePercent >= 0
    items.push({
      name: idx.name,
      value: idx.value.toLocaleString(),
      changeStr: `${isUp ? '+' : ''}${idx.changePercent.toFixed(2)}%`,
      isUp,
    })
  }
  const topStocks = stocks.filter(s => ['NVDA', 'TSM', 'QCOM', '9868.HK', '688981.SH'].includes(s.symbol))
  for (const s of topStocks) {
    const isUp = s.changePercent >= 0
    const priceStr = s.price >= 100 ? s.price.toFixed(0) : s.price.toFixed(2)
    items.push({
      name: s.name,
      value: priceStr,
      changeStr: `${isUp ? '+' : ''}${s.changePercent.toFixed(2)}%`,
      isUp,
    })
  }
  const doubled = [...items, ...items]
  return `
  <div class="bottom-ticker-v4">
    <div class="ticker-track-v4">
      ${doubled.map(it => `
        <span class="ticker-item-v4">
          <span class="tkr-name">${esc(it.name)}</span>
          <span class="tkr-val">${it.value}</span>
          <span class="tkr-chg ${it.isUp ? 'up' : 'down'}">${it.changeStr}</span>
        </span>
      `).join('')}
    </div>
  </div>`
}

function renderBottomTicker(html: string): string { return html }

// ============================================================================
// CLOCK & REFRESH
// ============================================================================
function startClock() {
  const tick = () => {
    const el = document.getElementById('bigscreen-clock')
    if (el) el.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false }) + ' CST'
  }
  tick()
  clockTimer = window.setInterval(tick, 1000)
}

function startAutoRefresh() {
  setInterval(async () => {
    try {
      if (newsScrollTimer) clearInterval(newsScrollTimer)
      const [newsResult, indices, stocks] = await Promise.all([
        fetchAllNews(),
        fetchIndustryIndices(),
        fetchStockData(['NVDA', 'TSM', 'QCOM', '9868.HK', '688981.SH']),
      ])
      let oritekNews: OritekMediaItem[] = []
      try {
        const cn = await fetchCompanyNews()
        if (cn.length > 0) {
          oritekNews = cn.map((c: CompanyNews, i: number) => ({
            id: `rss-on-${Date.now()}-${i}`,
            title: c.title,
            summary: c.title,
            source: c.source,
            date: c.time,
            url: c.url || '',
          }))
        }
      } catch { /* fall through */ }
      if (oritekNews.length === 0) oritekNews = BASE_ORITEK_NEWS
      render(newsResult, indices, stocks, oritekNews)
    } catch (err) {
      console.warn('[Bigscreen v4] Auto-refresh failed:', err)
    }
  }, 5 * 60 * 1000)
}

// ============================================================================
// UTILS
// ============================================================================
function esc(str: string): string {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// ============================================================================
// BOOT
// ============================================================================
document.addEventListener('DOMContentLoaded', init)
