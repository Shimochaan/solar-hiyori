import Slider from './Slider'

// 2択トグル(在宅パターン・蓄電池の有無)用の小さな部品
function Toggle({ label, hint, options, value, onChange }) {
  return (
    <div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-1.5 flex gap-2">
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={
              'flex-1 rounded-lg px-3 py-2.5 text-sm transition ' +
              (value === opt.value
                ? 'bg-orange-500 font-bold text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-orange-50')
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

// ============================================================
//  「投資の前提」入力パネル(Phase A)。
//  家族構成・暮らし方・蓄電池・費用相場をまとめて受け持つ。
// ============================================================
export default function InvestmentControls({ settings, onChange }) {
  const update = (patch) => onChange({ ...settings, ...patch })

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
        <span className="step-badge">3</span>投資の前提(暮らし方とお金)
      </h2>
      <p className="mt-1.5 mb-4 text-sm text-gray-500">
        家族構成や蓄電池の有無で「自家消費の割合」が変わり、回収年数に効きます。
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Slider
          label="世帯人数"
          hint="多いほど電気を使う=自家消費が増えやすい。"
          value={settings.householdSize}
          min={1}
          max={6}
          step={1}
          unit="人"
          onChange={(v) => update({ householdSize: v })}
        />

        <Toggle
          label="日中の在宅"
          hint="日中に家で電気を使うほど、発電を自分で使えてお得。"
          value={settings.homePattern}
          onChange={(v) => update({ homePattern: v })}
          options={[
            { label: '日中いない', value: 'away' },
            { label: '在宅多め', value: 'home' },
          ]}
        />

        <Toggle
          label="蓄電池"
          hint="昼の余りを夜に回せる。自家消費は増えるが初期費用も増える。"
          value={settings.hasBattery}
          onChange={(v) => update({ hasBattery: v })}
          options={[
            { label: 'なし', value: false },
            { label: 'あり', value: true },
          ]}
        />

        {/* 蓄電池ありのときだけ容量スライダーを出す */}
        {settings.hasBattery && (
          <Slider
            label="蓄電池の容量"
            hint="家庭用の代表は5〜10kWh。"
            value={settings.batteryKwh}
            min={3}
            max={16}
            step={1}
            unit="kWh"
            onChange={(v) => update({ batteryKwh: v })}
          />
        )}

        <Slider
          label="設置費用の相場"
          hint="パネル1kWあたりの工事込み費用(円/kWp)。"
          value={settings.costPerKwp / 10000}
          min={15}
          max={40}
          step={1}
          unit="万円/kWp"
          onChange={(v) => update({ costPerKwp: v * 10000 })}
        />

        {settings.hasBattery && (
          <Slider
            label="蓄電池の費用相場"
            hint="蓄電池1kWhあたりの費用(円/kWh)。"
            value={settings.costPerBatteryKwh / 10000}
            min={8}
            max={30}
            step={1}
            unit="万円/kWh"
            onChange={(v) => update({ costPerBatteryKwh: v * 10000 })}
          />
        )}

        {/* 補助金:自治体で激変するためプリセットで選ぶ(初期費用から控除) */}
        <div className="sm:col-span-2">
          <Toggle
            label="補助金"
            hint="自治体で大きく変わる。東京都はとくに手厚く、初期費用を大幅に圧縮できる。"
            value={settings.subsidyPreset}
            onChange={(v) => update({ subsidyPreset: v })}
            options={[
              { label: 'なし', value: 'none' },
              { label: '東京都(目安)', value: 'tokyo' },
              { label: '都+区(手厚い)', value: 'rich' },
            ]}
          />
        </div>
      </div>

      {/* 売電単価は2025下半期〜のFIT2段階制を自動適用(調査.mdに基づく) */}
      <p className="mt-3 text-xs text-gray-400">
        売電単価は最新のFIT(1〜4年目24円 / 5〜10年目8.3円 / 以降は市場相場)を自動で適用します。
      </p>
    </div>
  )
}
