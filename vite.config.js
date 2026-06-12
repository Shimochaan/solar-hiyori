import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Tailwind CSS v4 は Vite プラグインとして読み込む(設定ファイル不要になった新方式)
import tailwindcss from '@tailwindcss/vite'
// Cesium(3D地図)の静的アセット(Workers/Assets/Widgets)を正しく配置するプラグイン
import cesium from 'vite-plugin-cesium'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cesium()],
})
