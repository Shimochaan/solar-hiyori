import { useState } from 'react'

// ============================================================
//  計算ロジックの種明かしカード(折りたたみ式)。
//  「どんな式で出しているか」を隠さず見せる = 信頼につながるし、
//  そのまま note 記事のネタにもなる。
// ============================================================
export default function LogicNote() {
  const [open, setOpen] = useState(false)

  return (
    <div className="card p-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left font-bold text-gray-900"
      >
        <span>計算の種明かし(どうやって出しているか)</span>
        <span className="text-sm font-normal text-gray-400">{open ? '閉じる ▲' : '開く ▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3 text-sm text-gray-600">
          <p>このアプリは Open-Meteo の日射量データに、次の式を掛けています。</p>
          <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 font-mono text-xs text-orange-700 ring-1 ring-gray-100">
{`発電量(kWh) = 面積A(㎡) × 効率η × 日射量H(kWh/㎡) × PR`}
          </pre>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>A 面積</b>:パネルを敷く広さ。</li>
            <li><b>η 効率</b>:光を電気に変える割合(最新品で約20%)。</li>
            <li><b>H 日射量</b>:Open-Meteoの実測/予報。MJ/m²を÷3.6でkWh/m²に変換。</li>
            <li><b>PR 性能比</b>:配線・温度・汚れなどのロス込み係数(0.75〜0.85)。</li>
          </ul>

          <p className="font-semibold text-gray-800">傾き・方位の補正</p>
          <p>
            日射量Hは「水平な地面」に降る量(GHI)。パネルは屋根の角度で傾けて南向きに
            置くので、実際にパネル面が受ける量は変わります。太陽の年間の通り道から
            「傾けた面が水平の何倍受けるか(transposition factor)」を計算して掛けています。
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>直達光は太陽位置から入射角を、散乱光は等方性+太陽方向の集中(Hay簡易)で評価。</li>
            <li>係数は Open-Meteo の傾斜面実測データで較正済み(実用域=傾き10〜45°・東〜西で誤差±3%)。</li>
            <li>目安:南向き30°で年<b>+12%</b>ほど。真東/真西で約−8%、寝かせる(0°)と基準(±0%)。</li>
          </ul>

          <hr className="border-gray-100" />

          <p className="font-semibold text-gray-800">投資回収の計算</p>
          <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 font-mono text-xs text-emerald-700 ring-1 ring-gray-100">
{`年間メリット = 自家消費kWh×買電単価 + 売電kWh×売電単価
回収年数   = 初期費用(パネル+蓄電池) ÷ 年間メリット`}
          </pre>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>自家消費率</b>:在宅パターン(30〜40%)+蓄電池(+30pt・上限80%)で推定。</li>
            <li><b>年間消費量</b>:1,800kWh + 900kWh×(人数−1) の簡易式(推定)。</li>
            <li><b>設置費用</b>:新築 約28.9万円/kWp、蓄電池 約15万円/kWh(調達価格等委員会2025-26)。</li>
            <li><b>売電単価(FIT・2段階)</b>:1〜4年目 24円 / 5〜10年目 8.3円 / 11年目〜 約8.5円。初期に厚い最新スキーム。</li>
            <li><b>補助金</b>:自治体で激変(東京都=太陽光〜15万/kW・蓄電池10万/kWh等)。初期費用から控除。</li>
          </ul>

          <p className="font-semibold text-gray-800">25年の収支に織り込んでいること</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>パネル劣化</b>:年0.5%ずつ発電量が低下。</li>
            <li><b>パワコン交換</b>:15年目に約20万円の支出。</li>
            <li><b>定期点検</b>:約4万円を数年ごと。</li>
            <li><b>廃棄費用</b>:最終年に約40万円(将来負債)。</li>
            <li><b>電気代の値上がり</b>:年1%(自家消費の価値が上がる)。</li>
          </ul>

          <p className="font-semibold text-gray-800">投資指標(KPI)</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>LCOE</b>:(実質初期費用+生涯の維持・廃棄費)÷生涯総発電量。自前の電気1kWhの原価。</li>
            <li><b>IRR</b>:全キャッシュフローからNPV=0となる年率(投信や預金利回りと比較できる)。</li>
            <li><b>回収期間</b>:累積収支が初めてプラスに転じる年。</li>
          </ul>

          <p className="text-xs text-gray-400">
            ※費用・消費量・単価は【推定の初期値】。出典の目安は資源エネルギー庁・調達価格等委員会の
            資料。地域/業者/年度で変わるためスライダーで調整できます。
          </p>
          <p className="text-xs text-gray-400">
            ※簡易シミュレーション。傾き・方位・近隣の影(3D)は反映済みですが、いずれも
            較正済みの近似です。設置判断は専門業者の現地調査と併せてご利用ください。
          </p>
        </div>
      )}
    </div>
  )
}
