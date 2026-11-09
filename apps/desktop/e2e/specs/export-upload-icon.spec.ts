import { test as base, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page, TestInfo } from '@playwright/test'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { mockRaindropApi } from '../api-mock'

interface FeatureFixtures {
  groupCount: number
  extraCollections: number
  childBookmarkCount: number
  electronApp: ElectronApplication
  profileDirectory: string
  page: Page
  mockApi: Awaited<ReturnType<typeof mockRaindropApi>>
}

/** Isolate real IPC preferences/files while recording only the synthetic renderer and mock API data. */
const test = base.extend<FeatureFixtures>({
  groupCount: [2, { option: true }],
  extraCollections: [0, { option: true }],
  childBookmarkCount: [0, { option: true }],
  profileDirectory: async ({}, use) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'lain-feature-e2e-'))
    await use(directory)
    await rm(directory, { recursive: true, force: true })
  },
  electronApp: async ({ profileDirectory }, use, testInfo) => {
    const application = await electron.launch({
      args: [
        fileURLToPath(new URL('../../dist-electron/main.js', import.meta.url)),
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        LAIN_TEST_MODE: '1',
        LAIN_USER_DATA_DIR: profileDirectory,
      },
      recordVideo: {
        dir: testInfo.outputPath('video'),
        size: { width: 1200, height: 800 },
      },
    })
    await use(application)
    const video = application.windows()[0]?.video()
    await application.close()
    if (video) {
      const videoPath = testInfo.outputPath('flow.webm')
      await video.saveAs(videoPath)
      await testInfo.attach('Recorded Electron flow', {
        path: videoPath,
        contentType: 'video/webm',
      })
    }
  },
  page: async ({ electronApp, mockApi }, use) => {
    void mockApi
    const page = await electronApp.firstWindow()
    await page.reload()
    await expect(
      page.locator('[data-slot="breadcrumb-page"]', {
        hasText: 'All Bookmarks',
      }),
    ).toBeVisible()
    await use(page)
  },
  mockApi: async (
    { electronApp, groupCount, extraCollections, childBookmarkCount },
    use,
  ) => {
    const page = await electronApp.firstWindow()
    await use(
      await mockRaindropApi(page, {
        failUploadMetadataOnceFor: 'retry-notes.txt',
        groupCount,
        extraCollections,
        childBookmarkCount,
      }),
    )
  },
})

/** Attach a visible flow checkpoint; videos preserve the transitions between these states. */
async function capture(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  // Hold already-asserted checkpoints so the recorded flow remains readable at normal playback speed.
  await page.waitForTimeout(450)
  const filename = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path: filename })
  await testInfo.attach(name, { path: filename, contentType: 'image/png' })
}

test('export preserves all pages through native cancellation then writes a verified JSON file', async ({
  page,
  electronApp,
  profileDirectory,
}, testInfo) => {
  // Arrange — stub only the OS picker; the preload bridge, sender check and atomic file writer remain real.
  await electronApp.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: true, filePath: '' })
  })
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const exporter = page.getByRole('dialog', { name: 'Export bookmarks' })
  await exporter.getByLabel('Format', { exact: true }).selectOption('json')

  // Act — cancel native selection after snapshot verification, then repeat with a destination.
  await exporter.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(exporter.getByRole('status')).toHaveText(
    'Save canceled. No file was written.',
  )
  expect(
    (await readdir(profileDirectory)).some(
      (filename) =>
        filename.endsWith('.json') && filename.startsWith('qa-export'),
    ),
  ).toBe(false)
  await capture(page, testInfo, 'export-native-canceled')
  const destination = path.join(profileDirectory, 'qa-export.json')
  await electronApp.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, destination)
  await exporter.getByRole('button', { name: 'Export', exact: true }).click()

  // Assert — the real file includes records beyond the first 50 loaded rows, without temporary artifacts.
  await expect(exporter.getByRole('status')).toHaveText(
    'Exported 60 bookmarks to qa-export.json.',
  )
  const snapshot = JSON.parse(await readFile(destination, 'utf8')) as {
    schemaVersion: number
    scope: number
    bookmarks: Array<{ _id: number }>
    collections: Array<{ _id: number }>
  }
  expect(snapshot.schemaVersion).toBe(1)
  expect(snapshot.scope).toBe(0)
  expect(snapshot.bookmarks).toHaveLength(60)
  expect(new Set(snapshot.bookmarks.map((bookmark) => bookmark._id)).size).toBe(
    60,
  )
  expect(snapshot.bookmarks.some((bookmark) => bookmark._id === 60)).toBe(true)
  expect(snapshot.collections.map((collection) => collection._id)).toEqual([
    100, 101, 102, 103, 200, 201,
  ])
  expect(
    (await readdir(profileDirectory)).filter((filename) =>
      filename.endsWith('.tmp'),
    ),
  ).toEqual([])
  await capture(page, testInfo, 'export-json-written')
})

