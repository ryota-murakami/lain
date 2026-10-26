import { test, expect } from '../electron'

/**
 * Auth bypass smoke tests.
 * Verify that LAIN_TEST_MODE=1 causes the app to start authenticated,
 * showing the main 3-panel UI instead of the login screen.
 *
 * @example
 *   pnpm test:e2e
 */

test.describe('Auth Bypass', () => {
  // @spec:API.29 - GET /user (auth state check on startup)
  test('should skip login screen and show main app', async ({ page }) => {
    await expect(page.getByText('Login with Raindrop.io')).not.toBeVisible()
    // Use breadcrumb link to uniquely identify (sidebar also has "All Bookmarks")
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })
  })

  // @spec:API.1 - GET /raindrops/{collectionId} (initial data load)
  test('should not show loading state after initial render', async ({
    page,
  }) => {
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Loading...')).not.toBeVisible()
  })

  // @spec:API.14 - GET /collections (sidebar loads root collections)
  // @spec:API.15 - GET /collections/childrens (sidebar loads nested)
  test('should have sidebar with system collections', async ({ page }) => {
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
})
