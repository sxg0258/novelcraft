// NovelCraft Service Worker
// 策略：stale-while-revalidate + 网络优先（API）
const VERSION = 'v1'
const STATIC_CACHE = `nc-static-${VERSION}`
const API_CACHE = `nc-api-${VERSION}`

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== STATIC_CACHE && k !== API_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  // API 请求：网络优先，失败时返回缓存
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone()
          caches.open(API_CACHE).then(c => c.put(e.request, clone))
        }
        return res
      }).catch(() => caches.match(e.request))
    )
    return
  }
  // 静态资源：缓存优先
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(STATIC_CACHE).then(c => c.put(e.request, clone))
        }
        return res
      }).catch(() => cached)
      return cached || network
    })
  )
})
