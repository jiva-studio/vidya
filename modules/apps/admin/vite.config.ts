import path from 'node:path'

import tailwind from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const port = Number(process.env.VIDYA_ADMIN_PORT || 7811)
const apiUrl = process.env.VIDYA_API_URL || 'http://localhost:7810'

export default defineConfig({
  plugins: [vue(), tailwind()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),

      // The design tokens are owned by @vidya/ui and read, never written, here.
      // An alias keeps that single reference in one place while the package is
      // still being built out on its own branch.
      '@ui': path.resolve(import.meta.dirname, '../../libs/ui/src'),
    },
  },
  server: {
    port,
    strictPort: true,

    // Kept for the shape it gives the dev build, not because it is required:
    // the API allows this origin by name now. Everything under /api is
    // forwarded to it and the prefix is stripped on the way, so the console
    // talks to one origin here and to a real domain in production without the
    // client code knowing the difference.
    proxy: {
      '/api': {
        target: apiUrl,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
