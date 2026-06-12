// ============================================================
//  openMeteo.js
//  Open-Meteo(無料・APIキー不要・ブラウザから直接呼べる)から
//  「住所→緯度経度」と「日射量データ」を取ってくる係。
//  ※この層は「データを取るだけ」。計算は solar.js に分けている。
// ============================================================

// --- 共通: fetch して JSON にする小さなヘルパー --------------
// （エラー時は分かりやすいメッセージを投げる）
async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Open-Meteo への通信に失敗しました (HTTP ${res.status})`)
  }
  return res.json()
}

// ============================================================
//  ① 住所・地名 → 緯度経度(ジオコーディング)
//  例: 「千葉市」→ [{ name:'千葉市', latitude:35.6, ... }]
// ============================================================
export async function searchAddress(query) {
  if (!query || query.trim() === '') return []

  // encodeURIComponent: 日本語やスペースをURLで安全な形に変換する
  const url =
    `https://geocoding-api.open-meteo.com/v1/search` +
    `?name=${encodeURIComponent(query)}&language=ja&count=5&format=json`

  const data = await getJson(url)

  // 候補が無いときは results キー自体が無いので空配列を返す
  if (!data.results) return []

  // 画面で扱いやすい形に整える
  return data.results.map((r) => ({
    id: r.id,
    name: r.name,                 // 例: 千葉市
    admin1: r.admin1 ?? '',       // 都道府県 例: 千葉県
    admin2: r.admin2 ?? '',       // 市区など
    latitude: r.latitude,
    longitude: r.longitude,
  }))
}

// ============================================================
//  ② 日別の日射量シリーズ(過去〜近未来)
//  past_days で過去の実測、forecast_days で予報を取得。
//  → 「今日のスコア」「今月の累計(脳内設置)」「週間予報」に使う。
//  単位は MJ/m²(後で solar.js が kWh に変換する)。
// ============================================================
export async function fetchDailySeries(lat, lon, { pastDays = 40, forecastDays = 7 } = {}) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=shortwave_radiation_sum` +     // 1日の積算日射量(MJ/m²)
    `&timezone=Asia%2FTokyo` +
    `&past_days=${pastDays}&forecast_days=${forecastDays}`

  const data = await getJson(url)
  return {
    dates: data.daily.time,                       // 例: ['2026-06-09', ...]
    radiationMJ: data.daily.shortwave_radiation_sum, // 例: [4.91, 12.3, ...]
  }
}

// ============================================================
//  ③ 今日の時間別 日射量(W/m²)
//  → 「今日の発電カーブ」グラフ用。0時〜23時の山なりが見える。
// ============================================================
export async function fetchTodayHourly(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=shortwave_radiation` +        // 時間別の瞬間的な日射量(W/m²)
    `&timezone=Asia%2FTokyo&forecast_days=1`

  const data = await getJson(url)
  return {
    times: data.hourly.time,                  // 例: ['2026-06-12T00:00', ...]
    radiationW: data.hourly.shortwave_radiation, // 例: [0, 0, 50, 300, ...]
  }
}

// ============================================================
//  ④ 過去1年ぶんの日別日射量(アーカイブAPI)
//  → 「年間どれくらい発電できるか」と「月別の発電量グラフ」に使う。
//  ERA5(実測ベースの再解析データ)。直近数日は遅延があるため、
//  前年の1年(1/1〜12/31)を丸ごと取得して“平年並みの目安”とする。
// ============================================================
export async function fetchAnnualDaily(lat, lon, year) {
  const start = `${year}-01-01`
  const end = `${year}-12-31`
  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat}&longitude=${lon}` +
    `&start_date=${start}&end_date=${end}` +
    `&daily=shortwave_radiation_sum&timezone=Asia%2FTokyo`

  const data = await getJson(url)
  return {
    dates: data.daily.time,
    radiationMJ: data.daily.shortwave_radiation_sum,
  }
}
