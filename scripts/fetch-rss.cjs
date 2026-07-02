/**
 * RSS聚合抓取脚本 — 由 GitHub Actions 定时运行
 * 输出：
 *   data/feeds.json  — 供前端直接读取（零API配额消耗）
 *   data/health.json — 源健康状态（供监控自动化使用）
 *   data/status.json — 本次抓取摘要
 *
 * 四层防御：L1健康监控 | L2增量合并防数据丢失 | L3源降级标记 | L4预留自愈接口
 */
const RssParser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new RssParser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; OritekMonitor/1.0)',
  },
});

// ─── 源分类映射 ───
const SOURCE_CATEGORY = {
  '36kr.com': 'ai-tech',
  'qbitai.com': 'ai-tech',
  'leiphone.com': 'ai-tech',
  'tmtpost.com': 'ai-tech',
  'geekpark.net': 'ai-tech',
  'ifanr.com': 'ai-tech',
  'techcrunch.com': 'ai-tech',
  'theverge.com': 'ai-tech',
  'wired.com': 'ai-tech',
  'technologyreview.com': 'ai-tech',
  'arstechnica.com': 'ai-tech',
  'electrek.co': 'ai-tech',
  'eetimes.com': 'semiconductor',
  'semiengineering.com': 'semiconductor',
  'semiconductor-today.com': 'semiconductor',
  'digitimes.com': 'semiconductor',
  'semiwiki.com': 'semiconductor',
  'semiconductor-digest.com': 'semiconductor',
  'semianalysis.com': 'semiconductor',
  'nvidia.com': 'ai-tech',
  'therobotreport.com': 'ai-tech',
  'openai.com': 'ai-tech',
  'supplychaindive.com': 'supply-chain',
  'bbci.co.uk': 'international',
  'aljazeera.com': 'international',
  'france24.com': 'international',
  'dw.com': 'international',
  'nhk.or.jp': 'international',
  'nippon.com': 'international',
};

function getCategory(url) {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    for (const [key, cat] of Object.entries(SOURCE_CATEGORY)) {
      if (host.includes(key)) return cat;
    }
  } catch {}
  return 'other';
}

const FEED_URLS = [
  'https://36kr.com/feed',
  'https://www.qbitai.com/rss',
  'https://www.leiphone.com/feed',
  'https://www.tmtpost.com/rss.xml',
  'https://www.geekpark.net/rss',
  'https://www.ifanr.com/feed',
  'https://techcrunch.com/feed/',
  'https://www.theverge.com/rss/index.xml',
  'https://www.wired.com/feed/rss',
  'https://www.technologyreview.com/feed/',
  'https://feeds.arstechnica.com/arstechnica/index',
  'https://electrek.co/feed/',
  'https://www.eetimes.com/feed/',
  'https://semiengineering.com/feed/',
  'https://www.semiconductor-today.com/rss/news.xml',
  'https://www.digitimes.com/rss/daily.xml',
  'https://semiwiki.com/feed/',
  'https://www.semiconductor-digest.com/feed/',
  'https://semianalysis.com/feed/',
  'https://blogs.nvidia.com/feed/',
  'https://www.therobotreport.com/feed/',
  'https://openai.com/blog/rss.xml',
  'https://www.supplychaindive.com/feeds/news/',
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://feeds.bbci.co.uk/news/technology/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://www.france24.com/en/rss',
  'https://rss.dw.com/rdf/rss-de-all',
  'https://www3.nhk.or.jp/rss/news/cat0.xml',
  'https://www.nippon.com/en/feed/',
];

// ─── 健康状态判定阈值 ───
const DEGRADED_THRESHOLD = 3;  // 连续失败3次 → degraded
const DEAD_THRESHOLD = 6;      // 连续失败6次 → dead

// ─── 工具函数 ───
const DATA_DIR = path.join(__dirname, '..', 'data');
const FEEDS_PATH = path.join(DATA_DIR, 'feeds.json');
const HEALTH_PATH = path.join(DATA_DIR, 'health.json');
const STATUS_PATH = path.join(DATA_DIR, 'status.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadJSON(filePath, fallback = null) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.warn(`[WARN] 读取 ${filePath} 失败: ${e.message}`);
  }
  return fallback;
}

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OritekMonitor/1.0)' },
      redirect: 'follow',
    });
    clearTimeout(id);
    return resp;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ─── L1 健康监控：加载历史状态 ───
