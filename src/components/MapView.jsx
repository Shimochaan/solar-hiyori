import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css' // 地図の見た目に必要なCSS(忘れると崩れる)

// ============================================================
//  選択した場所を地図にピン表示するコンポーネント。
//  Leaflet は素のJSライブラリなので、React の「描画後に1回だけ実行」
//  の仕組み(useEffect)を使って地図を作り、緯度経度が変わったら動かす。
//  useRef = 再描画をまたいで“同じ地図インスタンス”を覚えておく入れ物。
// ============================================================
// 自前のオレンジ・ピン(Leaflet標準の画像アイコンはバンドル時に欠けやすいので
// HTML(divIcon)で描く。これで「ピンが刺さってるか分からない」問題も解消)。
const pinIcon = L.divIcon({
  className: '', // 余計なデフォルトスタイルを付けない
  html: `
    <div style="position:relative;transform:translate(-50%,-100%);">
      <svg width="34" height="46" viewBox="0 0 34 46" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 0C7.6 0 0 7.6 0 17c0 12 17 29 17 29s17-17 17-29C34 7.6 26.4 0 17 0z"
          fill="#f97316" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="17" cy="17" r="6.5" fill="#ffffff"/>
      </svg>
    </div>`,
  iconSize: [34, 46],
  iconAnchor: [0, 0], // transformで位置合わせするのでここは0
})

export default function MapView({ lat, lon, label }) {
  const containerRef = useRef(null) // 地図を描くdiv
  const mapRef = useRef(null)       // Leaflet地図の本体
  const markerRef = useRef(null)    // ピン
  const circleRef = useRef(null)    // 場所のハイライト円

  // --- 初回だけ地図を生成する ---
  useEffect(() => {
    if (mapRef.current) return // すでに作っていれば何もしない

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false, // ページスクロール中に地図が誤ズームしないように
      zoomControl: true,
    }).setView([lat, lon], 17) // 17=建物の輪郭まで見えるズーム
    // CARTO Voyager タイル(無料・キー不要・クリーンで見やすい配色)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: '© OpenStreetMap © CARTO',
    }).addTo(map)

    // 場所をやわらかく囲むハイライト円(ピンだけより「ここ」が分かりやすい)
    circleRef.current = L.circle([lat, lon], {
      radius: 28, color: '#f97316', weight: 2, fillColor: '#f97316', fillOpacity: 0.12,
    }).addTo(map)
    markerRef.current = L.marker([lat, lon], { icon: pinIcon }).addTo(map)
    mapRef.current = map

    // 後片付け:このコンポーネントが消えるとき地図も破棄する(メモリリーク防止)
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, []) // 空配列=初回マウント時のみ

  // --- 緯度経度が変わったらピンと表示位置を動かす ---
  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.setView([lat, lon], 17)
    markerRef.current.setLatLng([lat, lon])
    circleRef.current.setLatLng([lat, lon])
  }, [lat, lon])

  return (
    <div className="card p-3">
      <div
        ref={containerRef}
        className="h-48 w-full overflow-hidden rounded-xl sm:h-64"
        style={{ background: '#eef2f5' }}
      />
      <p className="mt-2 px-1 text-xs text-gray-500">
        {label}
        <span className="ml-1 text-gray-400">
          (緯度 {lat.toFixed(5)}, 経度 {lon.toFixed(5)})
        </span>
      </p>
    </div>
  )
}
