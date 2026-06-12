import { SCORE_MESSAGES } from '../lib/solar'
import { Sun } from './icons'

// 数値を「1,234」のようなカンマ区切りにする小道具
const fmt = (n) => Math.round(n).toLocaleString('ja-JP')

// ============================================================
//  今日の「発電日和指数」カード(太陽5段階)
//  毎日見たくなる、アプリの“顔”。
// ============================================================
export function ScoreCard({ score, todayKwh, todayYen }) {
  const msg = SCORE_MESSAGES[score]

  return (
    <div className="card overflow-hidden bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="p-6 text-center">
        <p className="text-sm font-medium text-orange-700">今日の発電日和指数</p>

        {/* 太陽アイコンを5個。score個ぶん点灯(オレンジ)、残りは薄いグレー。 */}
        <div className="my-3 flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Sun
              key={i}
              filled={i <= score}
              size={26}
              className={i <= score ? 'text-orange-500' : 'text-gray-300'}
            />
          ))}
        </div>

        <p className="text-xl font-bold text-gray-900">{msg.label}</p>
        <p className="mt-1 text-sm text-gray-500">{msg.note}</p>

        <div className="mt-5 flex justify-center gap-8 border-t border-orange-100 pt-4">
          <div>
            <p className="text-xs text-gray-400">今日の予想発電量</p>
            <p className="font-mono text-lg font-semibold text-gray-900">{todayKwh.toFixed(1)} kWh</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">お金にすると</p>
            <p className="font-mono text-lg font-semibold text-emerald-600">約 {fmt(todayYen)} 円</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
//  「脳内ソーラーパネル設置」カード
//  まだパネルを置いていなくても、「今月ここに置いていたら
//  累計いくら稼げていたか」をバーチャル表示する。
// ============================================================
export function BrainSolarCard({ monthYen, monthKwh, monthLabel }) {
  return (
    <div className="card p-6">
      <h3 className="font-bold text-gray-900">脳内ソーラーパネル設置モード</h3>
      <p className="mt-1 text-sm text-gray-500">
        もしこの場所に、いまのパネル設定で置いていたら――
      </p>
      <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-center">
        <p className="text-xs text-gray-500">{monthLabel}の累計(バーチャル)</p>
        <p className="my-1 text-4xl font-extrabold text-emerald-600">
          {fmt(monthYen)}
          <span className="ml-1 text-lg font-bold text-gray-400">円</span>
        </p>
        <p className="text-sm text-gray-500">({monthKwh.toFixed(1)} kWh 発電できていた計算)</p>
      </div>
      <p className="mt-3 text-center text-xs text-gray-400">
        “屋根を遊ばせておくのは、油田を放置するのと同じだ”
      </p>
    </div>
  )
}

// ============================================================
//  年間見積もりカード(過去1年の実測ベース)
// ============================================================
export function AnnualCard({ annualKwh, annualYen, year, loading }) {
  return (
    <div className="card p-6">
      <h3 className="font-bold text-gray-900">年間の発電見積もり</h3>
      <p className="mt-1 text-sm text-gray-500">
        {year}年の実測日射量をもとにした“平年並み”の目安。
      </p>
      {loading ? (
        <p className="mt-4 text-gray-400">年間データを計算中…</p>
      ) : (
        <div className="mt-4 flex gap-8">
          <div>
            <p className="text-xs text-gray-400">年間発電量</p>
            <p className="font-mono text-2xl font-bold text-gray-900">{fmt(annualKwh)} kWh</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">年間の金額換算</p>
            <p className="font-mono text-2xl font-bold text-emerald-600">約 {fmt(annualYen)} 円</p>
          </div>
        </div>
      )}
    </div>
  )
}
