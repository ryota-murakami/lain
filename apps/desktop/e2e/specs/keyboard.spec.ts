import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  expect,
  getOpenedExternalUrls,
  launchElectronApp,
  prepareFirstWindow,
  test,
} from '../electron'

/**
 * Keyboard shortcut E2E tests for PR1 modifier-key shortcuts.
 * Verifies that global keyboard shortcuts trigger the correct UI actions
 * when wired through useKeyboardShortcuts hook.
 *
 * Uses synthetic KeyboardEvent dispatch via page.evaluate() to avoid
 * Playwright-Electron key mapping issues with certain modifier combos.
 */

/** Wait for the main app to fully render (breadcrumb visible = data loaded). */
async function waitForApp(page: import('@playwright/test').Page) {
  await expect(
    page.locator('[data-slot="breadcrumb-page"]', {
      hasText: 'All Bookmarks',
    }),
  ).toBeVisible({ timeout: 10_000 })
}

/**
 * Dispatch a synthetic keyboard event on the window.
 * Bypasses Playwright's keyboard API which can have issues with certain
 * modifier+key combinations in Electron.
 */
async function pressShortcut(
  page: import('@playwright/test').Page,
  opts: {
    key: string
    metaKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
    ctrlKey?: boolean
  },
) {
  await page.evaluate((o) => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: o.key,
        metaKey: o.metaKey ?? false,
        shiftKey: o.shiftKey ?? false,
        altKey: o.altKey ?? false,
        ctrlKey: o.ctrlKey ?? false,
        bubbles: true,
        cancelable: true,
      }),
    )
  }, opts)
}

