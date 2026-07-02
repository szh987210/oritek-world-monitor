/**
 * fetch-finance.cjs — 新浪财经实时行情抓取
 *
 * 在 GitHub Actions 中运行（服务端环境，无 CORS 限制）。
 * 每 15 分钟调用新浪财经 API 获取美股/港股/A股实时价格，
 * 输出 data/finance.json 供前端读取。
 *
 * 用法：node scripts/fetch-finance.cjs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ==================== 配置 ====================

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'finance.json');

// 新浪财经行情代码映射
const STOCK_SINA_MAP = {
  // 美股 (gb_前缀)
  'NVDA':    { sina: 'gb_nvda',    name: '英伟达',     marketCap: '3.2T' },
  'INTC':    { sina: 'gb_intc',    name: '英特尔',     marketCap: '110B' },
  'QCOM':    { sina: 'gb_qcom',    name: '高通',       marketCap: '210B' },
  'AMD':     { sina: 'gb_amd',     name: 'AMD',        marketCap: '220B' },
  'MSFT':    { sina: 'gb_msft',    name: '微软',       marketCap: '3.0T' },
  'GOOGL':   { sina: 'gb_goog',    name: '谷歌',       marketCap: '2.2T' },
  'TSLA':    { sina: 'gb_tsla',    name: '特斯拉',     marketCap: '790B' },
  'TSM':     { sina: 'gb_tsm',     name: '台积电',     marketCap: '900B' },
  'MU':      { sina: 'gb_mu',      name: '美光科技',   marketCap: '110B' },
  'AVGO':    { sina: 'gb_avgo',    name: '博通',       marketCap: '850B' },
  'ASML':    { sina: 'gb_asml',    name: '阿斯麦',     marketCap: '380B' },
  'AMAT':    { sina: 'gb_amat',    name: '应用材料',   marketCap: '170B' },
  'LRCX':    { sina: 'gb_lrcx',    name: '泛林集团',   marketCap: '110B' },
  'KLAC':    { sina: 'gb_klac',    name: '科磊',       marketCap: '100B' },
  'MRVL':    { sina: 'gb_mrvl',    name: '迈威尔',     marketCap: '79B' },
  // 港股
  '09868.HK':  { sina: 'hk09868',  name: '小鹏汽车',   marketCap: '1174亿港元' },
  '09888.HK':  { sina: 'hk09888',  name: '百度集团',   marketCap: '3697亿港元' },
  '00020.HK':  { sina: 'hk00020',  name: '商汤科技',   marketCap: '785亿港元' },
  '09866.HK':  { sina: 'hk09866',  name: '蔚来汽车',   marketCap: '820亿港元' },
  '02015.HK':  { sina: 'hk02015',  name: '理想汽车',   marketCap: '1550亿港元' },
  '09660.HK':  { sina: 'hk09660',  name: '地平线机器人', marketCap: '915亿港元' },
  // A股
  '688981.SH': { sina: 'sh688981', name: '中芯国际',   marketCap: '9537亿' },
  '603501.SH': { sina: 'sh603501', name: '韦尔股份',   marketCap: '1280亿' },
  '002049.SZ': { sina: 'sz002049', name: '紫光国微',   marketCap: '550亿' },
  '300782.SZ': { sina: 'sz300782', name: '卓胜微',     marketCap: '420亿' },
  '688012.SH': { sina: 'sh688012', name: '中微公司',   marketCap: '1150亿' },
  '688396.SH': { sina: 'sh688396', name: '华润微',     marketCap: '640亿' },
  '603893.SH': { sina: 'sh603893', name: '瑞芯微',     marketCap: '520亿' },
  '688608.SH': { sina: 'sh688608', name: '恒玄科技',   marketCap: '200亿' },
  '300223.SZ': { sina: 'sz300223', name: '北京君正',   marketCap: '350亿' },
  '688595.SH': { sina: 'sh688595', name: '芯海科技',   marketCap: '50亿' },
};

// 指数成分股分组（用于计算复合指数）
const INDEX_COMPOSITION = {
  '费城半导体': ['NVDA', 'INTC', 'AMD', 'AVGO', 'QCOM', 'TSM', 'MU', 'ASML', 'AMAT', 'LRCX', 'KLAC', 'MRVL'],
  '中证半导体': ['688981.SH', '603501.SH', '002049.SZ', '300782.SZ', '688012.SH', '688396.SH', '603893.SH', '688608.SH', '300223.SZ', '688595.SH'],
  '智能汽车':   ['TSLA', '09868.HK', '09866.HK', '02015.HK', '09660.HK'],
  '机器人指数': ['NVDA', 'AMD', 'AVGO', 'TSLA', 'MSFT', 'GOOGL'],
  'AI算力指数': ['NVDA', 'AMD', 'AVGO', 'MSFT', 'GOOGL', 'INTC', 'TSM', 'MU'],
  '新能源指数': ['TSLA', '09868.HK', '09866.HK', '02015.HK'],
};

const INDEX_ICONS = {
  '费城半导体': '🔷',
  '中证半导体': '💎',
  '智能汽车':   '🚗',
  '机器人指数': '🤖',
  'AI算力指数': '🧠',
  '新能源指数': '⚡',
};

// ==================== HTTP 请求 ====================

function fetchSinaData(sinaCodes) {
  return new Promise((resolve, reject) => {
    const url = `https://hq.sinajs.cn/list=${sinaCodes.join(',')}`;
    const options = {
      headers: {
        'Referer': 'https://finance.sina.com.cn',
        'User-Agent': 'Mozilla/5.0 (compatible; GitHubActions/1.0)',
      },
      timeout: 15000,
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

// ==================== 解析器 ====================

/**
 * 解析美股行情
 * 新浪美股字段 (已验证 2026-07-02):
 *   [0] name, [1] price, [2] changePercent(%), [3] datetime,
 *   [4] absolute change, [5] open, [6] high, [7] low,
 *   [8] 52w high, [9] 52w low, [10] volume
 */
