/**
 * Oritek World Monitor — 大屏版渲染引擎
 * 复用 dataService 数据层，独立布局，适配 NOC/SOC 监控大屏
 * URL: /oritek-world-monitor/bigscreen.html
 */
import './bigscreen.css'
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
  fetchGlobalHotspots,
  fetchStockData,
  generateTechTrendsFromNews,
  generateSupplyChainFromNews,
  generatePoliciesFromNews,
  generateSentimentFromNews,
  fetchCompanyNews,
  getSourceHealthStats,
  getAllSourceScores,
} from './dataService'

// ====== State ======
const app = document.getElementById('bigscreen-app')!
let clockTimer: number | undefined

// ====== Init ======
async function init() {
  renderSkeleton()

  try {
    const [newsResult, indices, hotspots, stocks] = await Promise.all([
      fetchAllNews(),
      fetchIndustryIndices(),
      fetchGlobalHotspots(),
      fetchStockData(['NVDA', 'QCOM', 'MBLY', '09660.HK', '02533.HK', '603893.SH']),
    ])

    render(newsResult, indices, hotspots, stocks)
    startClock()
    startAutoRefresh()
  } catch (err) {
    console.error('[Bigscreen] Init failed:', err)
    app.innerHTML = `<div class="skeleton"><div class="skeleton-text" style="color:#ef4444">数据加载失败，请刷新页面</div></div>`
  }
}

// ====== Skeleton ======
function renderSkeleton() {
  app.innerHTML = `<div class="skeleton"><div class="skeleton-text">▌ 系统初始化中...</div></div>`
}

// ====== Main Render ======
function render(
  newsResult: { news: NewsItem[]; alerts: AlertItem[]; aiInsights: AIInsight[]; startupFunding: StartupFundingItem[] },
  indices: IndustryIndex[],
  hotspots: GlobalHotspot[],
  stocks: StockData[]
) {
  const { news, alerts, aiInsights, startupFunding } = newsResult

  // Derive data from news
  const techTrends = generateTechTrendsFromNews(news)
  const supplyChain = generateSupplyChainFromNews(news)
  const policies = generatePoliciesFromNews(news)
  const sentiment = generateSentimentFromNews(news)
  const healthStats = getSourceHealthStats()
  const sourceScores = getAllSourceScores()

  // Compute top bar stats
  const activeSources = healthStats.filter(s => s.healthScore >= 50).length
  const totalSources = healthStats.length
  const avgCredibility = sourceScores.length > 0
    ? Math.round(sourceScores.reduce((a, b) => a + b.composite, 0) / sourceScores.length)
    : 0

  // Build ticker items
  const tickerItems = buildTickerItems(indices, stocks)

  app.innerHTML = `
    ${renderTopBar(activeSources, totalSources, avgCredibility)}
    <div class="main-grid">
      <div class="column">
        ${renderAlertPanel(alerts)}
        ${renderIndicesPanel(indices)}
        <div class="panel panel-company">
          <div class="panel-header">
            <span class="icon">📰</span>
            <span class="title">欧冶媒体报道</span>
          </div>
          <div class="panel-body" id="cn-panel-body">
            <div class="empty-state">加载中...</div>
          </div>
        </div>
      </div>
      <div class="column">
        ${renderMapPanel(hotspots, news)}
        ${renderAlertStreamPanel(news)}
        ${renderAIPanel(aiInsights, startupFunding)}
      </div>
      <div class="column">
        ${renderTechRadarPanel(techTrends)}
        ${renderSupplyChainPanel(supplyChain)}
        ${renderPolicyPanel(policies)}
      </div>
    </div>
    ${renderBottomTicker(tickerItems)}
  `

  // Load company news async
  loadCompanyNews()
}

