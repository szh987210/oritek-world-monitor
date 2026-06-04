/**
 * Oritek World Monitor — 大屏版渲染引擎 v2
 * 复用 dataService 数据层，NOC/SOC 监控大屏
 * URL: /oritek-world-monitor/bigscreen.html
 *
 * v2 改善:
 * - 左列重排: 风险预警→欧冶媒体→AI洞察→产业指数(迷你走势)
 * - 中列融合: 世界地图+热点标记+实时警戒流滚动
 * - 右列: 技术雷达(趋势箭头)→供应链(滚动)→合规政策(滚动)
 * - 四个模块自动滚动 + 风险脉冲
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
  fetchGlobalHotspots,
  fetchStockData,
  generateTechTrendsFromNews,
  generateSupplyChainFromNews,
  generatePoliciesFromNews,
  fetchCompanyNews,
  getSourceHealthStats,
  getAllSourceScores,
} from './dataService'

// ====== State ======
const app = document.getElementById('bigscreen-app')!
let clockTimer: number | undefined
let worldMapData: any = null
let isMapRendering = false

// 区域→经纬度映射（热点标记用）
const REGION_COORDS: Record<string, [number, number]> = {
  '北美': [-100, 40], '美国': [-100, 40], '加拿大': [-105, 55],
  '欧洲': [10, 50], '欧盟': [10, 50], '德国': [10, 51], '法国': [2, 47], '英国': [-2, 53],
  '亚太': [120, 30], '中国': [105, 35], '中国台湾': [121, 24], '日本': [138, 36], '韩国': [127, 36],
  '东南亚': [110, 5], '印度': [78, 22], '中东': [50, 28],
  '南美': [-60, -15], '巴西': [-55, -10],
  '非洲': [25, 0], '澳洲': [135, -25],
  '全球': [0, 0],
}

function getRegionCoords(region: string): [number, number] {
  for (const [key, coords] of Object.entries(REGION_COORDS)) {
    if (region.includes(key)) return coords
  }
  return [0, 0]
}

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
  const techTrends = generateTechTrendsFromNews(news)
  const supplyChain = generateSupplyChainFromNews(news)
  const policies = generatePoliciesFromNews(news)
  const healthStats = getSourceHealthStats()
  const sourceScores = getAllSourceScores()

  const activeSources = healthStats.filter(s => s.healthScore >= 50).length
  const totalSources = healthStats.length
  const avgCredibility = sourceScores.length > 0
    ? Math.round(sourceScores.reduce((a, b) => a + b.composite, 0) / sourceScores.length)
    : 0

  const tickerItems = buildTickerItems(indices, stocks)

  app.innerHTML = `
    ${renderTopBar(activeSources, totalSources, avgCredibility)}
    <div class="main-grid">
      <div class="column col-left">
        ${renderAlertPanel(alerts)}
        <div class="panel panel-company" id="cn-panel">
          <div class="panel-header">
            <span class="icon">📰</span>
            <span class="title">欧冶媒体报道</span>
          </div>
          <div class="panel-body" id="cn-panel-body">
            <div class="empty-state">加载中...</div>
          </div>
        </div>
        ${renderAIPanel(aiInsights, startupFunding)}
      </div>
      <div class="column col-center">
        ${renderMapAndAlertPanel(hotspots, news)}
      </div>
      <div class="column col-right">
        ${renderTechRadarPanel(techTrends)}
        ${renderSupplyChainPanel(supplyChain)}
        ${renderPolicyPanel(policies)}
      </div>
    </div>
    ${renderBottomTicker(tickerItems)}
  `

  // Async loads
  loadCompanyNews()
  // Render map after DOM update
  setTimeout(() => renderWorldMapD3(hotspots), 200)
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
  const hasCritical = alerts.some(a => a.level === 'critical')
  const pulseClass = hasCritical ? 'pulse-critical' : ''
  const doubled = alerts.length > 3 ? [...alerts, ...alerts] : alerts
  const items = doubled.length > 0
    ? doubled.map(a => `
      <div class="alert-item ${a.level}">
        <span class="alert-icon">${a.level === 'critical' ? '🔴' : a.level === 'warning' ? '🟡' : '🔵'}</span>
        <div class="alert-text">
          <div class="alert-title">${esc(a.title)}</div>
          <div class="alert-source">${esc(a.description || '')}</div>
        </div>
      </div>`).join('')
    : `<div class="empty-state">暂无风险告警</div>`

  const animDuration = Math.max(35, alerts.length * 10)

  return `
  <div class="panel panel-alert ${pulseClass}">
    <div class="panel-header">
      <span class="icon">⚠️</span>
      <span class="title">风险预警</span>
      <span class="badge">${alerts.length}</span>
    </div>
    <div class="panel-body">
      <div class="scroll-list" style="animation-duration:${animDuration}s">
        ${alerts.length > 3 ? items + items : items}
      </div>
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
    const doubled = [...items, ...items, ...items]
    body.innerHTML = `
      <div class="company-news-list scroll-list" style="animation-duration:${Math.max(40, items.length * 6)}s">
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

// ====== Center Column: Globe Map + Tech Hotspots ======
function renderMapAndAlertPanel(hotspots: GlobalHotspot[], news: NewsItem[]): string {
  const totalNews = news.length
  const highImpact = hotspots.filter(h => h.impact === 'high').length

  // Tech hotspots for vertical scroll below map
  const techHotspots = hotspots
    .filter(h => h.summary && h.summary.length > 0)
    .slice(0, 20)
  const doubled = techHotspots.length > 2 ? [...techHotspots, ...techHotspots, ...techHotspots] : techHotspots
  const hotspotsHtml = doubled.length > 0
    ? doubled.map(h => `
      <div class="ghs-item">
        <span class="ghs-impact ${h.impact}">${h.impact === 'high' ? '高' : h.impact === 'medium' ? '中' : '低'}</span>
        <span class="ghs-region">${esc(h.region)}</span>
        <span class="ghs-text">${esc(h.summary || h.title || '')}</span>
      </div>`).join('')
    : `<div class="empty-state">暂无科技热点</div>`

  const hotspotsDur = Math.max(35, techHotspots.length * 5)

  return `
  <div class="panel panel-globe">
    <div class="panel-header">
      <span class="icon">🌍</span>
      <span class="title">全球态势感知</span>
      <span class="badge">${totalNews} 条情报</span>
      <span class="stat-chip">${hotspots.length}热点</span>
      <span class="stat-chip impact-high">${highImpact}高影响</span>
    </div>
    <div class="panel-body globe-body">
      <div class="map-container" id="bigscreen-map">
        <svg id="bigscreenMapSvg" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet"></svg>
      </div>
      <div class="globe-divider"></div>
      <div class="globe-hotspots">
        <div class="ghs-header">
          <span>🔴 全球科技热点</span>
          <span class="ghs-count">${techHotspots.length}条</span>
        </div>
        <div class="ghs-scroll">
          <div class="scroll-list" style="animation-duration:${hotspotsDur}s">
            ${techHotspots.length > 2 ? hotspotsHtml + hotspotsHtml : hotspotsHtml}
          </div>
        </div>
      </div>
    </div>
  </div>`
}

// ====== D3 World Map ======
async function renderWorldMapD3(hotspots: GlobalHotspot[]) {
  if (isMapRendering) return
  isMapRendering = true

  try {
    const svgEl = document.getElementById('bigscreenMapSvg')
    if (!svgEl) { isMapRendering = false; return }

    const svg = d3.select('#bigscreenMapSvg')
    const rect = svgEl.getBoundingClientRect()
    const WIDTH = Math.max(rect.width, 400)
    const HEIGHT = Math.round(WIDTH / 2)

    svg.attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)

    const equirectScale = WIDTH / (2 * Math.PI) * 0.95
    const projection = d3Geo.geoEquirectangular()
      .scale(equirectScale)
      .translate([WIDTH / 2, HEIGHT / 2])
      .precision(0.1)

    const pathGenerator = d3Geo.geoPath().projection(projection)

    svg.selectAll('*').remove()

    // Defs
    const defs = svg.append('defs')

    // Ocean gradient
    const oceanGrad = defs.append('linearGradient').attr('id', 'bsOcean').attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%')
    oceanGrad.append('stop').attr('offset', '0%').attr('stop-color', '#051525')
    oceanGrad.append('stop').attr('offset', '100%').attr('stop-color', '#0a1e35')

    // Land gradient
    const landGrad = defs.append('linearGradient').attr('id', 'bsLand').attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%')
    landGrad.append('stop').attr('offset', '0%').attr('stop-color', '#132d45')
    landGrad.append('stop').attr('offset', '100%').attr('stop-color', '#0c2035')

    // Glow filter
    const filter = defs.append('filter').attr('id', 'bsGlow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%')
    filter.append('feGaussianBlur').attr('stdDeviation', '1.5').attr('result', 'blur')
    filter.append('feFlood').attr('flood-color', 'rgba(6, 182, 212, 0.2)').attr('result', 'color')
    filter.append('feComposite').attr('in', 'color').attr('in2', 'blur').attr('operator', 'in').attr('result', 'glow')
    const merge = filter.append('feMerge')
    merge.append('feMergeNode').attr('in', 'glow')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Hotspot pulse filter
    const pulseFilter = defs.append('filter').attr('id', 'bsPulse')
    pulseFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur')
    const pulseMerge = pulseFilter.append('feMerge')
    pulseMerge.append('feMergeNode').attr('in', 'blur')
    pulseMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Background
    svg.append('rect').attr('width', WIDTH).attr('height', HEIGHT).attr('fill', 'url(#bsOcean)')

    const mapGroup = svg.append('g')

    // Load map data
    if (!worldMapData) {
      const basePath = getBasePath()
      const urls = [
        `${basePath}/world-110m.json`,
        'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
      ]
      for (const url of urls) {
        try {
          const resp = await fetch(url)
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
        } catch { /* continue */ }
      }
    }

    if (worldMapData?.features) {
      mapGroup.selectAll('path.country')
        .data(worldMapData.features)
        .enter().append('path')
        .attr('class', 'country')
        .attr('d', (d: any) => pathGenerator(d) || '')
        .attr('fill', 'url(#bsLand)')
        .attr('stroke', 'rgba(6, 182, 212, 0.25)')
        .attr('stroke-width', Math.max(0.3, WIDTH / 3000))
        .attr('filter', 'url(#bsGlow)')
    }

    // Graticule
    mapGroup.append('path')
      .datum(d3Geo.geoGraticule()())
      .attr('d', pathGenerator)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(6, 182, 212, 0.06)')
      .attr('stroke-width', 0.5)

    // Hotspot markers
    const markerGroup = svg.append('g').attr('class', 'hotspot-markers')
    const uniqueRegions = new Map<string, GlobalHotspot>()
    for (const h of hotspots) uniqueRegions.set(h.region, h)
    const uniqueList = [...uniqueRegions.values()].slice(0, 15)

    for (const h of uniqueList) {
      const coords = getRegionCoords(h.region)
      const [x, y] = projection(coords) || [0, 0]
      if (x < -50 || x > WIDTH + 50 || y < -50 || y > HEIGHT + 50) continue

      const radius = h.impact === 'high' ? 5 : h.impact === 'medium' ? 3.5 : 2.5
      const color = h.impact === 'high' ? '#ef4444' : h.impact === 'medium' ? '#f59e0b' : '#3b82f6'

      // Pulse ring
      markerGroup.append('circle')
        .attr('cx', x).attr('cy', y).attr('r', radius + 4)
        .attr('fill', 'none').attr('stroke', color)
        .attr('stroke-width', 1).attr('opacity', 0.5)
        .attr('class', 'marker-pulse')

      // Core dot
      markerGroup.append('circle')
        .attr('cx', x).attr('cy', y).attr('r', radius)
        .attr('fill', color).attr('stroke', '#fff')
        .attr('stroke-width', 0.5).attr('filter', 'url(#bsPulse)')

      // Label
      markerGroup.append('text')
        .attr('x', x + radius + 5).attr('y', y + 3)
        .attr('fill', '#e2e8f0').attr('font-size', '9px')
        .attr('font-family', 'Noto Sans SC, sans-serif')
        .text(h.region)
    }

    console.log(`[Bigscreen] Map rendered: ${uniqueList.length} hotspot markers`)
  } catch (e) {
    console.warn('[Bigscreen] Map render failed:', e)
  } finally {
    isMapRendering = false
  }
}

