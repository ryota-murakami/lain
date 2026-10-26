import { http, HttpResponse } from 'msw'

import { mockStore } from './mock-store'

const API_BASE = 'https://api.raindrop.io/rest/v1'

/**
 * MSW request handlers for Raindrop.io API mock.
 * All reads/writes go through `mockStore` for stateful CRUD testing.
 *
 * @example
 *   // Override handler for specific test
 *   server.use(
 *     http.get(`${API_BASE}/user`, () =>
 *       HttpResponse.json({ result: false }, { status: 401 })
 *     )
 *   )
 */
export const handlers = [
  // --- Raindrops (with pagination + sort) ---
  http.get(`${API_BASE}/raindrops/:collectionId`, ({ params, request }) => {
    const collectionId = Number(params.collectionId)
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? '0')
    const perpage = Number(url.searchParams.get('perpage') ?? '25')
    const sort = url.searchParams.get('sort') ?? undefined

    const { items, count } = mockStore.getRaindrops(
      collectionId,
      page,
      perpage,
      sort,
    )
    return HttpResponse.json({ result: true, items, count })
  }),

  http.get(`${API_BASE}/raindrop/:id`, ({ params }) => {
    const item = mockStore.getRaindropById(Number(params.id))
    return item
      ? HttpResponse.json({ result: true, item })
      : new HttpResponse(null, { status: 404 })
  }),

  http.post(`${API_BASE}/raindrop`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const item = mockStore.addRaindrop(body)
    return HttpResponse.json({ result: true, item })
  }),

  http.put(`${API_BASE}/raindrop/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    const item = mockStore.updateRaindrop(Number(params.id), body)
    return item
      ? HttpResponse.json({ result: true, item })
      : new HttpResponse(null, { status: 404 })
  }),

  http.delete(`${API_BASE}/raindrop/:id`, ({ params }) => {
    mockStore.deleteRaindrop(Number(params.id))
    return HttpResponse.json({ result: true })
  }),

  // Batch operations
  http.put(
    `${API_BASE}/raindrops/:collectionId`,
    async ({ request, params }) => {
      const collectionId = Number(params.collectionId)
      const body = (await request.json()) as {
        ids?: number[]
        [key: string]: unknown
      }
      const { ids, ...data } = body
      const modified = mockStore.batchUpdateRaindrops(
        collectionId,
        ids ?? [],
        data,
      )
      return HttpResponse.json({ result: true, modified })
    },
  ),

  http.delete(`${API_BASE}/raindrops/:collectionId`, async ({ request }) => {
    const body = (await request.json()) as { ids?: number[] }
    const modified = mockStore.batchDeleteRaindrops(body.ids ?? [])
    return HttpResponse.json({ result: true, modified })
  }),

  // --- Collections ---
  http.get(`${API_BASE}/collections`, () => {
    return HttpResponse.json({
      result: true,
      items: mockStore.getAllCollections(),
    })
  }),

  http.get(`${API_BASE}/collections/childrens`, () => {
    return HttpResponse.json({
      result: true,
      items: mockStore.getChildCollections(),
    })
  }),

  http.post(`${API_BASE}/collection`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const item = mockStore.addCollection(body)
    return HttpResponse.json({ result: true, item })
  }),

  http.put(`${API_BASE}/collection/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    const item = mockStore.updateCollection(Number(params.id), body)
    return item
      ? HttpResponse.json({ result: true, item })
      : new HttpResponse(null, { status: 404 })
  }),

  http.delete(`${API_BASE}/collection/:id`, ({ params }) => {
    const id = Number(params.id)
    // Special case: DELETE /collection/-99 = empty trash
    if (id === -99) {
      const count = mockStore.emptyTrash()
      return HttpResponse.json({ result: true, count })
    }
    mockStore.deleteCollection(id)
    return HttpResponse.json({ result: true })
  }),

  // Merge collections
  http.put(`${API_BASE}/collections/merge`, async ({ request }) => {
    const body = (await request.json()) as { to: number; ids: number[] }
    mockStore.mergeCollections(body.to, body.ids)
    return HttpResponse.json({ result: true })
  }),

  // Clean empty collections
  http.put(`${API_BASE}/collections/clean`, () => {
    return HttpResponse.json({ result: true, count: 0 })
  }),

  // --- Tags ---
  http.get(`${API_BASE}/tags/:collectionId`, ({ params }) => {
    const collectionId = Number(params.collectionId)
    return HttpResponse.json({
      result: true,
      items: mockStore.getTags(collectionId),
    })
  }),

  http.get(`${API_BASE}/tags`, () => {
    return HttpResponse.json({ result: true, items: mockStore.getTags() })
  }),

  http.put(`${API_BASE}/tags/:collectionId`, async ({ request, params }) => {
    const collectionId = Number(params.collectionId)
    const body = (await request.json()) as {
      replace: string
      tags: string[]
    }
    // Rename: merge old tags into new name
    for (const oldTag of body.tags) {
      mockStore.renameTag(collectionId, oldTag, body.replace)
    }
    return HttpResponse.json({ result: true })
  }),

  http.delete(`${API_BASE}/tags/:collectionId`, async ({ request, params }) => {
    const collectionId = Number(params.collectionId)
    const body = (await request.json()) as { tags: string[] }
    mockStore.deleteTag(collectionId, body.tags)
    return HttpResponse.json({ result: true })
  }),

  // --- User ---
  http.get(`${API_BASE}/user`, () => {
    return HttpResponse.json({ result: true, user: mockStore.user })
  }),

  http.put(`${API_BASE}/user`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const user = mockStore.updateUser(body)
    return HttpResponse.json({ result: true, user })
  }),

  // --- Filters ---
  http.get(`${API_BASE}/filters/:collectionId`, ({ params }) => {
    const collectionId = Number(params.collectionId)
    const tags = mockStore.getTags(collectionId)

    // Build type counts from store
    const typeCounts = new Map<string, number>()
    const raindrops =
      collectionId === 0
        ? mockStore.raindrops
        : mockStore.raindrops.filter((r) => r.collection.$id === collectionId)
    for (const r of raindrops) {
      typeCounts.set(r.type, (typeCounts.get(r.type) ?? 0) + 1)
    }

    return HttpResponse.json({
      result: true,
      items: {
        types: Array.from(typeCounts.entries()).map(([_id, count]) => ({
          _id,
          count,
        })),
        tags: tags.slice(0, 10),
      },
    })
  }),

  // --- Suggest ---
  http.get(`${API_BASE}/raindrop/suggest`, ({ request }) => {
    const requestUrl = new URL(request.url)
    const targetUrl = requestUrl.searchParams.get('url') ?? ''
    let domain = ''
    try {
      domain = new URL(targetUrl).hostname
    } catch {
      /* ignore invalid URL */
    }
    return HttpResponse.json({
      result: true,
      item: {
        meta: domain ? { icon: `https://${domain}/favicon.ico` } : {},
      },
    })
  }),

  http.post(`${API_BASE}/raindrop/suggest`, () => {
    return HttpResponse.json({
      result: true,
      item: {
        collections: [{ $id: 100 }],
        tags: ['suggested-tag'],
      },
    })
  }),

  // --- Import URL parse ---
  http.get(`${API_BASE}/import/url/parse`, ({ request }) => {
    const url = new URL(request.url)
    const targetUrl = url.searchParams.get('url') ?? ''
    let domain = ''
    try {
      domain = new URL(targetUrl).hostname
    } catch {
      /* ignore */
    }
    return HttpResponse.json({
      result: true,
      item: {
        title: `Parsed: ${domain}`,
        excerpt: 'Auto-parsed description',
        link: targetUrl,
        meta: { icon: `https://${domain}/favicon.ico` },
      },
    })
  }),
]
