import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cpSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Generate locally from the pinned package; no runtime CDN, token, or copy middleware.
// Vite serves public/ in development and copies it into dist for production.
const cesiumPublic = fileURLToPath(new URL('./public/cesiumStatic/', import.meta.url))
mkdirSync(cesiumPublic, { recursive: true })
for (const name of ['ThirdParty', 'Workers', 'Assets', 'Widgets']) {
  cpSync(fileURLToPath(new URL(`./node_modules/cesium/Build/Cesium/${name}`, import.meta.url)),
    `${cesiumPublic}/${name}`, { recursive: true })
}

export default defineConfig({
  define: { CESIUM_BASE_URL: JSON.stringify('/cesiumStatic') },
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/nasa-tiles': {
        target: 'https://trek.nasa.gov',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/nasa-tiles/, '/tiles'),
        timeout: 20000,
        proxyTimeout: 20000,
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
