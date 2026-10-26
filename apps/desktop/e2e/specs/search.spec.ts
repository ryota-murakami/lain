import type { Page } from '@playwright/test'
import Fuse from 'fuse.js'

import { expect, test } from '../electron'

/**
 * P3 Search feature tests covering:
 * - F1 Scoped Search
 * - F2 Field-Specific Search
 * - F5 Fuzzy Collection Search
 */

/** Collection count used for fuzzy performance verification. */
const FUZZY_PERF_COLLECTION_COUNT = 100
/** Number of benchmark iterations for average timing. */
const FUZZY_PERF_ITERATIONS = 20
/** Performance target from SPEC F5.3 (milliseconds). */
const FUZZY_PERF_MAX_AVERAGE_MS = 10
/** Fuzzy threshold used by the app implementation. */
const FUZZY_PERF_THRESHOLD = 0.4

/**
 * Build synthetic collection rows for fuzzy performance checks.
 * Includes a known "React Resources" target to guarantee a hit for query "rct".
 *
 * @param count - Number of collection rows to generate
 * @returns Generated collection rows
 */
function buildPerfCollections(
  count: number,
): Array<{ id: string; name: string }> {
  return Array.from({ length: count }, (_, index) => ({
    id: `${index + 1}`,
    name: index === 0 ? 'React Resources' : `Collection ${index + 1}`,
  }))
}

/**
 * Reset to a predictable default state for each search test.
 * @param page - Playwright page
 */
async function resetToAllBookmarks(page: Page) {
  // If persisted state reopens Cmd+K on launch, close it first.
  const commandDialog = page.getByRole('dialog', { name: 'Search bookmarks' })
  if (await commandDialog.isVisible()) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)
  }

  const allBookmarksControl = page
    .getByRole('button', { name: 'All Bookmarks' })
    .first()
  await expect(allBookmarksControl).toBeVisible({ timeout: 10_000 })
  await allBookmarksControl.click({ force: true })
  await expect(
    page.locator('[data-slot="breadcrumb-page"]', {
      hasText: 'All Bookmarks',
    }),
  ).toBeVisible({ timeout: 10_000 })

  const mainSearchInput = page.getByPlaceholder('Search bookmarks... (⌘K)')
  await expect(mainSearchInput).toBeVisible()
  await mainSearchInput.fill('')
}

test.describe('P3 Search - Scoped Search (F1)', () => {
  // @spec:F1.1 - Search only returns results from current collection when scoped
  // @spec:F1.2 - Scope badge shows current collection name
  // @spec:F1.3 - Toggle to global search is one click away
  // @spec:F1.4 - Empty state shows scoped message with global option
  test('scopes results to current collection, then expands globally', async ({
    page,
  }) => {
    await resetToAllBookmarks(page)

    // Switch to Design collection (does not contain "React Documentation")
    await page.getByRole('button', { name: 'Design' }).click()
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', { hasText: 'Design' }),
    ).toBeVisible()

    // Ensure scoped mode even if previous run persisted global mode
    const searchInDesignButton = page.getByRole('button', {
      name: 'Search in Design',
    })
    if (
      (await searchInDesignButton.count()) > 0 &&
      (await searchInDesignButton.first().isVisible())
    ) {
      await searchInDesignButton.first().click()
    }

    const mainSearchInput = page.getByPlaceholder('Search bookmarks... (⌘K)')
    await mainSearchInput.fill('React Documentation')

    await expect(
      page.locator('[data-slot="badge"]', { hasText: /^in Design$/ }),
    ).toBeVisible()
    await expect(page.getByText(/No results in Design/i)).toBeVisible()

    // One-click fallback to global search
    await page
      .getByRole('button', { name: 'Search everywhere' })
      .first()
      .click()
    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible()
  })

  // @spec:F1.1 - Scoped mode applies in Cmd+K command results
  // @spec:F1.3 - Command palette also allows one-click global toggle
  test('cmd+k search follows scoped mode and supports global toggle', async ({
    page,
  }) => {
    await resetToAllBookmarks(page)

    await page.getByRole('button', { name: 'Design' }).click()
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', { hasText: 'Design' }),
    ).toBeVisible()

    await page.keyboard.press('Meta+k')
    // Scope to the palette: the main toolbar input also carries a "(⌘K)" hint
    const commandDialog = page.getByRole('dialog')
    const commandInput = commandDialog.getByPlaceholder(/⌘K/)
    await expect(commandInput).toBeVisible()

    // Ensure scoped mode inside command as well
    const commandSearchInDesign = commandDialog.getByRole('button', {
      name: 'Search in Design',
    })
    if (
      (await commandSearchInDesign.count()) > 0 &&
      (await commandSearchInDesign.first().isVisible())
    ) {
      await commandSearchInDesign.first().click()
    }

    await commandInput.fill('React Documentation')

    await expect(commandDialog.getByText('No bookmarks found.')).toBeVisible()

    await commandDialog
      .getByRole('button', { name: 'Search everywhere' })
      .click()
    await expect(commandDialog.getByText('React Documentation')).toBeVisible()
  })
})

