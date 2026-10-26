import { test, expect } from '../electron'

/**
 * P2 Core CRUD UI tests.
 * E2E runs with LAIN_TEST_MODE=1 (mock auth) and page.route() API mocking.
 * Tests verify UI rendering, data display, and user interactions.
 *
 * @example
 *   pnpm test:e2e
 */

test.describe('Sidebar Navigation', () => {
  // @spec:API.14 - GET /collections (root collection tree)
  // @spec:API.15 - GET /collections/childrens (nested collections)
  test('should render system collections in sidebar', async ({ page }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Unsorted')).toBeVisible()
    await expect(page.getByText('Trash')).toBeVisible()
  })

  // @spec:F7.3 - Breadcrumb shows full path: Group > Collection
  // @spec:API.1 - GET /raindrops/{collectionId} (collection switch)
  test('should update breadcrumb on collection click', async ({ page }) => {
    // Wait for initial render
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    // Click Unsorted in sidebar
    await page.getByRole('button', { name: 'Unsorted' }).click()

    // Breadcrumb should update — use the breadcrumb-specific element
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', { hasText: 'Unsorted' }),
    ).toBeVisible()
  })
})

test.describe('Add Bookmark Dialog', () => {
  // @spec:API.3 - POST /raindrop (create bookmark dialog)
  test('should open dialog with form fields', async ({ page }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    // Click "Add Bookmark" button — could be in toolbar ("Add") or empty state ("Add Bookmark")
    await page
      .getByRole('button', { name: /Add Bookmark|^Add$/ })
      .first()
      .click()

    // Dialog should open with title and URL input
    await expect(
      page.getByRole('heading', { name: 'Add Bookmark' }),
    ).toBeVisible()
    await expect(page.getByLabel('URL')).toBeVisible()
  })

  // @spec:KB.15 - Escape/Cancel closes active dialog
  test('should close dialog via Cancel button', async ({ page }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    await page
      .getByRole('button', { name: /Add Bookmark|^Add$/ })
      .first()
      .click()
    await expect(
      page.getByRole('heading', { name: 'Add Bookmark' }),
    ).toBeVisible()

    // Close via Cancel
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Dialog should be gone
    await expect(
      page.getByRole('heading', { name: 'Add Bookmark' }),
    ).not.toBeVisible()
  })

  // @spec:KB.15 - Escape closes active panel/dialog
  test('should close dialog via Escape key', async ({ page }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    await page
      .getByRole('button', { name: /Add Bookmark|^Add$/ })
      .first()
      .click()
    await expect(
      page.getByRole('heading', { name: 'Add Bookmark' }),
    ).toBeVisible()

    // Close via Escape
    await page.keyboard.press('Escape')

    await expect(
      page.getByRole('heading', { name: 'Add Bookmark' }),
    ).not.toBeVisible()
  })
})

