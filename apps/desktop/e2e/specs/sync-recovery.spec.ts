import type { Page, Route, TestInfo } from '@playwright/test'

import { mockRaindrops } from '../../fixtures'
import { test, expect } from '../electron'

const priorRecording = process.env.LAIN_E2E_RECORD
// The shared fixture records these recovery transitions without changing other suites' defaults.
test.beforeAll(() => {
  process.env.LAIN_E2E_RECORD = '1'
})
test.afterAll(() => {
  if (priorRecording === undefined) delete process.env.LAIN_E2E_RECORD
  else process.env.LAIN_E2E_RECORD = priorRecording
})

/**
 * Hold an asserted recovery state so the shared native recording remains readable.
 * These tests call it between deliberate failures and user recovery actions.
 * @example await recordCheckpoint(page, testInfo, 'offline-draft')
 */
async function recordCheckpoint(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  await page.waitForTimeout(450)
  const filename = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path: filename })
  await testInfo.attach(name, { path: filename, contentType: 'image/png' })
}

test('late metadata for an old URL cannot overwrite the current URL or manually edited fields', async ({
  page,
}, testInfo) => {
  // Arrange
  const pending = new Map<string, Route>()
  await page.route('**/api.raindrop.io/rest/v1/import/url/parse?*', (route) => {
    const url = new URL(route.request().url()).searchParams.get('url')!
    pending.set(url, route)
  })
  await page.getByRole('button', { name: 'Add Bookmark', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add Bookmark', exact: true })

  // Act — deliver the newest parse first while an earlier URL remains in flight.
  await dialog
    .getByLabel('URL', { exact: true })
    .fill('https://old.example.test/article')
  await expect
    .poll(() => pending.has('https://old.example.test/article'))
    .toBe(true)
  await dialog
    .getByLabel('URL', { exact: true })
    .fill('https://current.example.test/article')
  await expect
    .poll(() => pending.has('https://current.example.test/article'))
    .toBe(true)
  await dialog.getByLabel('Title', { exact: true }).fill('My deliberate title')
  await dialog
    .getByLabel('Description', { exact: true })
    .fill('My deliberate description')
  await recordCheckpoint(page, testInfo, 'metadata-manual-input-pending')
  await pending.get('https://current.example.test/article')!.fulfill({
    json: {
      result: true,
      item: {
        title: 'Current server title',
        excerpt: 'Current server excerpt',
        type: 'document',
      },
    },
  })
  await expect(
    dialog.getByRole('combobox', { name: 'Type', exact: true }),
  ).toHaveText('document')
  const oldResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/import/url/parse') &&
      new URL(response.url()).searchParams.get('url') ===
        'https://old.example.test/article',
  )
  await pending.get('https://old.example.test/article')!.fulfill({
    json: {
      result: true,
      item: {
        title: 'Obsolete server title',
        excerpt: 'Obsolete server excerpt',
        type: 'article',
      },
    },
  })
  await (await oldResponse).finished()

  // Assert — fields still reflect user intent after both actual HTTP responses settle.
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue(
    'My deliberate title',
  )
  await expect(dialog.getByLabel('Description', { exact: true })).toHaveValue(
    'My deliberate description',
  )
  await expect(dialog.getByLabel('URL', { exact: true })).toHaveValue(
    'https://current.example.test/article',
  )
  await expect(
    dialog.getByRole('combobox', { name: 'Type', exact: true }),
  ).toHaveText('document')
  await recordCheckpoint(page, testInfo, 'metadata-stale-response-discarded')
})

test('reconnecting refreshes remote bookmarks while retaining an unsaved detail draft until explicit reload', async ({
  page,
}, testInfo) => {
  // Arrange
  await expect(page.getByText(/^Synced /)).toBeVisible()
  const row = page.locator('[data-raindrop-id="1"]')
  await row.click()
  const title = page.getByLabel('Title', { exact: true })
  await title.fill('Unsaved offline draft')
  let offline = false
  let remoteChanged = false
  let writes = 0
  await page.route('**/api.raindrop.io/rest/v1/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (!['GET', 'OPTIONS'].includes(request.method())) writes += 1
    if (offline) return route.abort('internetdisconnected')
    if (remoteChanged && pathname.endsWith('/user/stats')) {
      return route.fulfill({
        json: {
          result: true,
          items: [
            { _id: 0, count: 60 },
            { _id: -1, count: 0 },
            { _id: -99, count: 0 },
          ],
          meta: { changedBookmarksDate: '2026-11-10T00:01:00.000Z' },
        },
      })
    }
    if (remoteChanged && pathname.endsWith('/raindrops/0')) {
      return route.fulfill({
        json: {
          result: true,
          count: 60,
          items: mockRaindrops.slice(0, 50).map((item) =>
            item._id === 1
              ? {
                  ...item,
                  title: 'Remote edit during disconnection',
                  lastUpdate: '2026-11-10T00:01:00.000Z',
                }
              : item,
          ),
        },
      })
    }
    return route.fallback()
  })

  // Act — emulate browser connectivity and an external edit, without sending a mutation.
  offline = true
  await page.context().setOffline(true)
  await expect(page.getByText('Offline', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Refresh', exact: true }),
  ).toBeDisabled()
  await expect(title).toHaveValue('Unsaved offline draft')
  await recordCheckpoint(page, testInfo, 'offline-draft-preserved')
  remoteChanged = true
  offline = false
  await page.context().setOffline(false)

  // Assert — automatic reconnect fetches show the remote row but never replace the draft.
  await expect(row).toContainText('Remote edit during disconnection')
  await expect(
    page.getByText(/This bookmark changed on another device/),
  ).toBeVisible()
  await expect(title).toHaveValue('Unsaved offline draft')
  await expect(page.getByText(/^Synced /)).toBeVisible()
  expect(writes).toBe(0)
  await recordCheckpoint(page, testInfo, 'reconnected-conflict-preserves-draft')

  // Act / Assert — only the explicit reload action discards the draft.
  await page
    .getByRole('button', { name: 'Discard edits and load latest', exact: true })
    .click()
  await expect(title).toHaveValue('Remote edit during disconnection')
  expect(writes).toBe(0)
  await recordCheckpoint(page, testInfo, 'explicit-remote-reload')
})

test('rate-limited saves retain input and retry only on user action after the shared cooldown', async ({
  page,
}, testInfo) => {
  // Arrange
  await expect(page.getByText(/^Synced /)).toBeVisible()
  await page.locator('[data-raindrop-id="1"]').click()
  const title = page.getByLabel('Title', { exact: true })
  await title.fill('Saved after explicit rate-limit retry')
  let saves = 0
  let resetAt = 0
  const laterRequests: number[] = []
  await page.route('**/api.raindrop.io/rest/v1/**', async (route) => {
    const request = route.request()
    if (resetAt) laterRequests.push(Date.now())
    if (
      request.method() === 'PUT' &&
      new URL(request.url()).pathname.endsWith('/raindrop/1')
    ) {
      saves += 1
      if (saves === 1) {
        resetAt = (Math.ceil(Date.now() / 1000) + 4) * 1000
        return route.fulfill({
          status: 429,
          headers: { 'x-ratelimit-reset': String(resetAt / 1000) },
          json: { result: false, errorMessage: 'Synthetic rate limit' },
        })
      }
    }
    return route.fallback()
  })

  // Act
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()

  // Assert — the request fails visibly and is not silently replayed.
  await expect(
    page.getByText(
      'Rate limit reached. Requests will resume after the server reset.',
    ),
  ).toBeVisible()
  await expect(title).toHaveValue('Saved after explicit rate-limit retry')
  await expect(
    page.getByRole('button', { name: 'Save Changes', exact: true }),
  ).toBeEnabled()
  await recordCheckpoint(page, testInfo, 'rate-limit-input-retained')
  expect(saves).toBe(1)

  // Act — a user retry and a refresh both wait behind the shared server deadline.
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page.locator('[data-raindrop-id="1"]')).toContainText(
    'Saved after explicit rate-limit retry',
  )

  // Assert
  expect(saves).toBe(2)
  expect(laterRequests.length).toBeGreaterThan(0)
  expect(laterRequests.every((time) => time >= resetAt - 50)).toBe(true)
  await testInfo.attach('server-cooldown-observations', {
    body: JSON.stringify({ saves, resetAt, laterRequests }),
    contentType: 'application/json',
  })
  await expect(title).toHaveValue('Saved after explicit rate-limit retry')
  await expect(page.getByText(/^Synced /)).toBeVisible()
  await recordCheckpoint(page, testInfo, 'rate-limit-retry-saved')

  // Sonner pauses notification expiry under the pointer; moving away lets the ordinary timer finish.
  await page.mouse.move(20, 20)
  await expect(
    page.getByText(
      'Rate limit reached. Requests will resume after the server reset.',
    ),
  ).not.toBeVisible({ timeout: 6000 })
  await recordCheckpoint(page, testInfo, 'rate-limit-past-notification-expired')
})
