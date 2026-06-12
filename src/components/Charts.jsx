// ============================================================
//  グラフ2種。Recharts(Reactでよく使うグラフ部品)を使う。
//  ResponsiveContainer = 親要素の幅に合わせて自動リサイズする箱。
// ============================================================
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

// ライトテーマ共通のツールチップ見た目(白地・細枠・丸み)
const tooltipStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  boxShadow: '0 4px 12px rgba(17,24,39,0.08)',
}
const axisTick = { fill: '#9ca3af', fontSize: 11 }

// ------------------------------------------------------------
//  今日の発電カーブ(時間別の日射量 W/m²)
//  朝ゼロ → 正午にピーク → 夕方ゼロ、の山なりが見える。
// ------------------------------------------------------------
export function TodayCurve({ data }) {
  return (
    <div className="card p-5">
      <h3 className="mb-3 font-bold text-gray-900">今日の発電カーブ(時間別)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            {/* グラデーション塗り(太陽っぽいオレンジ) */}
            <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
          <XAxis dataKey="hour" tick={axisTick} interval={2} />
          <YAxis tick={axisTick} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: '#374151' }}
            formatter={(v) => [`${v} W/m²`, '日射量']}
          />
          <Area type="monotone" dataKey="w" stroke="#f97316" fill="url(#sun)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ------------------------------------------------------------
//  月別の発電量(年間の内訳)。夏に高く冬に低い形が見える。
// ------------------------------------------------------------
export function MonthlyChart({ data }) {
  return (
    <div className="card p-5">
      <h3 className="mb-3 font-bold text-gray-900">月別の発電量(年間の内訳)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
          <XAxis dataKey="month" tick={axisTick} />
          <YAxis tick={axisTick} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: '#374151' }}
            formatter={(v) => [`${Math.round(v)} kWh`, '発電量']}
            cursor={{ fill: '#f9731610' }}
          />
          <Bar dataKey="kwh" fill="#fb923c" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
