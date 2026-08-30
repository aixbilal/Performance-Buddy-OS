import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  test: {
    // Pure-logic engine tests run in the fast default 'node' environment.
    // React component tests opt into jsdom per-file with a docblock:
    //   // @vitest-environment jsdom
    setupFiles: ['./vitest.setup.ts'],
    // Keep Playwright specs (e2e/) and WebdriverIO specs (wdio/) out of Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**', 'wdio/**'],
  },
})
