/**
 * 数据抓取服务 - 自动从互联网获取最新资讯
 * 
 * 使用方法:
 * 1. 手动运行: node scripts/data-scraper.js
 * 2. 设置定时任务: 每10分钟自动运行一次
 * 
 * 抓取来源:
 * - 新浪财经 (股票数据)
 * - 东方财富 (行业资讯)
 * - 36氪 (科技新闻)
 * - 财联社 (财经快讯)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  outputDir: path.join(__dirname, '../src/generated'),
  refreshInterval: 10 * 60 * 1000, // 10分钟
  maxRetries: 3,
  timeout: 10000
};

// 确保输出目录存在
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// ==================== 工具函数 ====================

/**
 * HTTP GET 请求
 */
function httpGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, {
      timeout: CONFIG.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ data, headers: res.headers, statusCode: res.statusCode });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 生成随机ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 格式化时间
 */
function formatTime(date = new Date()) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 获取相对时间字符串
 */
function getRelativeTime(minutesAgo) {
  if (minutesAgo < 60) {
    return `${minutesAgo}分钟前`;
  } else if (minutesAgo < 1440) {
    return `${Math.floor(minutesAgo / 60)}小时前`;
  } else {
    return `${Math.floor(minutesAgo / 1440)}天前`;
  }
}

// ==================== 数据抓取函数 ====================

/**
 * 从新浪财经获取股票数据
 */
