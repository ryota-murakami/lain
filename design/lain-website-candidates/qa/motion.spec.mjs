import {
  test,
  expect,
} from '../../../apps/desktop/node_modules/@playwright/test/index.mjs'

// Slower walkthroughs retain enough frames to inspect movement and input feedback.
for (const id of [
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
]) {
  test(`${id} recorded motion: hero, product navigation and demo changes remain coherent`, async ({
    page,
  }) => {
    // Arrange: capture the default motion preference at a representative desktop size.
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/${id}/`)

    // Act: allow entrance/ambient motion to run before driving the interaction.
    await page.waitForTimeout(1500)
    if (id === 'W11') await page.locator('.play-pile').hover()
    else await page.getByRole('link', { name: 'Explore Lain' }).hover()
    await page.waitForTimeout(600)
    await page.getByRole('link', { name: 'See how it feels' }).click()
    await page.waitForTimeout(700)
    await page
      .getByRole('searchbox', { name: 'Search illustrative bookmarks' })
      .pressSequentially('design', { delay: 100 })
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Grid', exact: true }).click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'List', exact: true }).click()

    // Assert: motion must not leave controls hidden or disrupt the current query.
    await expect(page.locator('.demo-count')).toHaveText('2 bookmarks')
    await expect(
      page.getByRole('heading', { name: 'A thoughtful design system' }),
    ).toBeVisible()
    await page
      .getByRole('searchbox', { name: 'Search illustrative bookmarks' })
      .clear()
    await page.waitForTimeout(500)
    await page.emulateMedia({ reducedMotion: 'reduce' })
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
