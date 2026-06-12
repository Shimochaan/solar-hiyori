import { useEffect, useState, useMemo, lazy, Suspense } from 'react'
import { fetchDailySeries, fetchTodayHourly, fetchAnnualDaily } from './lib/openMeteo'
import {
  mjToKwh, generationKwh, toYen, sunScore, dailyKwhSeries, sum, tiltTranspositionFactor,
} from './lib/solar'
import {
  DEFAULTS, SIM_DEFAULTS, annualConsumptionKwh, selfConsumptionRate, annualBenefit,
  initialCost, subsidyAmount, simulateCashflow, paybackFromRows, monthlyMoney,
  lcoe, irr, doNothingElectricityCost,
} from './lib/economics'
import AddressSearch from './components/AddressSearch'
import MapView from './components/MapView'
import Controls from './components/Controls'
import InvestmentControls from './components/InvestmentControls'
import { ScoreCard, BrainSolarCard, AnnualCard } from './components/ResultCards'
import { TodayCurve, MonthlyChart } from './components/Charts'
import { PaybackCard, KpiCard, DoNothingCard, PaybackChart, MonthlyMoneyChart } from './components/PaybackSection'
import LogicNote from './components/LogicNote'
import { SunLogo } from './components/icons'

// 3Dビューア(Cesium)は重いので遅延読み込み。ボタンを押すまで読み込まない。
const Shadow3D = lazy(() => import('./components/Shadow3D'))

// 今日の日付を 'YYYY-MM-DD'(日本時間)で取得する小道具。
// 'sv-SE' ロケールは ISO 形式(2026-06-12)で返してくれるので便利。
const todayStr = () => new Date().toLocaleDateString('sv-SE')

