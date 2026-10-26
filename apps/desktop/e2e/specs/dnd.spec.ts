import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../electron'

/**
 * Wait until the app reaches a stable, authenticated state.
 * @param page - Playwright page
 */
async function waitForSidebarReady(page: Page) {
  const allBookmarksButton = page
    .getByRole('button', { name: 'All Bookmarks' })
    .first()
  await expect(allBookmarksButton).toBeVisible({ timeout: 10_000 })
  await allBookmarksButton.click({ force: true })
  await expect(page.getByRole('button', { name: 'Unsorted' })).toBeVisible()
}

/**
 * Get ordered root collection IDs visible in one sidebar group.
 * @param page - Playwright page
 * @param groupId - Group test identifier suffix (e.g. "group-0")
 * @returns Ordered list of collection IDs
 */
async function getGroupRootCollectionIds(
  page: Page,
  groupId: string,
): Promise<string[]> {
  const ids = await page
    .getByTestId(`sidebar-group-${groupId}`)
    .locator('[data-testid^="sidebar-collection-"]')
    .evaluateAll((elements) => {
      return elements
        .map((element) => element.getAttribute('data-testid') ?? '')
        .map((value) => value.replace('sidebar-collection-', ''))
        .filter(Boolean)
    })
  return ids
}

/**
 * Perform manual drag-and-drop (with double hover for dragover reliability).
 * @param page - Playwright page
 * @param sourceCollectionId - Source collection ID
 * @param target - Target locator
 */
async function dragCollectionToTarget(
  page: Page,
  sourceCollectionId: string,
  target: Locator,
) {
  const source = page.getByTestId(`sidebar-collection-${sourceCollectionId}`)
  await source.hover()
  await page.mouse.down()
  await target.hover()
  await target.hover()
  await page.mouse.up()
}

/**
 * Open context menu for one collection row.
 * @param page - Playwright page
 * @param collectionId - Collection ID
 */
async function openCollectionContextMenu(page: Page, collectionId: string) {
  await page
    .getByTestId(`sidebar-collection-${collectionId}`)
    .click({ button: 'right' })
}

test.describe('P4 Organization - DnD and Context Menu (F6)', () => {
  // @spec:F6.1 - Drag collection between groups updates API
  // @spec:F6.5 - Drag preview shows collection icon + name
  // @spec:F6.6 - Drop indicator shows insertion point
  test('moves collection across groups with drag preview and drop indicator', async ({
    page,
  }) => {
    await waitForSidebarReady(page)

    await expect
      .poll(async () => getGroupRootCollectionIds(page, 'group-0'))
      .toContain('100')

    const source = page.getByTestId('sidebar-collection-100')
    const targetGroup = page.getByTestId('sidebar-group-group-1')

    await source.hover()
    await page.mouse.down()
    await targetGroup.hover()
    await targetGroup.hover()

    await expect(page.getByTestId('drag-preview')).toBeVisible()
    await expect(
      page.locator('[data-testid^="drop-indicator-"]').first(),
    ).toBeVisible()

    await page.mouse.up()

    await expect
      .poll(async () => getGroupRootCollectionIds(page, 'group-1'))
      .toContain('100')
    await expect
      .poll(async () => getGroupRootCollectionIds(page, 'group-0'))
      .not.toContain('100')
  })

  // @spec:F6.2 - Reorder within group works and persists
  test('reorders collections within a group and keeps order after reload', async ({
    page,
  }) => {
    await waitForSidebarReady(page)

    const before = await getGroupRootCollectionIds(page, 'group-0')
    expect(before).toEqual(['100', '102'])

    await dragCollectionToTarget(
      page,
      '102',
      page.getByTestId('sidebar-collection-100'),
    )

    await expect
      .poll(async () => getGroupRootCollectionIds(page, 'group-0'))
      .toEqual(['102', '100'])

    await page.reload()
    await waitForSidebarReady(page)

    await expect
      .poll(async () => getGroupRootCollectionIds(page, 'group-0'))
      .toEqual(['102', '100'])
  })

  // @spec:F6.3 - Double-click enables inline rename
  test('supports inline rename on double-click', async ({ page }) => {
    await waitForSidebarReady(page)

    const row = page.getByTestId('sidebar-collection-100')
    await row.dblclick()
    const inlineInput = row.locator('input')
    await expect(inlineInput).toBeVisible()

    await inlineInput.fill('Renamed Collection')
    await inlineInput.press('Enter')

    await expect(row.getByText('Renamed Collection')).toBeVisible()
  })

  // @spec:F6.4 - Right-click context menu with all options
  test('supports context menu rename, move, color, and delete actions', async ({
    page,
  }) => {
    await waitForSidebarReady(page)

    // Rename
    await openCollectionContextMenu(page, '100')
    await page.getByRole('menuitem', { name: 'Rename' }).click()
    const renamedRow = page.getByTestId('sidebar-collection-100')
    const renameInput = renamedRow.locator('input')
    await renameInput.fill('Context Renamed')
    await renameInput.press('Enter')
    await expect(renamedRow.getByText('Context Renamed')).toBeVisible()

    // Move to Group
    await openCollectionContextMenu(page, '100')
    await page.getByRole('menuitem', { name: 'Move to Group' }).hover()
    await page.getByRole('menuitem', { name: 'Creative' }).last().click()
    await expect
      .poll(async () => getGroupRootCollectionIds(page, 'group-1'))
      .toContain('100')

    // Change color
    await openCollectionContextMenu(page, '100')
    await page.getByRole('menuitem', { name: 'Change Color' }).hover()
    await page.getByRole('menuitem', { name: 'Red' }).last().click()
    await expect(page.getByTestId('collection-color-100')).toBeVisible()

    // Delete
    await openCollectionContextMenu(page, '100')
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(page.getByTestId('sidebar-collection-100')).not.toBeVisible()
  })

  // @spec:F6.7 - Optimistic updates: UI updates immediately, reverts on error
  test('rolls back optimistic group move when persistence fails', async ({
    page,
  }) => {
    await waitForSidebarReady(page)

    let failedOnce = false
    await page.route('**/api.raindrop.io/rest/v1/user', async (route) => {
      if (route.request().method() === 'PUT' && !failedOnce) {
        failedOnce = true
        await page.waitForTimeout(600)
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ result: false }),
        })
        return
      }
      await route.fallback()
    })

    await openCollectionContextMenu(page, '100')
    await page.getByRole('menuitem', { name: 'Move to Group' }).hover()
    await page.getByRole('menuitem', { name: 'Creative' }).last().click()

    // Optimistic move first.
    await expect
      .poll(async () => getGroupRootCollectionIds(page, 'group-1'))
      .toContain('100')

    // Then rollback after failed mutation.
    await expect
      .poll(async () => getGroupRootCollectionIds(page, 'group-0'))
      .toContain('100')
  })
})