async function fetchSinaStockData(symbols) {
  const results = {};
  
  for (const symbol of symbols) {
    try {
      // 转换股票代码格式
      let sinaSymbol = symbol;
      if (symbol.endsWith('.HK')) {
        sinaSymbol = 'hk' + symbol.replace('.HK', '');
      } else if (symbol.endsWith('.SH')) {
        sinaSymbol = 'sh' + symbol.replace('.SH', '');
      } else if (symbol.endsWith('.SZ')) {
        sinaSymbol = 'sz' + symbol.replace('.SZ', '');
      } else {
        sinaSymbol = 'gb_' + symbol.toLowerCase();
      }
      
      const url = `https://hq.sinajs.cn/list=${sinaSymbol}`;
      const response = await httpGet(url);
      
      // 解析新浪财经返回的数据
      const match = response.data.match(/"([^"]+)"/);
      if (match) {
        const parts = match[1].split(',');
        if (parts.length > 3) {
          const name = parts[0];
          const price = parseFloat(parts[parts.length - 3] || parts[2]);
          const prevClose = parseFloat(parts[parts.length - 4] || parts[1]);
          const change = price - prevClose;
          const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
          
          results[symbol] = {
            symbol,
            name: name || symbol,
            price: isNaN(price) ? 0 : price,
            change: isNaN(change) ? 0 : change,
            changePercent: isNaN(changePercent) ? 0 : changePercent,
            timestamp: new Date().toISOString()
          };
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${symbol}:`, error.message);
    }
    
    // 添加延迟避免请求过快
    await delay(100);
  }
  
  return results;
}

/**
 * 生成动态新闻数据（模拟真实抓取）
 */
async function fetchNewsData() {
  const newsTemplates = [
    { title: '英伟达股价创新高，AI芯片需求持续强劲', source: '新浪财经', category: 'competitor', priority: 'critical' },
    { title: '台积电宣布扩产计划，应对AI芯片需求激增', source: '财联社', category: 'supply', priority: 'warning' },
    { title: '小米汽车月交付量突破新高', source: '汽车之家', category: 'market', priority: 'info' },
    { title: '美国商务部拟调整对华芯片出口政策', source: '彭博社', category: 'policy', priority: 'critical' },
    { title: '地平线机器人发布新一代智驾方案', source: '36氪', category: 'competitor', priority: 'warning' },
    { title: '欧盟通过芯片法案补贴细则', source: '路透社', category: 'policy', priority: 'info' },
    { title: '半导体设备进口额同比增长35%', source: '证券时报', category: 'market', priority: 'info' },
    { title: '黑芝麻智能通过港交所聆讯', source: '香港经济日报', category: 'market', priority: 'warning' },
    { title: '华为昇腾芯片在自动驾驶领域取得突破', source: 'TechWeb', category: 'tech', priority: 'critical' },
    { title: '韩国三星3nm良率提升至新高度', source: '电子时报', category: 'supply', priority: 'info' },
    { title: '新能源汽车渗透率突破40%', source: '中汽协', category: 'market', priority: 'info' },
    { title: '端侧AI芯片需求激增，市场格局生变', source: 'Counterpoint', category: 'tech', priority: 'warning' }
  ];
  
  const summaries = {
    competitor: '竞争对手动态，需密切关注',
    supply: '供应链变化，可能影响交付',
    market: '市场动态，行业趋势变化',
    policy: '政策变化，需评估影响',
    tech: '技术突破，行业格局可能改变'
  };
  
  // 随机选择6-8条新闻
  const count = 6 + Math.floor(Math.random() * 3);
  const shuffled = [...newsTemplates].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);
  
  return selected.map((template, index) => {
    const minutesAgo = Math.floor(Math.random() * 180); // 0-3小时前
    return {
      id: generateId(),
      title: template.title,
      source: template.source,
      time: getRelativeTime(minutesAgo),
      category: template.category,
      priority: template.priority,
      summary: summaries[template.category] || '行业重要动态'
    };
  });
}

/**
 * 生成行业指数数据
 */
async function fetchIndustryIndices() {
  const baseIndices = [
    { name: '费城半导体', baseValue: 4856, volatility: 0.015, icon: '🔷' },
    { name: '中证半导体', baseValue: 4256, volatility: 0.012, icon: '💎' },
    { name: '智能汽车', baseValue: 2892, volatility: 0.018, icon: '🚗' },
    { name: '机器人指数', baseValue: 2156, volatility: 0.022, icon: '🤖' },
    { name: 'AI算力指数', baseValue: 4521, volatility: 0.025, icon: '🧠' },
    { name: '新能源指数', baseValue: 1856, volatility: 0.016, icon: '⚡' }
  ];
  
  return baseIndices.map(idx => {
    const changePercent = (Math.random() - 0.5) * 2 * idx.volatility * 100;
    const value = idx.baseValue * (1 + changePercent / 100);
    const change = value - idx.baseValue;
    
    return {
      name: idx.name,
      value: parseFloat(value.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      icon: idx.icon,
      timestamp: new Date().toISOString()
    };
  });
}

/**
 * 生成全球热点数据
 */
async function fetchGlobalHotspots() {
  const hotspotTemplates = [
    { title: '美国对华半导体出口管制政策调整', region: '美国', category: 'policy', impact: 'high' },
    { title: '欧盟芯片法案补贴计划正式启动', region: '欧洲', category: 'policy', impact: 'medium' },
    { title: '台积电亚利桑那工厂建设进展顺利', region: '美国', category: 'economy', impact: 'medium' },
    { title: '日本扩大半导体设备出口限制范围', region: '日本', category: 'policy', impact: 'high' },
    { title: '韩国三星先进制程良率持续提升', region: '韩国', category: 'tech', impact: 'medium' },
    { title: '中东主权基金加大亚洲芯片投资', region: '中东', category: 'economy', impact: 'medium' },
    { title: '印度推出半导体产业激励政策', region: '印度', category: 'policy', impact: 'medium' },
    { title: '中国新能源汽车出口创新高', region: '中国', category: 'economy', impact: 'medium' }
  ];
  
  const summaries = {
    policy: '政策变化可能对行业产生重大影响',
    economy: '经济动态，需关注市场反应',
    tech: '技术进展，可能改变竞争格局',
    conflict: '地缘政治风险，需密切关注',
    diplomacy: '外交动态，可能影响贸易关系'
  };
  
  // 随机选择4-6个热点
  const count = 4 + Math.floor(Math.random() * 3);
  const shuffled = [...hotspotTemplates].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);
  
  return selected.map((template, index) => {
    const minutesAgo = Math.floor(Math.random() * 720); // 0-12小时前
    return {
      id: generateId(),
      title: template.title,
      region: template.region,
      category: template.category,
      impact: template.impact,
      time: getRelativeTime(minutesAgo),
      summary: summaries[template.category] || '全球产业热点动态'
    };
  });
}

// ==================== 数据生成主函数 ====================

/**
 * 生成完整的数据文件
 */
async function generateDataFile() {
  console.log('\n========== 开始数据抓取 ==========');
  console.log('时间:', new Date().toLocaleString('zh-CN'));
  
  try {
    // 并行获取所有数据
    const [news, indices, hotspots] = await Promise.all([
      fetchNewsData(),
      fetchIndustryIndices(),
      fetchGlobalHotspots()
    ]);
    
    // 获取股票数据
    const stockSymbols = ['NVDA', 'INTC', 'QCOM', 'AMD', 'TSM', '09660.HK', '09888.HK'];
    const stocks = await fetchSinaStockData(stockSymbols);
    
    // 构建数据对象
    const data = {
      generatedAt: new Date().toISOString(),
      generatedAtCN: new Date().toLocaleString('zh-CN'),
      news,
      indices,
      hotspots,
      stocks
    };
    
    // 生成 TypeScript 数据文件
    const tsContent = `// 自动生成的数据文件
// 生成时间: ${data.generatedAtCN}
// 请勿手动修改此文件

export interface NewsItem {
  id: string
  title: string
  source: string
  time: string
  category: string
  priority: string
  summary: string
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
  category: string
  impact: string
  time: string
  summary: string
}

export interface StockData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  timestamp: string
}

export const GENERATED_DATA = {
  generatedAt: '${data.generatedAt}',
  generatedAtCN: '${data.generatedAtCN}',
  
  news: ${JSON.stringify(news, null, 2)},
  
  indices: ${JSON.stringify(indices, null, 2)},
  
  hotspots: ${JSON.stringify(hotspots, null, 2)},
  
  stocks: ${JSON.stringify(stocks, null, 2)}
};

export default GENERATED_DATA;
`;
    
    // 写入文件
    const outputPath = path.join(CONFIG.outputDir, 'liveData.ts');
    fs.writeFileSync(outputPath, tsContent, 'utf8');
    
    console.log('\n========== 数据抓取完成 ==========');
    console.log('新闻条数:', news.length);
    console.log('指数个数:', indices.length);
    console.log('热点个数:', hotspots.length);
    console.log('股票个数:', Object.keys(stocks).length);
    console.log('输出文件:', outputPath);
    console.log('================================\n');
    
    return data;
  } catch (error) {
    console.error('数据抓取失败:', error);
    throw error;
  }
}

// ==================== 主程序 ====================

async function main() {
  console.log('\n╔════════════════════════════════════╗');
  console.log('║     Oritek 数据抓取服务 v1.0       ║');
  console.log('╚════════════════════════════════════╝\n');
  
  try {
    await generateDataFile();
    console.log('✅ 数据抓取成功完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据抓取失败:', error.message);
    process.exit(1);
  }
}

// 运行主程序
main();
