import type { Page } from '@playwright/test'

import {
  mockRaindrops,
  mockCollections,
  mockChildCollections,
  mockUser,
  mockTags,
} from '../fixtures'

/** Fixture types inferred from the shared fixtures */
type MockRaindrop = (typeof mockRaindrops)[number]
type MockCollection = (typeof mockCollections)[number]
type MockTag = (typeof mockTags)[number]

interface MockApiOptions {
  groupCount?: number
  extraCollections?: number
  childBookmarkCount?: number
  /** Reject one metadata write after this synthetic file has already been created. */
  failUploadMetadataOnceFor?: string
}

interface MockApiObservations {
  uploadedFiles: string[]
  uploadRequests: Array<{
    filename: string
    collectionId: number
    collectionBeforeFile: boolean
  }>
  metadataWrites: Array<{ id: number; body: Record<string, unknown> }>
  collectionMerges: Array<{ to: number; ids: number[] }>
}

/**
 * Remove optional surrounding quotes from an operator term.
 * @param value - Raw operator value (possibly quoted)
 * @returns Normalized unquoted value
 */
function unquoteSearchTerm(value: string): string {
  const trimmed = value.trim()
  const quoted = trimmed.match(/^"(.*)"$/)
  return (quoted ? quoted[1] : trimmed).replace(/\\"/g, '"')
}

/**
 * Case-insensitive "contains" helper.
 * @param value - Candidate text
 * @param term - Lowercase search term
 * @returns True if value contains term
 */
function includesTerm(value: string | undefined, term: string): boolean {
  return (value ?? '').toLowerCase().includes(term)
}

/**
 * Free-text fallback matcher across common bookmark fields.
 * @param item - Candidate raindrop
 * @param term - Lowercase search term
 * @returns True when any field includes the term
 */
function matchesFreeText(item: MockRaindrop, term: string): boolean {
  return (
    includesTerm(item.title, term) ||
    includesTerm(item.link, term) ||
    includesTerm(item.excerpt, term) ||
    includesTerm(item.note, term) ||
    includesTerm(item.domain, term) ||
    item.tags.some((tag) => includesTerm(tag, term))
  )
}

/**
 * Apply Raindrop-style search filtering for E2E API mocking.
 * Supports basic operators (`link:`, `title:`, `excerpt:`, `note:`)
 * plus free-text fallback.
 *
 * @param items - Candidate raindrops
 * @param search - Raw `search` query param
 * @returns Filtered raindrops
 */
function applySearchFilter(
  items: MockRaindrop[],
  search: string | null,
): MockRaindrop[] {
  const rawSearch = search?.trim() ?? ''
  if (!rawSearch) return items

  const operatorMatch = rawSearch.match(/^([a-z]+):(.*)$/i)
  if (!operatorMatch) {
    const term = unquoteSearchTerm(rawSearch).toLowerCase()
    return items.filter((item) => matchesFreeText(item, term))
  }

  const operator = operatorMatch[1].toLowerCase()
  const term = unquoteSearchTerm(operatorMatch[2]).toLowerCase()
  if (!term) return items

  switch (operator) {
    case 'link':
      return items.filter(
        (item) =>
          includesTerm(item.link, term) || includesTerm(item.domain, term),
      )
    case 'title':
      return items.filter((item) => includesTerm(item.title, term))
    case 'excerpt':
      return items.filter((item) => includesTerm(item.excerpt, term))
    case 'note':
      return items.filter((item) => includesTerm(item.note, term))
    default:
      return items.filter((item) =>
        matchesFreeText(item, rawSearch.toLowerCase()),
      )
  }
}

/**
 * Mutable in-memory store for E2E tests.
 * Each call to `mockRaindropApi()` creates a fresh store,
 * so mutations within a test are visible to subsequent reads.
 */
class E2eMockStore {
  raindrops: MockRaindrop[]
  collections: MockCollection[]
  childCollections: MockCollection[]
  user: typeof mockUser
  tags: MockTag[]
  changedBookmarksDate = '2026-11-09T00:00:00.000Z'
  private nextId = 10000

  constructor() {
    this.raindrops = structuredClone(mockRaindrops)
    this.collections = structuredClone(mockCollections)
    this.childCollections = structuredClone(mockChildCollections)
    this.user = structuredClone(mockUser)
    this.tags = structuredClone(mockTags)
  }

  genId(): number {
    return this.nextId++
  }
}

/**
 * Mock Raindrop.io API responses via Playwright page.route().
 * Creates a fresh stateful store per invocation so CRUD mutations
 * are reflected in subsequent reads within the same test.
 *
 * @param page - Playwright page instance
 *
 * @example
 *   const page = await electronApp.firstWindow()
 *   await mockRaindropApi(page)
 *   await page.waitForLoadState('domcontentloaded')
 */
export async function mockRaindropApi(
  page: Page,
  options: MockApiOptions = {},
): Promise<MockApiObservations> {
  const store = new E2eMockStore()
  // Populate the existing nested React collection only when a merge flow requests child data.
  const childBookmarks = store.raindrops
    .filter((bookmark) => bookmark.collection.$id === 100)
    .slice(0, options.childBookmarkCount ?? 0)
  for (const bookmark of childBookmarks) bookmark.collection = { $id: 200 }
  if (options.childBookmarkCount) {
    store.collections[0].count -= childBookmarks.length
    store.childCollections[0].count = childBookmarks.length
  }
  // Large synthetic accounts exercise real popup geometry without private collection titles.
  for (
    let index = store.user.groups.length;
    index < (options.groupCount ?? 2);
    index += 1
  ) {
    store.user.groups.push({
      title: `Synthetic group ${index + 1}`,
      hidden: false,
      sort: index,
      collections: [],
    })
  }
  const lastGroup = store.user.groups[store.user.groups.length - 1]
  for (let index = 0; index < (options.extraCollections ?? 0); index += 1) {
    const id = 1000 + index
    store.collections.push({
      ...structuredClone(mockCollections[0]),
      _id: id,
      title: `Synthetic collection ${index + 1}`,
      count: 0,
      sort: index + 4,
    })
    lastGroup.collections.push(id)
  }
  const observations: MockApiObservations = {
    uploadedFiles: [],
    uploadRequests: [],
    metadataWrites: [],
    collectionMerges: [],
  }
  const uploadNames = new Map<number, string>()
  let metadataFailureSent = false

  await page.route('**/api.raindrop.io/rest/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/rest/v1', '')
    const method = route.request().method()
    if (!['GET', 'OPTIONS'].includes(method))
      store.changedBookmarksDate = new Date().toISOString()
    if (method === 'GET' && path === '/user/stats') {
      return route.fulfill({
        json: {
          result: true,
          items: [
            {
              _id: 0,
              count: store.raindrops.filter(
                (item) => item.collection.$id !== -99,
              ).length,
            },
            {
              _id: -1,
              count: store.raindrops.filter(
                (item) => item.collection.$id === -1,
              ).length,
            },
            {
              _id: -99,
              count: store.raindrops.filter(
                (item) => item.collection.$id === -99,
              ).length,
            },
          ],
          meta: { changedBookmarksDate: store.changedBookmarksDate },
        },
      })
    }

    // GET /raindrops/:collectionId (with pagination + sort)
    if (method === 'GET' && /^\/raindrops\/(-?\d+)$/.test(path)) {
      const collectionId = Number(path.split('/').pop())
      const pageNum = Number(url.searchParams.get('page') ?? '0')
      const perpage = Number(url.searchParams.get('perpage') ?? '50')
      const sort = url.searchParams.get('sort') ?? undefined
      const search = url.searchParams.get('search')

      let all =
        collectionId === 0
          ? store.raindrops.filter((item) => item.collection.$id !== -99)
          : store.raindrops.filter((r) => r.collection.$id === collectionId)

      all = applySearchFilter(all, search)

      // Apply sort
      if (sort) {
        all = [...all].sort((a, b) => {
          switch (sort) {
            case '-created':
              return (
                new Date(b.created).getTime() - new Date(a.created).getTime()
              )
            case 'created':
              return (
                new Date(a.created).getTime() - new Date(b.created).getTime()
              )
            case 'title':
              return a.title.localeCompare(b.title)
            case '-title':
              return b.title.localeCompare(a.title)
            case 'domain':
              return a.domain.localeCompare(b.domain)
            case '-sort':
              return b.sort - a.sort
            default:
              return 0
          }
        })
      }

      const start = pageNum * perpage
      const items = all.slice(start, start + perpage)
      return route.fulfill({
        json: { result: true, items, count: all.length },
      })
    }

    // GET /raindrop/:id (single)
    if (method === 'GET' && /^\/raindrop\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop())
      const item = store.raindrops.find((r) => r._id === id)
      if (item) {
        return route.fulfill({ json: { result: true, item } })
      }
      return route.fulfill({ status: 404, json: { result: false } })
    }

    // POST /raindrop (create)
    if (method === 'POST' && path === '/raindrop') {
      const body = JSON.parse(
        (await route.request().postData()) ?? '{}',
      ) as Record<string, unknown>
      const newItem: MockRaindrop = {
        _id: store.genId(),
        title: (body.title as string) ?? 'Untitled',
        link: (body.link as string) ?? '',
        excerpt: (body.excerpt as string) ?? '',
        type: (body.type as MockRaindrop['type']) ?? 'link',
        cover: '',
        tags: (body.tags as string[]) ?? [],
        important: (body.important as boolean) ?? false,
        domain: '',
        created: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
        collection: (body.collection as { $id: number }) ?? { $id: 0 },
        media: [],
        note: (body.note as string) ?? '',
        highlights: [],
        removed: false,
        sort: 0,
      }
      try {
        newItem.domain = new URL(newItem.link).hostname
      } catch {
        /* ignore */
      }
      store.raindrops.unshift(newItem)
      return route.fulfill({ json: { result: true, item: newItem } })
    }

    // Multipart file creation is distinct from the metadata write that follows it.
    if (method === 'PUT' && path === '/raindrop/file') {
      const multipart = route.request().postDataBuffer()?.toString('utf8') ?? ''
      const filename = multipart.match(/filename="([^"]+)"/)?.[1]
      const collectionId = Number(
        multipart.match(/name="collectionId"\r\n\r\n(-?\d+)/)?.[1] ?? '-1',
      )
      if (!filename)
        return route.fulfill({
          status: 400,
          json: { result: false, errorMessage: 'Missing file' },
        })
      const id = store.genId()
      const item: MockRaindrop = {
        ...structuredClone(mockRaindrops[0]),
        _id: id,
        title: filename,
        type: 'document',
        tags: [],
        note: '',
        important: false,
        link: `https://example.com/uploads/${id}`,
        collection: { $id: collectionId },
        created: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
      }
      store.raindrops.unshift(item)
      uploadNames.set(id, filename)
      observations.uploadedFiles.push(filename)
      observations.uploadRequests.push({
        filename,
        collectionId,
        collectionBeforeFile:
          multipart.indexOf('name="collectionId"') <
          multipart.indexOf('name="file"'),
      })
      return route.fulfill({ json: { result: true, item } })
    }

    // PUT /raindrop/:id (update)
    if (method === 'PUT' && /^\/raindrop\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop())
      const body = JSON.parse(
        (await route.request().postData()) ?? '{}',
      ) as Record<string, unknown>
      if (uploadNames.has(id)) {
        observations.metadataWrites.push({ id, body })
        if (
          !metadataFailureSent &&
          uploadNames.get(id) === options.failUploadMetadataOnceFor
        ) {
          metadataFailureSent = true
          return route.fulfill({
            status: 503,
            json: { result: false, errorMessage: 'Synthetic metadata outage' },
          })
        }
      }
      const existing = store.raindrops.find((r) => r._id === id)
      if (existing) {
        const { order, ...fields } = body
        Object.assign(existing, fields)
        // Manual order: `order` is the new position among the collection's bookmarks;
        // renumber `sort` (highest first) so `sort=-sort` reads the new order back
        if (typeof order === 'number') {
          const siblings = store.raindrops
            .filter(
              (r) =>
                r.collection.$id === existing.collection.$id && r._id !== id,
            )
            .sort((a, b) => b.sort - a.sort)
          siblings.splice(order, 0, existing)
          siblings.forEach((raindrop, index) => {
            raindrop.sort = siblings.length - 1 - index
          })
        }
        return route.fulfill({ json: { result: true, item: existing } })
      }
      return route.fulfill({ status: 404, json: { result: false } })
    }

    // DELETE /raindrop/:id
    if (method === 'DELETE' && /^\/raindrop\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop())
      const item = store.raindrops.find((bookmark) => bookmark._id === id)
      // Mirror soft deletion so tests must verify the destination Trash, not just a disappearing row.
      if (item && item.collection.$id !== -99) {
        item.collection = { $id: -99 }
        item.removed = true
      } else {
        store.raindrops = store.raindrops.filter(
          (bookmark) => bookmark._id !== id,
        )
      }
      return route.fulfill({ json: { result: true } })
    }

    // PUT /raindrops/:collectionId (batch update)
    if (method === 'PUT' && /^\/raindrops\/(-?\d+)$/.test(path)) {
      const body = JSON.parse((await route.request().postData()) ?? '{}') as {
        ids?: number[]
        [key: string]: unknown
      }
      const { ids, ...data } = body
      let modified = 0
      for (const id of ids ?? []) {
        const r = store.raindrops.find((r) => r._id === id)
        if (r) {
          Object.assign(r, data)
          modified++
        }
      }
      return route.fulfill({ json: { result: true, modified } })
    }

    // DELETE /raindrops/:collectionId (batch delete)
    if (method === 'DELETE' && /^\/raindrops\/(-?\d+)$/.test(path)) {
      const body = JSON.parse((await route.request().postData()) ?? '{}') as {
        ids?: number[]
      }
      const deleteIds = new Set(body.ids ?? [])
      const source = Number(path.split('/').pop())
      const matching = store.raindrops.filter(
        (bookmark) =>
          deleteIds.has(bookmark._id) && bookmark.collection.$id === source,
      )
      // Active bookmarks enter Trash; only a request against Trash removes them permanently.
      if (source === -99) {
        store.raindrops = store.raindrops.filter(
          (bookmark) => !matching.includes(bookmark),
        )
      } else {
        for (const bookmark of matching) {
          bookmark.collection = { $id: -99 }
          bookmark.removed = true
        }
      }
      return route.fulfill({
        json: { result: true, modified: matching.length },
      })
    }

    // GET /collections
    if (method === 'GET' && path === '/collections') {
      return route.fulfill({
        json: { result: true, items: store.collections },
      })
    }

    // GET /collections/childrens
    if (method === 'GET' && path === '/collections/childrens') {
      return route.fulfill({
        json: { result: true, items: store.childCollections },
      })
    }

    // POST /collection (create)
    if (method === 'POST' && path === '/collection') {
      const body = JSON.parse(
        (await route.request().postData()) ?? '{}',
      ) as Record<string, unknown>
      const newColl: MockCollection = {
        _id: store.genId(),
        title: (body.title as string) ?? 'Untitled',
        parent: (body.parent as { $id: number }) ?? null,
        color: null,
        cover: [],
        count: 0,
        expanded: true,
        sort: store.collections.length,
        view: 'list',
        access: { level: 4, draggable: true },
        creatorRef: { _id: 1 },
      }
      if (newColl.parent) {
        store.childCollections.push(newColl)
      } else {
        store.collections.push(newColl)
      }
      return route.fulfill({ json: { result: true, item: newColl } })
    }

    // DELETE /collection/-99 (empty trash)
    if (method === 'DELETE' && path === '/collection/-99') {
      store.raindrops = store.raindrops.filter(
        (r) => r.collection.$id !== -99 && !r.removed,
      )
      return route.fulfill({ json: { result: true } })
    }

    // PUT /collection/:id
    if (method === 'PUT' && /^\/collection\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop())
      const body = JSON.parse(
        (await route.request().postData()) ?? '{}',
      ) as Record<string, unknown>
      const coll = [...store.collections, ...store.childCollections].find(
        (c) => c._id === id,
      )
      // The documented API color is derived from cover; arbitrary color writes are ignored by the service.
      const { color: ignoredColor, ...supportedFields } = body
      void ignoredColor
      if (coll) Object.assign(coll, supportedFields)
      return route.fulfill({ json: { result: true, item: coll } })
    }

    // DELETE /collection/:id
    if (method === 'DELETE' && /^\/collection\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop())
      store.collections = store.collections.filter((c) => c._id !== id)
      store.childCollections = store.childCollections.filter(
        (c) => c._id !== id,
      )
      return route.fulfill({ json: { result: true } })
    }

    // PUT /collections/merge
    if (method === 'PUT' && path === '/collections/merge') {
      const body = route.request().postDataJSON() as {
        to: number
        ids: number[]
      }
      observations.collectionMerges.push(structuredClone(body))
      const sourceIds = new Set(body.ids)
      // Preserve the bookmark identities while moving them, then remove the source collection records.
      for (const bookmark of store.raindrops) {
        if (sourceIds.has(bookmark.collection.$id)) {
          bookmark.collection = { $id: body.to }
        }
      }
      store.collections = store.collections.filter(
        (collection) => !sourceIds.has(collection._id),
      )
      store.childCollections = store.childCollections.filter(
        (collection) => !sourceIds.has(collection._id),
      )
      for (const group of store.user.groups) {
        group.collections = group.collections.filter((id) => !sourceIds.has(id))
      }
      const target = [...store.collections, ...store.childCollections].find(
        (collection) => collection._id === body.to,
      )
      if (target) {
        target.count = store.raindrops.filter(
          (bookmark) => bookmark.collection.$id === body.to,
        ).length
      }
      return route.fulfill({ json: { result: true } })
    }

    // GET /user
    if (method === 'GET' && path === '/user') {
      return route.fulfill({
        json: {
          result: true,
          user: { ...store.user, files: { used: 0, size: 100_000_000 } },
        },
      })
    }

    // PUT /user
    if (method === 'PUT' && path === '/user') {
      const body = JSON.parse(
        (await route.request().postData()) ?? '{}',
      ) as Record<string, unknown>
      store.user = {
        ...store.user,
        ...body,
      }
      return route.fulfill({
        json: {
          result: true,
          user: { ...store.user, files: { used: 0, size: 100_000_000 } },
        },
      })
    }

    // GET /tags (with or without collectionId)
    if (method === 'GET' && /^\/tags(\/(-?\d+))?$/.test(path)) {
      return route.fulfill({ json: { result: true, items: store.tags } })
    }

    // GET /filters/:collectionId
    if (method === 'GET' && /^\/filters\//.test(path)) {
      return route.fulfill({
        json: {
          result: true,
          items: {
            types: [
              { _id: 'link', count: 30 },
              { _id: 'article', count: 15 },
            ],
            tags: store.tags.slice(0, 10),
          },
        },
      })
    }

    // POST /raindrop/suggest
    if (method === 'POST' && path === '/raindrop/suggest') {
      return route.fulfill({
        json: {
          result: true,
          item: { collections: [{ $id: 100 }], tags: ['suggested-tag'] },
        },
      })
    }

    // GET /raindrop/suggest?url=...
    if (method === 'GET' && path === '/raindrop/suggest') {
      const targetUrl = url.searchParams.get('url') ?? ''
      let domain = ''
      try {
        domain = new URL(targetUrl).hostname
      } catch {
        /* ignore invalid URL */
      }

      return route.fulfill({
        json: {
          result: true,
          item: {
            meta: domain ? { icon: `https://${domain}/favicon.ico` } : {},
          },
        },
      })
    }

    // GET /import/url/parse
    if (method === 'GET' && path === '/import/url/parse') {
      const targetUrl = url.searchParams.get('url') ?? ''
      let domain = ''
      try {
        domain = new URL(targetUrl).hostname
      } catch {
        /* ignore */
      }
      return route.fulfill({
        json: {
          result: true,
          item: {
            title: `Parsed: ${domain}`,
            excerpt: 'Auto-parsed description',
            link: targetUrl,
          },
        },
      })
    }

    // Fallback: return generic success for unhandled mutations
    return route.fulfill({ json: { result: true } })
  })
  return observations
}