test.describe('P4 Auto Icon Assignment (F4)', () => {
  // @spec:F4.1 - New bookmarks auto-fetch icon from suggest API
  test('auto-fetches icon from suggest API in add bookmark dialog', async ({
    page,
  }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    await page
      .getByRole('button', { name: /Add Bookmark|^Add$/ })
      .first()
      .click()
    await expect(
      page.getByRole('heading', { name: 'Add Bookmark' }),
    ).toBeVisible()

    await page.getByLabel('URL').fill('https://react.dev')
    const preview = page.getByTestId('bookmark-favicon-preview')
    await expect(preview).toBeAttached({ timeout: 10_000 })
    await expect(preview).toHaveAttribute('src', /react\.dev\/favicon\.ico/)
  })

  // @spec:F4.2 - Fallback to Google Favicon API when suggest returns no icon
  test('falls back to Google favicon when suggest icon is unavailable', async ({
    page,
  }) => {
    await page.route(
      '**/api.raindrop.io/rest/v1/raindrop/suggest?*',
      async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            result: true,
            item: { meta: {} },
          }),
        })
      },
    )

    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    await page
      .getByRole('button', { name: /Add Bookmark|^Add$/ })
      .first()
      .click()
    await page.getByLabel('URL').fill('https://react.dev')

    const preview = page.getByTestId('bookmark-favicon-preview')
    await expect(preview).toBeAttached({ timeout: 10_000 })
    await expect(preview).toHaveAttribute(
      'src',
      /google\.com\/s2\/favicons\?domain=react\.dev&sz=64/,
    )
  })

  // @spec:F4.3 - Display domain first letter when no icon available
  test('renders domain initial fallback when favicon image cannot load', async ({
    page,
  }) => {
    await page.route('**/www.google.com/s2/favicons**', async (route) => {
      await route.fulfill({ status: 404, body: '' })
    })

    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    await expect
      .poll(async () => {
        return page
          .getByTestId('favicon-1')
          .evaluate((element) => element.tagName)
      })
      .toBe('DIV')

    await expect
      .poll(async () => {
        return page
          .getByTestId('favicon-1')
          .evaluate((element) => (element.textContent ?? '').trim())
      })
      .toBe('R')
  })

  // @spec:F4.4 - Background icon resolution does not block UI
  test('keeps add bookmark form interactive during icon resolution', async ({
    page,
  }) => {
    await page.route(
      '**/api.raindrop.io/rest/v1/raindrop/suggest?*',
      async (route) => {
        await page.waitForTimeout(1_000)
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            result: true,
            item: { meta: { icon: 'https://react.dev/favicon.ico' } },
          }),
        })
      },
    )

    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    await page
      .getByRole('button', { name: /Add Bookmark|^Add$/ })
      .first()
      .click()
    await expect(
      page.getByRole('heading', { name: 'Add Bookmark' }),
    ).toBeVisible()

    await page.getByLabel('URL').fill('https://react.dev')

    await page.getByLabel('Title').fill('Manual Title')
    await expect(page.getByLabel('Title')).toHaveValue('Manual Title')
  })
})

test.describe('Bookmark List Rendering', () => {
  // @spec:API.1 - GET /raindrops/{collectionId} (browse bookmarks)
  test('should render mocked bookmarks in list view', async ({ page }) => {
    // Wait for API-mocked data to load
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    // Bookmark titles from mock data should appear (use heading role for exact match)
    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: 'TypeScript Handbook' }),
    ).toBeVisible()
  })

  // @spec:F7.4 - Bookmark counts visible on collections
  test('should show item count in toolbar', async ({ page }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    // Wait for list items to render
    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible({ timeout: 10_000 })

    // Toolbar shows item count
    await expect(page.getByText(/\d+ items/)).toBeVisible()
  })
})

test.describe('Checkbox Selection', () => {
  // @spec:API.12 - PUT /raindrops/{collectionId} (batch select precondition)
  test('should select raindrop via checkbox on hover', async ({ page }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    // Wait for list items to appear
    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible({ timeout: 10_000 })

    // Hover over first list item to reveal checkbox
    const firstItem = page.locator('.divide-y > div').first()
    await firstItem.hover()

    // Click the checkbox
    const checkbox = firstItem.locator('[data-slot="checkbox"]')
    await checkbox.click()

    // Selection bar should appear showing "1 selected"
    await expect(page.getByText('1 selected')).toBeVisible()
  })

  // @spec:API.12 - PUT /raindrops/{collectionId} (deselect flow)
  test('should deselect raindrop via checkbox click', async ({ page }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible({ timeout: 10_000 })

    // Select first item
    const firstItem = page.locator('.divide-y > div').first()
    await firstItem.hover()
    const checkbox = firstItem.locator('[data-slot="checkbox"]')
    await checkbox.click()
    await expect(page.getByText('1 selected')).toBeVisible()

    // Deselect by clicking the checkbox again
    await checkbox.click()

    // Selection bar should disappear
    await expect(page.getByText(/\d+ selected/)).not.toBeVisible()
  })
})

test.describe('Content Scrolling', () => {
  // @spec:API.1 - GET /raindrops/{collectionId} (paginated list renders)
  test('should render scroll area with bookmarks', async ({ page }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    // Wait for mocked data to render in the list
    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible({ timeout: 10_000 })

    // Multiple items should be present (mocked data has 20 items)
    const items = page.locator('.divide-y > div')
    await expect(items.first()).toBeVisible()
    const count = await items.count()
    expect(count).toBeGreaterThan(5)
  })
})

