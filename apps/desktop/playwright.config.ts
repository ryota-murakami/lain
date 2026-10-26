import { defineConfig } from '@playwright/test'

/**
 * Playwright config for Electron E2E tests.
 * Tests launch the built Electron app directly.
 *
 * @example
 *   pnpm test:e2e           # Run all E2E tests
 *   pnpm test:e2e:ui        # Run with Playwright UI
 */
export default defineConfig({
  testDir: './e2e/specs',
  timeout: 30_000,
  workers: 1,
  retries: 1,
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts',
    },
  ],
})
