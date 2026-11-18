import { isCancel } from 'axios'
import { http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'

import type { Collection } from '@/store/api/raindropApi'
import { server } from '@test/mocks/server'

import {
  fetchBookmarkSnapshot,
  serializeBookmarkSnapshot,
  type BookmarkSnapshot,
} from './bookmark-export'

const API = 'https://api.raindrop.io/rest/v1'
const snapshot: BookmarkSnapshot = {
  schemaVersion: 1,
  exportedAt: '2026-11-09T00:00:00.000Z',
  scope: 0,
  groups: [
    { title: 'Research', collections: [100] },
    { title: 'Empty group', collections: [] },
  ],
  collections: [{ _id: 100, title: '読む & Learn' }],
  bookmarks: [
    {
      _id: 1,
      link: 'https://example.com/?a=1&b=2',
      title: '=HYPERLINK("bad")',
      excerpt: '<script>bad</script>',
      note: '日本語\n"note"',
      important: true,
      tags: ['research', 'comma,inside', '日本語'],
      collection: { $id: 100 },
      created: '2026-11-01T00:00:00.000Z',
      lastUpdate: '2026-11-02T00:00:00.000Z',
    },
  ],
}

/**
 * Provide synthetic HTTP responses that exercise export through the real Axios transport.
 * Tests override only their failure scenario; returned mutable data simulates remote edits.
 * @example const api = installExportApi(bookmarks)
 */
function installExportApi(
  bookmarks = snapshot.bookmarks,
  collections = snapshot.collections,
) {
  const api = {
    pages: [] as number[],
    requests: [] as string[],
    roots: collections.filter((collection) => !collection.parent?.$id),
    children: collections.filter((collection) => collection.parent?.$id),
    user: { _id: 1, groups: snapshot.groups },
    stats: {
      result: true,
      items: [
        { _id: 0, count: bookmarks.length },
        {
          _id: -1,
          count: bookmarks.filter((bookmark) => bookmark.collection?.$id === -1)
            .length,
        },
      ],
      meta: { changedBookmarksDate: '2026-11-09T00:00:00.000Z' },
    },
  }
  server.use(
    http.get(`${API}/user/stats`, () => {
      api.requests.push('stats')
      return HttpResponse.json(api.stats)
    }),
    http.get(`${API}/collections`, () => {
      api.requests.push('roots')
      return HttpResponse.json({ result: true, items: api.roots })
    }),
    http.get(`${API}/collections/childrens`, () =>
      HttpResponse.json({ result: true, items: api.children }),
    ),
    http.get(`${API}/user`, () =>
      HttpResponse.json({ result: true, user: api.user }),
    ),
    http.get(`${API}/raindrops/:collectionId`, ({ request }) => {
      const url = new URL(request.url)
      const page = Number(url.searchParams.get('page'))
      api.pages.push(page)
      // Every successful fixture also verifies unfiltered complete-page retrieval.
      expect(url.searchParams.get('perpage')).toBe('50')
      expect(url.searchParams.get('nested')).toBe('true')
      expect(url.searchParams.get('sort')).toBe('created')
      expect(url.searchParams.has('search')).toBe(false)
      return HttpResponse.json({
        result: true,
        items: bookmarks.slice(page * 50, page * 50 + 50),
        count: bookmarks.length,
      })
    }),
  )
  return api
}

/** Generate unique synthetic bookmarks when pagination tests install their HTTP fixtures. */
function numberedBookmarks(count: number): BookmarkSnapshot['bookmarks'] {
  return Array.from({ length: count }, (_, index) => ({
    _id: index + 1,
    title: `Bookmark ${index + 1}`,
    link: `https://example.com/${index + 1}`,
    collection: { $id: 100 },
  }))
}

test('HTML retains Unicode notes, exact tags, importance and dates without interpreting markup', () => {
  // Arrange / Act
  const document = new DOMParser().parseFromString(
    serializeBookmarkSnapshot(snapshot, 'html'),
    'text/html',
  )
  const link = document.querySelector('a')!
  // Assert
  expect(link.getAttribute('href')).toBe('https://example.com/?a=1&b=2')
  expect(link.textContent).toBe('=HYPERLINK("bad")')
  expect(link.getAttribute('data-note')).toBe('日本語\n"note"')
  expect(link.getAttribute('data-important')).toBe('true')
  expect(JSON.parse(link.getAttribute('data-tags')!)).toEqual([
    'research',
    'comma,inside',
    '日本語',
  ])
  expect(link.getAttribute('add_date')).toBe('1793491200')
  expect(link.getAttribute('last_modified')).toBe('1793577600')
  expect(document.querySelector('script')).toBeNull()
  expect(document.querySelector('dd')?.textContent.trim()).toBe(
    '<script>bad</script>',
  )
  expect(document.querySelector('h3')?.textContent).toBe('読む & Learn')
  expect(
    JSON.parse(
      document
        .querySelector('meta[name="lain-groups"]')!
        .getAttribute('content')!,
    ),
  ).toEqual([
    { title: 'Research', collections: [100] },
    { title: 'Empty group', collections: [] },
  ])
})

test('HTML nests empty descendants and separates folders with identical titles', () => {
  // Arrange
  const input: BookmarkSnapshot = {
    ...snapshot,
    collections: [
      { _id: 100, title: 'Root' },
      { _id: 101, title: 'Same', parent: { $id: 100 } },
      { _id: 102, title: 'Empty', parent: { $id: 101 } },
      { _id: 103, title: 'Same', parent: { $id: 100 } },
    ],
    bookmarks: [{ ...snapshot.bookmarks[0], collection: { $id: 101 } }],
  }
  // Act
  const document = new DOMParser().parseFromString(
    serializeBookmarkSnapshot(input, 'html'),
    'text/html',
  )
  const rootChildren =
    document.querySelector('h3[data-id="100"]')!.nextElementSibling!
  const nestedChildren =
    document.querySelector('h3[data-id="101"]')!.nextElementSibling!
  // Assert
  expect(rootChildren.tagName).toBe('DL')
  expect(rootChildren.querySelectorAll('h3')).toHaveLength(3)
  expect(nestedChildren.querySelector('h3')?.textContent).toBe('Empty')
  expect(nestedChildren.querySelector('a')?.getAttribute('data-id')).toBe('1')
  expect(document.querySelectorAll('h3')).toHaveLength(4)
  expect(
    document
      .querySelector('h3[data-id="103"]')!
      .nextElementSibling!.querySelectorAll('a'),
  ).toHaveLength(0)
})

test('HTML recovers cycles, self parents, orphan folders and unknown bookmark collections once', () => {
  // Arrange
  const input: BookmarkSnapshot = {
    ...snapshot,
    collections: [
      { _id: 100, title: 'A', parent: { $id: 101 } },
      { _id: 101, title: 'B', parent: { $id: 100 } },
      { _id: 102, title: 'Self', parent: { $id: 102 } },
      { _id: 103, title: 'Orphan', parent: { $id: 999 } },
    ],
    bookmarks: [
      snapshot.bookmarks[0],
      { _id: 2, title: 'Unsorted', collection: { $id: -1 } },
      { _id: 3, title: 'Missing', collection: { $id: 888 } },
    ],
  }
  // Act
  const document = new DOMParser().parseFromString(
    serializeBookmarkSnapshot(input, 'html'),
    'text/html',
  )
  // Assert
  expect(document.querySelectorAll('h3')).toHaveLength(6)
  expect(document.querySelectorAll('a')).toHaveLength(3)
  expect(document.querySelectorAll('h3[data-id="100"]')).toHaveLength(1)
  expect(document.querySelector('h3[data-id="888"]')?.textContent).toBe(
    'Unknown collection (888)',
  )
  expect(document.querySelector('h3[data-id="-1"]')?.textContent).toBe(
    'Unsorted',
  )
  expect(serializeBookmarkSnapshot(input, 'csv')).toContain('"B / A"')
})

test.each([
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'java\nscript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'file:///tmp/private',
  'vbscript:msgbox(1)',
  '//evil.example',
  '/relative',
  'not a URL',
])('HTML makes %s inert while retaining its original value', (link) => {
  // Arrange / Act
  const document = new DOMParser().parseFromString(
    serializeBookmarkSnapshot(
      { ...snapshot, bookmarks: [{ ...snapshot.bookmarks[0], link }] },
      'html',
    ),
    'text/html',
  )
  // Assert
  expect(document.querySelector('a')?.getAttribute('href')).toBe('about:blank')
  expect(document.querySelector('a')?.getAttribute('data-original-url')).toBe(
    link,
  )
  expect(document.querySelector('script')).toBeNull()
})

test('HTML omits invalid dates without NaN or fabricated export timestamps', () => {
  // Arrange
  const input = {
    ...snapshot,
    bookmarks: [
      { ...snapshot.bookmarks[0], created: 'invalid', lastUpdate: undefined },
    ],
  }
  // Act
  const html = serializeBookmarkSnapshot(input, 'html')
  // Assert
  expect(html).not.toContain('NaN')
  expect(html).not.toContain('ADD_DATE=')
  expect(html).not.toContain('LAST_MODIFIED=')
  expect(
    JSON.parse(serializeBookmarkSnapshot(input, 'json')).bookmarks[0].created,
  ).toBe('invalid')
})

test('CSV neutralizes formulas and preserves quoted multiline notes, Unicode and nested paths', () => {
  // Arrange
  const input = {
    ...snapshot,
    collections: [
      { _id: 99, title: 'Parent' },
      { _id: 100, title: '読む & Learn', parent: { $id: 99 } },
    ],
  }
  // Act
  const csv = serializeBookmarkSnapshot(input, 'csv')
  // Assert
  expect(csv.charCodeAt(0)).toBe(0xfeff)
  expect(csv).toContain('"\'=HYPERLINK(""bad"")"')
  expect(csv).toContain('"日本語\n""note"""')
  expect(csv).toContain('"Parent / 読む & Learn"')
  expect(csv.endsWith('\r\n')).toBe(true)
})

test.each(['+SUM(A1:A2)', '-1+2', '@IMPORT', '  =1', '\tformula', '\nformula'])(
  'CSV neutralizes the leading formula or control sequence %s',
  (title) => {
    // Arrange / Act
    const csv = serializeBookmarkSnapshot(
      { ...snapshot, bookmarks: [{ ...snapshot.bookmarks[0], title }] },
      'csv',
    )
    // Assert
    expect(csv).toContain(`"'${title}"`)
  },
)

test('JSON retains IDs, importance, hierarchy, empty groups, highlights and file metadata', () => {
  // Arrange
  const input: BookmarkSnapshot = {
    ...snapshot,
    bookmarks: [
      {
        ...snapshot.bookmarks[0],
        highlights: [{ _id: 'synthetic', text: '引用', note: 'annotation' }],
        file: { name: 'sample.pdf', size: 123, type: 'application/pdf' },
      },
    ],
  }
  // Act
  const data = JSON.parse(
    serializeBookmarkSnapshot(input, 'json'),
  ) as BookmarkSnapshot
  // Assert
  expect(data.bookmarks[0]._id).toBe(1)
  expect(data.bookmarks[0].important).toBe(true)
  expect(data.bookmarks[0].highlights).toEqual([
    { _id: 'synthetic', text: '引用', note: 'annotation' },
  ])
  expect(data.bookmarks[0].file).toEqual({
    name: 'sample.pdf',
    size: 123,
    type: 'application/pdf',
  })
  expect(data.groups).toEqual([
    { title: 'Research', collections: [100] },
    { title: 'Empty group', collections: [] },
  ])
  expect(data.collections).toEqual([{ _id: 100, title: '読む & Learn' }])
})

test.each([
  { total: 0, pages: [0] },
  { total: 49, pages: [0] },
  { total: 50, pages: [0, 1] },
  { total: 51, pages: [0, 1] },
  { total: 100, pages: [0, 1, 2] },
])(
  'export retrieves exactly $total items across the 50-item page boundary',
  async ({ total, pages }) => {
    // Arrange
    const api = installExportApi(numberedBookmarks(total))
    const progress = vi.fn()
    // Act
    const result = await fetchBookmarkSnapshot(
      0,
      new AbortController().signal,
      progress,
    )
    // Assert
    expect(result.bookmarks).toHaveLength(total)
    expect(new Set(result.bookmarks.map((bookmark) => bookmark._id)).size).toBe(
      total,
    )
    expect(api.pages).toEqual(pages)
    expect(progress).toHaveBeenLastCalledWith(total, total)
    expect(api.requests.filter((request) => request === 'stats')).toHaveLength(
      2,
    )
    expect(api.requests.filter((request) => request === 'roots')).toHaveLength(
      2,
    )
    expect(result.groups).toHaveLength(2)
  },
)

test('scoped export retains empty descendants and path ancestors without unrelated siblings', async () => {
  // Arrange
  const collections: Collection[] = [
    { _id: 90, title: 'Ancestor' },
    { _id: 100, title: 'Selected', parent: { $id: 90 } },
    { _id: 101, title: 'Empty child', parent: { $id: 100 } },
    { _id: 102, title: 'Empty grandchild', parent: { $id: 101 } },
    { _id: 103, title: 'Private sibling', parent: { $id: 90 } },
  ]
  const api = installExportApi(snapshot.bookmarks, collections)
  api.user.groups = [
    { title: 'Selected group', collections: [90] },
    { title: 'Unrelated group', collections: [999] },
  ]
  // Act
  const result = await fetchBookmarkSnapshot(
    100,
    new AbortController().signal,
    vi.fn(),
  )
  // Assert
  expect(result.collections.map((collection) => collection._id)).toEqual([
    90, 100, 101, 102,
  ])
  expect(result.groups).toEqual([
    { title: 'Selected group', collections: [90] },
  ])
  expect(result.scope).toBe(100)
  expect(JSON.stringify(result)).not.toContain('Private sibling')
})

test('Unsorted export omits named collection and group metadata', async () => {
  // Arrange
  installExportApi([{ ...snapshot.bookmarks[0], collection: { $id: -1 } }])
  // Act
  const result = await fetchBookmarkSnapshot(
    -1,
    new AbortController().signal,
    vi.fn(),
  )
  // Assert
  expect(result.bookmarks).toHaveLength(1)
  expect(result.collections).toEqual([])
  expect(result.groups).toEqual([])
})

test.each([
  {
    name: 'a short page before the total',
    page: { result: true, count: 2, items: snapshot.bookmarks },
    error: 'Export is incomplete',
  },
  {
    name: 'more items than reported',
    page: { result: true, count: 0, items: snapshot.bookmarks },
    error: 'more bookmarks',
  },
  {
    name: 'a duplicate ID',
    page: {
      result: true,
      count: 2,
      items: [snapshot.bookmarks[0], snapshot.bookmarks[0]],
    },
    error: 'duplicate or missing',
  },
  {
    name: 'a missing ID',
    page: { result: true, count: 1, items: [{ collection: { $id: 100 } }] },
    error: 'duplicate or missing',
  },
  {
    name: 'a fractional total',
    page: { result: true, count: 1.5, items: snapshot.bookmarks },
    error: 'valid export page',
  },
  {
    name: 'a missing total',
    page: { result: true, items: snapshot.bookmarks },
    error: 'valid export page',
  },
  {
    name: 'a service error',
    page: { result: false, count: 1, items: snapshot.bookmarks },
    error: 'valid export page',
  },
  { name: 'a null page', page: null, error: 'valid export page' },
  {
    name: 'an oversized page',
    page: { result: true, count: 51, items: numberedBookmarks(51) },
    error: 'valid export page',
  },
  {
    name: 'an out-of-scope item',
    page: {
      result: true,
      count: 1,
      items: [{ _id: 1, collection: { $id: -99 } }],
    },
    error: 'outside the selected export scope',
  },
])(
  'export rejects $name without returning a partial snapshot',
  async ({ page, error }) => {
    // Arrange
    installExportApi()
    server.use(
      http.get(`${API}/raindrops/:collectionId`, () => HttpResponse.json(page)),
    )
    // Act / Assert
    await expect(
      fetchBookmarkSnapshot(0, new AbortController().signal, vi.fn()),
    ).rejects.toThrow(error)
  },
)

test('export rejects IDs repeated across pages with an unchanged total', async () => {
  // Arrange
  installExportApi(numberedBookmarks(51))
  server.use(
    http.get(`${API}/raindrops/:collectionId`, ({ request }) =>
      HttpResponse.json({
        result: true,
        count: 51,
        items:
          new URL(request.url).searchParams.get('page') === '0'
            ? numberedBookmarks(50)
            : [{ ...snapshot.bookmarks[0], _id: 50 }],
      }),
    ),
  )
  // Act / Assert
  await expect(
    fetchBookmarkSnapshot(0, new AbortController().signal, vi.fn()),
  ).rejects.toThrow('duplicate or missing')
})

test('export rejects a changed total on the empty boundary page', async () => {
  // Arrange
  installExportApi(numberedBookmarks(50))
  server.use(
    http.get(`${API}/raindrops/:collectionId`, ({ request }) =>
      HttpResponse.json(
        new URL(request.url).searchParams.get('page') === '0'
          ? { result: true, count: 50, items: numberedBookmarks(50) }
          : { result: true, count: 51, items: [] },
      ),
    ),
  )
  // Act / Assert
  await expect(
    fetchBookmarkSnapshot(0, new AbortController().signal, vi.fn()),
  ).rejects.toThrow('collection changed')
})

test('export rejects same-count edits detected by the final bookmark revision', async () => {
  // Arrange
  const api = installExportApi()
  // Act / Assert
  await expect(
    fetchBookmarkSnapshot(0, new AbortController().signal, () => {
      api.stats.meta.changedBookmarksDate = '2026-11-09T00:00:01.000Z'
    }),
  ).rejects.toThrow('Bookmarks changed during export')
})

test.each(['rename', 'parent', 'group', 'account'] as const)(
  'export detects a concurrent %s change despite a stable bookmark revision',
  async (change) => {
    // Arrange
    const api = installExportApi()
    // Act / Assert
    await expect(
      fetchBookmarkSnapshot(0, new AbortController().signal, () => {
        if (change === 'rename')
          api.roots[0] = { ...api.roots[0], title: 'Renamed' }
        if (change === 'parent')
          api.roots[0] = { ...api.roots[0], parent: { $id: 999 } }
        if (change === 'group')
          api.user.groups = [{ title: 'Changed group', collections: [100] }]
        if (change === 'account') api.user._id = 2
      }),
    ).rejects.toThrow('account or collection hierarchy changed')
  },
)

test('export accepts unchanged metadata with reordered object keys', async () => {
  // Arrange
  const api = installExportApi()
  // Act
  const result = await fetchBookmarkSnapshot(
    0,
    new AbortController().signal,
    () => {
      api.roots = [{ title: '読む & Learn', _id: 100 }]
    },
  )
  // Assert
  expect(result.bookmarks).toHaveLength(1)
})

test('export rejects totals inconsistent with the account statistics', async () => {
  // Arrange
  const api = installExportApi()
  api.stats.items[0].count = 2
  // Act / Assert
  await expect(
    fetchBookmarkSnapshot(0, new AbortController().signal, vi.fn()),
  ).rejects.toThrow('account total does not match')
})

test.each([{}, { changedBookmarksDate: 'invalid' }])(
  'export refuses invalid or missing revision metadata: %j',
  async (meta) => {
    // Arrange
    installExportApi()
    server.use(
      http.get(`${API}/user/stats`, () =>
        HttpResponse.json({ result: true, items: [], meta }),
      ),
    )
    // Act / Assert
    await expect(
      fetchBookmarkSnapshot(0, new AbortController().signal, vi.fn()),
    ).rejects.toThrow('valid export change marker')
  },
)

test('export accepts identical collections appearing in both root and child listings exactly once', async () => {
  // Arrange — the real service can include roots in both endpoints.
  const api = installExportApi()
  api.children = [{ title: '読む & Learn', _id: 100 }]
  // Act
  const result = await fetchBookmarkSnapshot(
    0,
    new AbortController().signal,
    vi.fn(),
  )
  // Assert
  expect(result.collections).toEqual([{ title: '読む & Learn', _id: 100 }])
  expect(result.bookmarks).toHaveLength(1)
})

test('export rejects conflicting duplicate collection IDs across hierarchy responses', async () => {
  // Arrange
  const api = installExportApi()
  api.children = [{ _id: 100, title: 'Moving', parent: { $id: 999 } }]
  // Act / Assert
  await expect(
    fetchBookmarkSnapshot(0, new AbortController().signal, vi.fn()),
  ).rejects.toThrow('hierarchy is incomplete or changed')
})

test('export canceled before startup sends no API requests', async () => {
  // Arrange
  const api = installExportApi()
  const controller = new AbortController()
  controller.abort()
  // Act
  const failure = await fetchBookmarkSnapshot(
    0,
    controller.signal,
    vi.fn(),
  ).catch((error: unknown) => error)
  // Assert
  expect(isCancel(failure)).toBe(true)
  expect(api.requests).toEqual([])
})

test('export canceled at a page boundary stops before the next page or validation', async () => {
  // Arrange
  const api = installExportApi(numberedBookmarks(51))
  const controller = new AbortController()
  // Act
  const failure = await fetchBookmarkSnapshot(0, controller.signal, () =>
    controller.abort(),
  ).catch((error: unknown) => error)
  // Assert
  expect(isCancel(failure)).toBe(true)
  expect(api.pages).toEqual([0])
  expect(api.requests.filter((request) => request === 'stats')).toHaveLength(1)
})

test('export canceled during final consistency validation never succeeds', async () => {
  // Arrange
  installExportApi()
  const controller = new AbortController()
  let reads = 0
  server.use(
    http.get(`${API}/user/stats`, () => {
      reads++
      if (reads === 2) controller.abort()
      return HttpResponse.json({
        result: true,
        items: [{ _id: 0, count: 1 }],
        meta: { changedBookmarksDate: '2026-11-09T00:00:00.000Z' },
      })
    }),
  )
  // Act
  const failure = await fetchBookmarkSnapshot(
    0,
    controller.signal,
    vi.fn(),
  ).catch((error: unknown) => error)
  // Assert
  expect(isCancel(failure)).toBe(true)
  expect(reads).toBe(2)
})

test('export propagates later HTTP failures instead of returning downloaded items', async () => {
  // Arrange
  installExportApi(numberedBookmarks(51))
  server.use(
    http.get(`${API}/raindrops/:collectionId`, ({ request }) =>
      new URL(request.url).searchParams.get('page') === '0'
        ? HttpResponse.json({
            result: true,
            count: 51,
            items: numberedBookmarks(50),
          })
        : new HttpResponse(null, { status: 503 }),
    ),
  )
  const progress = vi.fn()
  // Act / Assert
  await expect(
    fetchBookmarkSnapshot(0, new AbortController().signal, progress),
  ).rejects.toThrow('503')
  expect(progress).toHaveBeenCalledTimes(1)
  expect(progress).toHaveBeenCalledWith(50, 51)
})