test.describe('View Mode Toggle', () => {
  // @spec:F3.1 - All 4 view modes render correctly
  test('should show view mode dropdown trigger in toolbar', async ({
    page,
  }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    // View mode dropdown trigger button should be visible
    await expect(page.getByLabel('View mode')).toBeVisible({ timeout: 5_000 })
  })

  // @spec:F3.1 - All 4 view modes render correctly (dropdown options)
  test('should open dropdown with all 4 view mode options', async ({
    page,
  }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    // Open the view mode dropdown
    await page.getByLabel('View mode').click()

    // All 4 options should be present as radio menu items
    await expect(
      page.getByRole('menuitemradio', { name: 'List' }),
    ).toBeVisible()
    await expect(
      page.getByRole('menuitemradio', { name: 'Grid' }),
    ).toBeVisible()
    await expect(
      page.getByRole('menuitemradio', { name: 'Table' }),
    ).toBeVisible()
    await expect(
      page.getByRole('menuitemradio', { name: 'Directory' }),
    ).toBeVisible()
  })

  // @spec:F3.1 - All 4 view modes render correctly (switch works)
  test('should switch view mode via dropdown selection', async ({ page }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    // Wait for bookmarks to render in default list view
    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible({ timeout: 10_000 })

    // Switch to Grid view
    await page.getByLabel('View mode').click()
    await page.getByRole('menuitemradio', { name: 'Grid' }).click()

    // Bookmarks should still be visible after view mode change
    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Sort Dropdown', () => {
  // @spec:API.1 - GET /raindrops/{collectionId} (sort parameter)
  test('should render sort dropdown with default "Newest First"', async ({
    page,
  }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    // Sort dropdown should show current value
    await expect(page.getByText('Newest First')).toBeVisible({
      timeout: 5_000,
    })
  })

  // @spec:API.1 - GET /raindrops/{collectionId} (sort change)
  test('should change sort option via dropdown', async ({ page }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    // Wait for data to load
    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible({ timeout: 10_000 })

    // Open sort dropdown and select "Title A-Z"
    await page.getByText('Newest First').click()
    await page.getByRole('option', { name: 'Title A-Z' }).click()

    // Dropdown should now show "Title A-Z"
    await expect(page.getByText('Title A-Z')).toBeVisible()
  })
})

test.describe('Bulk Delete', () => {
  // @spec:API.13 - DELETE /raindrops/{collectionId} (batch delete)
  test('should show Delete button in bulk bar and handle click', async ({
    page,
  }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    // Wait for list items
    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible({ timeout: 10_000 })

    // Select first item via checkbox
    const firstItem = page.locator('.divide-y > div').first()
    await firstItem.hover()
    const checkbox = firstItem.locator('[data-slot="checkbox"]')
    await checkbox.click()

    // Bulk bar should show "1 selected" and Delete button
    await expect(page.getByText('1 selected')).toBeVisible()
    const deleteButton = page.getByRole('button', { name: 'Delete' })
    await expect(deleteButton).toBeVisible()

    // Click Delete — should trigger batch delete mutation
    await deleteButton.click()

    // After delete, selection bar should clear
    await expect(page.getByText(/\d+ selected/)).not.toBeVisible({
      timeout: 5_000,
    })
  })

  // @spec:API.13 - DELETE /raindrops/{collectionId} (deselect all in bulk bar)
  test('should show Deselect All button in bulk bar', async ({ page }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible({ timeout: 10_000 })

    // Select first item
    const firstItem = page.locator('.divide-y > div').first()
    await firstItem.hover()
    await firstItem.locator('[data-slot="checkbox"]').click()
    await expect(page.getByText('1 selected')).toBeVisible()

    // Click Deselect All
    await page.getByRole('button', { name: 'Deselect All' }).click()

    // Selection bar should disappear
    await expect(page.getByText(/\d+ selected/)).not.toBeVisible()
  })
})

test.describe('Detail Panel Layout (addbaa1 regression)', () => {
  // @spec:API.2 - GET /raindrop/{id} (view bookmark details)
  test('should open detail panel within viewport when raindrop is clicked', async ({
    page,
  }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    // Wait for bookmarks to render
    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible({ timeout: 10_000 })

    // Click a raindrop to open the detail panel
    await page.getByRole('heading', { name: 'React Documentation' }).click()

    // Detail panel should become visible with "Details" header
    await expect(page.getByText('Details')).toBeVisible({ timeout: 5_000 })

    // Get viewport width
    const viewportWidth = await page.evaluate(() => window.innerWidth)

    // Verify the detail panel is within viewport bounds
    const detailPanel = page.locator('.flex.h-screen.flex-col.border-l').last()
    await expect
      .poll(async () => (await detailPanel.boundingBox())?.width ?? 0, {
        timeout: 5_000,
      })
      .toBeGreaterThan(0)

    const box = await detailPanel.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThan(0) // Panel is expanded
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1) // Within viewport (1px tolerance)
  })

  // @spec:API.2 - GET /raindrop/{id} (detail panel layout regression)
  test('should keep SidebarInset min-w-0 when detail panel is open', async ({
    page,
  }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible({ timeout: 10_000 })

    // Open detail panel
    await page.getByRole('heading', { name: 'React Documentation' }).click()
    await expect(page.getByText('Details')).toBeVisible({ timeout: 5_000 })

    // Verify SidebarInset has min-w-0 (CSS class check)
    const sidebarInset = page.locator('[data-slot="sidebar-inset"]')
    const classes = await sidebarInset.getAttribute('class')
    expect(classes).toContain('min-w-0')

    // Verify SidebarInset doesn't overflow viewport
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    const insetBox = await sidebarInset.boundingBox()
    expect(insetBox).toBeTruthy()
    expect(insetBox!.x + insetBox!.width).toBeLessThanOrEqual(viewportWidth + 1)
  })

  // @spec:API.2 - GET /raindrop/{id} (close detail panel)
  test('should close detail panel and keep content visible', async ({
    page,
  }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible({ timeout: 10_000 })

    // Open detail panel
    await page.getByRole('heading', { name: 'React Documentation' }).click()
    await expect(page.getByText('Details')).toBeVisible({ timeout: 5_000 })

    // Close detail panel via close button (PanelRightClose icon)
    // Button is inside the detail panel header, has no aria-label but tooltip "Close panel"
    const closeButton = page
      .locator('.flex.h-screen.flex-col.border-l button:has(svg)')
      .first()
    await closeButton.click()

    // Wait for panel to collapse
    await expect(page.getByText('Details')).not.toBeVisible({ timeout: 3_000 })

    // Content should still be visible and within viewport after panel closes
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    const sidebarInset = page.locator('[data-slot="sidebar-inset"]')
    const insetBox = await sidebarInset.boundingBox()
    expect(insetBox).toBeTruthy()
    expect(insetBox!.x + insetBox!.width).toBeLessThanOrEqual(viewportWidth + 1)

    // Bookmarks should still be visible after panel close
    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible()
  })
})

test.describe('Bulk Operations Bar', () => {
  // @spec:API.12 - PUT /raindrops/{collectionId} (bulk ops bar UI)
  test('should show disabled Move to... and Add Tag... buttons', async ({
    page,
  }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })

    await expect(
      page.getByRole('heading', { name: 'React Documentation' }),
    ).toBeVisible({ timeout: 10_000 })

    // Select an item to show bulk bar
    const firstItem = page.locator('.divide-y > div').first()
    await firstItem.hover()
    await firstItem.locator('[data-slot="checkbox"]').click()
    await expect(page.getByText('1 selected')).toBeVisible()

    // Move to... and Add Tag... should be visible but disabled
    const moveButton = page.getByRole('button', { name: 'Move to...' })
    const tagButton = page.getByRole('button', { name: 'Add Tag...' })
    await expect(moveButton).toBeVisible()
    await expect(tagButton).toBeVisible()
    await expect(moveButton).toBeDisabled()
    await expect(tagButton).toBeDisabled()
  })
})