function loadPreviousHealth() {
  const prev = loadJSON(HEALTH_PATH);
  if (!prev || !prev.sources) return {};
  const map = {};
  for (const [name, src] of Object.entries(prev.sources)) {
    map[name] = {
      url: src.url,
      category: src.category,
      consecutive_failures: src.consecutive_failures || 0,
      total_attempts: src.total_attempts || 0,
      total_successes: src.total_successes || 0,
      avg_latency_ms: src.avg_latency_ms || 0,
      avg_items: src.avg_items || 0,
      last_success: src.last_success || null,
      last_failure: src.last_failure || null,
      last_error: src.last_error || null,
    };
  }
  return map;
}

// ─── L2 增量合并：加载旧 feeds 防止空覆盖 ───
function loadPreviousFeeds() {
  const prev = loadJSON(FEEDS_PATH, []);
  return Array.isArray(prev) ? prev : [];
}

// ─── 抓取单个源（返回 { items, latencyMs, error }）─── // #18: 添加15s整体超时，防止 rss-parser 卡死慢源
async function fetchFeed(url) {
  const FEED_TIMEOUT = 15000;

  const fetchWithDeadline = async () => {
    const startTime = Date.now();
    try {
      const feed = await parser.parseURL(url);
      const latency = Date.now() - startTime;
      const items = feed.items.map(item => ({
        title: item.title || '',
        link: item.link || item.guid || '',
        description: (item.description || item.summary || item.contentSnippet || '').replace(/<[^>]+>/g, '').slice(0, 300),
        pubDate: item.pubDate || item.isoDate || item.published || new Date().toISOString(),
        source: feed.title || new URL(url).hostname.replace('www.', ''),
      }));
      return { items, latencyMs: latency, error: null };
    } catch (err) {
      // 降级：直接 fetch XML 再 parse
      try {
        const t0 = Date.now();
        const xmlText = await fetchWithTimeout(url, 8000).then(r => r.text());
        const feed = await parser.parseString(xmlText);
        const latency = Date.now() - t0;
        const items = feed.items.map(item => ({
          title: item.title || '',
          link: item.link || item.guid || '',
          description: (item.description || item.summary || '').replace(/<[^>]+>/g, '').slice(0, 300),
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          source: feed.title || new URL(url).hostname.replace('www.', ''),
        }));
        return { items, latencyMs: latency, error: null };
      } catch (err2) {
        const latency = Date.now() - startTime;
        return { items: [], latencyMs: latency, error: err2.message || String(err2) };
      }
    }
  };

  const timeoutPromise = new Promise(resolve =>
    setTimeout(() => resolve({ items: [], latencyMs: FEED_TIMEOUT, error: `timeout after ${FEED_TIMEOUT}ms` }), FEED_TIMEOUT)
  );

  return Promise.race([fetchWithDeadline(), timeoutPromise]);
}

