import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import SunCalc from 'suncalc'
import { sampleSunPositions, shadingLoss, panelCellsENU } from '../lib/shading'

// ============================================================
//  Shadow3D ―― 3Dで周辺建物を表示し、屋根のパネルに「光がどう当たるか」を見せる。
//
//  【A】パネル可視化:傾き・方位を反映した板を屋根に描画。
//        ▶再生で1日の太陽が動き、隣家の影がパネルを横切る様子が見える。
//        ・再生中:パネル全体が「日向=オレンジ / 日陰=グレー」で色変化。
//        ・計算後:パネルを格子に切り、年間の日当たり%をヒートマップ表示。
//  【B】建物データ:国交省 PLATEAU(Japan 3D Buildings, Cesium ion asset 2602291)。
//        実際の建物形状で日本の住宅地の遮蔽がリアルに。失敗時はOSMへ自動フォールバック。
//
//  ・重い(Cesiumは大きい)ので App からは遅延読み込み(lazy)で呼ぶ。
//  ・Cesium ionの無料トークンが必要。未設定なら案内を表示して終わる。
// ============================================================
const TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN
const PLATEAU_ASSET_ID = 2602291 // Cesium ion「Japan 3D Buildings」(PLATEAU由来・全国)

// 日当たり率 p(0〜1)→ グレー〜オレンジの色。ヒートマップ用。
function heatColor(p) {
  // slate(0.55,0.6,0.66) → orange(0.98,0.45,0.09) を線形補間
  const r = 0.55 + (0.98 - 0.55) * p
  const g = 0.6 + (0.45 - 0.6) * p
  const b = 0.66 + (0.09 - 0.66) * p
  return new Cesium.Color(r, g, b, 0.92)
}

