// ============================================================
//  小さなSVGアイコン置き場。絵文字をやめ、統一感のある線画にする。
//  色は className の text-* を継承する(currentColor)。
// ============================================================

// 太陽アイコン。filled=塗り(点灯) / それ以外は薄いアウトライン。
export function Sun({ filled = true, size = 22, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
    >
      <circle cx="12" cy="12" r="4" fill={filled ? 'currentColor' : 'none'} />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  )
}

// ロゴ用のシンプルな太陽マーク
export function SunLogo({ size = 28 }) {
  return <Sun filled size={size} className="text-orange-500" />
}
