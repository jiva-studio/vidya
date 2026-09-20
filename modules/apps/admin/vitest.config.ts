import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',

      // A page test mounts the whole editor — the document, an overlay, and a
      // real CodeMirror — and five seconds is not enough for that on a loaded
      // machine. The limit is here to catch a hang, not to time the renderer.
      testTimeout: 20_000,
      globals: true,
      include: ['src/**/*.spec.ts'],
      setupFiles: ['./vitest.setup.ts'],
    },
  }),
)