export default function Shadow3D({ lat, lon, label, tiltDeg = 30, azimuthDeg = 0, areaM2 = 20, onShadingComputed }) {
  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const panelRef = useRef([])       // パネル格子セルのEntity配列
  const beamRef = useRef(null)      // パネル位置の「光の柱」Entity
  const frameRef = useRef(null)     // ENU→ECEF変換の材料 {origin, rot}
  const playTimerRef = useRef(null) // 再生アニメのタイマー
  const [month, setMonth] = useState(6)
  const [hour, setHour] = useState(12)
  const [computing, setComputing] = useState(false)
  const [loss, setLoss] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [mode, setMode] = useState('live')  // 'live'(再生)|'heatmap'(計算後)
  const [source, setSource] = useState('')   // 使った建物データ名(PLATEAU/OSM)

  // --- トークン未設定なら、3Dは出さず案内だけ ---
  if (!TOKEN) {
    return (
      <div className="card p-6 text-sm text-gray-600">
        <h3 className="font-bold text-gray-900">3D 影シミュレーション</h3>
        <p className="mt-2">
          3D表示には無料の Cesium ion トークンが必要です。
          プロジェクト直下の <code className="rounded bg-gray-100 px-1">.env.example</code> を
          <code className="rounded bg-gray-100 px-1">.env</code> にコピーし、
          <a className="text-orange-600 underline" href="https://cesium.com/ion/tokens" target="_blank" rel="noreferrer">cesium.com</a>
          で発行した無料トークンを貼って再起動してください。
        </p>
      </div>
    )
  }

  // --- 初回:ビューア・建物・カメラを用意 ---
  useEffect(() => {
    Cesium.Ion.defaultAccessToken = TOKEN
    let viewer
    let canceled = false

    async function init() {
      viewer = new Cesium.Viewer(containerRef.current, {
        baseLayerPicker: false, geocoder: false, homeButton: false,
        sceneModePicker: false, navigationHelpButton: false, animation: false,
        timeline: false, fullscreenButton: false, selectionIndicator: false, infoBox: false,
      })
      viewerRef.current = viewer

      viewer.scene.globe.enableLighting = true // 太陽光で陰影
      viewer.shadows = true                     // 建物が影を落とす
      viewer.clock.shouldAnimate = false        // 時刻はスライダー/再生で操作

      // --- イラスト寄りの“デザインされた3D”にする ---
      // ① 航空写真は使わず、地面をフラットな淡色に(街がごちゃつかず建物が際立つ)
      viewer.imageryLayers.removeAll()
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#e9eef3')
      viewer.scene.globe.showGroundAtmosphere = false
      // ② 影を濃く・やわらかく(影が「写っている」と一目で分かるように)
      viewer.shadowMap.darkness = 0.32
      viewer.shadowMap.softShadows = true
      viewer.shadowMap.size = 2048
      // ③ 空はうっすら(イラストの背景的に)
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.brightnessShift = 0.2

      // 建物をフラットな淡色のブロックに塗るスタイル(写真の代わりに“図”として見せる)
      const FLAT_STYLE = new Cesium.Cesium3DTileStyle({ color: "color('#c8d3e0')" })

      // 【B】建物:PLATEAU(実形状)を試し、ダメならOSM(箱型)へフォールバック
      try {
        const plateau = await Cesium.Cesium3DTileset.fromIonAssetId(PLATEAU_ASSET_ID)
        if (canceled) return
        plateau.shadows = Cesium.ShadowMode.ENABLED
        plateau.style = FLAT_STYLE
        viewer.scene.primitives.add(plateau)
        setSource('PLATEAU(実建物形状)')
      } catch {
        try {
          const osm = await Cesium.createOsmBuildingsAsync()
          if (canceled) return
          osm.shadows = Cesium.ShadowMode.ENABLED
          osm.style = FLAT_STYLE
          viewer.scene.primitives.add(osm)
          setSource('OpenStreetMap(箱型・簡易)')
        } catch (e) {
          console.warn('建物データの読み込みに失敗:', e)
        }
      }

      // 「ここが対象地」マーカー。建物に紛れて場所を見失わないように、
      // ① 地面に貼り付くハイライト円 ② 建物の裏でも貫通して見えるピン+ラベル
      // を置く(高さサンプリング不要なので即表示できる)。
      const groundPos = Cesium.Cartesian3.fromDegrees(lon, lat)
      viewer.entities.add({
        position: groundPos,
        ellipse: {
          semiMinorAxis: 7, semiMajorAxis: 7,
          material: Cesium.Color.fromCssColorString('#f97316').withAlpha(0.35),
          outline: true, outlineColor: Cesium.Color.fromCssColorString('#f97316'),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          classificationType: Cesium.ClassificationType.BOTH, // 地面にも建物にも貼る
        },
      })
      viewer.entities.add({
        position: groundPos,
        point: {
          pixelSize: 13,
          color: Cesium.Color.fromCssColorString('#f97316'),
          outlineColor: Cesium.Color.WHITE, outlineWidth: 3,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY, // 建物の裏でも見える
        },
        label: {
          text: 'ここが対象地',
          font: 'bold 14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#ea580c').withAlpha(0.95),
          backgroundPadding: new Cesium.Cartesian2(8, 5),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })

      // 対象の土地へ斜め上空から寄る
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat - 0.0009, 180),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-30) },
        duration: 1.5,
      })

      // 建物・地形が読み込まれた頃にパネルを建てる(高さサンプリングのため少し待つ)
      setTimeout(() => { if (!canceled) buildPanel() }, 2600)
    }
    init()

    return () => {
      canceled = true
      if (playTimerRef.current) clearInterval(playTimerRef.current)
      if (viewer && !viewer.isDestroyed()) viewer.destroy()
      viewerRef.current = null
      panelRef.current = []
      frameRef.current = null
    }
    // 場所が変わったら作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon])

  // --- パネル板を屋根に建てる(傾き・方位・面積を反映) ---
  function buildPanel() {
    const viewer = viewerRef.current
    if (!viewer) return
    // 既存パネル・光の柱を片付け
    panelRef.current.forEach((e) => viewer.entities.remove(e))
    panelRef.current = []
    if (beamRef.current) { viewer.entities.remove(beamRef.current); beamRef.current = null }

    // 屋根の高さ:その地点の一番上(建物があれば屋根、無ければ地面)+クリアランス
    const carto = Cesium.Cartographic.fromDegrees(lon, lat)
    let top = 0
    try { top = viewer.scene.sampleHeight(carto) ?? 0 } catch { top = 0 }
    if (!top || top < 0) top = 0
    const baseH = top + 0.5
    const origin = Cesium.Cartesian3.fromDegrees(lon, lat, baseH)
    const enuToFixed = Cesium.Transforms.eastNorthUpToFixedFrame(origin)
    const rot = Cesium.Matrix4.getMatrix3(enuToFixed, new Cesium.Matrix3())
    frameRef.current = { origin, rot, baseH }

    // ENUの向き(東,北,上)→ ECEFの位置に変換する小道具
    const toEcef = (enu) => {
      const dir = Cesium.Matrix3.multiplyByVector(
        rot, new Cesium.Cartesian3(enu[0], enu[1], enu[2]), new Cesium.Cartesian3()
      )
      return Cesium.Cartesian3.add(origin, dir, new Cesium.Cartesian3())
    }

    const side = Math.max(2, Math.sqrt(areaM2)) // 一辺(㎡の平方根)
    const cells = panelCellsENU(tiltDeg, azimuthDeg, side, 5, 4)
    for (const cell of cells) {
      const positions = cell.corners.map(toEcef)
      const ent = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          perPositionHeight: true, // 各頂点の高さをそのまま使う=傾けられる
          material: heatColor(0.6), // 初期は中間色
          outline: true,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.6),
        },
      })
      ent._cell = cell // 後でレイ計算に使うセル情報を持たせておく
      panelRef.current.push(ent)
    }

    // パネル位置から立ち上がる「光の柱」。どの角度からでも対象地が分かる目印。
    beamRef.current = viewer.entities.add({
      polyline: {
        positions: [
          Cesium.Cartesian3.fromDegrees(lon, lat, baseH),
          Cesium.Cartesian3.fromDegrees(lon, lat, baseH + 22),
        ],
        width: 6,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: Cesium.Color.fromCssColorString('#fb923c'),
        }),
      },
    })

    applyLiveLighting() // 現在時刻の日向/日陰でいったん塗る
    viewer.scene.requestRender()
  }

  // --- 太陽方向のレイが建物に遮られるか(ENUのある点を始点に) ---
  function makeOccluder(originEcef) {
    const viewer = viewerRef.current
    const scene = viewer.scene
    return (suncalcAz, altitude) => {
      const bearing = Math.PI + suncalcAz
      const dirEnu = new Cesium.Cartesian3(
        Math.cos(altitude) * Math.sin(bearing),
        Math.cos(altitude) * Math.cos(bearing),
        Math.sin(altitude),
      )
      const { rot } = frameRef.current
      const dirEcef = Cesium.Matrix3.multiplyByVector(rot, dirEnu, new Cesium.Cartesian3())
      Cesium.Cartesian3.normalize(dirEcef, dirEcef)
      const ray = new Cesium.Ray(originEcef, dirEcef)
      const hit = scene.pickFromRay(ray, []) // 始点をパネルの少し上に置いて自己遮蔽を避ける
      return Cesium.defined(hit) && Cesium.defined(hit.object)
    }
  }

  // --- 現在の月・時刻で、パネル全体を日向/日陰の単色に塗る(再生モード用) ---
  function applyLiveLighting() {
    const viewer = viewerRef.current
    if (!viewer || !frameRef.current || panelRef.current.length === 0) return
    const year = new Date().getFullYear()
    const d = new Date(Date.UTC(year, month - 1, 15, hour - 9, 0, 0))
    const pos = SunCalc.getPosition(d, lat, lon)
    // パネル中心の少し上(+0.6m)を始点に(自分の板に当たらないように)
    const { origin, rot } = frameRef.current
    const upEnu = Cesium.Matrix3.multiplyByVector(rot, new Cesium.Cartesian3(0, 0, 0.6), new Cesium.Cartesian3())
    const liftedOrigin = Cesium.Cartesian3.add(origin, upEnu, new Cesium.Cartesian3())
    const occluded = makeOccluder(liftedOrigin)
    let lit
    if (pos.altitude <= 0.02) {
      lit = false // 太陽が地平線下=夜
    } else {
      lit = !occluded(pos.azimuth, pos.altitude)
    }
    const color = pos.altitude <= 0.02
      ? new Cesium.Color(0.3, 0.34, 0.4, 0.9)       // 夜:濃いグレー
      : lit
        ? new Cesium.Color(0.98, 0.55, 0.12, 0.95)  // 日向:オレンジ
        : new Cesium.Color(0.5, 0.55, 0.62, 0.92)   // 日陰:グレー
    panelRef.current.forEach((e) => { e.polygon.material = color })
    viewer.scene.requestRender()
  }

  // --- 月・時刻が変わったら太陽(影)を動かし、再生モードなら色も更新 ---
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const year = new Date().getFullYear()
    const utc = new Date(Date.UTC(year, month - 1, 15, hour - 9, 0, 0))
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(utc)
    if (mode === 'live') applyLiveLighting()
    viewer.scene.requestRender()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, hour])

  // --- ▶再生:日の出〜日の入りを自動で進める ---
  function togglePlay() {
    if (playing) {
      clearInterval(playTimerRef.current)
      setPlaying(false)
      return
    }
    setMode('live')
    setPlaying(true)
    setHour(5)
    playTimerRef.current = setInterval(() => {
      setHour((h) => {
        if (h >= 19) { clearInterval(playTimerRef.current); setPlaying(false); return 19 }
        return h + 1
      })
    }, 550)
  }

  // --- 年間の日当たりヒートマップを計算(パネルを格子で評価) ---
  async function computeHeatmap() {
    const viewer = viewerRef.current
    if (!viewer || panelRef.current.length === 0) { buildPanel() }
    setComputing(true)
    setMode('heatmap')
    try {
      const { rot } = frameRef.current
      const samples = sampleSunPositions(lat, lon, new Date().getFullYear())
      const toEcef = (enu) => {
        const dir = Cesium.Matrix3.multiplyByVector(
          rot, new Cesium.Cartesian3(enu[0], enu[1], enu[2]), new Cesium.Cartesian3()
        )
        return Cesium.Cartesian3.add(frameRef.current.origin, dir, new Cesium.Cartesian3())
      }
      let totalLit = 0
      let totalWeight = 0
      for (const ent of panelRef.current) {
        const cell = ent._cell
        // セル中心の少し上(法線方向ではなく単純に+0.3m上)を始点に
        const c = cell.center
        const originCell = toEcef([c[0], c[1], c[2] + 0.3])
        const occluded = makeOccluder(originCell)
        const cellLoss = shadingLoss(samples, occluded) // このセルの遮蔽率
        const lit = 1 - cellLoss
        ent.polygon.material = heatColor(lit)
        // 全体ロスは「日射の重み付き」で集計したいので、セルごとに weight×lit を足す
        // (shadingLoss が既に重み付け済みなので、ここは単純平均で代表させる)
        totalLit += lit
        totalWeight += 1
      }
      const avgLit = totalWeight > 0 ? totalLit / totalWeight : 1
      const lossFraction = Math.max(0, Math.min(1, 1 - avgLit))
      setLoss(lossFraction)
      onShadingComputed?.(lossFraction)
      viewer.scene.requestRender()
    } catch (e) {
      console.warn('日当たり計算に失敗(ベータ):', e)
      setLoss(0)
      onShadingComputed?.(0)
    } finally {
      setComputing(false)
    }
  }

  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="font-bold text-gray-900">3D 日当たりシミュレーション</h3>
        <span className="text-xs text-gray-400">{source || '建物読み込み中…'}</span>
      </div>

      <div ref={containerRef} className="h-80 w-full overflow-hidden rounded-xl bg-slate-200" />

      {/* 再生 + 時刻・季節スライダー */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={togglePlay}
          className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-gray-700"
        >
          {playing ? '⏸ 停止' : '▶ 1日の太陽を再生'}
        </button>
        <span className="text-xs text-gray-500">影がパネル(板)を横切る様子が見えます</span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <div className="flex justify-between text-sm text-gray-700">
            <span>季節(月)</span><span className="font-mono text-orange-600">{month}月</span>
          </div>
          <input type="range" min={1} max={12} step={1} value={month}
            onChange={(e) => { setMode('live'); setMonth(Number(e.target.value)) }} className="w-full" />
        </label>
        <label className="block">
          <div className="flex justify-between text-sm text-gray-700">
            <span>時刻</span><span className="font-mono text-orange-600">{hour}時</span>
          </div>
          <input type="range" min={5} max={19} step={1} value={hour}
            onChange={(e) => { setMode('live'); setHour(Number(e.target.value)) }} className="w-full" />
        </label>
      </div>

      {/* 年間ヒートマップの計算 */}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
        <button
          onClick={computeHeatmap}
          disabled={computing}
          className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
        >
          {computing ? '計算中…' : '年間の日当たりを計算(ヒートマップ)'}
        </button>
        {loss != null && (
          <p className="text-sm text-gray-700">
            影による年間ロス:<b className="text-orange-600">約 {(loss * 100).toFixed(0)}%</b>
            <span className="ml-1 text-xs text-gray-400">(発電量・回収年数に反映)</span>
          </p>
        )}
      </div>

      {/* 凡例 */}
      {mode === 'heatmap' && loss != null && (
        <div className="mt-2 flex items-center gap-2 px-1 text-xs text-gray-500">
          <span>日陰</span>
          <span className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(90deg,#8c99a8,#fb7309)' }} />
          <span>日向</span>
          <span className="ml-2 text-gray-400">…パネルの各マスが年間どれだけ陽を浴びるか</span>
        </div>
      )}

      <p className="mt-2 px-1 text-xs text-gray-400">
        {label} ／ パネルは傾き{tiltDeg}°・{azimuthDeg === 0 ? '真南' : `南${azimuthDeg < 0 ? '東' : '西'}${Math.abs(azimuthDeg)}°`}向きで描画。
        ※建物・影ロスは近似のベータ機能です。
      </p>
    </div>
  )
}
