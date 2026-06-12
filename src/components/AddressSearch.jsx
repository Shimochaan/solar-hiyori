import { useState } from 'react'
import { geocodeAddress } from '../lib/geocode'

// ============================================================
//  住所・地名を入力 → 候補を出して選ぶコンポーネント。
//  選ばれた場所(緯度経度)は onSelect で親(App)に渡す。
//  「これから買う土地」も番地で指定できるのがポイント。
// ============================================================
export default function AddressSearch({ onSelect, selected }) {
  const [query, setQuery] = useState('')      // 入力中の文字
  const [results, setResults] = useState([])  // 検索候補
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 検索ボタン or Enter で実行
  async function handleSearch(e) {
    e.preventDefault() // フォーム送信によるページ再読み込みを止める
    setError('')
    setLoading(true)
    try {
      const found = await geocodeAddress(query)
      setResults(found)
      if (found.length === 0) setError('候補が見つかりませんでした。番地まで含む住所で試してください。')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
        <span className="step-badge">1</span>場所を決める
      </h2>
      <p className="mt-1.5 mb-3 text-sm text-gray-500">
        今の家でも、これから買う土地でもOK。番地まで入れると地図にピンが立ちます。
      </p>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例: 千葉市中央区中央1-1、つくば市吾妻2-1"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-lg bg-orange-500 px-4 py-2.5 font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? '検索中…' : '検索'}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {/* 検索候補のリスト */}
      {results.length > 0 && (
        <ul className="mt-3 space-y-1">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => {
                  onSelect(r)      // 親に選択結果を渡す
                  setResults([])   // 候補リストを閉じる
                }}
                className="w-full rounded-lg px-3 py-3 text-left text-sm text-gray-700 transition hover:bg-orange-50"
              >
                {r.name}
                <span className="ml-2 text-xs text-gray-400">
                  ({r.latitude.toFixed(4)}, {r.longitude.toFixed(4)})
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 現在選択中の場所 */}
      {selected && (
        <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-700">
          選択中: <b>{selected.name}</b>
        </p>
      )}
    </div>
  )
}
