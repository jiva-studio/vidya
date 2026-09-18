import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'
import path from 'path'
import { SFCFluentPlugin } from 'unplugin-fluent-vue/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue({ script: { defineModel: true } }),
    SFCFluentPlugin({ blockType: 'fluent', checkSyntax: true }),
    legacy(),
  ],
  define: { global: 'window' },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
