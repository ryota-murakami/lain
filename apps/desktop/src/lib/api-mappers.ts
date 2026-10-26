/**
 * Pure mapping functions between Raindrop.io API types and UI types.
 * The API uses numeric `_id`, MongoDB-style `$id` references, and different
 * field names (`link`, `excerpt`, `important`). The UI uses string IDs and
 * friendlier names (`url`, `description`, `isImportant`).
 *
 * @example
 *   const uiRaindrop = toUiRaindrop(apiResponse.item)
 *   const apiData = toApiRaindropCreate({ url: 'https://...', title: 'My Page' })
 */
import type {
  Raindrop,
  Collection,
  Group,
  SystemCollection,
  ContentType,
  SortOption,
} from '@/lib/types'
import type {
  Raindrop as ApiRaindropBase,
  Collection as ApiCollection,
  User as ApiUser,
  RaindropCreate,
  RaindropUpdate,
  GetRaindropsByCollectionIdApiArg,
} from '@/store/api/raindropApi'

/**
 * Extended API Raindrop type with fields the codegen missed.
 * The OpenAPI spec doesn't include `important` or `domain` in the
 * Raindrop response schema, but the API does return them.
 */
type ApiRaindrop = ApiRaindropBase & {
  important?: boolean
  domain?: string
}

/** API sort type from the generated RTK Query arg */
type ApiSort = GetRaindropsByCollectionIdApiArg['sort']

/**
 * Map UI SortOption to API sort parameter for GET /raindrops/:collectionId.
 * @param sort - UI sort option from the toolbar dropdown
 * @returns API sort string compatible with Raindrop.io API
 * @example
 *   mapSortOptionToApi('newest')    // => '-created'
 *   mapSortOptionToApi('title-asc') // => 'title'
 */
export function mapSortOptionToApi(sort: SortOption): ApiSort {
  const map: Record<SortOption, ApiSort> = {
    newest: '-created',
    oldest: 'created',
    'title-asc': 'title',
    'title-desc': '-title',
    domain: 'domain',
    relevance: 'score',
    manual: '-sort',
  }
  return map[sort]
}

// ---------------------------------------------------------------------------
// Collection ID mapping — special IDs used by Raindrop.io API
// ---------------------------------------------------------------------------

const SPECIAL_COLLECTION_TO_API: Record<string, number> = {
  all: 0,
  unsorted: -1,
  trash: -99,
}

const SPECIAL_COLLECTION_TO_UI: Record<number, string> = {
  0: 'all',
  [-1]: 'unsorted',
  [-99]: 'trash',
}

/**
 * Convert a UI collection ID string to the numeric API equivalent.
 * @param uiId - UI collection ID ('all', 'unsorted', 'trash', or numeric string)
 * @returns Numeric API collection ID (0, -1, -99, or the parsed number)
 * @example
 *   collectionIdToApi('all')   // => 0
 *   collectionIdToApi('trash') // => -99
 *   collectionIdToApi('42')    // => 42
 */
export function collectionIdToApi(uiId: string): number {
  return SPECIAL_COLLECTION_TO_API[uiId] ?? Number(uiId)
}

/**
 * Convert a numeric API collection ID to the UI string equivalent.
 * @param apiId - Numeric API collection ID
 * @returns UI collection ID string
 * @example
 *   collectionIdToUi(0)    // => 'all'
 *   collectionIdToUi(-99)  // => 'trash'
 *   collectionIdToUi(42)   // => '42'
 */
export function collectionIdToUi(apiId: number): string {
  return SPECIAL_COLLECTION_TO_UI[apiId] ?? String(apiId)
}

// ---------------------------------------------------------------------------
// Raindrop mapping — API ↔ UI
// ---------------------------------------------------------------------------

/**
 * Extract domain hostname from a URL string, returning undefined on failure.
 * @param url - URL string to extract domain from
 * @returns Hostname or undefined
 * @example
 *   safeDomain('https://react.dev/docs') // => 'react.dev'
 *   safeDomain('not-a-url')              // => undefined
 */