test('multi-file upload keeps successful files and retries failed metadata without uploading a duplicate', async ({
  page,
  mockApi,
}, testInfo) => {
  // Arrange — two harmless in-memory text files exercise the real multipart upload and queue UI.
  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  const uploader = page.getByRole('dialog', { name: 'Upload files' })
  await uploader
    .getByRole('combobox', { name: 'Collection', exact: true })
    .click()
  await page
    .locator('[data-slot="popover-content"]')
    .getByRole('button', { name: /^Development 20$/ })
    .click()
  await uploader.locator('input[type="file"]').setInputFiles([
    {
      name: 'complete-notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Synthetic complete upload fixture.\n'),
    },
    {
      name: 'retry-notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Synthetic retry upload fixture.\n'),
    },
  ])
  await uploader
    .getByLabel('Title for complete-notes.txt')
    .fill('Complete notes')
  await uploader.getByLabel('Title for retry-notes.txt').fill('Retry notes')
  await uploader.getByLabel('Tags (comma separated)').fill('qa, synthetic')
  await uploader
    .getByLabel('Note for these files')
    .fill('Public synthetic QA fixture — 日本語')
  await uploader.getByLabel('Mark important').check()
  await capture(page, testInfo, 'upload-two-files-queued')

  // Act — one file completes and the second upload succeeds before its metadata request fails.
  await uploader.getByRole('button', { name: 'Upload queued files' }).click()
  await expect(
    uploader.getByText('Uploaded and saved', { exact: true }),
  ).toHaveCount(1)
  await expect(uploader.getByRole('alert')).toContainText(
    'File uploaded; metadata is not saved yet.',
  )
  await capture(page, testInfo, 'upload-partial-metadata-failure')
  await uploader
    .getByRole('button', { name: 'Retry metadata', exact: true })
    .click()

  // Assert — only the second metadata PUT is retried, against its original bookmark ID.
  await expect(
    uploader.getByText('Uploaded and saved', { exact: true }),
  ).toHaveCount(2)
  expect(mockApi.uploadedFiles).toEqual([
    'complete-notes.txt',
    'retry-notes.txt',
  ])
  expect(mockApi.uploadRequests).toEqual([
    {
      filename: 'complete-notes.txt',
      collectionId: 100,
      collectionBeforeFile: true,
    },
    {
      filename: 'retry-notes.txt',
      collectionId: 100,
      collectionBeforeFile: true,
    },
  ])
  expect(mockApi.metadataWrites).toEqual([
    {
      id: 10000,
      body: {
        title: 'Complete notes',
        tags: ['qa', 'synthetic'],
        note: 'Public synthetic QA fixture — 日本語',
        important: true,
        collection: { $id: 100 },
      },
    },
    {
      id: 10001,
      body: {
        title: 'Retry notes',
        tags: ['qa', 'synthetic'],
        note: 'Public synthetic QA fixture — 日本語',
        important: true,
        collection: { $id: 100 },
      },
    },
    {
      id: 10001,
      body: {
        title: 'Retry notes',
        tags: ['qa', 'synthetic'],
        note: 'Public synthetic QA fixture — 日本語',
        important: true,
        collection: { $id: 100 },
      },
    },
  ])
  await capture(page, testInfo, 'upload-both-files-confirmed')
  await uploader
    .locator('[data-slot="dialog-footer"]')
    .getByRole('button', { name: 'Close', exact: true })
    .click()
  await page.getByRole('button', { name: 'Development', exact: true }).click()
  await expect(page.locator('[data-raindrop-id="10000"]')).toContainText(
    'Complete notes',
  )
  await expect(page.locator('[data-raindrop-id="10001"]')).toContainText(
    'Retry notes',
  )
  await capture(page, testInfo, 'uploaded-bookmarks-in-destination')
})

