import {
  test,
  expect,
} from '../../../apps/desktop/node_modules/@playwright/test/index.mjs'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const evidence = fileURLToPath(new URL('../qa/screenshots/', import.meta.url))
await mkdir(evidence, { recursive: true })
const ids = [
  'W01',
  'W02',
  'W03',
  'W04',
  'W05',
  'W06',
  'W07',
  'W08',
  'W09',
  'W10',
  'W11',
  'W12',
]

for (const id of ids) {
  for (const size of ['desktop', 'mobile']) {
    test(`${id} ${size}: visitors can search examples, change views and reach truthful download information`, async ({
      page,
    }) => {
      // Arrange: use isolated synthetic examples in a real Chromium browser.
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.setViewportSize(
        size === 'desktop'
          ? { width: 1440, height: 1000 }
          : { width: 390, height: 844 },
      )
      await page.goto(`/${id}/`)
      await page.evaluate(() => document.fonts.ready)

      // Act: record page movement and the same controls a visitor can use.
      await expect(page.locator('h1')).toBeVisible()
      await page.screenshot({
        path: `${evidence}/${id}-${size}.png`,
        fullPage: true,
        animations: 'disabled',
      })
      await page.getByRole('link', { name: 'See how it feels' }).click()
      const search = page.getByRole('searchbox', {
        name: 'Search illustrative bookmarks',
      })
      await search.fill('design')

      // Assert: visible results reflect the query, including a zero-result path.
      await expect(page.locator('.demo-count')).toHaveText('2 bookmarks')
      await expect(page.locator('.demo-bookmark:visible')).toHaveCount(2)
      await expect(
        page.getByRole('heading', { name: 'A thoughtful design system' }),
      ).toBeVisible()
      await search.fill('no-such-example')
      await expect(
        page.getByText('No matching examples. Try “design”.'),
      ).toBeVisible()
      await expect(page.locator('.demo-count')).toHaveText('0 bookmarks')
      await search.clear()
      await expect(page.locator('.demo-count')).toHaveText('6 bookmarks')
      await page.getByRole('button', { name: 'Grid', exact: true }).click()
      await expect(page.locator('[data-workspace]')).toHaveAttribute(
        'data-view',
        'grid',
      )
      await expect(
        page.getByRole('button', { name: 'Grid', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true')
      await page.getByRole('button', { name: 'Table', exact: true }).click()
      await expect(page.locator('[data-workspace]')).toHaveAttribute(
        'data-view',
        'table',
      )
      await page.getByRole('button', { name: 'List', exact: true }).click()
      await page.getByRole('link', { name: 'Get Lain' }).click()
      await expect(
        page.getByText('AppImage & deb · preview target'),
      ).toBeVisible()
      await expect(
        page.getByText('Alpha software.', { exact: false }),
      ).toBeVisible()
      await page.getByText('Before you install', { exact: true }).click()
      await expect(
        page.getByText('Check your operating system, CPU', { exact: false }),
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: /macOS Apple Silicon/ }),
      ).toHaveAttribute(
        'href',
        'https://github.com/ryota-murakami/lain/releases',
      )
      await expect(
        page.getByRole('link', { name: /Linux x64 AppImage/ }),
      ).toHaveAttribute(
        'href',
        'https://github.com/ryota-murakami/lain/releases',
      )
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true)
      expect(errors).toEqual([])

      // Act: reduced motion must stop ambient and entrance animations.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.evaluate(() => window.scrollTo(0, 0))

      // Assert: no running CSS animation remains under the user's preference.
      expect(
        await page.evaluate(
          () =>
            document
              .getAnimations()
              .filter((animation) => animation.playState === 'running').length,
        ),
      ).toBe(0)
    })
  }
}

test('The comparison room opens all twelve candidates and preserves a keyboard-created shortlist', async ({
  page,
}) => {
  // Arrange: a fresh browser starts with all directions and an empty shortlist.
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await expect(page.locator('[data-direction]:visible')).toHaveCount(12)
  await page.screenshot({
    path: `${evidence}/comparison-desktop.png`,
    fullPage: true,
    animations: 'disabled',
  })

  // Act: keyboard activation adds one direction, then filters to that shortlist.
  const shortlist = page.getByRole('button', {
    name: 'Shortlist W01: The considered web',
  })
  await shortlist.focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Shortlisted', exact: true }).click()

  // Assert: only the chosen direction remains, including after reload.
  await expect(page.locator('[data-direction]:visible')).toHaveCount(1)
  await expect(page.locator('#shown-count')).toHaveText('1 direction')
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Shortlist W01: The considered web' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Technical', exact: true }).click()
  await expect(page.locator('[data-direction]:visible')).toHaveCount(3)
  await page.getByRole('button', { name: 'All', exact: true }).click()
  for (const id of ids) {
    await expect(
      page.locator(`[data-direction="${id}"] a`).first(),
    ).toHaveAttribute('href', `${id}/`)
  }
  await page.getByRole('button', { name: 'Clear shortlist' }).click()
  await page.getByRole('button', { name: 'Shortlisted', exact: true }).click()
  await expect(
    page.getByText('No directions shortlisted yet.', { exact: false }),
  ).toBeVisible()
})

test('The mobile comparison room keeps every direction readable and local links resolvable', async ({
  page,
  request,
}) => {
  // Arrange: use a narrow phone viewport without sharing any user data.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  // Act: capture the full comparison and inspect each static route.
  await page.screenshot({
    path: `${evidence}/comparison-mobile.png`,
    fullPage: true,
    animations: 'disabled',
  })
  for (const id of ids) {
    const response = await request.get(`/${id}/`)
    expect(response.status()).toBe(200)
  }

  // Assert: the full set remains available without horizontal scrolling.
  await expect(page.locator('[data-direction]:visible')).toHaveCount(12)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Editorial', exact: true }).click()
  await expect(page.locator('[data-direction]:visible')).toHaveCount(3)
})
