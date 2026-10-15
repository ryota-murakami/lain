import type { Page } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  expect,
  launchElectronApp,
  prepareFirstWindow,
  test,
} from '../electron'

/**
 * F3 view mode E2E tests: table / directory rendering, Cmd+1–4 switching,
 * per-collection overrides and persistence across relaunches.
 */

/** Longer than the localStorage save debounce so the view mode is written before the app closes. */
const PERSIST_SETTLE_MS = 1_000

/**
 * Wait for the main app to render the default "All Bookmarks" scope.
 * @param page - Playwright page
 */
async function waitForApp(page: Page) {
  await expect(
    page.locator('[data-slot="breadcrumb-page"]', {
      hasText: 'All Bookmarks',
    }),
  ).toBeVisible({ timeout: 10_000 })
}

test.describe('View Modes (F3)', () => {
  // @spec:F3.1 - All 4 view modes render correctly with real data (table)
  // @spec:KB.6 - Cmd3 switches to table view
  test('Cmd+3 renders the bookmarks as a sortable table', async ({ page }) => {
    await waitForApp(page)

    await page.keyboard.press('Meta+3')

    const tableView = page.getByTestId('table-view')
    await expect(tableView).toBeVisible()
    await expect(tableView.getByText('React Documentation')).toBeVisible()
    await expect(tableView.getByRole('button', { name: 'Title' })).toBeVisible()
  })

  // @spec:F3.1 - All 4 view modes render correctly with real data (directory)
  // @spec:KB.7 - Cmd4 switches to directory view
  test('Cmd+4 renders bookmarks nested under their collection folders', async ({
    page,
  }) => {
    await waitForApp(page)

    await page.keyboard.press('Meta+4')

    const directoryView = page.getByTestId('directory-view')
    await expect(directoryView).toBeVisible()
    await expect(
      directoryView.getByRole('button', { name: /Development\/ \(20\)/ }),
    ).toBeVisible()
    await expect(
      directoryView.getByRole('button', { name: /React Documentation/ }),
    ).toBeVisible()
  })

  // @spec:F3.4 - Cmd+1-4 shortcuts switch view mode
  test('Cmd+1 through Cmd+4 switch between grid, list, table and directory', async ({
    page,
  }) => {
    await waitForApp(page)

    await page.keyboard.press('Meta+1')
    await expect(page.getByTestId('grid-view')).toBeVisible()

    await page.keyboard.press('Meta+3')
    await expect(page.getByTestId('table-view')).toBeVisible()

    await page.keyboard.press('Meta+4')
    await expect(page.getByTestId('directory-view')).toBeVisible()

    await page.keyboard.press('Meta+2')
    await expect(page.getByTestId('list-view')).toBeVisible()
  })

  // @spec:F3.3 - Per-collection view mode overrides global default
  test('a remembered collection keeps its own view mode while others use the default', async ({
    page,
  }) => {
    await waitForApp(page)

    // Remember Design with the grid view
    await page.getByRole('button', { name: 'Design' }).click()
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', { hasText: 'Design' }),
    ).toBeVisible()
    await page.getByLabel('View mode').click()
    const rememberItem = page.getByRole('menuitemcheckbox', {
      name: 'Remember for this collection',
    })
    await rememberItem.click()
    // The menu stays open after toggling, so the view can be picked right away
    await expect(rememberItem).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('menuitemradio', { name: 'Grid' }).click()
    await expect(page.getByTestId('grid-view')).toBeVisible()

    // Every other scope still uses the global default (list)
    await page.getByRole('button', { name: 'All Bookmarks' }).first().click()
    await waitForApp(page)
    await expect(page.getByTestId('list-view')).toBeVisible()

    // Coming back restores the remembered override
    await page.getByRole('button', { name: 'Design' }).click()
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', { hasText: 'Design' }),
    ).toBeVisible()
    await expect(page.getByTestId('grid-view')).toBeVisible()
  })

  // @spec:F3.2 - View mode persists across app restarts
  test('keeps the chosen view mode after the app is relaunched', async () => {
    // Own profile dir so the second launch reads what the first one persisted
    const userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'lain-e2e-view-mode-'),
    )
    try {
      const firstApp = await launchElectronApp(userDataDir)
      const firstPage = await prepareFirstWindow(firstApp)
      await waitForApp(firstPage)
      await firstPage.keyboard.press('Meta+3')
      await expect(firstPage.getByTestId('table-view')).toBeVisible()
      await firstPage.waitForTimeout(PERSIST_SETTLE_MS)
      await firstApp.close()

      const secondApp = await launchElectronApp(userDataDir)
      const secondPage = await prepareFirstWindow(secondApp)
      await waitForApp(secondPage)
      await expect(secondPage.getByTestId('table-view')).toBeVisible()
      await secondApp.close()
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true })
    }
  })
})
