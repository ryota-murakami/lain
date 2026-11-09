import { test, expect } from '../electron'

const API = 'https://api.raindrop.io/rest/v1'

// @spec:API.24 - DELETE /collection/-99 — empty only the isolated mock Trash through the visible menu.
for (const scenario of [
  {
    name: '503 refusal preserves both trash bookmarks and never claims success',
    mode: '503',
    status: 503,
    success: false,
  },
  {
    name: 'HTTP200 result false preserves both trash bookmarks and never claims success',
    mode: 'result-false',
    status: 200,
    success: false,
  },
  {
    name: 'successful Empty Trash refreshes the empty list and preserves active bookmarks',
    mode: 'success',
    status: 200,
    success: true,
  },
]) {
  test(scenario.name, async ({ page }, testInfo) => {
    // Arrange — fresh synthetic auth/profile; no real account or existing Trash is loaded.
    const errors: string[] = []
    const requests: Array<{ phase: string; method: string; path: string }> = []
    let phase = 'seed'
    page.on('pageerror', (error) => errors.push(error.message))
    await page.context().route('https://**/*', (route) => route.abort())
    await page.route('**/api.raindrop.io/rest/v1/**', async (route) => {
      const request = route.request()
      const pathname = new URL(request.url()).pathname.replace('/rest/v1', '')
      requests.push({ phase, method: request.method(), path: pathname })
      if (
        phase === 'empty-trash' &&
        request.method() === 'DELETE' &&
        pathname === '/collection/-99' &&
        !scenario.success
      ) {
        await route.fulfill({
          status: scenario.status,
          json: {
            result: false,
            errorMessage: 'Controlled Empty Trash refusal',
          },
        })
        return
      }
      await route.fallback()
    })
    await page.reload()
    await expect(page.locator('[data-slot="breadcrumb-page"]')).toHaveText(
      'All Bookmarks',
    )
    await expect(page.locator('[data-raindrop-id="1"]')).toBeVisible()
    await page.evaluate(async (api) => {
      // Seed only the private in-memory mock through its existing soft-delete handler.
      for (const id of [1, 2]) {
        const response = await fetch(`${api}/raindrop/${id}`, {
          method: 'DELETE',
        })
        if (!(await response.json()).result)
          throw new Error('Synthetic Trash seed failed')
      }
    }, API)
    await page.reload()
    const trash = page.getByRole('button', { name: /^Trash(?: \d+)?$/ })
    await trash.click()
    await expect(page.locator('[data-slot="breadcrumb-page"]')).toHaveText(
      'Trash',
    )
    await expect(page.locator('[data-raindrop-id]')).toHaveCount(2)
    await expect(page.locator('[data-raindrop-id="1"]')).toContainText(
      'React Documentation',
    )
    await expect(page.locator('[data-raindrop-id="2"]')).toContainText(
      'TypeScript Handbook',
    )
    phase = 'empty-trash'
    await trash.hover()
    await trash.locator('button[aria-haspopup="menu"]').click()
    await expect(
      page.getByRole('menuitem', { name: 'Empty Trash', exact: true }),
    ).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('empty-trash-menu.png') })

    // Act — click the real destructive menu item and inspect the actual mutation request.
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        response.url() === `${API}/collection/-99`,
    )
    await page
      .getByRole('menuitem', { name: 'Empty Trash', exact: true })
      .click()
    const response = await responsePromise
    expect(response.status()).toBe(scenario.status)
    expect(await response.json()).toEqual(
      scenario.success
        ? { result: true }
        : { result: false, errorMessage: 'Controlled Empty Trash refusal' },
    )
    await expect(
      page.getByRole('menuitem', { name: 'Empty Trash', exact: true }),
    ).toBeHidden()

    // Assert — failure never removes data or announces success; success refreshes the list.
    if (scenario.success) {
      await expect(page.locator('[data-raindrop-id]')).toHaveCount(0)
      await expect(
        page.getByText('Trash emptied', { exact: true }),
      ).toBeVisible()
      await expect(
        page.getByText('No bookmarks found', { exact: true }),
      ).toBeVisible()
    } else {
      await expect(page.locator('[data-raindrop-id]')).toHaveCount(2)
      await expect(
        page.getByText('Trash emptied', { exact: true }),
      ).toHaveCount(0)
      await expect(
        page.getByText(
          scenario.mode === '503'
            ? 'Server error. Please try again later.'
            : 'Could not empty Trash. Please retry.',
          { exact: true },
        ),
      ).toBeVisible()
    }
    // Hold an asserted checkpoint only to make its feedback readable in the recording.
    await page.waitForTimeout(500)
    await page.screenshot({
      path: testInfo.outputPath('empty-trash-feedback.png'),
    })
    const feedback = await page.locator('[data-sonner-toast]').allTextContents()
    expect(feedback).toEqual([
      scenario.success
        ? 'Trash emptied'
        : scenario.mode === '503'
          ? 'Server error. Please try again later.'
          : 'Could not empty Trash. Please retry.',
    ])
    expect(errors).toEqual([])
    await page.reload()
    await expect(page.locator('[data-slot="breadcrumb-page"]')).toHaveText(
      'All Bookmarks',
    )
    await page.getByRole('button', { name: /^Trash(?: \d+)?$/ }).click()
    await expect(page.locator('[data-slot="breadcrumb-page"]')).toHaveText(
      'Trash',
    )
    await expect(page.locator('[data-raindrop-id]')).toHaveCount(
      scenario.success ? 0 : 2,
    )
    const inventory = await page.evaluate(async (api) => {
      const trash = await (
        await fetch(`${api}/raindrops/-99?perpage=50`)
      ).json()
      const active = await (
        await fetch(`${api}/raindrops/0?perpage=100`)
      ).json()
      return {
        trashIds: trash.items
          .map((item: { _id: number }) => item._id)
          .sort((a: number, b: number) => a - b),
        activeCount: active.count,
      }
    }, API)
    expect(inventory).toEqual({
      trashIds: scenario.success ? [] : [1, 2],
      activeCount: 58,
    })
    const mutations = requests.filter(
      (request) =>
        request.phase === 'empty-trash' &&
        !['GET', 'OPTIONS'].includes(request.method),
    )
    expect(mutations).toEqual([
      { phase: 'empty-trash', method: 'DELETE', path: '/collection/-99' },
    ])
    await page.screenshot({
      path: testInfo.outputPath('empty-trash-reloaded.png'),
    })
    await testInfo.attach('Empty Trash API observations', {
      body: JSON.stringify(
        {
          scenario: scenario.mode,
          responseStatus: response.status(),
          mutations,
          inventory,
          feedback,
          pageErrors: errors,
          allRequests: requests,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    })
  })
}
