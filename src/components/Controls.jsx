import Slider from './Slider'

// パネルの方位(度)を日本語ラベルに。南=0・東=−・西=+。
function azimuthLabel(deg) {
  if (deg === 0) return '真南(ベスト)'
  if (deg === -90) return '真東'
  if (deg === 90) return '真西'
  return `南${deg < 0 ? '東' : '西'}に${Math.abs(deg)}°`
}

// ============================================================
//  パネルの設定を入力するコンポーネント。
//  値は親(App)が state で持ち、ここは「表示と変更」だけ担当する
//  (= 制御コンポーネント。値の出どころは1か所=親に集約する書き方)。
//  tiltGain: 傾き・方位による発電量の増減(水平比の倍率)。場所未選択ならnull。
// ============================================================
export default function Controls({ settings, onChange, tiltGain = null }) {
  // settings の一部だけ更新するヘルパー(他の値は残す)
  const update = (patch) => onChange({ ...settings, ...patch })
  const az = settings.azimuthDeg
  const azClamp = (v) => Math.min(90, Math.max(-90, v))

  return (
    <div className="card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900">
        <span className="step-badge">2</span>パネルを想定する
      </h2>
      <div className="space-y-4">
        <Slider
          label="パネル面積"
          hint="屋根や土地に敷く広さ。一般的な住宅でだいたい 15〜30㎡。"
          value={settings.areaM2}
          min={5}
          max={100}
          step={1}
          unit="㎡"
          onChange={(v) => update({ areaM2: v })}
        />
        <Slider
          label="変換効率 η"
          hint="パネルが光を電気に変える割合。最新の家庭用で約20%。"
          value={Math.round(settings.efficiency * 100)}
          min={10}
          max={25}
          step={1}
          unit="%"
          // 画面は%、内部は小数(0.20)で持つので変換する
          onChange={(v) => update({ efficiency: v / 100 })}
        />
        <Slider
          label="性能比 PR"
          hint="配線損失・パネル温度・汚れなどのロス込みの係数。屋根設置で0.75〜0.85。"
          value={settings.pr}
          min={0.6}
          max={0.9}
          step={0.01}
          unit=""
          onChange={(v) => update({ pr: v })}
        />
        <Slider
          label="電気代単価(買う)"
          hint="電力会社から買う電気の単価(円/kWh)。自家消費=この単価ぶん節約になる。"
          value={settings.pricePerKwh}
          min={10}
          max={40}
          step={1}
          unit="円/kWh"
          onChange={(v) => update({ pricePerKwh: v })}
        />

        {/* 傾き(屋根の角度)。日本の戸建ては30°前後が標準。 */}
        <Slider
          label="パネルの傾き"
          hint="屋根の勾配。日本の戸建ては30°前後が標準。寝かせる(0°)より傾けた方がよく稼ぐ。"
          value={settings.tiltDeg}
          min={0}
          max={60}
          step={1}
          unit="°"
          onChange={(v) => update({ tiltDeg: v })}
        />

        {/* 方位(向き)。南=0が最良。東西にずれるほど発電は減る。 */}
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-gray-700">パネルの向き</span>
            <span className="font-mono font-semibold text-orange-600">{azimuthLabel(az)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              aria-label="向きを東へ"
              onClick={() => update({ azimuthDeg: azClamp(az - 15) })}
              disabled={az <= -90}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-bold text-gray-600 transition hover:bg-orange-50 disabled:opacity-40"
            >
              −
            </button>
            <input
              type="range"
              min={-90}
              max={90}
              step={15}
              value={az}
              onChange={(e) => update({ azimuthDeg: Number(e.target.value) })}
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              aria-label="向きを西へ"
              onClick={() => update({ azimuthDeg: azClamp(az + 15) })}
              disabled={az >= 90}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-bold text-gray-600 transition hover:bg-orange-50 disabled:opacity-40"
            >
              ＋
            </button>
          </div>
          <div className="mt-1 flex justify-between px-9 text-xs text-gray-400">
            <span>東</span><span>南</span><span>西</span>
          </div>
        </div>

        {/* 傾き・方位の効果を即時フィードバック(水平比で何%増減か) */}
        {tiltGain != null && (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            この傾き・向きだと、寝かせて置く(水平)場合に比べ発電量は
            <b className={tiltGain >= 1 ? 'text-emerald-600' : 'text-red-500'}>
              {' '}{tiltGain >= 1 ? '+' : ''}{Math.round((tiltGain - 1) * 100)}%
            </b>
            。<span className="text-gray-400">南向き30°前後がいちばん稼ぎます。</span>
          </p>
        )}
      </div>
    </div>
  )
}
