// ============================================================
//  economics.js  ―― 「お金」と「投資判断指標」の計算をまとめた係。
//  発電量(kWh)を solar.js が出す。こちらはそれを“円”に換算し、
//  回収年数・LCOE・IRR・「何もしない場合の損失」まで出す。
//
//  ※ここで使う相場・統計値はすべて【推定の初期値】。実際は地域・業者・
//    年度で変わるため、画面で調整できる前提にしている。
//    出典の目安は「太陽光発電導入指標の調査.md」(経産省/NEDO/各種実勢)。
// ============================================================

// --- 相場・前提の初期値(調整可能) --------------------------
export const DEFAULTS = {
  costPerKwp: 289000,        // パネル設置費用(円/kWp)。新築 約28.9万/kW(調達価格等委員会2025-26)。
  costPerBatteryKwh: 150000, // 蓄電池の費用相場(円/kWh)。
  batteryKwh: 7,             // 家庭用蓄電池の代表的な容量(kWh)。
}

// ============================================================
//  世帯人数 → 年間の電力消費量(kWh/年)の推定
//  4人家族で約13.1kWh/日 ≒ 約4,800kWh/年 を基準に補正(調査.md)。
//  簡易モデル: 1,800 + 1,000×(人数−1)。例) 4人=4,800kWh/年
// ============================================================
export function annualConsumptionKwh(householdSize) {
  return 1800 + (householdSize - 1) * 1000
}

// ============================================================
//  自家消費率の推定(発電のうち、その家で直接使う割合)
//  調査.md: 太陽光のみ 30〜44% / +蓄電池 50〜70% / +EV(V2H) 80〜90%。
//  ・在宅パターン: 日中不在=30% / 在宅多め=40%
//  ・蓄電池あり: +30ポイント(→ 60〜70%。上限80%)
//  自家消費は「高い買電単価ぶん得」なので、回収の主役になる。
// ============================================================
export function selfConsumptionRate({ homePattern, hasBattery }) {
  let rate = homePattern === 'home' ? 0.40 : 0.30
  if (hasBattery) rate += 0.30
  return Math.min(rate, 0.80)
}

// ============================================================
//  初年度の経済メリット(円/年)。カードの見出し表示用。
//  発電量を「自家消費ぶん(節約)」と「売電ぶん(売上)」に分ける。
// ============================================================
export function annualBenefit({ genKwh, useKwh, selfRate, buyPrice, sellPrice }) {
  const selfKwh = Math.min(genKwh * selfRate, useKwh) // 自家消費(家の消費量が上限)
  const sellKwh = Math.max(genKwh - selfKwh, 0)       // 売電(余り)
  const saved = selfKwh * buyPrice // 買わずに済んだ電気代(節約=回避コスト)
  const sold = sellKwh * sellPrice // 売って得たお金(売電収入)
  return { selfKwh, sellKwh, saved, sold, total: saved + sold }
}

// ============================================================
//  初期費用(円) = パネル費用 + (蓄電池費用)。補助金は別途控除する。
// ============================================================
export function initialCost({ systemKwp, costPerKwp, hasBattery, batteryKwh, costPerBatteryKwh }) {
  const pv = systemKwp * costPerKwp
  const batt = hasBattery ? batteryKwh * costPerBatteryKwh : 0
  return { pv, batt, total: pv + batt }
}

// ============================================================
//  補助金(調査.md)。自治体で激変するため代表的なプリセットを用意。
//  東京都は太陽光〜15万/kW・蓄電池10万/kWh(上限120万)など極めて手厚い。
// ============================================================
export const SUBSIDY_PRESETS = {
  none:  { label: 'なし',          perKwp: 0,      perBatteryKwh: 0,      batteryCap: 0 },
  tokyo: { label: '東京都(目安)',  perKwp: 120000, perBatteryKwh: 100000, batteryCap: 1200000 },
  rich:  { label: '都+区(手厚い)', perKwp: 170000, perBatteryKwh: 130000, batteryCap: 1500000 },
}

export function subsidyAmount(presetKey, { systemKwp, hasBattery, batteryKwh }) {
  const p = SUBSIDY_PRESETS[presetKey] ?? SUBSIDY_PRESETS.none
  const pv = systemKwp * p.perKwp
  let batt = hasBattery ? batteryKwh * p.perBatteryKwh : 0
  if (p.batteryCap) batt = Math.min(batt, p.batteryCap) // 蓄電池補助は上限あり
  return Math.round(pv + batt)
}