/** "Development" (collection 100) lists bookmark 1 first in the default newest-first order. */
const DEV_BOOKMARK_ID = '1'
/** Bookmarks in "Development" — the toolbar shows "20 items" once its page has loaded. */
const DEV_ITEM_COUNT = 20
const DESIGN_COLLECTION_ID = '101'
/** In manual (`-sort`) order the two Development bookmarks with the highest `sort` lead. */
const DEV_MANUAL_ORDER_TOP = ['20', '19']
/**
 * dnd-kit's PointerSensor swallows click events on the document for 50ms after a drop
 * (so the click that ends a drag never reaches a handler); clicks issued sooner are lost.
 */
const POST_DROP_CLICK_GUARD_MS = 100

/**
 * Select a sidebar collection and wait for its breadcrumb (and, when given, its item
 * count: RTK Query keeps the previous collection's rows on screen until the new page
 * arrives, so on slow runners the list can still belong to the old collection).
 * @param page - Playwright page
 * @param name - Collection name as shown in the sidebar
 * @param itemCount - Expected "N items" toolbar count once the collection has loaded
 */
async function openCollection(page: Page, name: string, itemCount?: number) {
  await page.getByRole('button', { name }).first().click()
  await expect(
    page.locator('[data-slot="breadcrumb-page"]', { hasText: name }),
  ).toBeVisible()
  if (itemCount !== undefined) {
    await expect(page.getByText(`${itemCount} items`)).toBeVisible()
  }
}

/**
 * IDs of the bookmarks currently listed, top to bottom.
 * @param page - Playwright page
 * @returns Ordered bookmark IDs
 */
async function getListedRaindropIds(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid="list-view"] [data-raindrop-id]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-raindrop-id') ?? ''),
    )
}

/**
 * Drag a bookmark row onto a target (double hover so dnd-kit sees a move after
 * activation), run optional assertions while it hovers, then drop and wait for
 * dnd-kit's post-drop click guard to lift.
 * @param page - Playwright page
 * @param raindropId - Bookmark to drag
 * @param target - Drop target locator
 * @param whileDragging - Assertions to run before the drop (preview, highlight)
 */
async function dragBookmarkTo(
  page: Page,
  raindropId: string,
  target: Locator,
  whileDragging?: () => Promise<void>,
) {
  await page.getByTestId(`raindrop-drag-${raindropId}`).hover()
  await page.mouse.down()
  await target.hover()
  await target.hover()
  await whileDragging?.()
  await page.mouse.up()
  await page.waitForTimeout(POST_DROP_CLICK_GUARD_MS)
}

