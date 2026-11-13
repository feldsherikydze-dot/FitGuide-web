import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Версия берётся из package.json, время сборки — момент запуска сборки.
// Нужно, чтобы на экране было видно, какая сборка открыта: свежая или из кэша.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const buildStamp = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`

export default defineConfig({
  // Относительные пути - сборка работает в любой подпапке (GitHub Pages /repo/)
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_STAMP__: JSON.stringify(buildStamp),
  },
  build: {
    // esbuild вместо rolldown: у rolldown на Windows проблемы с native binding
    minify: 'esbuild',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2023',
    },
  },
})
