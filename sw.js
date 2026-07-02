// Service Worker - 缓存 world-110m.json 和静态资源，加速地图加载
const CACHE_NAME = 'owm-v1'
const PRECACHE_URLS = [
  '/world-110m.json',
  '/oritek-icon.svg',
]

// Install: 预缓存关键资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching world map data')
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          fetch(url)
            .then(resp => {
              if (resp.ok) return cache.put(url, resp)
              console.warn('[SW] Failed to cache:', url, resp.status)
            })
            .catch(e => console.warn('[SW] Cache fetch failed:', url, e))
        )
      )
    })
  )
  self.skipWaiting()
})

// Activate: 清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Fetch: 地图数据优先缓存，静态资源缓存优先
self.addEventListener('fetch', (event) => {
  const url = event.request.url

  // 只处理同源和 CDN 请求
  if (!url.includes(self.location.origin) &&
      !url.includes('jsdelivr') && !url.includes('unpkg')) return

  // world-110m.json: 缓存优先，网络更新后台同步
  if (url.includes('world-110m.json')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(url).then(cached => {
          const networkFetch = fetch(url).then(resp => {
            if (resp.ok) {
              cache.put(url, resp.clone())
              console.log('[SW] world-110m.json updated in cache')
            }
            return resp
          }).catch(() => null)

          // 优先返回缓存，立即响应
          if (cached) return cached
          // 无缓存则等待网络
          return networkFetch
        })
      )
    )
    return
  }

  // 静态 JS/CSS: 缓存优先，网络备选
  if (url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.svg') || url.endsWith('.woff2')) {
    event.respondWith(
      caches.match(url).then(cached => {
        if (cached) return cached
        return fetch(url).then(resp => {
          if (resp.ok) {
            caches.open(CACHE_NAME).then(c => c.put(url, resp.clone()))
          }
          return resp
        })
      })
    )
    return
  }
})
