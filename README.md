# ☀️ ソーラー発電日和

「もしここにソーラーパネルを置いたら、どれくらい発電して、いくら稼げるか?」を、
住所とパネル面積から試算する Web アプリ。今の家でも、これから買う土地でもOK。

> 屋根を遊ばせておくのは、油田を放置するのと同じだ。

## 起動方法
```bash
npm install      # 初回だけ
npm run dev      # 開発サーバー起動 → http://localhost:5173/
npm run build    # 本番用ビルド(dist/ に出力)
```

## 3D影シミュレーション用のトークン設定(任意)
3Dで近隣の影を見る機能には、無料の **Cesium ion トークン**が必要です(未設定でも他の機能は動きます)。
```bash
cp .env.example .env        # テンプレをコピー
# .env を開き、cesium.com で発行した無料トークンを VITE_CESIUM_ION_TOKEN= に貼る
npm run dev                 # 再起動して反映
```
トークン取得: https://cesium.com/ion/signup (無料・クレカ不要) → https://cesium.com/ion/tokens の Default Token をコピー

## どのファイルが何をしているか(学習用ガイド)
コードを読むときは、この順番で追うと分かりやすい。

| ファイル | 役割 |
|---|---|
| `src/lib/solar.js` | **発電量の心臓部**。発電量の計算式・スコア化。まずここを読む。 |
| `src/lib/economics.js` | **お金の心臓部**。投資回収・LCOE・IRR・補助金・FIT2段階・損失回避。 |
| `src/lib/openMeteo.js` | Open-Meteo から日射量データを取る係。 |
| `src/lib/geocode.js` | 国土地理院APIで住所(番地)→緯度経度。 |
| `src/lib/shading.js` | 太陽位置サンプリング→影による発電ロス率の推定(3Dと独立した純計算)。 |
| `src/App.jsx` | 全体の司令塔。状態(state)を持ち、データ取得→計算→各画面に配る。 |
| `src/components/AddressSearch.jsx` | 場所の検索・選択(番地対応)。 |
| `src/components/MapView.jsx` | 選んだ場所を地図にピン表示(Leaflet+OSM)。 |
| `src/components/Controls.jsx` `InvestmentControls.jsx` | パネル設定 / 投資の前提(家族構成・蓄電池・補助金)の入力。 |
| `src/components/ResultCards.jsx` `PaybackSection.jsx` | スコア/脳内設置/年間 と 投資回収/KPI/損失回避/収支グラフ。 |
| `src/components/Shadow3D.jsx` | 3D影シミュレーション(Cesium・遅延読み込み・要トークン)。 |
| `src/components/Charts.jsx` `Slider.jsx` `icons.jsx` `LogicNote.jsx` | グラフ / 共通スライダー / アイコン / 計算の種明かし。 |

## 計算式
```
発電量(kWh) = 面積A(㎡) × 変換効率η × 日射量H(kWh/㎡) × 性能比PR
```
日射量 H は Open-Meteo の実測/予報(MJ/m² を ÷3.6 で kWh/m² に変換)。

## データ提供
- [Open-Meteo](https://open-meteo.com/)(日射量・無料・キー不要)
- [国土地理院](https://www.gsi.go.jp/)(住所ジオコーディング・無料・キー不要)
- [OpenStreetMap](https://www.openstreetmap.org/) / [Cesium](https://cesium.com/)(地図・3D建物)

## 技術
Vite + React + Tailwind CSS v4 + Recharts
