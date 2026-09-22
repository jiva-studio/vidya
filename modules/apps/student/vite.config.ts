import path from 'node:path'

import tailwind from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const port = Number(process.env.VIDYA_STUDENT_PORT || 7814)
const apiUrl = process.env.VIDYA_API_URL || 'http://localhost:7810'

export default defineConfig({
  plugins: [vue(), tailwind()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),

      // The design tokens are owned by @vidya/ui and read, never written, here.
      '@ui': path.resolve(import.meta.dirname, '../../libs/ui/src'),
    },
  },
  server: {
    port,
    strictPort: true,

    // The site and the console are different origins — different ports here,
    // different hosts in production — so each proxies /api to the API itself
    // and neither needs CORS.
    proxy: {
      '/api': {
        target: apiUrl,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
