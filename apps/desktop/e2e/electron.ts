import { test as base, _electron as electron, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

import { mockRaindropApi } from './api-mock'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Custom Playwright fixtures for Electron E2E tests.
 * Launches the built Electron app with LAIN_TEST_MODE=1 to bypass OAuth.
 * The main process registers mock auth IPC handlers, so the app starts
 * in an authenticated state without opening the Raindrop.io login window.
 * Every launch gets a fresh temporary userData dir (LAIN_USER_DATA_DIR), so
 * persisted Redux state in localStorage cannot leak from one test to the next.
 * Runs headless (hidden BrowserWindow, no Dock icon) — set LAIN_E2E_HEADED=1
 * to watch the app while tests run.
 *
 * @example
 *   import { test, expect } from '../electron'
 *
 *   test('shows main app (auth bypassed)', async ({ page }) => {
 *     await expect(page.getByText('All Bookmarks')).toBeVisible()
 *   })
 */
type ElectronFixtures = {
  electronApp: ElectronApplication
  page: Page
}

/**
 * Launch the built Electron app in test mode against `userDataDir`.
 * Backs the `electronApp` fixture and restart tests that relaunch into the same profile.
 *
 * @param userDataDir - Directory the app uses for userData/sessionData (localStorage lives here)
 * @returns Running Electron application
 * @example
 *   const app = await launchElectronApp(fs.mkdtempSync(path.join(os.tmpdir(), 'lain-e2e-')))
 */
export async function launchElectronApp(
  userDataDir: string,
): Promise<ElectronApplication> {
  return electron.launch({
    args: [path.join(__dirname, '../dist-electron/main.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      LAIN_TEST_MODE: '1',
      LAIN_USER_DATA_DIR: userDataDir,
    },
  })
}

/**
 * First window of `app` with the Raindrop API mocked and the page reloaded, so
 * RTK Query never fires before the `page.route()` intercepts exist (CI runners
 * load the app faster than Playwright registers route handlers).
 *
 * @param app - Application returned by {@link launchElectronApp}
 * @returns Page ready for assertions against mock data
 * @example
 *   const page = await prepareFirstWindow(app)
 */
export async function prepareFirstWindow(
  app: ElectronApplication,
): Promise<Page> {
  const page = await app.firstWindow()
  await mockRaindropApi(page)
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  return page
}

/** Mirrors the global key set by `registerTestShellIPC` in electron/test-auth.ts. */
const OPENED_EXTERNAL_URLS_GLOBAL_KEY = '__LAIN_OPENED_EXTERNAL_URLS__'

/**
 * URLs the renderer asked the main process to open externally since launch.
 * Test mode records them instead of opening a browser (see electron/test-auth.ts).
 *
 * @param app - Application returned by {@link launchElectronApp}
 * @returns Recorded URLs in call order (empty when nothing was opened)
 * @example
 *   await page.keyboard.press('Enter')
 *   expect(await getOpenedExternalUrls(electronApp)).toEqual(['https://react.dev'])
 */
export async function getOpenedExternalUrls(
  app: ElectronApplication,
): Promise<string[]> {
  const recorded: unknown = await app.evaluate(
    (_electron, globalKey) => Reflect.get(globalThis, globalKey),
    OPENED_EXTERNAL_URLS_GLOBAL_KEY,
  )
  if (!Array.isArray(recorded)) return []
  return recorded.filter((value): value is string => typeof value === 'string')
}

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    // Fresh userData per launch: the app persists the ui/search/settings slices
    // to localStorage, so a shared profile would carry e.g. the last selected
    // collection into the next test and break its readiness checks.
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lain-e2e-'))
    const app = await launchElectronApp(userDataDir)
    await use(app)
    await app.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  },
  page: async ({ electronApp }, use) => {
    const page = await prepareFirstWindow(electronApp)
    await use(page)
  },
})

export { expect }
