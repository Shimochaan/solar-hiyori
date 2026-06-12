import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css' // 地図の見た目に必要なCSS(忘れると崩れる)

// ============================================================
//  選択した場所を地図にピン表示するコンポーネント。
//  Leaflet は素のJSライブラリなので、React の「描画後に1回だけ実行」
//  の仕組み(useEffect)を使って地図を作り、緯度経度が変わったら動かす。
//  useRef = 再描画をまたいで“同じ地図インスタンス”を覚えておく入れ物。
// ============================================================
export default function MapView({ lat, lon, label }) {
  const containerRef = useRef(null) // 地図を描くdiv
  const mapRef = useRef(null)       // Leaflet地図の本体
  const markerRef = useRef(null)    // ピン

  // --- 初回だけ地図を生成する ---
  useEffect(() => {
    if (mapRef.current) return // すでに作っていれば何もしない

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false, // ページスクロール中に地図が誤ズームしないように
      zoomControl: true,
    }).setView([lat, lon], 16) // 16=番地が見えるズーム
    // OpenStreetMap のタイル(無料・キー不要)を背景に敷く
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)

    markerRef.current = L.marker([lat, lon]).addTo(map)
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
    mapRef.current.setView([lat, lon], 16)
    markerRef.current.setLatLng([lat, lon])
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