function safeDomain(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}

/**
 * Convert an API Raindrop response to the UI Raindrop type.
 * Maps `_id→id`, `link→url`, `excerpt→description`, `important→isImportant`, etc.
 *
 * @param api - Raw API raindrop object
 * @returns UI-compatible Raindrop
 * @example
 *   toUiRaindrop({ _id: 1, link: 'https://react.dev', title: 'React', ... })
 *   // => { id: '1', url: 'https://react.dev', title: 'React', ... }
 */
export function toUiRaindrop(api: ApiRaindrop): Raindrop {
  return {
    id: String(api._id ?? 0),
    title: api.title ?? '',
    url: api.link ?? '',
    type: (api.type ?? 'link') as ContentType,
    description: api.excerpt ?? undefined,
    coverImage: api.cover ?? undefined,
    domain: safeDomain(api.link),
    tags: api.tags ?? [],
    createdAt: api.created ?? '',
    updatedAt: api.lastUpdate ?? '',
    collectionId: collectionIdToUi(api.collection?.$id ?? 0),
    isImportant: api.important ?? false,
    notes: api.note ?? undefined,
    highlights: api.highlights?.map((h) => h.text ?? '') ?? [],
  }
}

/**
 * Form data shape accepted by toApiRaindropCreate.
 * Matches the AddBookmarkDialog form output.
 */
export interface CreateBookmarkData {
  url: string
  title?: string
  description?: string
  collectionId?: string
  tags?: string[]
  isImportant?: boolean
  type?: ContentType
  notes?: string
}

/**
 * Convert bookmark form data to the API RaindropCreate shape for POST /raindrop.
 * @param data - Form data from the UI
 * @returns API-compatible RaindropCreate object
 * @example
 *   toApiRaindropCreate({ url: 'https://react.dev', title: 'React' })
 *   // => { link: 'https://react.dev', title: 'React' }
 */
export function toApiRaindropCreate(data: CreateBookmarkData): RaindropCreate {
  return {
    link: data.url,
    title: data.title,
    excerpt: data.description,
    collection: data.collectionId
      ? { $id: collectionIdToApi(data.collectionId) }
      : undefined,
    tags: data.tags,
    important: data.isImportant,
    type: data.type,
    note: data.notes,
  }
}

/**
 * Convert a partial UI Raindrop to the API RaindropUpdate shape for PUT /raindrop/{id}.
 * Only includes fields that are defined (undefined fields are omitted).
 *
 * @param data - Partial UI raindrop with fields to update
 * @returns API-compatible RaindropUpdate object
 * @example
 *   toApiRaindropUpdate({ title: 'New Title', isImportant: true })
 *   // => { title: 'New Title', important: true }
 */
export function toApiRaindropUpdate(data: Partial<Raindrop>): RaindropUpdate {
  const update: RaindropUpdate = {}
  if (data.title !== undefined) update.title = data.title
  if (data.url !== undefined) update.link = data.url
  if (data.description !== undefined) update.excerpt = data.description
  if (data.tags !== undefined) update.tags = data.tags
  if (data.isImportant !== undefined) update.important = data.isImportant
  if (data.type !== undefined) update.type = data.type
  if (data.notes !== undefined) update.note = data.notes
  if (data.collectionId !== undefined) {
    update.collection = { $id: collectionIdToApi(data.collectionId) }
  }
  return update
}

// ---------------------------------------------------------------------------
// Collection + Group mapping — reconstruct sidebar tree from 3 API responses
// ---------------------------------------------------------------------------

/**
 * Convert an API Collection to the UI Collection type.
 * Recursively attaches child collections.
 *
 * @param api - Raw API collection
 * @param groupId - Synthetic group ID this collection belongs to
 * @param childrenByParent - Lookup map: parentId → child collections
 * @returns UI-compatible Collection
 */
