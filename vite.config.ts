import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Относительные пути — сборка работает в любой подпапке (GitHub Pages /repo/)
  base: './',
  plugins: [react()],
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