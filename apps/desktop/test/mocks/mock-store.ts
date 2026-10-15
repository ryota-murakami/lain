import {
  mockRaindrops,
  mockCollections,
  mockChildCollections,
  mockUser,
  mockTags,
} from '@fixtures'

/** Fixture types inferred from the shared fixtures */
type MockRaindrop = (typeof mockRaindrops)[number]
type MockCollection = (typeof mockCollections)[number]
type MockTag = (typeof mockTags)[number]
type MockUser = typeof mockUser

/**
 * Mutable in-memory store for CRUD test flows.
 * Clones fixtures on construction; `reset()` restores to initial state.
 *
 * Handlers read/write through this store so mutations (POST/PUT/DELETE)
 * are visible in subsequent reads (GET).
 *
 * @example
 *   // In test setup
 *   afterEach(() => mockStore.reset())
 *
 *   // In handler
 *   http.post('/raindrop', async ({ request }) => {
 *     const body = await request.json()
 *     const item = mockStore.addRaindrop(body)
 *     return HttpResponse.json({ result: true, item })
 *   })
 */
class MockStore {
  raindrops: MockRaindrop[]
  collections: MockCollection[]
  childCollections: MockCollection[]
  user: MockUser
  tags: MockTag[]
  private nextId = 10000

  constructor() {
    this.raindrops = structuredClone(mockRaindrops)
    this.collections = structuredClone(mockCollections)
    this.childCollections = structuredClone(mockChildCollections)
    this.user = structuredClone(mockUser)
    this.tags = structuredClone(mockTags)
  }

  /**
   * Reset all data to initial fixture state.
   * Call in afterEach to prevent state leakage between tests.
   */
  reset(): void {
    this.raindrops = structuredClone(mockRaindrops)
    this.collections = structuredClone(mockCollections)
    this.childCollections = structuredClone(mockChildCollections)
    this.user = structuredClone(mockUser)
    this.tags = structuredClone(mockTags)
    this.nextId = 10000
  }

  /** Generate a unique numeric ID for new items */
  genId(): number {
    return this.nextId++
  }

  // --- Raindrop CRUD ---

  /**
   * @param collectionId - 0 for all, or specific collection ID
   * @param page - 0-indexed page number
   * @param perpage - Items per page (max 50)
   * @param sort - API sort field
   * @returns Paginated slice and total count
   */
  getRaindrops(
    collectionId: number,
    page: number,
    perpage: number,
    sort?: string,
  ): { items: MockRaindrop[]; count: number } {
    let all =
      collectionId === 0
        ? this.raindrops
        : this.raindrops.filter((r) => r.collection.$id === collectionId)

    // Apply sort
    if (sort) {
      all = [...all].sort((a, b) => {
        switch (sort) {
          case '-created':
            return new Date(b.created).getTime() - new Date(a.created).getTime()
          case 'created':
            return new Date(a.created).getTime() - new Date(b.created).getTime()
          case 'title':
            return a.title.localeCompare(b.title)
          case '-title':
            return b.title.localeCompare(a.title)
          case 'domain':
            return a.domain.localeCompare(b.domain)
          case '-domain':
            return b.domain.localeCompare(a.domain)
          default:
            return 0
        }
      })
    }

    const start = page * perpage
    const items = all.slice(start, start + perpage)
    return { items, count: all.length }
  }

  getRaindropById(id: number): MockRaindrop | undefined {
    return this.raindrops.find((r) => r._id === id)
  }

  addRaindrop(data: Record<string, unknown>): MockRaindrop {
    const item: MockRaindrop = {
      _id: this.genId(),
      title: (data.title as string) ?? 'Untitled',
      link: (data.link as string) ?? '',
      excerpt: (data.excerpt as string) ?? '',
      type: (data.type as MockRaindrop['type']) ?? 'link',
      cover: '',
      tags: (data.tags as string[]) ?? [],
      important: (data.important as boolean) ?? false,
      domain: '',
      created: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      collection: (data.collection as { $id: number }) ?? { $id: 0 },
      media: [],
      note: '',
      highlights: [],
      removed: false,
      sort: 0,
    }
    // Extract domain from link
    try {
      item.domain = new URL(item.link).hostname
    } catch {
      /* ignore invalid URLs */
    }
    this.raindrops.unshift(item)
    return item
  }