test.describe('Keyboard Shortcuts', () => {
  // @spec:KB.1 - CmdK opens search palette
  test('Cmd+K opens global search palette', async ({ page }) => {
    await waitForApp(page)
    await page.keyboard.press('Meta+k')
    await expect(page.getByText('Search bookmarks')).toBeVisible()
  })

  // @spec:KB.2 - CmdN opens add bookmark dialog
  test('Cmd+N opens add bookmark dialog', async ({ page }) => {
    await waitForApp(page)
    await pressShortcut(page, { key: 'n', metaKey: true })
    await expect(
      page.getByRole('heading', { name: 'Add Bookmark', level: 2 }),
    ).toBeVisible()
  })

  // @spec:KB.3 - CmdShiftN opens new collection dialog
  test('Cmd+Shift+N opens new collection dialog', async ({ page }) => {
    await waitForApp(page)
    await page.keyboard.press('Meta+Shift+n')
    await expect(
      page.getByRole('heading', { name: /collection/i }),
    ).toBeVisible()
  })

  // @spec:KB.4 - Cmd1 switches to grid view
  test('Cmd+1 switches to grid view', async ({ page }) => {
    await waitForApp(page)
    await page.keyboard.press('Meta+1')
    // Grid view renders cards in a grid layout
    await expect(page.locator('[data-testid="grid-view"]')).toBeVisible()
  })

  // @spec:KB.5 - Cmd2 switches to list view
  test('Cmd+2 switches to list view', async ({ page }) => {
    await waitForApp(page)
    // First switch away from list (default)
    await page.keyboard.press('Meta+1')
    await expect(page.locator('[data-testid="grid-view"]')).toBeVisible()
    // Then back to list
    await page.keyboard.press('Meta+2')
    await expect(page.locator('[data-testid="list-view"]')).toBeVisible()
  })

  // @spec:KB.8 - CmdComma opens settings
  test('Cmd+, opens settings dialog', async ({ page }) => {
    await waitForApp(page)
    await pressShortcut(page, { key: ',', metaKey: true })
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  // @spec:KB.16 - CmdShiftK opens shortcut settings
  // @spec:F8.7 - Cmd+Shift+K opens shortcut editor from anywhere
  test('Cmd+Shift+K opens settings on shortcuts tab', async ({ page }) => {
    await waitForApp(page)
    await pressShortcut(page, { key: 'k', metaKey: true, shiftKey: true })
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(
      page.getByRole('tab', { name: 'Keyboard Shortcuts', selected: true }),
    ).toBeVisible()
  })

  // @spec:KB.10 - CmdA selects all bookmarks
  test('Cmd+A selects all bookmarks in view', async ({ page }) => {
    await waitForApp(page)
    await page.keyboard.press('Meta+a')
    // When all selected, the bulk action bar should appear
    await expect(page.getByText(/selected/i)).toBeVisible()
  })

  // @spec:KB.20 - CmdShiftT opens tag management
  test('Cmd+Shift+T opens tag management', async ({ page }) => {
    await waitForApp(page)
    await pressShortcut(page, { key: 't', metaKey: true, shiftKey: true })
    await expect(page.getByRole('heading', { name: /tag/i })).toBeVisible()
  })
})

/** Storage middleware debounces localStorage writes (300ms); wait comfortably longer before quitting. */
const PERSIST_SETTLE_MS = 1_000

/** Open Settings on the Keyboard Shortcuts tab with Cmd+Shift+K and wait for the editor. */
async function openShortcutEditor(page: import('@playwright/test').Page) {
  await waitForApp(page)
  await pressShortcut(page, { key: 'k', metaKey: true, shiftKey: true })
  await expect(page.getByTestId('shortcut-editor')).toBeVisible()
}

/** Rebind "New Bookmark" to Cmd+Shift+E through the editor UI. */
async function rebindNewBookmarkToCmdShiftE(
  page: import('@playwright/test').Page,
) {
  const row = page.getByTestId('shortcut-row-newBookmark')
  await row.getByRole('button', { name: 'Edit' }).click()
  const captureField = row.getByLabel('Press new shortcut for New Bookmark')
  await expect(captureField).toBeFocused()
  await captureField.press('Meta+Shift+e')
  await expect(row).toContainText('⇧⌘E')
}

test.describe('Keyboard Shortcut Editor (F8)', () => {
  // @spec:F8.1 - Settings dialog has "Keyboard Shortcuts" tab listing all actions
  test('lists all 20 actions with their current bindings', async ({ page }) => {
    await openShortcutEditor(page)
    await expect(page.locator('[data-testid^="shortcut-row-"]')).toHaveCount(20)
    await expect(page.getByTestId('shortcut-row-newBookmark')).toContainText(
      '⌘N',
    )
  })

  // @spec:F8.2 - Click "Edit" on any shortcut → captures next key combo → saves
  test('edits a shortcut and the new combo triggers the action', async ({
    page,
  }) => {
    await openShortcutEditor(page)
    await rebindNewBookmarkToCmdShiftE(page)
    await expect(
      page.getByTestId('shortcut-row-newBookmark').getByText('Custom'),
    ).toBeVisible()

    // Close settings; the rebound combo now opens the Add Bookmark dialog
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeHidden()
    await pressShortcut(page, { key: 'e', metaKey: true, shiftKey: true })
    await expect(
      page.getByRole('heading', { name: 'Add Bookmark', level: 2 }),
    ).toBeVisible()
  })

  // @spec:F8.3 - Conflict detection warns when binding already assigned, offers swap
  test('warns when the combo is taken and swaps the two bindings', async ({
    page,
  }) => {
    await openShortcutEditor(page)
    const newBookmarkRow = page.getByTestId('shortcut-row-newBookmark')
    await newBookmarkRow.getByRole('button', { name: 'Edit' }).click()
    await newBookmarkRow
      .getByLabel('Press new shortcut for New Bookmark')
      .press('Meta+k')

    await expect(newBookmarkRow.getByRole('alert')).toContainText(
      '⌘K is used by Global Search',
    )
    await newBookmarkRow.getByRole('button', { name: 'Swap' }).click()

    await expect(newBookmarkRow).toContainText('⌘K')
    await expect(page.getByTestId('shortcut-row-search')).toContainText('⌘N')
  })

  // @spec:F8.4 - "Reset to Defaults" restores all shortcuts to defaults
  test('restores every default binding after confirming Reset to Defaults', async ({
    page,
  }) => {
    await openShortcutEditor(page)
    await rebindNewBookmarkToCmdShiftE(page)

    await page.getByRole('button', { name: 'Reset to Defaults' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Reset', exact: true })
      .click()

    await expect(page.getByTestId('shortcut-row-newBookmark')).toContainText(
      '⌘N',
    )
    await expect(
      page
        .locator('[data-testid^="shortcut-row-"]')
        .getByText('Custom', { exact: true }),
    ).toHaveCount(0)
  })

  // @spec:F8.5 - Search filter finds actions by name
  test('filters the action list by name', async ({ page }) => {
    await openShortcutEditor(page)
    await page.getByLabel('Filter actions').fill('grid')
    await expect(page.locator('[data-testid^="shortcut-row-"]')).toHaveCount(1)
    await expect(page.getByTestId('shortcut-row-viewGrid')).toBeVisible()
  })

  // @spec:F8.6 - Custom shortcuts persist across app restarts (localStorage)
  test('keeps a custom shortcut after the app is relaunched', async () => {
    // Own profile dir so the second launch reads what the first one persisted
    const userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'lain-e2e-restart-'),
    )
    try {
      const firstApp = await launchElectronApp(userDataDir)
      const firstPage = await prepareFirstWindow(firstApp)
      await openShortcutEditor(firstPage)
      await rebindNewBookmarkToCmdShiftE(firstPage)
      await firstPage.waitForTimeout(PERSIST_SETTLE_MS)
      await firstApp.close()

      const secondApp = await launchElectronApp(userDataDir)
      const secondPage = await prepareFirstWindow(secondApp)
      await openShortcutEditor(secondPage)
      await expect(
        secondPage.getByTestId('shortcut-row-newBookmark'),
      ).toContainText('⇧⌘E')
      await secondApp.close()
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true })
    }
  })
})

