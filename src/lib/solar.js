// ============================================================
//  solar.js  ―― このアプリの「心臓部」。発電量の計算をまとめた係。
//  ここだけ読めば「どういう理屈で発電量を出しているか」が分かる。
//  ※純粋な計算関数だけ。通信(fetch)も画面(React)も持たない。
// ============================================================

import { sampleSunPositions } from './shading'

// --- 単位変換: MJ/m² → kWh/m² -------------------------------
//  日射量データは MJ(メガジュール)で来るが、電力で考えたいので
//  kWh(キロワットアワー)に直す。1 kWh = 3.6 MJ なので 3.6 で割る。
export function mjToKwh(mj) {
  return mj / 3.6
}

// ============================================================
//  発電量の基本式(このアプリの核心)
//
//   発電量(kWh) = 面積A(㎡) × 変換効率η × 日射量H(kWh/㎡) × ロス係数PR
//
//  ・A  : パネルを敷く面積。屋根や土地の「広さ」。
//  ・η  : パネルが光を電気に変える割合(変換効率)。最新品で約0.20(=20%)。
//  ・H  : その期間に降り注いだ日射エネルギー量(kWh/㎡)。Open-Meteoの実測/予報。
//  ・PR : 性能比(Performance Ratio)。配線損失・パネル温度上昇・汚れなどの
//          現実的なロスをまとめた係数。屋根設置で通常 0.75〜0.85。初期値0.8。
//
//  例) 20㎡・η0.2・H5kWh/㎡・PR0.8 → 20×0.2×5×0.8 = 16 kWh
// ============================================================
export function generationKwh({ irradianceKwhM2, areaM2, efficiency, pr }) {
  return irradianceKwhM2 * areaM2 * efficiency * pr
}

// --- 発電量(kWh) → お金(円) ------------------------------
//  売電単価 or 電気代単価(円/kWh)を掛けるだけ。
//  「もし売っていたら / 電気代を浮かせていたら いくらか」の目安。
export function toYen(kwh, pricePerKwh) {
  return kwh * pricePerKwh
}

// ============================================================
//  「発電日和指数」: 1日の日射量を 5段階(☀️×5)に変換する
//  しきい値は kWh/㎡/日(=ピーク日照時間。1000W/m²の太陽が何時間
//  当たったか換算した値)で区切る。値は日本の晴天〜曇天の実感に合わせた目安。
//   ~1.5 : ☀1  どんより(パネルもお休み)
//   ~3.0 : ☀2  いまひとつ
//   ~4.5 : ☀3  まずまず
//   ~6.0 : ☀4  よく稼ぐ
//   6.0~ : ☀5  ガッツリ稼ぐ快晴
// ============================================================
export function sunScore(kwhM2PerDay) {
  if (kwhM2PerDay < 1.5) return 1
  if (kwhM2PerDay < 3.0) return 2
  if (kwhM2PerDay < 4.5) return 3
  if (kwhM2PerDay < 6.0) return 4
  return 5
}

// スコアに応じた一言コメント(低い日は「パネルの言い訳」で遊ぶ要素)
export const SCORE_MESSAGES = {
  1: { label: '開店休業', emoji: '😴', note: '「今日は雲が分厚くて…」とパネルの言い訳。' },
  2: { label: 'ぼちぼち', emoji: '🌥️', note: '薄日でもチリツモ。少しは稼ぎます。' },
  3: { label: 'まずまず', emoji: '⛅', note: '平均的な仕事ぶり。悪くない一日。' },
  4: { label: 'よく稼ぐ', emoji: '🌤️', note: '屋根がしっかり働いています。' },
  5: { label: '稼ぎ時！', emoji: '☀️', note: '快晴ボーナス。屋根がフル回転で発電中。' },
}

// ============================================================
//  日別シリーズ → 各日の発電量(kWh)に変換するヘルパー
//  Open-Meteoの MJ配列を受け取り、面積などの設定を掛けて
//  「その日の発電量(kWh)」の配列にして返す。
// ============================================================
export function dailyKwhSeries(radiationMJ, settings) {
  return radiationMJ.map((mj) => {
    if (mj == null) return null // データ欠損日はそのまま null
    const irradianceKwhM2 = mjToKwh(mj)
    return generationKwh({ irradianceKwhM2, ...settings })
  })
}

// --- 配列の合計(nullは無視) --------------------------------
export function sum(arr) {
  return arr.reduce((acc, v) => acc + (v ?? 0), 0)
}

// ============================================================
//  傾き・方位の補正(transposition factor)
//
//  Open-Meteoの日射量Hは「水平な地面」に降る量(=水平面日射量GHI)。
//  パネルは普通、屋根の角度で傾けて南向きに設置するので、実際にパネル面が
//  受ける量(=傾斜面日射量GTI)は水平より多い(南向き30°で年+12%ほど)。
//  その「水平の何倍受けるか」= transposition factor を返す。
//
//  考え方(等方性+Hay異方性の簡易モデル):
//   ・直達光: 1年ぶんの太陽位置から「傾けた面が真正面で受ける割合」を平均
//             cos(入射角AOI) = cosβ·sinα + sinβ·cosα·cos(太陽方位 − パネル方位)
//             Rb = Σmax(cosAOI,0) / Σsinα …直達の傾斜/水平比
//   ・散乱光: 一部(AI)は太陽方向に集中し直達と同じRbで、残りは空一様に降る
//   ・地面反射: アルベド(地面の反射率)ぶんを加える
//  パラメータ(fd/AI/albedo)は Open-Meteo実測GTIで較正済み(実用域±3%)。
//
//  β=傾斜角(度), パネル方位(度): 南=0・西=+・東=−(SunCalcと同じ向き)
// ============================================================
const TILT_FD = 0.38      // 年間の散乱光割合(日本の目安)
const TILT_AI = 0.40      // 異方性指数(散乱光のうち太陽方向に集中する割合)
const TILT_ALBEDO = 0.10  // 地面の反射率(アルベド)

export function tiltTranspositionFactor({ tiltDeg, azimuthDeg, latitude, longitude, year }) {
  if (!tiltDeg) return 1 // 水平(傾き0°)なら補正なし=1.0
  const beta = (tiltDeg * Math.PI) / 180
  const gp = (azimuthDeg * Math.PI) / 180
  const samples = sampleSunPositions(latitude, longitude, year)
  let num = 0
  let den = 0
  for (const { azimuth, altitude, weight } of samples) {
    const cosAOI =
      Math.cos(beta) * Math.sin(altitude) +
      Math.sin(beta) * Math.cos(altitude) * Math.cos(azimuth - gp)
    num += Math.max(cosAOI, 0)
    den += weight // weight = sin(altitude)
  }
  const Rb = den > 0 ? num / den : 0
  const beam = (1 - TILT_FD) * Rb
  const diffuse = TILT_FD * (TILT_AI * Rb + (1 - TILT_AI) * (1 + Math.cos(beta)) / 2)
  const reflected = TILT_ALBEDO * (1 - Math.cos(beta)) / 2
  return beam + diffuse + reflected
}