function parseUS(raw) {
  const parts = raw.split(',');
  if (parts.length < 5) return null;
  const price = parseFloat(parts[1]);
  if (isNaN(price) || price <= 0) return null;
  const changePercent = parseFloat(parts[2]) || 0;
  const absChange = parseFloat(parts[4]) || 0;
  const volume = parseFloat(parts[10]) || 0;
  return {
    name: parts[0].trim(),
    price,
    change: absChange,
    changePercent,
    volume,
  };
}

/**
 * 解析港股行情
 * 新浪港股字段 (已验证 2026-07-02):
 *   [0] 英文名, [1] 中文名(GBK), [2] ?, [3] 昨收(涨跌基准),
 *   [4] 现价, [5-6] ?/?, [7] 涨跌额, [8] 涨跌幅(%),
 *   [9-10] 买/卖价, [11] 成交额
 */
function parseHK(raw) {
  const parts = raw.split(',');
  if (parts.length < 9) return null;
  const price = parseFloat(parts[4]);
  if (isNaN(price) || price <= 0) return null;
  const change = parseFloat(parts[7]) || 0;
  const changePercent = parseFloat(parts[8]) || 0;
  return {
    name: parts[0].trim(),
    price,
    change,
    changePercent,
    volume: 0, // 港股 Sina API 不提供成交量在基本字段中
  };
}

/**
 * 解析A股行情
 * 格式: name,open,prev_close,price,high,low,bid,ask,volume,turnover,...
 */
function parseCN(raw) {
  const parts = raw.split(',');
  if (parts.length < 9) return null;
  const name = parts[0].trim();
  const open = parseFloat(parts[1]) || 0;
  const prevClose = parseFloat(parts[2]) || 0;
  const price = parseFloat(parts[3]) || 0;
  const volume = parseFloat(parts[8]) || 0;
  const change = prevClose > 0 ? price - prevClose : (open > 0 ? price - open : 0);
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
  return {
    name,
    price,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePct * 100) / 100,
    volume,
  };
}

function parseSinaResponse(code, raw) {
  if (!raw || raw.length < 20) return null;
  if (code.startsWith('gb_')) return parseUS(raw);
  if (code.startsWith('hk')) return parseHK(raw);
  if (code.startsWith('sh') || code.startsWith('sz')) return parseCN(raw);
  // 默认尝试美股格式
  return parseUS(raw);
}

// ==================== 主逻辑 ====================

