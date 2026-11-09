import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { _electron as electron, expect, type Page } from '@playwright/test'

import { mockRaindropApi } from '../e2e/api-mock'

const executablePath = process.argv[2]
if (!executablePath)
  throw new Error('Supply the packaged application executable.')
const label = process.argv[3] ?? 'default'
if (!/^[a-z0-9-]+$/.test(label))
  throw new Error('Evidence label must be a simple package name.')
const evidence = path.resolve('test-results/package-smoke', label)
const profile = await mkdtemp(path.join(tmpdir(), 'lain-package-smoke-'))
const failures: string[] = []
await mkdir(evidence, { recursive: true })
const launchOptions: Parameters<typeof electron.launch>[0] = {
  executablePath: path.resolve(executablePath),
  // Ubuntu CI runs inside an isolated virtual display; no production flags change.
  args: process.platform === 'linux' && process.env.CI ? ['--no-sandbox'] : [],
  env: {
    ...process.env,
    NODE_ENV: 'test',
    LAIN_TEST_MODE: '1',
    LAIN_USER_DATA_DIR: profile,
  },
  recordVideo: { dir: evidence, size: { width: 1200, height: 800 } },
}
let app = await electron.launch(launchOptions)

/**
 * Fail package QA for renderer errors during either process lifetime.
 * The smoke runner calls this after installing fixtures and before loading the tested document.
 * @example
 * observeRendererErrors(page)
 */
function observeRendererErrors(page: Page): void {
  page.on('pageerror', (error) => failures.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      failures.push(`${message.text()} (${message.location().url})`)
  })
}

/**
 * Keep synthetic package QA independent of external favicon and cover services.
 * Each process installs this fixture before reloading its document; local bundled assets stay real.
 * @example
 * await mockRemoteImages(page)
 */
async function mockRemoteImages(page: Page): Promise<void> {
  await page.route(/^https?:\/\//, async (route) => {
    if (route.request().resourceType() !== 'image') return route.fallback()
    return route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#94a3b8"/></svg>',
    })
  })
}

try {
  const page = await app.firstWindow()
  await mockRaindropApi(page)
  await mockRemoteImages(page)
  observeRendererErrors(page)
  await page.reload()
  await expect(
    page.locator('[data-slot="breadcrumb-page"]', { hasText: 'All Bookmarks' }),
  ).toBeVisible()
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  // Exercise real platform keyboard dispatch in the packaged renderer.
  for (const [key, label] of [
    ['1', 'Grid'],
    ['2', 'List'],
    ['3', 'Table'],
    ['4', 'Directory'],
  ]) {
    await page.keyboard.press(`${modifier}+${key}`)
    await page.getByRole('button', { name: 'View mode' }).click()
    await expect(
      page.getByRole('menuitemradio', { name: label, exact: true }),
    ).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')
    await page.screenshot({
      path: path.join(evidence, `view-${label.toLowerCase()}.png`),
    })
  }
  await page.keyboard.press(`${modifier}+,`)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.screenshot({ path: path.join(evidence, 'settings.png') })
  await page.getByRole('tab', { name: 'Updates', exact: true }).click()
  await expect(
    page.getByText('Updates are available in installed release builds.'),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Check for updates' }),
  ).toBeDisabled()
  await page.screenshot({ path: path.join(evidence, 'updates.png') })
  await page.keyboard.press('Escape')
  await app.close()
  // Reuse only this temporary profile to verify settings survive an actual process restart.
  app = await electron.launch(launchOptions)
  const reopened = await app.firstWindow()
  await mockRaindropApi(reopened)
  await mockRemoteImages(reopened)
  observeRendererErrors(reopened)
  await reopened.reload()
  await reopened.getByRole('button', { name: 'View mode' }).click()
  await expect(
    reopened.getByRole('menuitemradio', { name: 'Directory', exact: true }),
  ).toHaveAttribute('aria-checked', 'true')
  await reopened.keyboard.press('Escape')
  await reopened.screenshot({ path: path.join(evidence, 'after-restart.png') })
  expect(
    failures,
    'Packaged renderer must remain free of runtime errors',
  ).toEqual([])
  await writeFile(
    path.join(evidence, 'environment.json'),
    JSON.stringify(
      {
        platform: process.platform,
        arch: process.arch,
        executablePath: path.basename(executablePath),
        virtualDisplay: Boolean(process.env.DISPLAY),
        mockApi: true,
        profileRestart: 'directory-view-preserved',
        version: await app.evaluate(({ app: runningApp }) =>
          runningApp.getVersion(),
        ),
      },
      null,
      2,
    ),
  )
} catch (error) {
  const page = await app.firstWindow()
  await page.screenshot({ path: path.join(evidence, 'failure.png') })
  await writeFile(
    path.join(evidence, 'failure.json'),
    JSON.stringify(
      { failures, body: await page.locator('body').innerText() },
      null,
      2,
    ),
  )
  throw error
} finally {
  await app.close()
  await rm(profile, { recursive: true, force: true })
}
