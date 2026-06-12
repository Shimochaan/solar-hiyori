import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// --- PWA: Service Worker を登録(本番ビルドでのみ) ---
// 開発中(vite dev)はSWのキャッシュが邪魔になりがちなので登録しない。
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service Worker の登録に失敗:', err)
    })
  })
}