test.describe('P3 Search - Field-Specific Search (F2)', () => {
  // @spec:F2.1 - URL-only search finds bookmarks by domain or URL substring
  // @spec:F2.2 - Title-only search matches bookmark titles
  // @spec:F2.3 - Description-only search matches excerpts
  // @spec:F2.4 - Matched field is highlighted in results
  // @spec:F2.5 - Scope persists across searches (searchSlice)
  test('supports URL/title/description scopes with highlight and persistence', async ({
    page,
  }) => {
    await resetToAllBookmarks(page)

    await page.keyboard.press('Meta+k')
    const commandDialog = page.getByRole('dialog')
    const commandInput = commandDialog.getByPlaceholder(/⌘K/)
    await expect(commandInput).toBeVisible()

    const searchEverywhereButton = commandDialog.getByRole('button', {
      name: 'Search everywhere',
    })
    if (
      (await searchEverywhereButton.count()) > 0 &&
      (await searchEverywhereButton.first().isVisible())
    ) {
      await searchEverywhereButton.first().click()
    }

    // URL scope
    await commandDialog.getByRole('button', { name: 'URL Only' }).click()
    await commandInput.fill('react.dev')
    await expect(commandDialog.getByText('React Documentation')).toBeVisible()
    await expect(commandDialog.getByText('TypeScript Handbook')).toHaveCount(0)

    // Title scope
    await commandDialog.getByRole('button', { name: 'Title Only' }).click()
    await commandInput.fill('Handbook')
    await expect(
      commandDialog.getByText('TypeScript Handbook').first(),
    ).toBeVisible()

    // Description scope + highlight
    await commandDialog
      .getByRole('button', { name: 'Description Only' })
      .click()
    await commandInput.fill('comprehensive')
    await expect(
      commandDialog.getByText('TypeScript Handbook').first(),
    ).toBeVisible()
    await expect(
      commandDialog.locator('mark', { hasText: /comprehensive/i }),
    ).toBeVisible()

    // Close palette; scope should persist in main content
    await page.keyboard.press('Escape')
    const mainSearchInput = page.getByPlaceholder('Search bookmarks... (⌘K)')
    const descriptionBadge = page
      .locator('[data-slot="badge"]', { hasText: /^description$/ })
      .first()
    await expect(mainSearchInput).toHaveValue('comprehensive')
    await expect(descriptionBadge).toBeVisible()

    // New query keeps same scope (description-only)
    await mainSearchInput.fill('foundational')
    await expect(descriptionBadge).toBeVisible()
  })
})

test.describe('P3 Search - Fuzzy Collection Search (F5)', () => {
  // @spec:F5.1 - Typing "rct" finds React collection
  // @spec:F5.2 - Match highlights show matched characters
  // @spec:F5.4 - Works in sidebar filter
  // @spec:F5.5 - Empty query shows all collections
  test('sidebar collection search supports empty-query and fuzzy matching', async ({
    page,
  }) => {
    await resetToAllBookmarks(page)

    const sidebarSearchButton = page
      .locator('button:has(svg.lucide-search)')
      .first()
    await sidebarSearchButton.click()

    const sidebarSearchInput = page.getByPlaceholder('Find collection...')
    await expect(sidebarSearchInput).toBeVisible()

    // Empty-query behavior: can select nested child collection "React"
    await page
      .getByRole('button', { name: /^React/ })
      .first()
      .click()
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', { hasText: 'React' }),
    ).toBeVisible()

    // Reopen search and test fuzzy query + highlighting
    await sidebarSearchButton.click()
    await expect(sidebarSearchInput).toBeVisible()
    await sidebarSearchInput.fill('rct')

    await expect(
      page.getByRole('button', { name: /^React/ }).first(),
    ).toBeVisible()
    await expect(page.locator('strong').first()).toBeVisible()
  })

  // @spec:F5.4 - Works in collection selector dropdowns
  test('collection selector dropdown supports fuzzy matching', async ({
    page,
  }) => {
    await resetToAllBookmarks(page)

    await page
      .getByRole('button', { name: /Add Bookmark|^Add$/ })
      .first()
      .click()
    const dialog = page.getByRole('dialog', { name: 'Add Bookmark' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('combobox').first().click()
    const selectorSearchInput = page.getByPlaceholder('Search collections...')
    await expect(selectorSearchInput).toBeVisible()
    await selectorSearchInput.fill('rct')

    const reactOption = page
      .locator('[data-slot="popover-content"] button', { hasText: /^React/ })
      .first()
    await expect(reactOption).toBeVisible()
    await expect(
      page.locator('[data-slot="popover-content"] strong').first(),
    ).toBeVisible()
    await reactOption.click()

    await expect(dialog.getByRole('combobox').first()).toContainText('React')
  })

  // @spec:F5.3 - Performance: <10ms for 100 collections
  test('fuzzy search average stays under 10ms for 100 collections', async () => {
    const collections = buildPerfCollections(FUZZY_PERF_COLLECTION_COUNT)
    const query = 'rct'
    const fuseOptions = {
      keys: ['name'] as const,
      threshold: FUZZY_PERF_THRESHOLD,
      includeScore: true,
      includeMatches: true,
      ignoreLocation: true,
    }

    // Warm up JIT/cache before measuring.
    new Fuse(collections, fuseOptions).search(query)

    const samplesMs: number[] = []
    for (let index = 0; index < FUZZY_PERF_ITERATIONS; index += 1) {
      const startMs = performance.now()
      const results = new Fuse(collections, fuseOptions).search(query)
      const elapsedMs = performance.now() - startMs
      samplesMs.push(elapsedMs)
      expect(results.length).toBeGreaterThan(0)
    }

    const totalMs = samplesMs.reduce((sum, value) => sum + value, 0)
    const averageMs = totalMs / samplesMs.length
    expect(averageMs).toBeLessThan(FUZZY_PERF_MAX_AVERAGE_MS)
  })
})