// ====== Top Bar ======
function renderTopBar(activeSources: number, totalSources: number, credibility: number): string {
  return `
  <div class="topbar">
    <div class="topbar-logo">
      <svg viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="12" stroke="#06b6d4" stroke-width="2"/><circle cx="14" cy="14" r="4" fill="#06b6d4"/><line x1="14" y1="2" x2="14" y2="6" stroke="#06b6d4" stroke-width="1.5"/><line x1="14" y1="22" x2="14" y2="26" stroke="#06b6d4" stroke-width="1.5"/><line x1="2" y1="14" x2="6" y2="14" stroke="#06b6d4" stroke-width="1.5"/><line x1="22" y1="14" x2="26" y2="14" stroke="#06b6d4" stroke-width="1.5"/></svg>
      ORITEK COMMAND CENTER
    </div>
    <div class="topbar-divider"></div>
    <div class="topbar-stat">
      <span class="stat-label">数据源</span>
      <span class="stat-value">${activeSources}/${totalSources}</span>
      <span class="stat-label">在线</span>
    </div>
    <div class="topbar-stat">
      <span class="stat-label">可信度</span>
      <span class="stat-value">${credibility}%</span>
    </div>
    <div class="topbar-spacer"></div>
    <div class="topbar-live">
      <div class="topbar-live-dot"></div>
      LIVE
    </div>
    <div class="topbar-time" id="bigscreen-clock">--:--:--</div>
  </div>`
}

// ====== Left Column ======
function renderAlertPanel(alerts: AlertItem[]): string {
  const items = alerts.slice(0, 5)
  const content = items.length > 0
    ? items.map(a => `
      <div class="alert-item ${a.level}">
        <span class="alert-icon">${a.level === 'critical' ? '🔴' : a.level === 'warning' ? '🟡' : '🔵'}</span>
        <div class="alert-text">
          <div class="alert-title">${esc(a.title)}</div>
          <div class="alert-source">${esc(a.description || '')}</div>
        </div>
      </div>`).join('')
    : `<div class="empty-state">暂无风险告警</div>`

  return `
  <div class="panel panel-alert">
    <div class="panel-header">
      <span class="icon">⚠️</span>
      <span class="title">风险预警</span>
      <span class="badge">${alerts.length}</span>
    </div>
    <div class="panel-body">
      <div class="alert-list">${content}</div>
    </div>
  </div>`
}

function renderIndicesPanel(indices: IndustryIndex[]): string {
  const items = indices.slice(0, 6)
  const cards = items.map(i => {
    const isUp = i.changePercent >= 0
    const cls = isUp ? 'ticker-up' : 'ticker-down'
    const sign = isUp ? '+' : ''
    return `
      <div class="index-card">
        <div class="idx-name">${esc(i.name)}</div>
        <div class="idx-value">${i.value.toLocaleString()}</div>
        <div class="idx-change ${cls}">${sign}${i.changePercent.toFixed(2)}%</div>
      </div>`
  }).join('')

  return `
  <div class="panel panel-indices">
    <div class="panel-header">
      <span class="icon">📊</span>
      <span class="title">产业指数</span>
    </div>
    <div class="panel-body">
      <div class="index-grid">${cards}</div>
    </div>
  </div>`
}

async function loadCompanyNews() {
  const body = document.getElementById('cn-panel-body')
  if (!body) return

  try {
    const items = await fetchCompanyNews()
    if (items.length === 0) {
      body.innerHTML = `<div class="empty-state">暂无媒体报道</div>`
      return
    }
    const doubled = [...items, ...items]
    body.innerHTML = `
      <div class="company-news-list" style="animation-duration:${Math.max(20, items.length * 3)}s">
        ${doubled.map(cn => `
          <div class="cn-item">
            <div class="cn-title">${esc(cn.title)}</div>
            <div class="cn-meta">
              ${esc(cn.source)} · ${esc(cn.time)}
              <span class="cn-lang">${cn.url && cn.url.includes('.cn') ? '中文' : 'EN'}</span>
            </div>
          </div>`).join('')}
      </div>`
  } catch {
    body.innerHTML = `<div class="empty-state">加载失败</div>`
  }
}

