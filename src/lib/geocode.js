// ============================================================
//  geocode.js  ―― 住所 → 緯度経度(番地レベル)。
//  国土地理院(GSI)の住所検索APIを使う。無料・APIキー不要。
//  土地は番地で選ぶ、という要望に応えるための係。
//
//  ※注意(設計上の事実):番地まで特定しても、Open-Meteoの日射量は
//    数km四方の格子の値なので、隣の番地でも日射量の数値自体は同じ。
//    番地精度が効くのは「地図表示の納得感」と「将来の遮蔽計算」。
// ============================================================

// GSIのレスポンスは GeoJSON 形式の配列:
//  [{ geometry:{ coordinates:[経度,緯度] }, properties:{ title:"住所文字列" } }, ...]
export async function geocodeAddress(query) {
  if (!query || query.trim() === '') return []

  const url =
    `https://msearch.gsi.go.jp/address-search/AddressSearch` +
    `?q=${encodeURIComponent(query)}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`住所検索に失敗しました (HTTP ${res.status})`)
  const data = await res.json()
  if (!Array.isArray(data)) return []

  // 画面で扱いやすい形に整える。
  // coordinates は [経度(lon), 緯度(lat)] の順なので取り違えに注意。
  return data.slice(0, 6).map((f, i) => {
    const [lon, lat] = f.geometry.coordinates
    return {
      id: `${f.properties.title}-${i}`,
      name: f.properties.title, // 例: 東京都千代田区千代田１番
      admin1: '',               // GSIは都道府県を分けて返さないので空(titleに含まれる)
      latitude: lat,
      longitude: lon,
    }
  })
}
