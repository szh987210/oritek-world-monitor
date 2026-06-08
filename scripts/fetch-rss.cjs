/**
 * RSS聚合抓取脚本 — 由 GitHub Actions 定时运行
 * 输出：data/feeds.json（供前端直接读取，零API配额消耗）
 */
const RssParser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const parser = new RssParser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; OritekMonitor/1.0)',
  },
});

// 所有RSS源（与 src/staticData.ts 保持同步）
// 去重后共37个独特URL
const FEED_URLS = [
  // ── 中文科技/AI媒体 ──
  'https://36kr.com/feed',
  'https://www.qbitai.com/rss',
  'https://www.leiphone.com/feed',
  'https://www.tmtpost.com/rss.xml',
  'https://www.geekpark.net/rss',
  'https://www.ifanr.com/feed',
  // ── 英文科技媒体 ──
  'https://techcrunch.com/feed/',
  'https://www.theverge.com/rss/index.xml',
  'https://www.wired.com/feed/rss',
  'https://www.technologyreview.com/feed/',
  'https://feeds.arstechnica.com/arstechnica/index',
  'https://electrek.co/feed/',
  // ── 半导体专项 ──
  'https://www.eetimes.com/feed/',
  'https://semiengineering.com/feed/',
  'https://www.semiconductor-today.com/rss/news.xml',
  'https://www.digitimes.com/rss/daily.xml',
  'https://semiwiki.com/feed/',
  'https://www.semiconductor-digest.com/feed/',
  'https://semianalysis.com/feed/',
  // ── AI/机器人 ──
  'https://blogs.nvidia.com/feed/',
  'https://www.therobotreport.com/feed/',
  'https://openai.com/blog/rss.xml',
  // ── 供应链/产业 ──
  'https://www.supplychaindive.com/feeds/news/',
  // ── 国际新闻（热点流向）──
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://feeds.bbci.co.uk/news/technology/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://www.france24.com/en/rss',
  'https://rss.dw.com/rdf/rss-de-all',
  'https://www3.nhk.or.jp/rss/news/cat0.xml',
  'https://www.nippon.com/en/feed/',
];

/**
 * 带超时的 fetch（Node 18+ 内置 fetch）
 */
async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OritekMonitor/1.0)',
      },
      redirect: 'follow',
    });
    clearTimeout(id);
    return resp;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * 抓取单个RSS源
 */
async function fetchFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    return feed.items.map(item => ({
      title: item.title || '',
      link: item.link || item.guid || '',
      description: (item.description || item.summary || item.contentSnippet || '').replace(/<[^>]+>/g, '').slice(0, 300),
      pubDate: item.pubDate || item.isoDate || item.published || new Date().toISOString(),
      source: feed.title || new URL(url).hostname.replace('www.', ''),
    }));
  } catch (err) {
    // 降级：直接用 https/http 模块抓取 XML 再解析
    try {
      const xmlText = await fetchWithTimeout(url).then(r => r.text());
      const feed = await parser.parseString(xmlText);
      return feed.items.map(item => ({
        title: item.title || '',
        link: item.link || item.guid || '',
        description: (item.description || item.summary || '').replace(/<[^>]+>/g, '').slice(0, 300),
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        source: feed.title || new URL(url).hostname.replace('www.', ''),
      }));
    } catch (err2) {
      console.error(`[WARN] 抓取失败 ${url}: ${err2.message}`);
      return [];
    }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log(`[fetch-rss] 开始抓取 ${FEED_URLS.length} 个RSS源...`);
  const allItems = [];
  const errors = [];

  // 并发限制为 6，避免被封
  const CONCURRENCY = 6;
  for (let i = 0; i < FEED_URLS.length; i += CONCURRENCY) {
    const batch = FEED_URLS.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(url => fetchFeed(url)));
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      } else {
        errors.push(FEED_URLS[i + j]);
      }
    }
  }

  console.log(`[fetch-rss] 抓取完成：成功 ${allItems.length} 条，失败 ${errors.length} 个源`);

  // 去重（标题前30字符）
  const seen = new Set();
  const uniqueItems = allItems.filter(item => {
    const key = (item.title || '').slice(0, 30).toLowerCase().replace(/\s+/g, '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 按发布时间降序
  uniqueItems.sort((a, b) => {
    const da = new Date(a.pubDate).getTime();
    const db = new Date(b.pubDate).getTime();
    return db - da;
  });

  // 保留最新 300 条
  const latest = uniqueItems.slice(0, 300);

  // 写入 data/feeds.json
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const outputPath = path.join(dataDir, 'feeds.json');
  fs.writeFileSync(outputPath, JSON.stringify(latest, null, 2));

  // 写入抓取状态
  const status = {
    lastUpdate: new Date().toISOString(),
    totalItems: latest.length,
    sourcesAttempted: FEED_URLS.length,
    sourcesFailed: errors.length,
    failedSources: errors,
  };
  fs.writeFileSync(path.join(dataDir, 'status.json'), JSON.stringify(status, null, 2));

  console.log(`[fetch-rss] ✅ 写入 ${latest.length} 条到 ${outputPath}`);
}

main().catch(err => {
  console.error('[fetch-rss] 脚本异常退出：', err);
  process.exit(1);
});
