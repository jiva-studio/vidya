import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue({ script: { defineModel: true } }), legacy()],
  define: { global: 'window' },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    // A test here compiles the SQLite wasm, migrates a database and runs the
    // sync engine against a stubbed network. That work is real and bounded,
    // and on a machine doing anything else it outlasts the runner's default
    // budget — which is a guess about test length, not a property of ours.
    testTimeout: 30_000,
  },
})
