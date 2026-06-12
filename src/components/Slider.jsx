// ============================================================
//  スライダー1本ぶんの共通部品。Controls と InvestmentControls の
//  両方から使い回す(同じ見た目の入力を1か所にまとめておく考え方)。
//
//  モバイル対応:指でのドラッグは値がブレやすいので、両脇に −/+ ボタン
//  (大きめのタップ領域)を置いて、1ステップずつの微調整もできるようにする。
// ============================================================
export default function Slider({ label, hint, value, min, max, step, unit, onChange }) {
  // min/max を超えないように丸めてから反映する小道具
  const clamp = (v) => Math.min(max, Math.max(min, v))
  // 小数ステップ(PRの0.01など)で誤差が出ないよう、step単位に丸める
  const round = (v) => Math.round(v / step) * step
  const step1 = (dir) => onChange(clamp(round(value + dir * step)))

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="font-mono font-semibold text-orange-600">
          {value}
          <span className="ml-0.5 text-xs text-gray-400">{unit}</span>
        </span>
      </div>

      <div className="mt-1 flex items-center gap-2">
        {/* − ボタン(44px相当の大きめタップ領域) */}
        <button
          type="button"
          aria-label={`${label}を減らす`}
          onClick={() => step1(-1)}
          disabled={value <= min}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-bold text-gray-600 transition hover:bg-orange-50 disabled:opacity-40"
        >
          −
        </button>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="min-w-0 flex-1"
        />

        {/* ＋ ボタン */}
        <button
          type="button"
          aria-label={`${label}を増やす`}
          onClick={() => step1(1)}
          disabled={value >= max}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-bold text-gray-600 transition hover:bg-orange-50 disabled:opacity-40"
        >
          ＋
        </button>
      </div>

      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}
