import { defineConfig } from '../../apps/desktop/node_modules/@playwright/test/index.mjs'

export default defineConfig({
  testDir: './qa',
  testMatch: '*.spec.mjs',
  timeout: 45_000,
  workers: 2,
  fullyParallel: true,
  outputDir: './qa/test-results',
  reporter: [['list'], ['json', { outputFile: './qa/results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4317',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 900 },
    video: { mode: 'on', size: { width: 1280, height: 900 } },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