/**
 * Rows of every view in the default "newest" order: fixture #1 was created one day
 * before the snapshot date, #2 two days before, so they are always the first two.
 */
const FIRST_BOOKMARK = { id: '1', url: 'https://react.dev' }
const SECOND_BOOKMARK = { id: '2', title: 'TypeScript Handbook' }

/** The navigable row of a bookmark in whichever view is active. */
function bookmarkRow(
  page: import('@playwright/test').Page,
  raindropId: string,
) {
  return page.locator(`[data-raindrop-id="${raindropId}"]`)
}

const VIEW_MODES = [
  { mode: 'grid', shortcut: 'Meta+1', testId: 'grid-view' },
  { mode: 'list', shortcut: 'Meta+2', testId: 'list-view' },
  { mode: 'table', shortcut: 'Meta+3', testId: 'table-view' },
  { mode: 'directory', shortcut: 'Meta+4', testId: 'directory-view' },
] as const

test.describe('View Navigation (F7)', () => {
  // @spec:KB.12 - Arrow Down moves selection down
  test('Arrow Down focuses the first bookmark, then the next one', async ({
    page,
  }) => {
    await waitForApp(page)
    await page.keyboard.press('ArrowDown')
    await expect(bookmarkRow(page, FIRST_BOOKMARK.id)).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(bookmarkRow(page, SECOND_BOOKMARK.id)).toBeFocused()
  })

  // @spec:KB.11 - Arrow Up moves selection up
  test('Arrow Up moves back to the previous bookmark', async ({ page }) => {
    await waitForApp(page)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(bookmarkRow(page, SECOND_BOOKMARK.id)).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(bookmarkRow(page, FIRST_BOOKMARK.id)).toBeFocused()
  })

  // @spec:KB.13 - Enter opens selected bookmark in browser
  test('Enter opens the focused bookmark in the system browser', async ({
    page,
    electronApp,
  }) => {
    await waitForApp(page)
    await page.keyboard.press('ArrowDown')
    await expect(bookmarkRow(page, FIRST_BOOKMARK.id)).toBeFocused()
    await page.keyboard.press('Enter')
    // Test mode records the URL instead of launching a browser
    await expect
      .poll(() => getOpenedExternalUrls(electronApp))
      .toEqual([FIRST_BOOKMARK.url])
  })

  // @spec:KB.14 - Space toggles detail panel for selected
  test('Space opens the detail panel for the focused bookmark and closes it again', async ({
    page,
  }) => {
    await waitForApp(page)
    const detailPanel = page.getByTestId('detail-panel')
    await expect(detailPanel).toHaveClass(/w-0/)

    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(bookmarkRow(page, SECOND_BOOKMARK.id)).toBeFocused()

    await page.keyboard.press('Space')
    await expect(detailPanel).toHaveClass(/w-\[360px\]/)
    await expect(detailPanel.getByLabel('Title')).toHaveValue(
      SECOND_BOOKMARK.title,
    )

    await page.keyboard.press('Space')
    await expect(detailPanel).toHaveClass(/w-0/)
  })

  for (const { mode, shortcut, testId } of VIEW_MODES) {
    // @spec:F7.6 - Arrow key navigation works in all view modes
    test(`arrow keys walk the bookmarks in ${mode} view`, async ({ page }) => {
      await waitForApp(page)
      await page.keyboard.press(shortcut)
      const view = page.getByTestId(testId)
      await expect(view).toBeVisible()

      await page.keyboard.press('ArrowDown')
      await expect(
        view.locator(`[data-raindrop-id="${FIRST_BOOKMARK.id}"]`),
      ).toBeFocused()
      await page.keyboard.press('ArrowDown')
      await expect(
        view.locator(`[data-raindrop-id="${SECOND_BOOKMARK.id}"]`),
      ).toBeFocused()
      await page.keyboard.press('ArrowUp')
      await expect(
        view.locator(`[data-raindrop-id="${FIRST_BOOKMARK.id}"]`),
      ).toBeFocused()
    })
  }

  // @spec:KB.19 - Cmd+D toggles important flag on selected
  test('Cmd+D marks the focused bookmark as important', async ({ page }) => {
    await waitForApp(page)
    await page.keyboard.press('ArrowDown')
    const firstRow = bookmarkRow(page, FIRST_BOOKMARK.id)
    await expect(firstRow).toBeFocused()
    await expect(firstRow.getByTestId('important-indicator')).toBeHidden()

    await pressShortcut(page, { key: 'd', metaKey: true })
    await expect(firstRow.getByTestId('important-indicator')).toBeVisible()
  })

  // @spec:KB.9 - Cmd+Backspace deletes selected bookmark(s)
  test('Cmd+Backspace removes the focused bookmark from the view', async ({
    page,
  }) => {
    await waitForApp(page)
    await page.keyboard.press('ArrowDown')
    await expect(bookmarkRow(page, FIRST_BOOKMARK.id)).toBeFocused()

    await pressShortcut(page, { key: 'Backspace', metaKey: true })
    await expect(bookmarkRow(page, FIRST_BOOKMARK.id)).toHaveCount(0)
    await expect(bookmarkRow(page, SECOND_BOOKMARK.id)).toBeVisible()
  })

  // @spec:KB.17 - Cmd+F focuses search bar (scoped to current collection)
  test('Cmd+F focuses the search bar of the current view', async ({ page }) => {
    await waitForApp(page)
    await pressShortcut(page, { key: 'f', metaKey: true })
    await expect(
      page.getByPlaceholder('Search bookmarks... (⌘K)'),
    ).toBeFocused()
  })

  // @spec:KB.18 - Cmd+Shift+F opens global search across all collections
  test('Cmd+Shift+F opens the search palette searching everywhere', async ({
    page,
  }) => {
    await waitForApp(page)
    // Inside a collection the palette would normally be scoped to it
    await page.getByRole('button', { name: 'Design' }).click()
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', { hasText: 'Design' }),
    ).toBeVisible()

    await pressShortcut(page, { key: 'f', metaKey: true, shiftKey: true })
    // Scope to the dialog: the toolbar behind it also says "searching everywhere"
    const palette = page.getByRole('dialog', { name: 'Search bookmarks' })
    await expect(palette).toBeVisible()
    await expect(palette.getByText('Searching everywhere')).toBeVisible()
  })
})
