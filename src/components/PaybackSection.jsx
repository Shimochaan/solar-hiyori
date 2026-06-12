import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Legend,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts'

const fmt = (n) => Math.round(n).toLocaleString('ja-JP')
// 万円表示(グラフの軸など、桁が大きいとき用)
const man = (n) => `${Math.round(n / 10000)}万`
// 回収年数の表示(∞=回収不可のときは出し分け)
const yearsLabel = (y) => (isFinite(y) ? `${y.toFixed(1)} 年` : '回収できない設定')

const tooltipStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  boxShadow: '0 4px 12px rgba(17,24,39,0.08)',
}
const axisTick = { fill: '#9ca3af', fontSize: 11 }

// ============================================================
//  投資回収の結果カード。
//  ・初期費用(パネル+蓄電池)
//  ・年間メリット(節約+売電)
//  ・投資回収年数(大きく) + 蓄電池あり/なしの比較
// ============================================================
export function PaybackCard({ cost, subsidy, netCost, benefit, payback, comparePayback, hasBattery }) {
  return (
    <div className="card overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 p-6">
      <h3 className="font-bold text-gray-900">投資回収シミュレーション</h3>

      <div className="my-4 text-center">
        <p className="text-xs text-gray-500">実質初期費用を回収できるまで</p>
        <p className="text-4xl font-extrabold text-emerald-600">{yearsLabel(payback)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-emerald-100 pt-4 text-sm">
        <div>
          <p className="text-xs text-gray-400">初期費用{subsidy > 0 ? '(補助金後)' : ''}</p>
          <p className="font-mono font-semibold text-gray-900">{fmt(netCost)} 円</p>
          <p className="text-xs text-gray-400">
            パネル {man(cost.pv)}円{cost.batt > 0 ? ` + 蓄電池 ${man(cost.batt)}円` : ''}
            {subsidy > 0 ? ` − 補助金 ${man(subsidy)}円` : ''}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">年間メリット(初年度)</p>
          <p className="font-mono font-semibold text-emerald-600">約 {fmt(benefit.total)} 円/年</p>
          <p className="text-xs text-gray-400">
            節約 {fmt(benefit.saved)}円 + 売電 {fmt(benefit.sold)}円
          </p>
        </div>
      </div>

      {/* 蓄電池あり/なしの比較(今の選択と逆のケースを並べる) */}
      <div className="mt-4 rounded-lg bg-white/70 px-3 py-2 text-xs text-gray-600">
        蓄電池
        <b className="text-gray-900"> {hasBattery ? 'あり' : 'なし'}</b> = {yearsLabel(payback)} ／
        <b className="text-gray-900"> {hasBattery ? 'なし' : 'あり'}</b> = {yearsLabel(comparePayback)}
        <p className="mt-1 text-gray-400">
          蓄電池は自家消費を増やすが費用も増えるため、回収が延びることが多い。
        </p>
      </div>
    </div>
  )
}

// ============================================================
//  投資指標カード(LCOE / IRR / 回収期間)。
//  金融リテラシーに沿った客観指標で「買うべきか」を後押しする。
// ============================================================
export function KpiCard({ lcoe, irr, payback, buyPrice }) {
  const irrLabel = irr == null ? '—' : `${(irr * 100).toFixed(1)} %`
  return (
    <div className="card p-6">
      <h3 className="font-bold text-gray-900">投資指標で見る</h3>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-400">発電原価 LCOE</p>
          <p className="font-mono text-xl font-bold text-gray-900">{lcoe.toFixed(1)}<span className="text-sm">円</span></p>
          <p className="text-xs text-gray-400">/kWh</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-400">利回り IRR</p>
          <p className="font-mono text-xl font-bold text-gray-900">{irrLabel}</p>
          <p className="text-xs text-gray-400">年率</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-400">回収期間</p>
          <p className="font-mono text-xl font-bold text-gray-900">
            {isFinite(payback) ? <>{payback.toFixed(1)}<span className="text-sm">年</span></> : '—'}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        自前の電気は <b className="text-emerald-600">{lcoe.toFixed(1)}円/kWh</b> で作れる計算。
        電力会社から買う <b className="text-gray-700">{buyPrice}円/kWh</b> より安く、
        将来の電気代を“安くロックイン”できることを意味します。
      </p>
    </div>
  )
}

// ============================================================
//  損失回避(Do Nothing)カード。
//  「導入せず電気を買い続けると25年でこれだけ払う」という
//  “何もしないことの損失”を見せ、現状維持バイアスを揺さぶる。
// ============================================================
export function DoNothingCard({ doNothingCost, finalNet, years = 25 }) {
  return (
    <div className="card overflow-hidden bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <h3 className="font-bold text-gray-900">“何もしない”とどうなる?</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white/70 p-4 text-center">
          <p className="text-xs text-gray-500">導入せず電気を買い続けると({years}年)</p>
          <p className="my-1 text-2xl font-extrabold text-orange-600">{fmt(doNothingCost)} 円</p>
          <p className="text-xs text-gray-400">支払い続ける電気代</p>
        </div>
        <div className="rounded-xl bg-white/70 p-4 text-center">
          <p className="text-xs text-gray-500">導入した場合({years}年後の手残り)</p>
          <p className={`my-1 text-2xl font-extrabold ${finalNet >= 0 ? 'text-emerald-600' : 'text-gray-600'}`}>
            {finalNet >= 0 ? '+' : ''}{fmt(finalNet)} 円
          </p>
          <p className="text-xs text-gray-400">費用を回収した上での損益</p>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-gray-500">
        高い電気を買い続ける“損失”を避け、屋根を資産に変えられます。
      </p>
    </div>
  )
}

// ============================================================
//  累積収支グラフ。0円ラインを上回った年=「元が取れた」年。
//  劣化・FIT終了・パワコン交換を織り込むので直線にならない。
// ============================================================
export function PaybackChart({ data, fitYears = 10 }) {
  return (
    <div className="card p-5">
      <h3 className="mb-1 font-bold text-gray-900">累積収支(マイナス→プラスで元が取れる)</h3>
      <p className="mb-3 text-xs text-gray-400">
        劣化・FIT終了・パワコン交換を織り込んだ25年の試算。直線にならないのが現実です。
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
          <XAxis dataKey="year" tick={axisTick} unit="年" interval={4} minTickGap={12} />
          <YAxis tick={axisTick} tickFormatter={(v) => man(v)} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: '#374151' }}
            labelFormatter={(v) => `${v}年目`}
            formatter={(v) => [`${fmt(v)} 円`, '累積収支']}
          />
          {/* 0円ライン:ここを超えたら投資回収完了 */}
          <ReferenceLine y={0} stroke="#10b981" strokeDasharray="4 4" />
          {/* FIT終了ライン:ここから売電単価が下がって傾きが寝る */}
          <ReferenceLine
            x={fitYears}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: 'FIT終了', fill: '#ea580c', fontSize: 11, position: 'top' }}
          />
          <Line type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ============================================================
//  月別の収支(節約+売電の積み上げ棒)。例年データから。
//  夏に高く冬に低い、という季節の稼ぎ感を具体的に見せる。
// ============================================================
export function MonthlyMoneyChart({ data }) {
  return (
    <div className="card p-5">
      <h3 className="mb-3 font-bold text-gray-900">月別の収支(例年ベース:節約+売電)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
          <XAxis dataKey="month" tick={axisTick} />
          <YAxis tick={axisTick} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: '#374151' }}
            formatter={(v, name) => [`${fmt(v)} 円`, name]}
            cursor={{ fill: '#f9731610' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {/* stackId を同じにすると積み上げ棒になる */}
          <Bar dataKey="saved" name="節約(自家消費)" stackId="m" fill="#10b981" radius={[0, 0, 0, 0]} />
          <Bar dataKey="sold" name="売電" stackId="m" fill="#fb923c" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
