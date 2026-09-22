import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',

      // One suite builds the real bundle to read the policy that ships; that
      // work is bounded but longer than a runner's guess at a test's length.
      testTimeout: 30_000,
      globals: true,
      include: ['src/**/*.spec.ts'],
      setupFiles: ['./vitest.setup.ts'],
    },
  }),
)