// ============================================================
//  25年シミュレーションの前提(直線にならない理由がここ)
// ============================================================
export const SIM_DEFAULTS = {
  years: 25,
  degradationRate: 0.005,     // パネル劣化:年0.5%(調査.md)
  // FITは2025下半期〜の2段階(住宅用<10kW)。初期に厚い設計。
  fitTier1Price: 24,          // 1〜4年目:24円/kWh
  fitTier1Years: 4,
  fitTier2Price: 8.3,         // 5〜10年目:8.3円/kWh
  fitTier2Years: 10,
  postFitSellPrice: 8.5,      // 11年目以降:市場相場の目安
  buyPriceInflation: 0.01,    // 電気代の年上昇率(推定1%)
  inverterReplaceYear: 15,    // パワコン交換(年)
  inverterReplaceCost: 200000,// パワコン交換費用(円)。15〜25万の中央。
  inspectionCost: 40000,      // 定期点検 約3.8〜4.1万円/回
  inspectionIntervalYears: 4, // 点検の間隔(年)
  disposalCost: 400000,       // 撤去・廃棄費用(将来負債・調査.md)
}

// その年の売電単価(FIT2段階→市場相場)
function sellPriceForYear(y, p) {
  if (y <= p.fitTier1Years) return p.fitTier1Price
  if (y <= p.fitTier2Years) return p.fitTier2Price
  return p.postFitSellPrice
}

// ============================================================
//  年ごとの収支シミュレーション(劣化・2段階FIT・点検・交換・廃棄)。
//  返り値: [{ year, yearBenefit, net(累積) }, ...]
// ============================================================
export function simulateCashflow({ genKwh, useKwh, selfRate, buyPrice, totalCost, ...overrides }) {
  const p = { ...SIM_DEFAULTS, ...overrides }
  const rows = [{ year: 0, yearBenefit: 0, net: Math.round(-totalCost) }]
  let cumulative = -totalCost

  for (let y = 1; y <= p.years; y++) {
    const gen = genKwh * Math.pow(1 - p.degradationRate, y - 1)   // 劣化反映
    const buy = buyPrice * Math.pow(1 + p.buyPriceInflation, y - 1) // 値上がり反映
    const sell = sellPriceForYear(y, p)                            // 2段階FIT

    const selfKwh = Math.min(gen * selfRate, useKwh)
    const sellKwh = Math.max(gen - selfKwh, 0)
    let yearBenefit = selfKwh * buy + sellKwh * sell

    // 臨時の支出(その年だけマイナス)
    if (y === p.inverterReplaceYear) yearBenefit -= p.inverterReplaceCost
    if (y % p.inspectionIntervalYears === 0) yearBenefit -= p.inspectionCost
    if (y === p.years) yearBenefit -= p.disposalCost // 最終年に廃棄費用

    cumulative += yearBenefit
    rows.push({ year: y, yearBenefit: Math.round(yearBenefit), net: Math.round(cumulative) })
  }
  return rows
}

// シミュレーション結果から投資回収年数(0円を初めて上回る年・小数補間)
export function paybackFromRows(rows) {
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].net >= 0) {
      const prev = rows[i - 1].net
      const frac = (0 - prev) / (rows[i].net - prev)
      return (rows[i].year - 1) + frac
    }
  }
  return Infinity
}

// ============================================================
//  生涯総発電量(劣化を反映した25年ぶんの合計 kWh)
// ============================================================
export function lifetimeGenerationKwh(genKwh, { years = SIM_DEFAULTS.years, degradationRate = SIM_DEFAULTS.degradationRate } = {}) {
  let total = 0
  for (let y = 1; y <= years; y++) total += genKwh * Math.pow(1 - degradationRate, y - 1)
  return total
}

// ============================================================
//  LCOE(均等化発電原価, 円/kWh)= 自前の電気1kWhあたりの原価。
//   = (実質初期費用 + 生涯の維持・廃棄費) ÷ 生涯総発電量
//  これが買電単価(30〜40円)より十分安い=「高い買い物」ではない証明。
// ============================================================
export function lcoe({ netCapex, genKwh }, overrides = {}) {
  const p = { ...SIM_DEFAULTS, ...overrides }
  const gen = lifetimeGenerationKwh(genKwh, p)
  const inspections = Math.floor(p.years / p.inspectionIntervalYears) * p.inspectionCost
  const opex = p.inverterReplaceCost + inspections + p.disposalCost
  return (netCapex + opex) / gen
}