function toUiCollection(
  api: ApiCollection,
  groupId: string,
  childrenByParent: Map<number, ApiCollection[]>,
): Collection {
  const apiId = api._id ?? 0
  const children = (childrenByParent.get(apiId) ?? [])
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((child) => toUiCollection(child, groupId, childrenByParent))

  return {
    id: String(apiId),
    name: api.title ?? '',
    icon: 'Folder',
    color: api.color ?? undefined,
    count: api.count ?? 0,
    groupId,
    parentId: api.parent?.$id ? String(api.parent.$id) : undefined,
    children: children.length > 0 ? children : undefined,
  }
}

/**
 * Reconstruct the sidebar group tree from the User's groups,
 * root collections, and child collections.
 *
 * The Raindrop.io API stores groups in `User.groups[]` as
 * `{ title, hidden, sort, collections: number[] }`. Root collections
 * come from GET /collections, child collections from GET /collections/childrens.
 *
 * @param user - API User object (contains groups array)
 * @param rootCollections - Root-level collections from GET /collections
 * @param childCollections - Nested collections from GET /collections/childrens
 * @returns Array of UI Group objects with nested Collection trees
 *
 * @example
 *   toUiGroups(
 *     { groups: [{ title: 'Work', collections: [100, 101] }] },
 *     [{ _id: 100, title: 'Dev' }, { _id: 101, title: 'Design' }],
 *     [{ _id: 200, title: 'React', parent: { $id: 100 } }]
 *   )
 *   // => [{ id: 'group-0', name: 'Work', collections: [{ id: '100', name: 'Dev', children: [{ id: '200', name: 'React' }] }, ...] }]
 */
export function toUiGroups(
  user: ApiUser,
  rootCollections: ApiCollection[],
  childCollections: ApiCollection[],
): Group[] {
  // Build lookup: collectionId → ApiCollection
  const collectionMap = new Map<number, ApiCollection>()
  for (const c of [...rootCollections, ...childCollections]) {
    if (c._id !== undefined && c._id !== null) collectionMap.set(c._id, c)
  }

  // Build children lookup: parentId → child collections
  const childrenByParent = new Map<number, ApiCollection[]>()
  for (const c of childCollections) {
    const parentId = c.parent?.$id
    if (parentId !== undefined && parentId !== null) {
      const existing = childrenByParent.get(parentId) ?? []
      existing.push(c)
      childrenByParent.set(parentId, existing)
    }
  }

  // Build groups from User.groups[], sorted by sort field
  const apiGroups = [...(user.groups ?? [])].sort(
    (a, b) => (a.sort ?? 0) - (b.sort ?? 0),
  )

  return apiGroups
    .filter((g) => !g.hidden)
    .map((g, index) => {
      const groupId = `group-${index}`
      const collections = (g.collections ?? [])
        .map((cId) => {
          const apiCol = collectionMap.get(cId)
          if (!apiCol) return null
          return toUiCollection(apiCol, groupId, childrenByParent)
        })
        .filter((c): c is Collection => c !== null)

      return {
        id: groupId,
        name: g.title ?? `Group ${index}`,
        collections,
      }
    })
}

/**
 * Build system collections (All Bookmarks, Unsorted, Trash) with real counts.
 * The "All" count is the sum of all root collection counts.
 *
 * @param rootCollections - Root-level collections (used for count aggregation)
 * @returns Array of SystemCollection objects
 * @example
 *   toUiSystemCollections([{ count: 45 }, { count: 23 }])
 *   // => [{ id: 'all', name: 'All Bookmarks', icon: 'Inbox', count: 68 }, ...]
 */
export function toUiSystemCollections(
  rootCollections: ApiCollection[],
  unsortedCount = 0,
  trashCount = 0,
): SystemCollection[] {
  const totalCount = rootCollections.reduce((sum, c) => sum + (c.count ?? 0), 0)

  return [
    { id: 'all', name: 'All Bookmarks', icon: 'Inbox', count: totalCount },
    {
      id: 'unsorted',
      name: 'Unsorted',
      icon: 'FileQuestion',
      count: unsortedCount,
    },
    { id: 'trash', name: 'Trash', icon: 'Trash2', count: trashCount },
  ]
}
