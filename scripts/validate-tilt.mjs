// 傾斜面日射量(GTI)の自前補正モデルを、Open-Meteoの実測GTIで較正・検証する。
// 使い捨ての検証スクリプト(本番コードには含めない)。
import SunCalc from '../node_modules/suncalc/suncalc.js'

const LAT = 35.6, LON = 140.1, YEAR = 2024

// --- 自前モデル: GTI/GHI 比(等方性天空モデル) -----------------
// cos(AOI) = cosβ·sinα + sinβ·cosα·cos(γs−γp)
//   α: 太陽高度, β: 傾斜, γs: 太陽方位(南=0,西+), γp: パネル方位(南=0,西+)
// Rb = Σ max(cosAOI,0) / Σ sinα   (快晴DNI一定で重み付けした直達の傾斜/水平比)
// GTI/GHI = (1−fd)·Rb + fd·(1+cosβ)/2 + albedo·(1−cosβ)/2
function sampleSun(lat, lon, year, step = 1) {
  const out = []
  for (let m = 0; m < 12; m++) {
    for (let h = 4; h <= 20; h += step) {
      const d = new Date(Date.UTC(year, m, 15, h - 9, 0, 0))
      const p = SunCalc.getPosition(d, lat, lon)
      if (p.altitude <= 0.05) continue
      out.push({ az: p.azimuth, alt: p.altitude })
    }
  }
  return out
}
// Hay異方性: 散乱光の一部(AI)は太陽方向に集中し直達と同じRbで傾く。
function modelFactor(lat, lon, year, tiltDeg, panelAzDeg, fd, albedo, AI) {
  const beta = (tiltDeg * Math.PI) / 180
  const gp = (panelAzDeg * Math.PI) / 180
  const s = sampleSun(lat, lon, year)
  let num = 0, den = 0
  for (const { az, alt } of s) {
    const cosAOI = Math.cos(beta) * Math.sin(alt) +
      Math.sin(beta) * Math.cos(alt) * Math.cos(az - gp)
    num += Math.max(cosAOI, 0)
    den += Math.sin(alt)
  }
  const Rb = den > 0 ? num / den : 0
  const beam = (1 - fd) * Rb
  const diffuse = fd * (AI * Rb + (1 - AI) * (1 + Math.cos(beta)) / 2)
  const refl = albedo * (1 - Math.cos(beta)) / 2
  return beam + diffuse + refl
}

// --- Open-Meteo 実測: 年間 ΣGTI / ΣGHI -------------------------
async function realRatio(tilt, az) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}` +
    `&start_date=${YEAR}-01-01&end_date=${YEAR}-12-31` +
    `&hourly=shortwave_radiation,global_tilted_irradiance&tilt=${tilt}&azimuth=${az}&timezone=Asia%2FTokyo`
  const r = await (await fetch(url)).json()
  const ghi = r.hourly.shortwave_radiation
  const gti = r.hourly.global_tilted_irradiance
  let sg = 0, st = 0
  for (let i = 0; i < ghi.length; i++) { sg += ghi[i] ?? 0; st += gti[i] ?? 0 }
  return st / sg
}

const cases = [
  { tilt: 0, az: 0 }, { tilt: 10, az: 0 }, { tilt: 30, az: 0 }, { tilt: 30, az: -45 },
  { tilt: 30, az: -90 }, { tilt: 30, az: 90 }, { tilt: 30, az: 180 },
  { tilt: 45, az: 0 }, { tilt: 60, az: 0 }, { tilt: 90, az: 0 }, { tilt: 90, az: 90 },
]
// 実測を先に全部取得(較正に使う)
const reals = []
for (const c of cases) reals.push({ ...c, real: await realRatio(c.tilt, c.az) })

// fd, AI, albedo をグリッド探索して二乗誤差最小を見つける
let best = null
for (let fd = 0.35; fd <= 0.6; fd += 0.01) {
  for (let AI = 0.3; AI <= 0.95; AI += 0.02) {
    for (let alb = 0.1; alb <= 0.3; alb += 0.05) {
      let err = 0
      for (const c of reals) {
        const m = modelFactor(LAT, LON, YEAR, c.tilt, c.az, fd, alb, AI)
        err += (m - c.real) ** 2
      }
      if (!best || err < best.err) best = { fd, AI, alb, err }
    }
  }
}
console.log('best params:', best)
console.log('\ntilt  az |  real  | model  | 誤差%')
let maxErr = 0
for (const c of reals) {
  const m = modelFactor(LAT, LON, YEAR, c.tilt, c.az, best.fd, best.alb, best.AI)
  const e = ((m - c.real) / c.real) * 100
  maxErr = Math.max(maxErr, Math.abs(e))
  console.log(`${String(c.tilt).padStart(4)} ${String(c.az).padStart(4)} | ${c.real.toFixed(3)} | ${m.toFixed(3)} | ${e >= 0 ? '+' : ''}${e.toFixed(1)}%`)
}
console.log(`\n最大誤差: ${maxErr.toFixed(1)}%`)

// 別緯度(札幌43.06, 福岡33.6)で汎化チェック
for (const [name, la, lo] of [['札幌', 43.06, 141.35], ['福岡', 33.59, 130.4]]) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${la}&longitude=${lo}&start_date=${YEAR}-01-01&end_date=${YEAR}-12-31&hourly=shortwave_radiation,global_tilted_irradiance&tilt=30&azimuth=0&timezone=Asia%2FTokyo`
  const r = await (await fetch(url)).json()
  let sg = 0, st = 0
  for (let i = 0; i < r.hourly.shortwave_radiation.length; i++) { sg += r.hourly.shortwave_radiation[i] ?? 0; st += r.hourly.global_tilted_irradiance[i] ?? 0 }
  const real = st / sg
  const m = modelFactor(la, lo, YEAR, 30, 0, best.fd, best.alb, best.AI)
  console.log(`${name}(緯${la}) tilt30南: real ${real.toFixed(3)} / model ${m.toFixed(3)} (${(((m - real) / real) * 100).toFixed(1)}%)`)
}
