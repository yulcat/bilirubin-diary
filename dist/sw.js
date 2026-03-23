const CACHE = 'bilirubin-diary-v1'
const ASSETS = [
  '/bilirubin-diary/',
  '/bilirubin-diary/index.html',
  '/bilirubin-diary/manifest.json',
  '/bilirubin-diary/icon.svg',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(res => {
        if (res.status === 200) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      }).catch(() => cached || new Response('Offline', { status: 503 }))
    })
  )
})
