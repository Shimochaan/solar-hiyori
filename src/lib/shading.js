// ============================================================
//  shading.js  ―― 「近隣の建物の影で、年間どれくらい発電を損するか」を
//  推定する係(ベータ)。3D(Cesium)に依存しない純粋な計算だけを置く。
//
//  考え方:
//   ① 1年ぶんの太陽の位置(方位・高度)をたくさんサンプリングする
//   ② 各サンプルを「日射の強さ」で重み付け(高い太陽ほど発電に効く)
//   ③ 「その方向が建物で遮られるか」を外から渡された判定関数で調べ、
//      遮られたぶんの重みを合計 ÷ 全体の重み = 影による損失率(0〜1)
//
//  ※occluded() の中身(実際の遮蔽判定)は 3D 側(Shadow3D)が持つ。
//    ここはロジックだけなので単体で検証できる。
// ============================================================
import SunCalc from 'suncalc'

// ① 太陽位置サンプル。各月の代表日(15日)× 日中の各時刻。
//    返り値: [{ azimuth, altitude, weight }, ...]
//    azimuth: suncalc仕様(南=0、西へ+)。altitude: 地平線からの高度(ラジアン)。
export function sampleSunPositions(lat, lon, year, { stepHours = 1 } = {}) {
  const samples = []
  for (let m = 0; m < 12; m++) {
    for (let h = 4; h <= 20; h += stepHours) {
      // JSTの (year, m, 15, h時) を UTC に直して絶対時刻を作る(JST = UTC+9)
      const d = new Date(Date.UTC(year, m, 15, h - 9, 0, 0))
      const pos = SunCalc.getPosition(d, lat, lon)
      if (pos.altitude <= 0.05) continue // 地平線下・極端な低空は除外
      samples.push({
        azimuth: pos.azimuth,
        altitude: pos.altitude,
        // 日射の強さの近似:太陽が高いほど強い(sin高度)。快晴ベースの相対重み。
        weight: Math.sin(pos.altitude),
      })
    }
  }
  return samples
}

// ③ 影による年間損失率(0〜1)。
//    occluded(azimuth, altitude) … その方向が建物で遮られるなら true。
export function shadingLoss(samples, occluded) {
  let total = 0
  let blocked = 0
  for (const s of samples) {
    total += s.weight
    if (occluded(s.azimuth, s.altitude)) blocked += s.weight
  }
  return total > 0 ? blocked / total : 0
}

// 補助:suncalcの方位(南=0,西+)→ 真北からの方位(北=0,東回り)に変換。
//  3D側でレイの向きを作るときに使う。
export function azimuthFromNorth(suncalcAzimuth) {
  return Math.PI + suncalcAzimuth
}

// ============================================================
//  パネル板を「格子セル」に切って、各セルの四隅をENU座標で返す(純粋計算)。
//  ENU = 原点まわりの 東(x)・北(y)・上(z) 座標。3D側でこれをECEFに変換して描く。
//
//  ・傾き β:屋根の勾配。0=水平、90=垂直。
//  ・方位 azimuthDeg:パネルの向き。南=0・西=+・東=−(SunCalcと同じ)。
//  ・sizeM:パネル一辺の長さ(㎡の平方根を渡す想定)。
//  ・nx × ny:格子の分割数(ヒートマップの解像度)。
//
//  考え方:水平な板を、横軸 r(地面と平行)まわりに β だけ起こす。
//   r(幅方向・水平)  = (cosBF, −sinBF, 0)
//   s(勾配方向・上り) = (−sinBF·cosβ, −cosBF·cosβ, sinβ)
//   BF = 北からの方位 = π + azimuth(パネルが向く水平方向)
//  セル中心 + u·r + v·s で四隅を作る。
// ============================================================
export function panelCellsENU(tiltDeg, azimuthDeg, sizeM, nx = 5, ny = 4) {
  const beta = (tiltDeg * Math.PI) / 180
  const bf = Math.PI + (azimuthDeg * Math.PI) / 180 // 北からの方位(rad)
  const cosB = Math.cos(beta)
  const sinB = Math.sin(beta)
  const r = [Math.cos(bf), -Math.sin(bf), 0]                 // 幅方向(水平)
  const s = [-Math.sin(bf) * cosB, -Math.cos(bf) * cosB, sinB] // 勾配方向(上り)
  const half = sizeM / 2
  const du = sizeM / nx
  const dv = sizeM / ny

  // 中心 + u·r + v·s の ENU 座標
  const pt = (u, v) => [u * r[0] + v * s[0], u * r[1] + v * s[1], u * r[2] + v * s[2]]

  const cells = []
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const u0 = -half + i * du
      const u1 = u0 + du
      const v0 = -half + j * dv
      const v1 = v0 + dv
      cells.push({
        i, j,
        // 四隅(描画用・反時計回り)
        corners: [pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)],
        // セル中心(レイの始点に使う)
        center: pt(u0 + du / 2, v0 + dv / 2),
      })
    }
  }
  return cells
}