// ─── 主函数 ───
async function main() {
  console.log(`[fetch-rss] 开始抓取 ${FEED_URLS.length} 个RSS源...`);
  ensureDataDir();

  // 加载历史状态
  const prevHealth = loadPreviousHealth();
  const prevFeeds = loadPreviousFeeds();

  // 初始化本次健康记录
  const healthRecords = {};
  const allItems = [];
  const now = new Date().toISOString();

  // 并发抓取（批次大小 6）
  const CONCURRENCY = 6;
  for (let i = 0; i < FEED_URLS.length; i += CONCURRENCY) {
    const batch = FEED_URLS.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(url => fetchFeed(url)));

    for (let j = 0; j < results.length; j++) {
      const url = batch[j];
      const sourceName = (() => {
        try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
      })();
      const category = getCategory(url);
      const prev = prevHealth[sourceName] || { consecutive_failures: 0, total_attempts: 0, total_successes: 0, avg_latency_ms: 0, avg_items: 0 };

      const result = results[j];
      if (result.status === 'fulfilled') {
        const { items, latencyMs, error } = result.value;
        const success = error === null && items.length > 0;

        if (success) {
          allItems.push(...items);
          const newTotal = prev.total_successes + 1;
          healthRecords[sourceName] = {
            url,
            category,
            status: 'ok',
            consecutive_failures: 0,
            total_attempts: prev.total_attempts + 1,
            total_successes: prev.total_successes + 1,
            avg_latency_ms: Math.round((prev.avg_latency_ms * prev.total_successes + latencyMs) / newTotal),
            avg_items: Math.round((prev.avg_items * prev.total_successes + items.length) / newTotal),
            last_success: now,
            last_failure: prev.last_failure,
            last_error: null,
          };
          console.log(`  ✅ ${sourceName}: ${items.length}条, ${latencyMs}ms`);
        } else {
          const consecutive = prev.consecutive_failures + 1;
          healthRecords[sourceName] = {
            url,
            category,
            status: consecutive >= DEAD_THRESHOLD ? 'dead' : consecutive >= DEGRADED_THRESHOLD ? 'degraded' : 'ok',
            consecutive_failures: consecutive,
            total_attempts: prev.total_attempts + 1,
            total_successes: prev.total_successes,
            avg_latency_ms: prev.avg_latency_ms,
            avg_items: prev.avg_items,
            last_success: prev.last_success,
            last_failure: now,
            last_error: error || 'empty items',
          };
          console.warn(`  ⚠️ ${sourceName}: 空内容 (连续失败${consecutive}次)`);
        }
      } else {
        const consecutive = prev.consecutive_failures + 1;
        healthRecords[sourceName] = {
          url,
          category,
          status: consecutive >= DEAD_THRESHOLD ? 'dead' : consecutive >= DEGRADED_THRESHOLD ? 'degraded' : 'ok',
          consecutive_failures: consecutive,
          total_attempts: prev.total_attempts + 1,
          total_successes: prev.total_successes,
          avg_latency_ms: prev.avg_latency_ms,
          avg_items: prev.avg_items,
          last_success: prev.last_success,
          last_failure: now,
          last_error: result.reason?.message || String(result.reason),
        };
        console.warn(`  ❌ ${sourceName}: ${result.reason?.message || result.reason} (连续失败${consecutive}次)`);
      }
    }
    // 批次间短暂延迟，避免被封
    if (i + CONCURRENCY < FEED_URLS.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // ─── 去重 + 排序 ───
  const seen = new Set();
  const uniqueItems = allItems.filter(item => {
    const key = (item.title || '').slice(0, 30).toLowerCase().replace(/\s+/g, '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  uniqueItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  const latest = uniqueItems.slice(0, 300);

  // ─── L2 增量合并：新数据 ∪ 旧数据 ───
  const mergedItems = [...latest];
  const newLinks = new Set(latest.map(i => i.link));
  const nowTs = Date.now();
  const STALE_MS = 24 * 60 * 60 * 1000; // 超过24小时标记stale
  for (const oldItem of prevFeeds) {
    if (newLinks.has(oldItem.link)) continue;
    const age = nowTs - new Date(oldItem.pubDate).getTime();
    const item = { ...oldItem };
    if (age > STALE_MS) {
      item._stale = true;
    }
    mergedItems.push(item);
  }

  // 按时间排序，stale 条目靠后
  mergedItems.sort((a, b) => {
    if (a._stale && !b._stale) return 1;
    if (!a._stale && b._stale) return -1;
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
  });

  const finalItems = mergedItems.slice(0, 500);

  // ─── 写入 feeds.json ───
  fs.writeFileSync(FEEDS_PATH, JSON.stringify(finalItems, null, 2));
  console.log(`[fetch-rss] ✅ feeds.json: ${finalItems.length}条 (本次新增${latest.length}, 合并历史${finalItems.length - latest.length})`);

  // ─── 写入 health.json ───
  const healthSummary = { total: FEED_URLS.length, healthy: 0, degraded: 0, dead: 0 };
  for (const rec of Object.values(healthRecords)) {
    if (rec.status === 'ok') healthSummary.healthy++;
    else if (rec.status === 'degraded') healthSummary.degraded++;
    else if (rec.status === 'dead') healthSummary.dead++;
  }
  const overallStatus = healthSummary.dead > 0 ? 'critical' : healthSummary.degraded > 0 ? 'degraded' : 'healthy';

  const health = {
    timestamp: now,
    status: overallStatus,
    summary: healthSummary,
    sources: healthRecords,
  };
  fs.writeFileSync(HEALTH_PATH, JSON.stringify(health, null, 2));
  console.log(`[fetch-rss] ✅ health.json: ${overallStatus} (healthy=${healthSummary.healthy}, degraded=${healthSummary.degraded}, dead=${healthSummary.dead})`);

  // ─── 写入 status.json ───
  const status = {
    lastUpdate: now,
    totalItems: finalItems.length,
    freshItems: latest.length,
    mergedItems: finalItems.length - latest.length,
    sourcesAttempted: FEED_URLS.length,
    sourcesHealthy: healthSummary.healthy,
    sourcesDegraded: healthSummary.degraded,
    sourcesDead: healthSummary.dead,
  };
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));

  console.log(`[fetch-rss] ✅ 全部完成`);
}

main().catch(err => {
  console.error('[fetch-rss] 脚本异常退出：', err);
  process.exit(1);
});