// ====== Center Column ======
function renderMapPanel(hotspots: GlobalHotspot[], news: NewsItem[]): string {
  const totalHotspots = hotspots.length
  const totalNews = news.length
  const highImpact = hotspots.filter(h => h.impact === 'high').length

  const feedItems = hotspots.slice(0, 8).map(h => `
    <div class="hotspot-item">
      <span class="hs-region">${esc(h.region)}</span>
      <span class="hs-title">${esc(h.title)}</span>
      <span class="hs-impact impact-${h.impact}">${h.impact === 'high' ? 'HIGH' : h.impact === 'medium' ? 'MED' : 'LOW'}</span>
    </div>`).join('')

  return `
  <div class="panel panel-map">
    <div class="panel-header">
      <span class="icon">🌍</span>
      <span class="title">全球态势感知</span>
      <span class="badge">${totalNews} 条情报</span>
    </div>
    <div class="panel-body">
      <div class="map-stats">
        <div class="map-stat-card">
          <div class="stat-num">${totalHotspots}</div>
          <div class="stat-label">全球热点</div>
        </div>
        <div class="map-stat-card">
          <div class="stat-num">${highImpact}</div>
          <div class="stat-label">高影响事件</div>
        </div>
        <div class="map-stat-card">
          <div class="stat-num">${totalNews}</div>
          <div class="stat-label">情报总量</div>
        </div>
      </div>
      <div class="hotspot-feed">${feedItems || '<div class="empty-state">暂无热点数据</div>'}</div>
    </div>
  </div>`
}

function renderAlertStreamPanel(news: NewsItem[]): string {
  const criticalNews = news
    .filter(n => n.priority === 'critical' || n.priority === 'warning')
    .slice(0, 6)

  const items = criticalNews.length > 0
    ? criticalNews.map(n => `
      <div class="alert-stream-item">
        <span class="as-time">${n.time}</span>
        <span class="as-text" title="${esc(n.title)}">${esc(n.title)}</span>
        <span class="as-severity ${n.priority === 'critical' ? 'sev-critical' : 'sev-warning'}">${n.priority === 'critical' ? '严重' : '警告'}</span>
      </div>`).join('')
    : `<div class="empty-state">暂无高危情报</div>`

  return `
  <div class="panel panel-alert-stream">
    <div class="panel-header">
      <span class="icon">🛡️</span>
      <span class="title">实时警戒流</span>
      <span class="badge">${criticalNews.length}</span>
    </div>
    <div class="panel-body">
      <div class="alert-stream-list">${items}</div>
    </div>
  </div>`
}

function renderAIPanel(aiInsights: AIInsight[], startupFunding: StartupFundingItem[]): string {
  const merged = [
    ...aiInsights.slice(0, 4).map(i => ({ title: i.title, type: 'AI' })),
    ...startupFunding.slice(0, 3).map(i => ({ title: `${i.company}: ${i.amount}`, type: 'VC' })),
  ]

  const items = merged.length > 0
    ? merged.map(item => `
      <div class="ai-item">
        <span class="ai-tag">${item.type}</span>
        <span class="ai-text">${esc(item.title)}</span>
      </div>`).join('')
    : `<div class="empty-state">暂无AI/融资动态</div>`

  return `
  <div class="panel panel-ai">
    <div class="panel-header">
      <span class="icon">🤖</span>
      <span class="title">AI洞察 & 融资</span>
      <span class="badge">${merged.length}</span>
    </div>
    <div class="panel-body">
      <div class="ai-insight-list">${items}</div>
    </div>
  </div>`
}

// ====== Right Column ======
function renderTechRadarPanel(techTrends: any[]): string {
  const top = techTrends.slice(0, 7)
  const maxCount = top.length > 0 ? (top[0].count || 1) : 1

  const items = top.length > 0
    ? top.map((t, i) => {
        const pct = Math.round(((t.count || 1) / maxCount) * 100)
        return `
        <div class="tech-item">
          <span class="rank">${i + 1}</span>
          <div class="tech-info">
            <div class="tech-name">${esc(t.name)}</div>
            <div class="tech-bar-wrap"><div class="tech-bar" style="width:${pct}%"></div></div>
          </div>
          <span class="tech-count">${t.count || 0}</span>
        </div>`
      }).join('')
    : `<div class="empty-state">暂无技术趋势数据</div>`

  return `
  <div class="panel panel-radar">
    <div class="panel-header">
      <span class="icon">📡</span>
      <span class="title">技术雷达</span>
    </div>
    <div class="panel-body">
      <div class="tech-radar-list">${items}</div>
    </div>
  </div>`
}