test('icon preview applies through native IPC, survives reload and restores the release default', async ({
  page,
  profileDirectory,
}, testInfo) => {
  // Arrange
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+,' : 'Control+,',
  )
  await page.getByRole('tab', { name: 'Icons', exact: true }).click()
  const gallery = page.getByRole('group', { name: '64 icon candidates' })
  await expect(gallery.getByRole('button')).toHaveCount(64)
  await expect(
    page.getByText('Current icon: Release default', { exact: true }),
  ).toBeVisible()

  // Act — preview remains local until the explicit apply action writes the native preference.
  await gallery.getByRole('button', { name: /^I12 / }).click()
  const preview = page.getByAltText('I12 128 pixel preview')
  await expect(preview).toBeVisible()
  await expect
    .poll(() =>
      preview.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0)
  await expect(
    page.getByText('Current icon: Release default', { exact: true }),
  ).toBeVisible()
  await capture(page, testInfo, 'icon-candidate-preview')
  await page
    .getByRole('button', { name: 'Apply previewed icon', exact: true })
    .click()

  // Assert — the actual isolated native preference matches the UI and survives renderer reload.
  await expect(
    page.getByText('Current icon: I12', { exact: true }),
  ).toBeVisible()
  expect(
    JSON.parse(
      await readFile(
        path.join(profileDirectory, 'lain-appearance.json'),
        'utf8',
      ),
    ),
  ).toEqual({ selectedIcon: 'I12' })
  await capture(page, testInfo, 'icon-candidate-applied')
  await page.reload()
  await expect(
    page.locator('[data-slot="breadcrumb-page"]', { hasText: 'All Bookmarks' }),
  ).toBeVisible()
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+,' : 'Control+,',
  )
  await page.getByRole('tab', { name: 'Icons', exact: true }).click()
  await expect(
    page.getByText('Current icon: I12', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Restore default', exact: true })
    .click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Default icon restored.' }),
  ).toBeVisible()
  expect(
    JSON.parse(
      await readFile(
        path.join(profileDirectory, 'lain-appearance.json'),
        'utf8',
      ),
    ),
  ).toEqual({ selectedIcon: null })
  await capture(page, testInfo, 'icon-default-restored')
})