export default function App() {
  // --- 画面の状態(state)をまとめて持つ --------------------
  const [location, setLocation] = useState(null) // 選択中の場所 {name, latitude, ...}
  const [settings, setSettings] = useState({
    // --- パネル設定 ---
    areaM2: 20,        // パネル面積(㎡)
    efficiency: 0.20,  // 変換効率(20%)
    pr: 0.8,           // 性能比
    pricePerKwh: 30,   // 電気代単価(買う / 円/kWh)。調査.md:実勢30〜40円。
    tiltDeg: 30,       // パネルの傾き(度)。日本の屋根は30°前後が標準。
    azimuthDeg: 0,     // パネルの向き(度)。南=0・西=+・東=−。
    // --- 投資の前提 ---
    householdSize: 4,        // 世帯人数
    homePattern: 'away',     // 日中の在宅: 'away'(いない) / 'home'(在宅多め)
    hasBattery: false,       // 蓄電池の有無
    batteryKwh: DEFAULTS.batteryKwh,
    costPerKwp: DEFAULTS.costPerKwp,
    costPerBatteryKwh: DEFAULTS.costPerBatteryKwh,
    subsidyPreset: 'none',   // 補助金プリセット: none / tokyo / rich
  })
  const [daily, setDaily] = useState(null)   // 日別シリーズ(過去40日+予報7日)
  const [hourly, setHourly] = useState(null) // 今日の時間別
  const [annual, setAnnual] = useState(null) // 過去1年ぶん
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [show3D, setShow3D] = useState(false)   // 3Dセクションを開いたか
  const [shadingLoss, setShadingLoss] = useState(0) // 影による年間発電ロス(0〜1)

  const lastYear = new Date().getFullYear() - 1 // 年間見積もりに使う「前年」

  // パネルの傾き・方位による日射量の増減(水平の何倍受けるか)。
  // 場所と傾き・方位が変わったときだけ再計算(太陽位置サンプリングは少し重い)。
  const tiltGain = useMemo(() => {
    if (!location) return 1
    return tiltTranspositionFactor({
      tiltDeg: settings.tiltDeg,
      azimuthDeg: settings.azimuthDeg,
      latitude: location.latitude,
      longitude: location.longitude,
      year: lastYear,
    })
  }, [location, settings.tiltDeg, settings.azimuthDeg, lastYear])

  // --- 場所が変わったらデータをまとめて取りに行く -----------
  useEffect(() => {
    if (!location) return
    let canceled = false // 取得途中で場所が変わったとき、古い結果を捨てる印

    setShadingLoss(0) // 別の土地に変えたら影ロスはリセット(再計算が必要)

    async function load() {
      setLoading(true)
      setError('')
      try {
        const { latitude: lat, longitude: lon } = location
        // 3つのAPIを同時に叩く(Promise.allで並列 → 速い)
        const [d, h, a] = await Promise.all([
          fetchDailySeries(lat, lon),
          fetchTodayHourly(lat, lon),
          fetchAnnualDaily(lat, lon, lastYear),
        ])
        if (!canceled) {
          setDaily(d)
          setHourly(h)
          setAnnual(a)
        }
      } catch (err) {
        if (!canceled) setError(err.message)
      } finally {
        if (!canceled) setLoading(false)
      }
    }
    load()
    return () => { canceled = true }
  }, [location, lastYear])

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* ヘッダー */}
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <SunLogo size={30} />
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">ソーラー発電日和</h1>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          住所とパネルの広さから、発電量と「何年で元が取れるか」を試算します。
        </p>
      </header>

      {/* 入力エリア */}
      <div className="grid gap-4 md:grid-cols-2">
        <AddressSearch onSelect={setLocation} selected={location} />
        <Controls settings={settings} onChange={setSettings} tiltGain={location ? tiltGain : null} />
      </div>
      {/* 選んだ場所を地図にピン表示(番地まで入れると正確に立つ) */}
      {location && (
        <div className="mt-4">
          <MapView
            lat={location.latitude}
            lon={location.longitude}
            label={location.name}
          />
          <p className="mt-1.5 px-1 text-center text-xs text-gray-400">
            ※日射量データは数km格子の値。番地が変わっても日射量の数値自体は同じです
            (地図は場所の確認用)。
          </p>

          {/* 3D影シミュレーション(押すまで重いCesiumを読み込まない) */}
          <div className="mt-4">
            {!show3D ? (
              <button
                onClick={() => setShow3D(true)}
                className="w-full rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700 transition hover:bg-orange-100"
              >
                🏠 3Dで近隣の影を見る(発電ロスも計算・ベータ)
              </button>
            ) : (
              <Suspense fallback={<div className="card p-6 text-center text-gray-400">3Dを読み込み中…</div>}>
                <Shadow3D
                  lat={location.latitude}
                  lon={location.longitude}
                  label={location.name}
                  tiltDeg={settings.tiltDeg}
                  azimuthDeg={settings.azimuthDeg}
                  areaM2={settings.areaM2}
                  onShadingComputed={setShadingLoss}
                />
              </Suspense>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        <InvestmentControls settings={settings} onChange={setSettings} />
      </div>

      {/* 状態メッセージ */}
      {!location && (
        <p className="mt-8 text-center text-gray-400">
          まず場所を検索して選んでください。
        </p>
      )}
      {error && <p className="mt-6 text-center text-red-500">{error}</p>}
      {loading && <p className="mt-6 text-center text-gray-400">日射量データを取得中…</p>}

      {/* 結果エリア(データが揃ったら表示) */}
      {location && daily && hourly && (
        <Results
          daily={daily}
          hourly={hourly}
          annual={annual}
          settings={settings}
          lastYear={lastYear}
          shadingLoss={shadingLoss}
          tiltGain={tiltGain}
        />
      )}

      <div className="mt-6">
        <LogicNote />
      </div>

      <footer className="mt-10 text-center text-xs text-gray-400">
        データ: Open-Meteo / 国土地理院 / OpenStreetMap(いずれも無料)・設置判断の参考用の簡易シミュレーションです
      </footer>
    </div>
  )
}

// ============================================================
//  Results: 取得済みデータ + 設定 から「計算して表示」する係。
//  計算はすべて solar.js の関数に任せ、ここは並べるだけ。
// ============================================================
function Results({ daily, hourly, annual, settings, lastYear, shadingLoss = 0, tiltGain = 1 }) {
  // 影による発電ロスの反映係数(例: 影ロス15% → shade=0.85 を発電量に掛ける)
  const shade = 1 - shadingLoss
  // 発電量に掛ける総合係数 = 影ロス × 傾き・方位ゲイン。
  // ※「天気の指数(☀)」は天候の話なのでこの係数は掛けない。
  const gen = shade * tiltGain

  // ---- ① 今日のスコア ----
  const today = todayStr()
  const idx = daily.dates.indexOf(today) // 今日が配列の何番目か
  const todayMJ = idx >= 0 ? daily.radiationMJ[idx] : 0
  const todayKwhM2 = mjToKwh(todayMJ)                 // kWh/㎡(=ピーク日照時間)
  const score = sunScore(todayKwhM2)                 // ☀指数は「天気」なので影は反映しない
  const todayKwh = generationKwh({ irradianceKwhM2: todayKwhM2, ...settings }) * gen
  const todayYen = toYen(todayKwh, settings.pricePerKwh)

  // ---- ② 脳内設置モード:今月の累計(1日〜今日) ----
  const ym = today.slice(0, 7) // 'YYYY-MM'
  // 今月かつ今日までの日だけ抜き出して、それぞれの発電量を合計
  const monthMJ = daily.radiationMJ.filter((_, i) =>
    daily.dates[i].startsWith(ym) && daily.dates[i] <= today
  )
  const monthKwh = sum(dailyKwhSeries(monthMJ, settings)) * gen
  const monthYen = toYen(monthKwh, settings.pricePerKwh)
  const monthLabel = `${Number(today.slice(5, 7))}月`

  // ---- ③ 年間見積もり + 月別内訳(過去1年の実測ベース) ----
  let annualKwh = 0
  let monthlyData = []
  if (annual) {
    const annualKwhSeries = dailyKwhSeries(annual.radiationMJ, settings)
    annualKwh = sum(annualKwhSeries) * gen
    // 月ごとに発電量を足し合わせる(1〜12月)。影ロスを反映。
    const buckets = Array(12).fill(0)
    annual.dates.forEach((date, i) => {
      const m = Number(date.slice(5, 7)) - 1 // 0始まりの月
      buckets[m] += annualKwhSeries[i] ?? 0
    })
    monthlyData = buckets.map((kwh, m) => ({ month: `${m + 1}月`, kwh: kwh * gen }))
  }
  const annualYen = toYen(annualKwh, settings.pricePerKwh)

  // ---- ④ 投資回収シミュレーション ----
  const systemKwp = settings.areaM2 * settings.efficiency // 設備容量 = 面積×効率
  const useKwh = annualConsumptionKwh(settings.householdSize) // 家の年間消費量
  const buyPrice = settings.pricePerKwh

  // 「今の設定」と「蓄電池を逆にしたケース」を両方計算して比較に使う
  function scenario(hasBattery) {
    const selfRate = selfConsumptionRate({ homePattern: settings.homePattern, hasBattery })
    // 初年度の年間メリット(カード表示用)。初年度の売電はFIT1段階目(24円)。
    const benefit = annualBenefit({
      genKwh: annualKwh, useKwh, selfRate, buyPrice,
      sellPrice: SIM_DEFAULTS.fitTier1Price,
    })
    const cost = initialCost({
      systemKwp,
      costPerKwp: settings.costPerKwp,
      hasBattery,
      batteryKwh: settings.batteryKwh,
      costPerBatteryKwh: settings.costPerBatteryKwh,
    })
    // 補助金を控除した実質初期費用
    const subsidy = subsidyAmount(settings.subsidyPreset, {
      systemKwp, hasBattery, batteryKwh: settings.batteryKwh,
    })
    const netCost = Math.max(cost.total - subsidy, 0)
    // 25年ぶんの現実的な収支(劣化・2段階FIT・点検・交換・廃棄=曲線になる)
    const rows = simulateCashflow({ genKwh: annualKwh, useKwh, selfRate, buyPrice, totalCost: netCost })
    return { selfRate, benefit, cost, subsidy, netCost, rows, payback: paybackFromRows(rows) }
  }
  const main = scenario(settings.hasBattery)     // 今選んでいるケース
  const other = scenario(!settings.hasBattery)   // 蓄電池あり/なしを逆にしたケース
  const cashflow = main.rows

  // ---- 投資指標(KPI): LCOE・IRR・回収期間 ----
  const lcoeYen = lcoe({ netCapex: main.netCost, genKwh: annualKwh })
  // IRR用キャッシュフロー = [初期費用マイナス, 各年のメリット...]
  const cashflowsForIrr = main.rows.map((r, i) => (i === 0 ? r.net : r.yearBenefit))
  const irrRate = irr(cashflowsForIrr)
  // 損失回避:何もしない場合の25年電気代
  const doNothing = doNothingElectricityCost({ useKwh, buyPrice })
  const finalNet = main.rows[main.rows.length - 1].net // 25年後の最終累積収支

  // 月別の収支(例年の月別発電量から、節約+売電に分けて。売電はFIT1段階目)
  const monthlyMoneyData = monthlyMoney(monthlyData, {
    selfRate: main.selfRate, buyPrice, sellPrice: SIM_DEFAULTS.fitTier1Price, useKwh,
  })

  // ---- ⑤ 今日の発電カーブ(時間別) ----
  const curveData = hourly.times.map((t, i) => ({
    hour: `${Number(t.slice(11, 13))}時`,
    w: Math.round(hourly.radiationW[i] ?? 0),
  }))

  return (
    <div className="mt-8 space-y-4">
      <ScoreCard score={score} todayKwh={todayKwh} todayYen={todayYen} />

      <div className="grid gap-4 md:grid-cols-2">
        <BrainSolarCard monthYen={monthYen} monthKwh={monthKwh} monthLabel={monthLabel} />
        <AnnualCard
          annualKwh={annualKwh}
          annualYen={annualYen}
          year={lastYear}
          loading={!annual}
        />
      </div>

      {/* 投資回収(年間発電量が出ているときのみ) */}
      {annual && (
        <>
          <PaybackCard
            cost={main.cost}
            subsidy={main.subsidy}
            netCost={main.netCost}
            benefit={main.benefit}
            payback={main.payback}
            comparePayback={other.payback}
            hasBattery={settings.hasBattery}
          />
          <DoNothingCard doNothingCost={doNothing} finalNet={finalNet} />
          <KpiCard lcoe={lcoeYen} irr={irrRate} payback={main.payback} buyPrice={buyPrice} />
          <PaybackChart data={cashflow} />
          <MonthlyMoneyChart data={monthlyMoneyData} />
        </>
      )}

      <TodayCurve data={curveData} />
      {monthlyData.length > 0 && <MonthlyChart data={monthlyData} />}
    </div>
  )
}
