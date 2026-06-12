// ============================================================
//  VerdictCard ―― 「結局ソーラーを置くべきか?」の結論を大きく見せるカード。
//  数字(回収年数・IRR・25年後の手残り)に加えて、
//  「効いている要因 / 改善できる点」を箇条書きで添えて、
//  ユーザーが“次に何をいじれば良くなるか”まで分かるようにする。
// ============================================================

// 判定レベルごとの配色(Tailwindのクラスは動的生成だと消えるので静的に列挙)
const TONES = {
  emerald: { ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-800' },
  lime: { ring: 'ring-lime-200', bg: 'bg-lime-50', text: 'text-lime-700', chip: 'bg-lime-100 text-lime-800' },
  amber: { ring: 'ring-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', chip: 'bg-amber-100 text-amber-800' },
  rose: { ring: 'ring-rose-200', bg: 'bg-rose-50', text: 'text-rose-700', chip: 'bg-rose-100 text-rose-800' },
}

const yen = (n) => `${Math.round(n / 10000).toLocaleString()}万円`

export default function VerdictCard({ verdict, payback, irr, finalNet, summary, reasons = [] }) {
  const t = TONES[verdict.tone] ?? TONES.amber
  const paybackText = Number.isFinite(payback) ? `約${payback.toFixed(1)}年` : '25年でも回収せず'
  const irrText = irr != null ? `${(irr * 100).toFixed(1)}%` : '—'

  return (
    <div className={`rounded-2xl p-5 ring-1 ${t.bg} ${t.ring}`}>
      <p className="text-xs font-medium text-gray-500">この試算での結論</p>

      {/* 結論の見出し(マーク + ラベル) */}
      <div className="mt-1 flex items-center gap-3">
        <span className={`text-4xl font-black leading-none ${t.text}`}>{verdict.mark}</span>
        <h2 className={`text-2xl font-bold ${t.text}`}>{verdict.label}</h2>
      </div>

      {/* 根拠の数字(チップ) */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${t.chip}`}>回収 {paybackText}</span>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${t.chip}`}>利回り(IRR) {irrText}</span>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${t.chip}`}>
          25年後 {finalNet >= 0 ? '+' : '−'}{yen(Math.abs(finalNet))}
        </span>
      </div>

      {/* 一言サマリー */}
      {summary && <p className="mt-3 text-sm leading-relaxed text-gray-700">{summary}</p>}

      {/* 効いている要因 / 改善できる点 */}
      {reasons.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-gray-200/70 pt-3">
          {reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <span className={r.plus ? 'text-emerald-500' : 'text-orange-500'}>
                {r.plus ? '＋' : '▲'}
              </span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-gray-400">
        ※費用・単価・補助金などの前提しだいで結論は変わります。下のスライダーで条件を変えて試せます。
      </p>
    </div>
  )
}