  updateRaindrop(
    id: number,
    data: Record<string, unknown>,
  ): MockRaindrop | undefined {
    const index = this.raindrops.findIndex((r) => r._id === id)
    if (index === -1) return undefined
    this.raindrops[index] = {
      ...this.raindrops[index],
      ...data,
    } as MockRaindrop
    return this.raindrops[index]
  }

  deleteRaindrop(id: number): boolean {
    const index = this.raindrops.findIndex((r) => r._id === id)
    if (index === -1) return false
    this.raindrops.splice(index, 1)
    return true
  }

  batchUpdateRaindrops(
    _collectionId: number,
    ids: number[],
    data: Record<string, unknown>,
  ): number {
    let modified = 0
    for (const id of ids) {
      if (this.updateRaindrop(id, data)) modified++
    }
    return modified
  }

  batchDeleteRaindrops(ids: number[]): number {
    let modified = 0
    for (const id of ids) {
      if (this.deleteRaindrop(id)) modified++
    }
    return modified
  }

  // --- Collection CRUD ---

  getAllCollections(): MockCollection[] {
    return this.collections
  }

  getChildCollections(): MockCollection[] {
    return this.childCollections
  }

  addCollection(data: Record<string, unknown>): MockCollection {
    const item: MockCollection = {
      _id: this.genId(),
      title: (data.title as string) ?? 'Untitled',
      parent: (data.parent as { $id: number }) ?? null,
      color: null,
      cover: [],
      count: 0,
      expanded: true,
      sort: this.collections.length,
      view: 'list',
      access: { level: 4, draggable: true },
      creatorRef: { _id: 1 },
    }
    if (item.parent) {
      this.childCollections.push(item)
    } else {
      this.collections.push(item)
    }
    return item
  }

  updateCollection(
    id: number,
    data: Record<string, unknown>,
  ): MockCollection | undefined {
    const allCollections = [...this.collections, ...this.childCollections]
    const coll = allCollections.find((c) => c._id === id)
    if (!coll) return undefined
    Object.assign(coll, data)
    return coll
  }

  deleteCollection(id: number): boolean {
    let index = this.collections.findIndex((c) => c._id === id)
    if (index !== -1) {
      this.collections.splice(index, 1)
      return true
    }
    index = this.childCollections.findIndex((c) => c._id === id)
    if (index !== -1) {
      this.childCollections.splice(index, 1)
      return true
    }
    return false
  }

  mergeCollections(targetId: number, sourceIds: number[]): boolean {
    // Move raindrops from source collections to target
    for (const sourceId of sourceIds) {
      for (const r of this.raindrops) {
        if (r.collection.$id === sourceId) {
          r.collection.$id = targetId
        }
      }
      this.deleteCollection(sourceId)
    }
    return true
  }

  emptyTrash(): number {
    const trashItems = this.raindrops.filter(
      (r) => r.collection.$id === -99 || r.removed,
    )
    this.raindrops = this.raindrops.filter(
      (r) => r.collection.$id !== -99 && !r.removed,
    )
    return trashItems.length
  }

  // --- Tags ---

  getTags(collectionId?: number): MockTag[] {
    if (!collectionId || collectionId === 0) return this.tags
    // For specific collections, filter tags by counting raindrops
    const collRaindrops = this.raindrops.filter(
      (r) => r.collection.$id === collectionId,
    )
    const tagCounts = new Map<string, number>()
    for (const r of collRaindrops) {
      for (const tag of r.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      }
    }
    return Array.from(tagCounts.entries()).map(([_id, count]) => ({
      _id,
      count,
    }))
  }

  renameTag(_collectionId: number, oldName: string, newName: string): boolean {
    // Update tag in all raindrops
    for (const r of this.raindrops) {
      const idx = r.tags.indexOf(oldName)
      if (idx !== -1) r.tags[idx] = newName
    }
    // Update tags list
    const tag = this.tags.find((t) => t._id === oldName)
    if (tag) tag._id = newName
    return true
  }

  deleteTag(_collectionId: number, tagNames: string[]): boolean {
    // Remove from all raindrops
    for (const r of this.raindrops) {
      r.tags = r.tags.filter((t) => !tagNames.includes(t))
    }
    // Remove from tags list
    this.tags = this.tags.filter((t) => !tagNames.includes(t._id))
    return true
  }

  // --- User ---

  /**
   * Update user object with partial payload fields.
   * @param data - Partial user update payload
   * @returns Updated user object
   */
  updateUser(data: Record<string, unknown>): MockUser {
    this.user = {
      ...this.user,
      ...data,
    } as MockUser
    return this.user
  }
}

export const mockStore = new MockStore()
