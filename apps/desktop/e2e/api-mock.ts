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
export async function mockRaindropApi(page: Page): Promise<void> {
  const store = new E2eMockStore()

  await page.route('**/api.raindrop.io/rest/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/rest/v1', '')
    const method = route.request().method()

    // GET /raindrops/:collectionId (with pagination + sort)
    if (method === 'GET' && /^\/raindrops\/(-?\d+)$/.test(path)) {
      const collectionId = Number(path.split('/').pop())
      const pageNum = Number(url.searchParams.get('page') ?? '0')
      const perpage = Number(url.searchParams.get('perpage') ?? '50')
      const sort = url.searchParams.get('sort') ?? undefined
      const search = url.searchParams.get('search')

      let all =
        collectionId === 0
          ? store.raindrops
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
        note: '',
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

    // PUT /raindrop/:id (update)
    if (method === 'PUT' && /^\/raindrop\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop())
      const body = JSON.parse(
        (await route.request().postData()) ?? '{}',
      ) as Record<string, unknown>
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
      store.raindrops = store.raindrops.filter((r) => r._id !== id)
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
      const before = store.raindrops.length
      store.raindrops = store.raindrops.filter((r) => !deleteIds.has(r._id))
      return route.fulfill({
        json: { result: true, modified: before - store.raindrops.length },
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
      if (coll) Object.assign(coll, body)
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
      return route.fulfill({ json: { result: true } })
    }

    // GET /user
    if (method === 'GET' && path === '/user') {
      return route.fulfill({ json: { result: true, user: store.user } })
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
      return route.fulfill({ json: { result: true, user: store.user } })
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
}