// ============================================================
//  IRR(内部収益率)。各年のキャッシュフローからNPV=0となる利率を
//  二分法で求める。定期預金や投信の利回りと比較するための指標。
//  cashflows = [初期費用のマイナス, 1年目, 2年目, ...]
// ============================================================
export function irr(cashflows) {
  const npv = (r) => cashflows.reduce((acc, c, t) => acc + c / Math.pow(1 + r, t), 0)
  // 現実的な年率の範囲 [0%, 50%] で探索する。
  // ※終端に廃棄費用(マイナス)があるため極端な低金利だとNPVが発散する。
  //   NPV(0)=全キャッシュフローの単純合計(=25年後の手残り)なので、
  //   これが赤字ならIRRなし、と素直に判定できる。
  let lo = 0, hi = 0.5
  let fLo = npv(lo)
  if (fLo <= 0) return null   // 名目でも赤字 → 利回りとして語れない(回収不能)
  if (npv(hi) > 0) return hi  // 50%超は非現実的なので頭打ち
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    const f = npv(mid)
    if (Math.abs(f) < 1) return mid
    if (fLo * f < 0) hi = mid
    else { lo = mid; fLo = f }
  }
  return (lo + hi) / 2
}

// ============================================================
//  結論判定 ―― 「で、結局ソーラーを置くべきか?」の一言ジャッジ。
//  数字(回収年数・IRR・25年後の手残り)から4段階で結論を出す。
//  しきい値は「個人の住宅投資としての肌感」+ 定期預金/投信利回りとの比較。
//   ・◎ 置くのがおすすめ : 回収≦12年 かつ IRR≧4%(預金より明確に有利)
//   ・○ 置く価値あり     : 回収≦18年 かつ IRR≧2%(プラスだが控えめ)
//   ・△ 条件しだい       : 25年内に回収はするが上記未満(やり方で化ける)
//   ・✕ 今は見送り       : 25年でも回収しきれない/利回りが立たない
// ============================================================
export function investmentVerdict({ payback, irr, finalNet }) {
  const recovers = Number.isFinite(payback) // 回収年数が有限=25年内に元が取れる
  if (recovers && irr != null && payback <= 12 && irr >= 0.04) {
    return { level: 'great', mark: '◎', label: '置くのがおすすめ', tone: 'emerald' }
  }
  if (recovers && irr != null && payback <= 18 && irr >= 0.02) {
    return { level: 'good', mark: '○', label: '置く価値あり', tone: 'lime' }
  }
  if (recovers && finalNet > 0) {
    return { level: 'maybe', mark: '△', label: '条件しだい(工夫の余地あり)', tone: 'amber' }
  }
  return { level: 'no', mark: '✕', label: '今の条件では見送り', tone: 'rose' }
}

// ============================================================
//  「何もしない場合」の電気代総額(損失回避フレーム用)。
//  太陽光を入れず、値上がりする電気を買い続けると25年でいくら払うか。
// ============================================================
export function doNothingElectricityCost({ useKwh, buyPrice, years = SIM_DEFAULTS.years, inflation = SIM_DEFAULTS.buyPriceInflation }) {
  let total = 0
  for (let y = 1; y <= years; y++) total += useKwh * buyPrice * Math.pow(1 + inflation, y - 1)
  return Math.round(total)
}

// ============================================================
//  月別の収支(節約+売電)を例年の月別発電量から計算する。
//  夏に高く冬に低い、季節の収支感を具体的に見せるため。
// ============================================================
export function monthlyMoney(monthly, { selfRate, buyPrice, sellPrice, useKwh }) {
  const monthlyUse = useKwh / 12
  return monthly.map(({ month, kwh }) => {
    const selfKwh = Math.min(kwh * selfRate, monthlyUse)
    const sellKwh = Math.max(kwh - selfKwh, 0)
    return {
      month,
      saved: Math.round(selfKwh * buyPrice),
      sold: Math.round(sellKwh * sellPrice),
    }
  })
}
