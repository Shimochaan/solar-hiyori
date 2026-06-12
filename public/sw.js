// ============================================================
//  Service Worker ―― PWA(ホーム画面追加・オフライン起動)の係。
//
//  方針(このアプリ特有の事情):
//   ・Cesium(/cesium/ 配下=13MB超)と外部API(Open-Meteo/地理院/OSM/Cesium ion)
//     は重い/動的なのでキャッシュしない。ネット任せにする。
//   ・アプリ本体(HTML+JS+CSS+アイコン=同一オリジン)だけをキャッシュして、
//     2回目以降の起動を速く・オフラインでも画面が出るようにする。
//
//  キャッシュ戦略:
//   ・ページ遷移(navigate): ネット優先 → 失敗時にキャッシュ済みの '/' を返す。
//   ・静的アセット(/assets/ 等): stale-while-revalidate
//     (まずキャッシュを即返し、裏で新しいものを取って次回に備える)。
// ============================================================
const CACHE = 'solar-hiyori-v1' // 中身を変えたら数字を上げる(古いキャッシュを掃除)
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/pwa-192.png']

// インストール時:アプリの骨組みを先読みキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  )
})

// 有効化時:古いバージョンのキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // 取得(GET)以外は素通り

  const url = new URL(request.url)

  // 別オリジン(API・地図タイル・Cesium ion等)はキャッシュせずネット任せ
  if (url.origin !== self.location.origin) return
  // Cesiumの重い静的アセットもキャッシュ対象外(容量が大きすぎる)
  if (url.pathname.startsWith('/cesium/')) return

  // ページ遷移はネット優先 → オフライン時はキャッシュ済みトップを返す
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    )
    return
  }

  // 同一オリジンの静的アセットは stale-while-revalidate
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) cache.put(request, res.clone())
          return res
        })
        .catch(() => cached) // オフラインならキャッシュにフォールバック
      return cached || network
    })
  )
})