function renderSupplyChainPanel(supplyChain: any[]): string {
  const items = supplyChain.slice(0, 6)
  const content = items.length > 0
    ? items.map(s => {
        const name = s.name || s.node || ''
        const risk = s.riskLevel || s.risk || 'low'
        const riskLabel = risk === 'high' ? '高风险' : risk === 'medium' ? '中风险' : '低风险'
        const riskCls = risk === 'high' ? 'risk-high' : risk === 'medium' ? 'risk-medium' : 'risk-low'
        return `
        <div class="supply-item">
          <span class="sc-name">${esc(name)}</span>
          <span class="sc-risk ${riskCls}">${riskLabel}</span>
        </div>`
      }).join('')
    : `<div class="empty-state">暂无供应链数据</div>`

  return `
  <div class="panel panel-supply">
    <div class="panel-header">
      <span class="icon">🔗</span>
      <span class="title">供应链状态</span>
      <span class="badge">${items.length}</span>
    </div>
    <div class="panel-body">
      <div class="supply-list">${content}</div>
    </div>
  </div>`
}

function renderPolicyPanel(policies: any[]): string {
  const items = policies.slice(0, 5)
  const content = items.length > 0
    ? items.map(p => `
      <div class="policy-item">
        <span class="pol-region">${esc(p.region || p.country || '全球')}</span>
        <span class="pol-text">${esc(p.title || p.text || '')}</span>
      </div>`).join('')
    : `<div class="empty-state">暂无政策动态</div>`

  return `
  <div class="panel panel-policy">
    <div class="panel-header">
      <span class="icon">📋</span>
      <span class="title">合规政策</span>
    </div>
    <div class="panel-body">
      <div class="policy-list">${content}</div>
    </div>
  </div>`
}

// ====== Bottom Ticker ======
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

  const topStocks = stocks.filter(s => ['NVDA', 'TSM', '9868.HK', '688981.SH'].includes(s.symbol))
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
  <div class="bottom-ticker">
    <div class="ticker-track">
      ${doubled.map(it => `
        <div class="ticker-item">
          <span class="ticker-name">${esc(it.name)}</span>
          <span class="ticker-value">${it.value}</span>
          <span class="ticker-change ${it.isUp ? 'ticker-up' : 'ticker-down'}">${it.changeStr}</span>
        </div>`).join('')}
    </div>
  </div>`
}

function renderBottomTicker(tickerHtml: string): string {
  return tickerHtml
}

// ====== Clock ======
function startClock() {
  const tick = () => {
    const el = document.getElementById('bigscreen-clock')
    if (el) {
      const now = new Date()
      el.textContent = now.toLocaleTimeString('zh-CN', { hour12: false }) + ' CST'
    }
  }
  tick()
  clockTimer = window.setInterval(tick, 1000)
}

// ====== Auto Refresh ======
function startAutoRefresh() {
  setInterval(async () => {
    try {
      const [newsResult, indices, hotspots, stocks] = await Promise.all([
        fetchAllNews(),
        fetchIndustryIndices(),
        fetchGlobalHotspots(),
        fetchStockData(['NVDA', 'QCOM', 'MBLY', '09660.HK', '02533.HK', '603893.SH']),
      ])
      render(newsResult, indices, hotspots, stocks)
    } catch (err) {
      console.warn('[Bigscreen] Auto-refresh failed:', err)
    }
  }, 5 * 60 * 1000)
}

// ====== Utils ======
function esc(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ====== Boot ======
document.addEventListener('DOMContentLoaded', init)