/**
 * Switch the toolbar sort to manual order.
 * @param page - Playwright page
 */
async function switchToManualOrder(page: Page) {
  await page.getByText('Newest First').click()
  await page.getByRole('option', { name: 'Manual Order' }).click()
}

test.describe('P4 Organization - Bookmark DnD (F6)', () => {
  // @spec:F6.1 - Drag collection between groups updates API
  // @spec:F6.5 - Drag preview shows collection icon + name
  test('drags a bookmark onto a sidebar collection and it moves there', async ({
    page,
  }) => {
    await waitForSidebarReady(page)
    await openCollection(page, 'Development', DEV_ITEM_COUNT)
    const row = page.getByTestId(`raindrop-drag-${DEV_BOOKMARK_ID}`)
    await expect(row).toBeVisible()
    const target = page.getByTestId(
      `sidebar-collection-${DESIGN_COLLECTION_ID}`,
    )

    await dragBookmarkTo(page, DEV_BOOKMARK_ID, target, async () => {
      await expect(page.getByTestId('drag-preview')).toContainText(
        'React Documentation',
      )
      await expect(target).toHaveAttribute('data-drop-target', 'true')
    })

    await expect(row).toHaveCount(0)
    await openCollection(page, 'Design')
    await expect(
      page.getByTestId(`raindrop-drag-${DEV_BOOKMARK_ID}`),
    ).toBeVisible()
  })

  // @spec:F6.1 - Drag collection between groups updates API
  test('drags the whole selection when the grabbed bookmark is selected', async ({
    page,
  }) => {
    await waitForSidebarReady(page)
    await openCollection(page, 'Development', DEV_ITEM_COUNT)
    await expect(
      page.getByTestId(`raindrop-drag-${DEV_BOOKMARK_ID}`),
    ).toBeVisible()
    await page.keyboard.press('Meta+a')
    await expect(page.getByText('20 selected')).toBeVisible()

    await dragBookmarkTo(
      page,
      DEV_BOOKMARK_ID,
      page.getByTestId(`sidebar-collection-${DESIGN_COLLECTION_ID}`),
      async () => {
        await expect(page.getByTestId('drag-preview-count')).toHaveText('20')
      },
    )

    await expect(page.getByText('No bookmarks found')).toBeVisible()
  })

  // @spec:F6.7 - Optimistic updates: UI updates immediately, reverts on error
  test('puts the bookmark back when the move is rejected', async ({ page }) => {
    await waitForSidebarReady(page)
    await openCollection(page, 'Development', DEV_ITEM_COUNT)
    const row = page.getByTestId(`raindrop-drag-${DEV_BOOKMARK_ID}`)
    await expect(row).toBeVisible()

    let failedOnce = false
    await page.route(
      '**/api.raindrop.io/rest/v1/raindrops/100',
      async (route) => {
        if (route.request().method() === 'PUT' && !failedOnce) {
          failedOnce = true
          await page.waitForTimeout(600)
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ result: false }),
          })
          return
        }
        await route.fallback()
      },
    )

    await dragBookmarkTo(
      page,
      DEV_BOOKMARK_ID,
      page.getByTestId(`sidebar-collection-${DESIGN_COLLECTION_ID}`),
    )

    // Gone at once, back once the API refused
    await expect(row).toHaveCount(0)
    await expect(row).toBeVisible()
  })

  // @spec:F6.2 - Reorder within group works and persists
  test('reorders bookmarks by drag in manual order and keeps it after reload', async ({
    page,
  }) => {
    await waitForSidebarReady(page)
    await openCollection(page, 'Development', DEV_ITEM_COUNT)
    await switchToManualOrder(page)
    await expect
      .poll(async () => (await getListedRaindropIds(page)).slice(0, 2))
      .toEqual(DEV_MANUAL_ORDER_TOP)

    await dragBookmarkTo(
      page,
      DEV_MANUAL_ORDER_TOP[1],
      page.getByTestId(`raindrop-drag-${DEV_MANUAL_ORDER_TOP[0]}`),
    )
    await expect
      .poll(async () => (await getListedRaindropIds(page)).slice(0, 2))
      .toEqual(['19', '20'])

    await page.reload()
    await waitForSidebarReady(page)
    await openCollection(page, 'Development', DEV_ITEM_COUNT)
    await switchToManualOrder(page)
    await expect
      .poll(async () => (await getListedRaindropIds(page)).slice(0, 2))
      .toEqual(['19', '20'])
  })
})