// Exercise both pointer layouts through the same user-visible contract; each run has an isolated profile/API store.
for (const view of ['grid', 'list'] as const) {
  test(`${view} hover controls select bookmarks and persist edit, important, move and Trash actions`, async ({
    page,
  }, testInfo) => {
    // Arrange — choose a real collection and the requested layout before touching its hover controls.
    await page.getByRole('button', { name: 'Development', exact: true }).click()
    await page.keyboard.press(view === 'grid' ? 'Meta+1' : 'Meta+2')
    const bookmarks = page.getByTestId(`${view}-view`)
    const reactSelection = bookmarks.getByRole('checkbox', {
      name: 'Select React Documentation',
      exact: true,
    })
    const typeScriptSelection = bookmarks.getByRole('checkbox', {
      name: 'Select TypeScript Handbook',
      exact: true,
    })
    await expect(bookmarks).toBeVisible()

    // Act — pointer selection must remain mounted when leaving the card cover or row icon.
    await bookmarks.getByText('React Documentation', { exact: true }).hover()
    await reactSelection.click()
    await expect(reactSelection).toBeChecked()
    await expect(page.getByText('1 selected', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Close detail panel' }),
    ).toHaveCount(0)
    await bookmarks.getByText('TypeScript Handbook', { exact: true }).hover()
    await typeScriptSelection.click()
    await expect(typeScriptSelection).toBeChecked()
    await expect(page.getByText('2 selected', { exact: true })).toBeVisible()
    await capture(page, testInfo, `${view}-two-checkboxes-selected`)
    await page
      .getByRole('button', { name: 'Deselect All', exact: true })
      .click()
    await expect(reactSelection).not.toBeChecked()
    await expect(typeScriptSelection).not.toBeChecked()

    // Edit must open the detail editor rather than starting a drag or opening the URL.
    await bookmarks.getByText('React Documentation', { exact: true }).hover()
    await bookmarks
      .getByRole('button', {
        name: 'Actions for React Documentation',
        exact: true,
      })
      .click()
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
    const detail = page.getByTestId('detail-panel')
    await expect(detail.getByLabel('Title', { exact: true })).toHaveValue(
      'React Documentation',
    )
    const editedTitle = `Menu edited ${view} bookmark`
    await detail.getByLabel('Title', { exact: true }).fill(editedTitle)
    await detail
      .getByRole('button', { name: 'Save Changes', exact: true })
      .click()
    await expect(
      detail.getByRole('button', { name: 'Save Changes', exact: true }),
    ).toBeDisabled()
    await expect(
      bookmarks.getByText(editedTitle, { exact: true }),
    ).toBeVisible()
    await capture(page, testInfo, `${view}-menu-edit-saved`)
    await detail.getByRole('button', { name: 'Close detail panel' }).click()
    await expect(
      page.getByRole('button', { name: 'Open detail panel' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Open detail panel' }).click()
    await expect(detail.getByLabel('Title', { exact: true })).toHaveValue(
      editedTitle,
    )
    await detail.getByRole('button', { name: 'Close detail panel' }).click()

    // Assert importance through the next rendered menu, then move and verify the destination collection.
    await bookmarks.getByText(editedTitle, { exact: true }).hover()
    await bookmarks
      .getByRole('button', { name: `Actions for ${editedTitle}`, exact: true })
      .click()
    await page
      .getByRole('menuitem', { name: 'Mark as Important', exact: true })
      .click()
    await bookmarks
      .getByRole('button', { name: `Actions for ${editedTitle}`, exact: true })
      .click()
    await expect(
      page.getByRole('menuitem', { name: 'Remove Important', exact: true }),
    ).toBeVisible()
    await capture(page, testInfo, `${view}-menu-importance-confirmed`)
    await page
      .getByRole('menuitem', { name: 'Move to Collection...', exact: true })
      .click()
    const mover = page.getByRole('dialog', {
      name: 'Move bookmarks',
      exact: true,
    })
    await mover
      .getByRole('combobox', { name: 'Collection', exact: true })
      .click()
    await page
      .locator('[data-slot="popover-content"]')
      .getByRole('button', { name: /^Design 15$/ })
      .click()
    await mover.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(mover).toBeHidden()
    await expect(bookmarks.getByText(editedTitle, { exact: true })).toHaveCount(
      0,
    )
    // Hold the first destination response to expose incorrect empty-state flashes during a scope change.
    let releaseDestination: () => void = () => undefined
    const destinationReady = new Promise<void>((resolve) => {
      releaseDestination = resolve
    })
    await page.route('**/raindrops/101?*', async (route) => {
      await destinationReady
      await route.fallback()
    })
    await page.getByRole('button', { name: 'Design', exact: true }).click()
    await expect(
      page.getByText('Loading bookmarks...', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'No bookmarks found', exact: true }),
    ).toHaveCount(0)
    await capture(page, testInfo, `${view}-destination-loading`)
    releaseDestination()
    await page.keyboard.press(view === 'grid' ? 'Meta+1' : 'Meta+2')
    await expect(
      bookmarks.getByText(editedTitle, { exact: true }),
    ).toBeVisible()
    await capture(page, testInfo, `${view}-moved-to-design`)

    // Trash must retain the bookmark in its destination rather than permanently deleting the fixture.
    await bookmarks.getByText(editedTitle, { exact: true }).hover()
    await bookmarks
      .getByRole('button', { name: `Actions for ${editedTitle}`, exact: true })
      .click()
    await page
      .getByRole('menuitem', { name: 'Move to Trash', exact: true })
      .click()
    await expect(bookmarks.getByText(editedTitle, { exact: true })).toHaveCount(
      0,
    )
    await page.getByRole('button', { name: /^Trash(?: \d+)?$/ }).click()
    await expect(page.getByText(editedTitle, { exact: true })).toBeVisible()
    await capture(page, testInfo, `${view}-trash-destination-confirmed`)
  })
}

test('privileged renderer refuses new windows and same-window navigation', async ({
  page,
  electronApp,
}) => {
  // Arrange — target a blank document so the probe never reaches an external service or browser.
  const originalUrl = page.url()
  const windowsBefore = electronApp.windows().length

  // Act — renderer scripts must not create an untrusted window with access to the privileged session.
  const newWindowWasDenied = await page.evaluate(
    () => window.open('about:blank', '_blank') === null,
  )
  expect(newWindowWasDenied).toBe(true)
  expect(electronApp.windows()).toHaveLength(windowsBefore)
  await page.evaluate(() => window.location.assign('about:blank'))

  // Assert — the native navigation guard retains the app document and its already-loaded library.
  await expect(page).toHaveURL(originalUrl)
  await expect(
    page.locator('[data-slot="breadcrumb-page"]', { hasText: 'All Bookmarks' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Export', exact: true }),
  ).toBeVisible()
})

test('scrolling after delayed first-page loading retrieves all bookmarks beyond the 50-item boundary', async ({
  page,
}, testInfo) => {
  // Arrange — delay the first page so the pagination sentinel is absent on MainContent's initial mount.
  let releaseInitialPage: () => void = () => undefined
  const initialPageReady = new Promise<void>((resolve) => {
    releaseInitialPage = resolve
  })
  const requestedPages: number[] = []
  await page.route('**/raindrops/0?*', async (route) => {
    const requestedPage = Number(
      new URL(route.request().url()).searchParams.get('page'),
    )
    requestedPages.push(requestedPage)
    if (requestedPage === 0) await initialPageReady
    await route.fallback()
  })
  await page.reload()
  await expect(
    page.getByText('Loading bookmarks...', { exact: true }),
  ).toBeVisible()
  await capture(page, testInfo, 'pagination-initial-loading')
  releaseInitialPage()
  await page.keyboard.press('Meta+2')
  const list = page.getByTestId('list-view')
  const rows = list.locator('[data-raindrop-id]')
  await expect(rows).toHaveCount(50)
  await capture(page, testInfo, 'pagination-first-50')

  // Act — wheel the real scroll viewport to the newly mounted sentinel; do not click Load more.
  const viewport = page
    .locator('[data-slot="scroll-area-viewport"]')
    .filter({ has: list })
  await viewport.hover()
  await page.mouse.wheel(0, 10000)

  // Assert — the second API page appears once, with every synthetic bookmark retained exactly once.
  await expect(rows).toHaveCount(60)
  expect(requestedPages).toEqual([0, 1])
  const renderedIds = await rows.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-raindrop-id')),
  )
  expect(new Set(renderedIds).size).toBe(60)
  expect(renderedIds).toContain('60')
  await expect(
    page.getByRole('button', { name: 'Load more bookmarks', exact: true }),
  ).toHaveCount(0)
  await capture(page, testInfo, 'pagination-all-60')
})

test('collection colors survive API refresh and group-context creation stays in its invoking group', async ({
  page,
}, testInfo) => {
  // Arrange — the mock intentionally ignores unsupported API color writes just like the observed service.
  const remoteColorWrites: unknown[] = []
  page.on('request', (request) => {
    if (
      request.method() === 'PUT' &&
      new URL(request.url()).pathname.endsWith('/collection/100')
    )
      remoteColorWrites.push(request.postDataJSON())
  })
  await page.getByTestId('sidebar-collection-100').click({ button: 'right' })
  await page
    .getByRole('menuitem', { name: 'Change Color', exact: true })
    .hover()
  await page.getByRole('menuitem', { name: 'Red', exact: true }).click()
  await expect(page.getByTestId('collection-color-100')).toHaveCSS(
    'color',
    'rgb(239, 68, 68)',
  )
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('lain-state')))
    .toContain('#ef4444')
  await capture(page, testInfo, 'collection-local-color')

  // Act — a fresh remote tree cannot erase this account's persisted local display color.
  await page.reload()
  await expect(page.getByTestId('collection-color-100')).toHaveCSS(
    'color',
    'rgb(239, 68, 68)',
  )
  expect(remoteColorWrites).toEqual([])
  await page
    .getByRole('button', { name: 'Group actions for Creative', exact: true })
    .click()
  await page
    .getByRole('menuitem', { name: 'Add Collection', exact: true })
    .click()
  const creator = page.getByRole('dialog', {
    name: 'Create Collection',
    exact: true,
  })
  await expect(
    creator.getByRole('combobox', { name: 'Group', exact: true }),
  ).toHaveText('Creative')
  await creator.getByLabel('Name', { exact: true }).fill('Created in Creative')
  await capture(page, testInfo, 'collection-group-context')
  await creator
    .getByRole('button', { name: 'Create Collection', exact: true })
    .click()

  // Assert — group membership persists remotely while local color survives another reload.
  await expect(creator).toBeHidden()
  await expect(
    page
      .getByTestId('sidebar-group-group-1')
      .getByText('Created in Creative', { exact: true }),
  ).toBeVisible()
  await expect(
    page
      .getByTestId('sidebar-group-group-0')
      .getByText('Created in Creative', { exact: true }),
  ).toHaveCount(0)
  await page.reload()
  await expect(
    page
      .getByTestId('sidebar-group-group-1')
      .getByText('Created in Creative', { exact: true }),
  ).toBeVisible()
  await expect(page.getByTestId('collection-color-100')).toHaveCSS(
    'color',
    'rgb(239, 68, 68)',
  )
  await capture(page, testInfo, 'collection-group-and-color-restored')
})

test.describe('large synthetic organization menus', () => {
  test.use({ groupCount: 40, extraCollections: 400 })

  test('scrolls a forty-group submenu to the final destination and preserves the move after reload', async ({
    page,
  }, testInfo) => {
    // Arrange — open the submenu at the first collection while forty destination groups exist.
    await page.getByTestId('sidebar-collection-100').click({ button: 'right' })
    await page
      .getByRole('menuitem', { name: 'Move to Group', exact: true })
      .hover()
    const submenu = page.locator('[data-slot="context-menu-sub-content"]')
    await expect(submenu).toBeVisible()
    await submenu.hover({ position: { x: 25, y: 25 } })

    // Act — a real wheel interaction must expose the last group without forcing a hidden click.
    await page.mouse.wheel(0, 10000)
    const lastGroup = page.getByRole('menuitem', {
      name: 'Synthetic group 40',
      exact: true,
    })
    await expect(lastGroup).toBeInViewport()
    await capture(page, testInfo, 'forty-groups-last-destination')
    await lastGroup.click()

    // Assert — the remote group list and subsequent reconstruction retain the destination.
    const targetGroup = page.getByTestId('sidebar-group-group-39')
    await expect(
      targetGroup.getByTestId('sidebar-collection-100'),
    ).toBeVisible()
    await page.reload()
    await expect(
      targetGroup.getByTestId('sidebar-collection-100'),
    ).toBeVisible()
    await targetGroup
      .getByTestId('sidebar-collection-100')
      .scrollIntoViewIfNeeded()
    await capture(page, testInfo, 'forty-groups-move-restored')
  })

  test('scrolls a four-hundred-collection picker within the window and moves a bookmark to its final option', async ({
    page,
  }, testInfo) => {
    // Arrange — open the real bookmark move dialog and its deeply populated collection picker.
    await page.getByText('React Documentation', { exact: true }).hover()
    await page
      .getByRole('button', {
        name: 'Actions for React Documentation',
        exact: true,
      })
      .click()
    await page
      .getByRole('menuitem', { name: 'Move to Collection...', exact: true })
      .click()
    const mover = page.getByRole('dialog', {
      name: 'Move bookmarks',
      exact: true,
    })
    await mover
      .getByRole('combobox', { name: 'Collection', exact: true })
      .click()
    const picker = page.locator('[data-slot="popover-content"]')
    const viewport = picker.locator('[data-slot="scroll-area-viewport"]')
    await expect(viewport).toBeVisible()
    const geometry = await viewport.evaluate((element) => ({
      client: element.clientHeight,
      scroll: element.scrollHeight,
    }))
    expect(geometry.client).toBeGreaterThan(0)
    expect(geometry.client).toBeLessThan(geometry.scroll)
    expect(
      await picker.evaluate(
        (element) =>
          element.getBoundingClientRect().bottom <= window.innerHeight,
      ),
    ).toBe(true)

    // Act — wheel inside the fixed viewport, then choose the final collection through its visible button.
    await viewport.hover()
    await page.mouse.wheel(0, 30000)
    const lastCollection = picker.getByRole('button', {
      name: 'Synthetic collection 400 0',
      exact: true,
    })
    await expect(lastCollection).toBeInViewport()
    await capture(page, testInfo, 'four-hundred-collections-last-option')
    await lastCollection.click()
    await expect(
      mover.getByRole('combobox', { name: 'Collection', exact: true }),
    ).toHaveText('Synthetic collection 400')
    await mover.getByRole('button', { name: 'Apply', exact: true }).click()

    // Assert — the chosen destination is saved and can retrieve the original bookmark.
    await expect(mover).toBeHidden()
    await page
      .getByRole('button', { name: 'Synthetic collection 400', exact: true })
      .click()
    await expect(page.locator('[data-slot="breadcrumb-page"]')).toHaveText(
      'Synthetic collection 400',
    )
    await expect(page.locator('[data-raindrop-id="1"]')).toContainText(
      'React Documentation',
    )
    await capture(page, testInfo, 'four-hundred-collections-move-confirmed')

    // The sidebar's unfiltered collection finder must also keep its long result list scrollable.
    await page.getByRole('button', { name: /^All Bookmarks(?: \d+)?$/ }).click()
    await expect(page.locator('[data-slot="breadcrumb-page"]')).toHaveText(
      'All Bookmarks',
    )
    await page
      .getByRole('button', { name: 'Search collections', exact: true })
      .click()
    const collectionSearch = page.getByTestId('collection-search')
    await expect(
      collectionSearch.getByPlaceholder('Find collection...'),
    ).toHaveValue('')
    const searchViewport = collectionSearch.locator(
      '[data-slot="scroll-area-viewport"]',
    )
    const searchGeometry = await searchViewport.evaluate((element) => ({
      client: element.clientHeight,
      scroll: element.scrollHeight,
    }))
    expect(searchGeometry.client).toBeGreaterThan(0)
    expect(searchGeometry.client).toBeLessThan(searchGeometry.scroll)
    await searchViewport.hover()
    await page.mouse.wheel(0, 30000)
    const lastSearchResult = collectionSearch.getByRole('button', {
      name: /^Synthetic collection 400 /,
    })
    await expect(lastSearchResult).toBeInViewport()
    await capture(page, testInfo, 'four-hundred-collections-sidebar-search')
    await lastSearchResult.click()
    await expect(collectionSearch).toBeHidden()
    await expect(page.locator('[data-slot="breadcrumb-page"]')).toHaveText(
      'Synthetic collection 400',
    )
    await expect(page.locator('[data-raindrop-id="1"]')).toContainText(
      'React Documentation',
    )
  })
})

test.describe('nested collection merge', () => {
  test.use({ childBookmarkCount: 3 })

  test('merges all three bookmarks from a child collection into another root and retains them after reload', async ({
    page,
    mockApi,
  }, testInfo) => {
    // Arrange — the child contains three existing bookmark IDs, so readback can detect missing or duplicate moves.
    await page
      .getByRole('button', { name: 'Merge Collections', exact: true })
      .click()
    const dialog = page.getByRole('dialog', {
      name: 'Merge Collections',
      exact: true,
    })
    await dialog
      .getByRole('combobox', { name: 'Source (will be deleted)' })
      .click()
    await page
      .getByRole('option', { name: 'Development / React (3)', exact: true })
      .click()
    await dialog
      .getByRole('combobox', { name: 'Target (receives bookmarks)' })
      .click()
    await page.getByRole('option', { name: 'Design (15)', exact: true }).click()
    await capture(page, testInfo, 'nested-merge-preview')

    // Act — one confirmed API operation must remove the child and preserve all original bookmark identities.
    await dialog
      .getByRole('button', { name: 'Confirm Merge', exact: true })
      .click()
    await expect(dialog).toBeHidden()
    expect(mockApi.collectionMerges).toEqual([{ to: 101, ids: [200] }])
    await page.getByRole('button', { name: 'Design', exact: true }).click()
    await expect(page.locator('[data-slot="breadcrumb-page"]')).toHaveText(
      'Design',
    )
    await expect(page.locator('[data-raindrop-id]')).toHaveCount(18)
    await expect(page.locator('[data-raindrop-id="1"]')).toContainText(
      'React Documentation',
    )
    await expect(page.locator('[data-raindrop-id="2"]')).toContainText(
      'TypeScript Handbook',
    )
    await expect(page.locator('[data-raindrop-id="3"]')).toContainText(
      'Vite Build Tool',
    )
    await capture(page, testInfo, 'nested-merge-target-readback')

    // Assert — refreshing rebuilds the sidebar and rows from the mock service, with no deleted source left to select.
    await page.reload()
    await page.getByRole('button', { name: 'Design', exact: true }).click()
    await expect(page.locator('[data-slot="breadcrumb-page"]')).toHaveText(
      'Design',
    )
    await expect(page.locator('[data-raindrop-id]')).toHaveCount(18)
    expect(
      await page
        .locator('[data-raindrop-id]')
        .evaluateAll(
          (rows) =>
            new Set(rows.map((row) => row.getAttribute('data-raindrop-id')))
              .size,
        ),
    ).toBe(18)
    for (const id of ['1', '2', '3'])
      await expect(page.locator(`[data-raindrop-id="${id}"]`)).toBeVisible()
    await page
      .getByRole('button', { name: 'Merge Collections', exact: true })
      .click()
    await dialog
      .getByRole('combobox', { name: 'Source (will be deleted)' })
      .click()
    await expect(
      page.getByRole('option', {
        name: 'Development / React (3)',
        exact: true,
      }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('option', { name: 'Design (18)', exact: true }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await capture(page, testInfo, 'nested-merge-reloaded')
  })
})