// ====== Right Column ======

function renderTechRadarPanel(techTrends: any[]): string {
  const top = techTrends.slice(0, 7)
  const maxCount = top.length > 0 ? (top[0].count || 1) : 1

  const items = top.length > 0
    ? top.map((t, i) => {
        const pct = Math.round(((t.count || 1) / maxCount) * 100)
        // Simulate trend direction from count variance
        const isTrending = i < 3 // top 3 are "hot"
        const trendArrow = isTrending ? '▲' : '▸'
        const trendCls = isTrending ? 'trend-up' : 'trend-stable'
        return `
        <div class="tech-item">
          <span class="rank">${i + 1}</span>
          <div class="tech-info">
            <div class="tech-name">
              ${esc(t.name || '')}
              <span class="tech-trend ${trendCls}">${trendArrow}</span>
            </div>
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
  const doubled = supplyChain.length > 0 ? [...supplyChain, ...supplyChain, ...supplyChain] : []
  const content = doubled.length > 0
    ? doubled.map(s => {
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

  const dur = Math.max(35, supplyChain.length * 8)

  return `
  <div class="panel panel-supply">
    <div class="panel-header">
      <span class="icon">🔗</span>
      <span class="title">供应链状态</span>
      <span class="badge">${supplyChain.length}</span>
    </div>
    <div class="panel-body">
      <div class="scroll-list" style="animation-duration:${dur}s">
        ${supplyChain.length > 3 ? content + content : content}
      </div>
    </div>
  </div>`
}

function renderPolicyPanel(policies: any[]): string {
  const doubled = policies.length > 0 ? [...policies, ...policies, ...policies] : []
  const content = doubled.length > 0
    ? doubled.map(p => `
      <div class="policy-item">
        <span class="pol-region">${esc(p.region || p.country || '全球')}</span>
        <span class="pol-text">${esc(p.title || p.text || '')}</span>
      </div>`).join('')
    : `<div class="empty-state">暂无政策动态</div>`

  const dur = Math.max(30, policies.length * 7)

  return `
  <div class="panel panel-policy">
    <div class="panel-header">
      <span class="icon">📋</span>
      <span class="title">合规政策</span>
    </div>
    <div class="panel-body">
      <div class="scroll-list" style="animation-duration:${dur}s">
        ${policies.length > 3 ? content + content : content}
      </div>
    </div>
  </div>`
}

function renderAIPanel(aiInsights: AIInsight[], startupFunding: StartupFundingItem[]): string {
  const merged = [
    ...aiInsights.slice(0, 6).map(i => ({ title: i.title, type: 'AI' })),
    ...startupFunding.slice(0, 5).map(i => ({ title: `${i.company}: ${i.amount}`, type: 'VC' })),
  ]
  const doubled = merged.length > 0 ? [...merged, ...merged, ...merged] : []
  const items = doubled.length > 0
    ? doubled.map(item => `
      <div class="ai-item">
        <span class="ai-tag">${item.type}</span>
        <span class="ai-text">${esc(item.title)}</span>
      </div>`).join('')
    : `<div class="empty-state">暂无AI/融资动态</div>`

  const dur = Math.max(35, merged.length * 6)

  return `
  <div class="panel panel-ai">
    <div class="panel-header">
      <span class="icon">🤖</span>
      <span class="title">AI洞察 & 融资</span>
      <span class="badge">${merged.length}</span>
    </div>
    <div class="panel-body">
      <div class="scroll-list" style="animation-duration:${dur}s">
        ${merged.length > 3 ? items + items : items}
      </div>
    </div>
  </div>`
}

// ====== Bottom Ticker ======
function buildTickerItems(indices: IndustryIndex[], stocks: StockData[]): string {
  const items: Array<{ name: string; value: string; changeStr: string; isUp: boolean }> = []
  for (const idx of indices.slice(0, 6)) {
    const isUp = idx.changePercent >= 0
    items.push({ name: idx.name, value: idx.value.toLocaleString(), changeStr: `${isUp ? '+' : ''}${idx.changePercent.toFixed(2)}%`, isUp })
  }
  const topStocks = stocks.filter(s => ['NVDA', 'TSM', '9868.HK', '688981.SH'].includes(s.symbol))
  for (const s of topStocks) {
    const isUp = s.changePercent >= 0
    const priceStr = s.price >= 100 ? s.price.toFixed(0) : s.price.toFixed(2)
    items.push({ name: s.name, value: priceStr, changeStr: `${isUp ? '+' : ''}${s.changePercent.toFixed(2)}%`, isUp })
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

function renderBottomTicker(tickerHtml: string): string { return tickerHtml }

// ====== Clock ======
function startClock() {
  const tick = () => {
    const el = document.getElementById('bigscreen-clock')
    if (el) el.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false }) + ' CST'
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function getBasePath(): string {
  return '/oritek-world-monitor'
}

// ====== Boot ======
document.addEventListener('DOMContentLoaded', init)