async function main() {
  console.log(`[fetch-finance] 开始抓取实时行情... ${new Date().toISOString()}`);

  // 收集所有要查询的sina代码
  const stockEntries = Object.entries(STOCK_SINA_MAP);
  const allCodes = stockEntries.map(([, cfg]) => cfg.sina);

  // 分批请求（URL长度限制，每批25个）
  const BATCH_SIZE = 25;
  const batches = [];
  for (let i = 0; i < allCodes.length; i += BATCH_SIZE) {
    batches.push(allCodes.slice(i, i + BATCH_SIZE));
  }

  const rawResults = {};
  for (const batch of batches) {
    try {
      const data = await fetchSinaData(batch);
      // 解析返回的 var hq_str_xxx="..." 行
      const lines = data.split('\n');
      for (const line of lines) {
        const match = line.match(/var hq_str_(\w+)="(.*)"/);
        if (match) {
          rawResults[match[1]] = match[2];
        }
      }
      console.log(`  [fetch-finance] 批次完成 (${batch.length} 只): 收到 ${Object.keys(rawResults).length} 条`);
    } catch (err) {
      console.error(`  [fetch-finance] 批次失败: ${err.message}`);
    }
  }

  // 解析每只股票
  const stocks = {};
  let successCount = 0;
  for (const [symbol, cfg] of stockEntries) {
    const raw = rawResults[cfg.sina];
    if (!raw) {
      console.warn(`  [fetch-finance] 无数据: ${symbol} (${cfg.sina})`);
      continue;
    }
    const parsed = parseSinaResponse(cfg.sina, raw);
    if (!parsed || parsed.price <= 0) {
      console.warn(`  [fetch-finance] 解析失败: ${symbol} (${cfg.sina})`);
      continue;
    }
    stocks[symbol] = {
      symbol,
      name: cfg.name,
      price: parsed.price,
      change: parsed.change,
      changePercent: parsed.changePercent,
      volume: parsed.volume || 0,
      marketCap: cfg.marketCap,
      timestamp: new Date().toISOString(),
    };
    successCount++;
  }

  // 计算行业指数（基于成分股涨跌幅加权平均）
  const indices = [];
  for (const [name, constituents] of Object.entries(INDEX_COMPOSITION)) {
    const validStocks = constituents
      .map(s => stocks[s])
      .filter(Boolean);

    if (validStocks.length === 0) continue;

    // 用等权均价计算指数涨跌幅
    const avgChangePct = validStocks.reduce((sum, s) => sum + s.changePercent, 0) / validStocks.length;
    const avgPrice = validStocks.reduce((sum, s) => sum + s.price, 0) / validStocks.length;

    // 指数基准值（以成分股价格总和为参考，涨跌幅驱动变化）
    const baseValues = {
      '费城半导体': 4856.32,
      '中证半导体': 4256.78,
      '智能汽车':   2892.45,
      '机器人指数': 2156.89,
      'AI算力指数': 4521.89,
      '新能源指数': 1856.32,
    };
    const base = baseValues[name] || 1000;
    // 基于涨跌幅调整基准值：value = base * (1 + avgChangePct / 100 * 衰减系数)
    // 衰减系数确保指数值不会因单日波动偏离太远（长期追踪用）
    const dampingFactor = 0.3;
    const value = base * (1 + avgChangePct / 100 * dampingFactor);

    indices.push({
      name,
      value: Math.round(value * 100) / 100,
      change: Math.round(avgChangePct * avgPrice / 100 * 100) / 100,
      changePercent: Math.round(avgChangePct * 100) / 100,
      icon: INDEX_ICONS[name] || '📊',
      timestamp: new Date().toISOString(),
    });
  }

  // 输出
  const output = {
    stocks,
    indices,
    lastUpdate: new Date().toISOString(),
    fetchedCount: successCount,
    totalCount: stockEntries.length,
  };

  // 写入文件
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`[fetch-finance] 完成: ${successCount}/${stockEntries.length} 只股票, ${indices.length} 个指数`);
  console.log(`[fetch-finance] 输出: ${OUTPUT_FILE}`);

  // 输出简要摘要用于 commit message
  const upStocks = Object.values(stocks).filter(s => s.change > 0).length;
  const downStocks = Object.values(stocks).filter(s => s.change < 0).length;
  console.log(`[fetch-finance] 摘要: ↑${upStocks} ↓${downStocks} →${successCount - upStocks - downStocks}`);
}

main().catch(err => {
  console.error('[fetch-finance] 致命错误:', err);
  process.exit(1);
});
