import { CanceledError } from 'axios'

import type { UserStats } from '@/store/api/accountApi'
import type { Collection, Raindrop, User } from '@/store/api/raindropApi'

import { lainAxios } from './axios'

export type ExportFormat = 'html' | 'csv' | 'json'
export interface BookmarkSnapshot {
  schemaVersion: 1
  exportedAt: string
  scope: number
  bookmarks: (Raindrop & { important?: boolean })[]
  collections: Collection[]
  groups: User['groups']
}

/**
 * Stop export between requests, including completed requests racing with cancellation.
 * Called by {@link fetchBookmarkSnapshot} and its metadata reader before exposing results.
 * @throws An Axios cancellation error recognized by the export dialog.
 * @example assertExportActive(controller.signal)
 */
function assertExportActive(signal: AbortSignal): void {
  if (signal.aborted) throw new CanceledError('Export canceled.')
}

/**
 * Require the server revision used to bracket {@link fetchBookmarkSnapshot} reads.
 * Missing revisions cannot establish consistency, even when two counts match.
 * @returns The server's unmodified bookmark change marker.
 * @throws When the stats response cannot support consistency verification.
 * @example const revision = changeMarker(stats)
 */
function changeMarker(stats: UserStats): string {
  const marker = stats?.meta?.changedBookmarksDate
  if (
    stats?.result !== true ||
    !Array.isArray(stats.items) ||
    typeof marker !== 'string' ||
    !Number.isFinite(Date.parse(marker))
  ) {
    throw new Error(
      'The service did not provide a valid export change marker. Please retry.',
    )
  }
  return marker
}

/**
 * Normalize JSON object keys for {@link fetchBookmarkSnapshot} metadata comparison.
 * Array order remains meaningful for groups and their collection ordering.
 * @returns A deterministic representation of JSON-compatible API metadata.
 * @example metadataFingerprint({ title: 'Reading', _id: 1 })
 */
function metadataFingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    // JSON objects have unordered keys; arrays carry the user's ordering.
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(
        Object.entries(item).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      )
    }
    return item
  })
}

interface ExportMetadata {
  collections: Collection[]
  groups: NonNullable<User['groups']>
  userId: number
}

/** Validate API identifiers before metadata or page records enter an export snapshot. */
function isExportId(id: unknown): id is number {
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0
}

/** Validate group membership arrays received by the metadata reader before serializing them. */
function validExportGroup(group: NonNullable<User['groups']>[number]): boolean {
  if (!group || typeof group !== 'object') return false
  if (group.collections === undefined) return true
  return Array.isArray(group.collections) && group.collections.every(isExportId)
}

/**
 * Merge the API's overlapping root/child listings without accepting conflicting snapshots.
 * Raindrop can include identical roots in both endpoints; only conflicting duplicates imply a changed hierarchy.
 * @example mergeExportCollections(roots, children)
 */
function mergeExportCollections(
  roots: Collection[],
  children: Collection[],
): Collection[] {
  const collections = new Map<number, Collection>()
  for (const collection of [...roots, ...children]) {
    const id = collection?._id
    if (!isExportId(id))
      throw new Error(
        'The collection hierarchy is incomplete or changed during export. Please retry.',
      )
    const previous = collections.get(id)
    if (
      previous &&
      metadataFingerprint(previous) !== metadataFingerprint(collection)
    ) {
      throw new Error(
        'The collection hierarchy is incomplete or changed during export. Please retry.',
      )
    }
    collections.set(id, collection)
  }
  return [...collections.values()]
}

/**
 * Read hierarchy and account identity around an export's page reads.
 * Called twice by {@link fetchBookmarkSnapshot} to detect organization changes.
 * @throws When metadata is incomplete or collection IDs conflict.
 * @example const metadata = await fetchExportMetadata(controller.signal)
 */
async function fetchExportMetadata(
  signal: AbortSignal,
): Promise<ExportMetadata> {
  assertExportActive(signal)
  const [roots, children, user] = await Promise.all([
    lainAxios.get<{ result: boolean; items: Collection[] }>('/collections', {
      signal,
    }),
    lainAxios.get<{ result: boolean; items: Collection[] }>(
      '/collections/childrens',
      { signal },
    ),
    lainAxios.get<{ result: boolean; user: User }>('/user', { signal }),
  ])
  assertExportActive(signal)
  if (
    roots.data?.result !== true ||
    children.data?.result !== true ||
    user.data?.result !== true ||
    !Array.isArray(roots.data.items) ||
    !Array.isArray(children.data.items)
  ) {
    throw new Error(
      'The service did not return complete export metadata. Please retry.',
    )
  }
  const userId = user.data.user?._id
  const groups = user.data.user?.groups ?? []
  if (
    !isExportId(userId) ||
    !Array.isArray(groups) ||
    !groups.every(validExportGroup)
  ) {
    throw new Error(
      'The service did not return a valid export account. Please retry.',
    )
  }
  return {
    collections: mergeExportCollections(roots.data.items, children.data.items),
    groups,
    userId,
  }
}

/**
 * Select a collection subtree, including descendants with no bookmarks.
 * Called by {@link fetchBookmarkSnapshot} before page validation and ancestor inclusion.
 * @returns IDs allowed to contribute bookmarks to this export.
 * @throws When the selected collection no longer exists.
 * @example const included = exportCollectionIds(100, collections)
 */
function exportCollectionIds(
  scope: number,
  collections: Collection[],
): Set<number> {
  if (scope === 0)
    return new Set([-1, ...collections.map((collection) => collection._id!)])
  if (scope === -1) return new Set([-1])
  if (!collections.some((collection) => collection._id === scope))
    throw new Error(
      'The selected collection no longer exists. Please choose another collection.',
    )
  const children = new Map<number, number[]>()
  for (const collection of collections) {
    const parent = collection.parent?.$id
    if (parent !== undefined)
      children.set(parent, [...(children.get(parent) ?? []), collection._id!])
  }
  const included = new Set([scope])
  // Set iteration visits newly added descendants, while cycles remain bounded.
  for (const id of included)
    for (const child of children.get(id) ?? []) included.add(child)
  return included
}

interface ExportPage {
  result: boolean
  items: BookmarkSnapshot['bookmarks']
  count: number
}

/** Reject malformed page envelopes before the export reader trusts their count or items. */
function validateExportPage(data: ExportPage): void {
  if (
    data?.result !== true ||
    !Array.isArray(data.items) ||
    !Number.isSafeInteger(data.count) ||
    data.count < 0 ||
    data.items.length > 50
  ) {
    throw new Error(
      'The service did not return a valid export page. Please retry.',
    )
  }
}

/** Check identity and scope for each downloaded page before appending it to the snapshot. */
function appendExportPage(
  bookmarks: BookmarkSnapshot['bookmarks'],
  items: ExportPage['items'],
  ids: Set<number>,
  included: Set<number>,
): void {
  for (const bookmark of items) {
    const id = bookmark?._id
    if (!isExportId(id) || ids.has(id))
      throw new Error('A duplicate or missing bookmark ID interrupted export.')
    if (!included.has(bookmark.collection?.$id ?? Number.NaN))
      throw new Error(
        'A bookmark moved outside the selected export scope. Please retry.',
      )
    ids.add(id)
    bookmarks.push(bookmark)
  }
}

/**
 * Download all stable pages for the snapshot reader, including an empty boundary page at multiples of 50.
 * @throws On stale counts, duplicate/moved records, incomplete data or cancellation.
 * @example await fetchExportPages(0, included, signal, progress)
 */
async function fetchExportPages(
  collectionId: number,
  included: Set<number>,
  signal: AbortSignal,
  progress: (loaded: number, total: number) => void,
): Promise<BookmarkSnapshot['bookmarks']> {
  const bookmarks: BookmarkSnapshot['bookmarks'] = []
  const ids = new Set<number>()
  let expected: number | undefined
  for (let page = 0; ; page++) {
    assertExportActive(signal)
    const response = await lainAxios.get<ExportPage>(
      `/raindrops/${collectionId}`,
      { signal, params: { page, perpage: 50, sort: 'created', nested: true } },
    )
    assertExportActive(signal)
    const data = response.data
    validateExportPage(data)
    expected ??= data.count
    if (expected !== data.count)
      throw new Error('The collection changed during export. Please retry.')
    appendExportPage(bookmarks, data.items, ids, included)
    if (bookmarks.length > expected)
      throw new Error(
        'Export contains more bookmarks than the service reported. Please retry.',
      )
    progress(bookmarks.length, expected)
    assertExportActive(signal)
    // A short page terminates reading; the final count must still match the initial total.
    if (data.items.length < 50) break
  }
  if (bookmarks.length !== expected)
    throw new Error('Export is incomplete. Please retry.')
  return bookmarks
}

/** Normalize hierarchy record order while retaining explicit sort fields and user group order. */
function exportMetadataFingerprint(metadata: ExportMetadata): string {
  return metadataFingerprint({
    ...metadata,
    collections: [...metadata.collections].sort(
      (left, right) => left._id! - right._id!,
    ),
  })
}

/** Check global/Unsorted stats against downloaded totals after the bracketing revision check. */
function verifyExportTotal(
  scope: number,
  count: number,
  before: UserStats,
  after: UserStats,
): void {
  if (scope !== 0 && scope !== -1) return
  const beforeCount = before.items.find((item) => item._id === scope)?.count
  const afterCount = after.items.find((item) => item._id === scope)?.count
  if (beforeCount !== count || afterCount !== count)
    throw new Error(
      'The account total does not match the export. Please retry.',
    )
}

/** Include selected empty descendants and path ancestors without unrelated siblings in scoped exports. */
function scopeExportMetadata(
  scope: number,
  metadata: ExportMetadata,
  included: Set<number>,
): Pick<BookmarkSnapshot, 'collections' | 'groups'> {
  const allCollections = new Map(
    metadata.collections.map((collection) => [collection._id!, collection]),
  )
  // Set iteration visits newly discovered ancestors and bounds malformed cycles.
  for (const id of included) {
    const parent = allCollections.get(id)?.parent?.$id
    if (parent !== undefined) included.add(parent)
  }
  const collections = metadata.collections.filter((collection) =>
    included.has(collection._id!),
  )
  const groups =
    scope === 0
      ? metadata.groups
      : metadata.groups
          .map((group) => ({
            ...group,
            collections: group.collections?.filter((id) => included.has(id)),
          }))
          .filter((group) => group.collections?.length)
  return { collections, groups }
}

/**
 * Fetch complete, consistency-checked data before the export dialog offers to save it.
 * Pages, IDs, scope, server revisions, account identity and hierarchy must agree.
 * The API is not transactional: these checks detect observed changes, not an atomic backup.
 * @param collectionId - Zero for active bookmarks, -1 for Unsorted, or a positive collection including descendants.
 * @param signal - Cancels requests and prevents partial snapshots from being returned.
 * @param progress - Reports downloaded items; reaching the total does not finish validation.
 * @returns A snapshot only after all pages and final consistency checks pass.
 * @throws On cancellation, incomplete/duplicate pages, changed data, invalid metadata, or API failure.
 * @example await fetchBookmarkSnapshot(0, controller.signal, (loaded, total) => report(loaded, total))
 */
export async function fetchBookmarkSnapshot(
  collectionId: number,
  signal: AbortSignal,
  progress: (loaded: number, total: number) => void,
): Promise<BookmarkSnapshot> {
  assertExportActive(signal)
  if (!Number.isSafeInteger(collectionId) || collectionId < -1)
    throw new Error(
      'Choose all bookmarks, Unsorted, or a collection to export.',
    )
  const before = await lainAxios.get<UserStats>('/user/stats', { signal })
  assertExportActive(signal)
  const marker = changeMarker(before.data)
  const metadata = await fetchExportMetadata(signal)
  const included = exportCollectionIds(collectionId, metadata.collections)
  const bookmarks = await fetchExportPages(
    collectionId,
    included,
    signal,
    progress,
  )
  const afterMetadata = await fetchExportMetadata(signal)
  const after = await lainAxios.get<UserStats>('/user/stats', { signal })
  assertExportActive(signal)
  if (marker !== changeMarker(after.data))
    throw new Error(
      'Bookmarks changed during export. Please retry for a consistent snapshot.',
    )
  if (
    exportMetadataFingerprint(metadata) !==
    exportMetadataFingerprint(afterMetadata)
  )
    throw new Error(
      'The account or collection hierarchy changed during export. Please retry.',
    )
  verifyExportTotal(collectionId, bookmarks.length, before.data, after.data)
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    scope: collectionId,
    bookmarks,
    ...scopeExportMetadata(collectionId, metadata, included),
  }
}

/**
 * Escape user text for HTML content and attributes during serialization.
 * @example escapeHtml('<Research>') // '&lt;Research&gt;'
 */
function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  )
}

/**
 * Quote CSV fields and neutralize formulas while retaining Unicode and newlines.
 * Called for every CSV field by {@link serializeBookmarkSnapshot}.
 * @example csvCell('=1+1') // A quoted cell prefixed with an apostrophe.
 */
function csvCell(value: unknown): string {
  const text = String(value ?? '')
  const safe =
    /^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

/**
 * Build CSV paths without looping on corrupt parent metadata.
 * Called by {@link serializeBookmarkSnapshot}; JSON retains original parent IDs.
 * @example collectionPath(100, [{ _id: 100, title: 'Reading' }]) // 'Reading'
 */
function collectionPath(
  id: number | undefined,
  collections: Collection[],
): string {
  if (id === -1 || id === undefined) return 'Unsorted'
  const path: string[] = []
  const seen = new Set<number>()
  while (id !== undefined && !seen.has(id)) {
    seen.add(id)
    const collection = collections.find((candidate) => candidate._id === id)
    if (!collection) {
      path.unshift(`Unknown collection (${id})`)
      break
    }
    path.unshift(collection.title ?? 'Untitled collection')
    id = collection.parent?.$id
  }
  return path.join(' / ')
}

/**
 * Emit optional Netscape dates without fabricating missing or invalid timestamps.
 * Called for bookmark and collection HTML attributes.
 * @example htmlDate('ADD_DATE', '2026-11-01T00:00:00.000Z')
 */
function htmlDate(
  attribute: 'ADD_DATE' | 'LAST_MODIFIED',
  value: string | undefined,
): string {
  const seconds = value ? Math.floor(Date.parse(value) / 1000) : Number.NaN
  return Number.isFinite(seconds) && seconds >= 0
    ? ` ${attribute}="${seconds}"`
    : ''
}

/**
 * Create a passive bookmark entry with non-web URLs preserved as data.
 * Called by {@link serializeBookmarkHtml}; JSON always keeps the original URL.
 * @example bookmarkHtml({ _id: 1, title: 'Example', link: 'https://example.com' })
 */
function bookmarkHtml(bookmark: BookmarkSnapshot['bookmarks'][number]): string {
  const original = bookmark.link ?? ''
  let href = 'about:blank'
  try {
    const url = new URL(original)
    // Only explicit HTTP(S) links remain clickable in exported HTML documents.
    if (url.protocol === 'http:' || url.protocol === 'https:') href = original
  } catch {
    /* Malformed or relative URLs remain available in DATA-ORIGINAL-URL. */
  }
  const originalAttribute =
    href !== original ? ` DATA-ORIGINAL-URL="${escapeHtml(original)}"` : ''
  return `<DT><A HREF="${escapeHtml(href)}"${originalAttribute} TAGS="${escapeHtml((bookmark.tags ?? []).join(','))}" DATA-TAGS="${escapeHtml(JSON.stringify(bookmark.tags ?? []))}"${htmlDate('ADD_DATE', bookmark.created)}${htmlDate('LAST_MODIFIED', bookmark.lastUpdate)} DATA-NOTE="${escapeHtml(bookmark.note)}" DATA-IMPORTANT="${Boolean(bookmark.important)}" DATA-ID="${escapeHtml(bookmark._id)}">${escapeHtml(bookmark.title ?? original)}</A>\n<DD>${escapeHtml(bookmark.excerpt)}\n`
}

/**
 * Emit one collection subtree with a shared visited set so cycles and duplicate roots cannot duplicate bookmarks.
 * Called by the HTML serializer; explicit closing markers keep deep trees off the JavaScript call stack.
 * @example serializeExportSubtree(root, children, folders, visited)
 */
function serializeExportSubtree(
  root: Collection,
  children: Map<number | undefined, Collection[]>,
  folders: Map<number | undefined, BookmarkSnapshot['bookmarks']>,
  visited: Set<number | undefined>,
): string[] {
  const body: string[] = []
  const pending: (Collection | 'close')[] = [root]
  while (pending.length) {
    const entry = pending.pop()!
    if (entry === 'close') {
      body.push('</DL><p>\n')
      continue
    }
    if (visited.has(entry._id)) continue
    visited.add(entry._id)
    body.push(
      `<DT><H3 DATA-ID="${escapeHtml(entry._id)}" DATA-PARENT-ID="${escapeHtml(entry.parent?.$id)}"${htmlDate('ADD_DATE', entry.created)}${htmlDate('LAST_MODIFIED', entry.lastUpdate)}>${escapeHtml(entry.title ?? 'Untitled collection')}</H3>\n<DL><p>\n`,
    )
    body.push(...(folders.get(entry._id) ?? []).map(bookmarkHtml))
    folders.delete(entry._id)
    pending.push('close', ...[...(children.get(entry._id) ?? [])].reverse())
  }
  return body
}

/**
 * Write Netscape nesting, empty folders and recoverable malformed hierarchies.
 * Called by {@link serializeBookmarkSnapshot}; an iterative walk bounds cycles and depth.
 * @returns Passive HTML with each collection and bookmark emitted once.
 * @example serializeBookmarkHtml(snapshot)
 */
function serializeBookmarkHtml(snapshot: BookmarkSnapshot): string {
  const byId = new Map(
    snapshot.collections.map((collection) => [collection._id, collection]),
  )
  const children = new Map<number | undefined, Collection[]>()
  const folders = new Map<number | undefined, BookmarkSnapshot['bookmarks']>()
  for (const collection of snapshot.collections) {
    const parent = collection.parent?.$id
    children.set(parent, [...(children.get(parent) ?? []), collection])
  }
  for (const bookmark of snapshot.bookmarks) {
    const id = bookmark.collection?.$id ?? -1
    folders.set(id, [...(folders.get(id) ?? []), bookmark])
  }
  const body: string[] = []
  const visited = new Set<number | undefined>()
  const roots = snapshot.collections.filter(
    (collection) =>
      !byId.has(collection.parent?.$id) ||
      collection.parent?.$id === collection._id,
  )
  // Remaining entries recover rootless cycles instead of losing their bookmarks.
  for (const root of [...roots, ...snapshot.collections]) {
    body.push(...serializeExportSubtree(root, children, folders, visited))
  }
  // Unsorted and orphaned references stay explicit, even in imported snapshots.
  for (const [id, bookmarks] of folders) {
    const title =
      id === -1 || id === undefined ? 'Unsorted' : `Unknown collection (${id})`
    body.push(
      `<DT><H3 DATA-ID="${escapeHtml(id)}">${escapeHtml(title)}</H3>\n<DL><p>\n`,
      ...bookmarks.map(bookmarkHtml),
      '</DL><p>\n',
    )
  }
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<META NAME="lain-groups" CONTENT="${escapeHtml(JSON.stringify(snapshot.groups ?? []))}">\n<TITLE>Lain bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n${body.join('')}</DL><p>\n`
}

/**
 * Serialize a verified snapshot for the export dialog's native file-save operation.
 * JSON retains API fields; CSV is a safe flat table; HTML preserves collection nesting.
 * HTML DATA-* and group metadata are Lain extensions that importers may ignore.
 * @returns UTF-8 text; CSV includes a BOM for spreadsheet compatibility.
 * @example serializeBookmarkSnapshot(snapshot, 'csv')
 */
export function serializeBookmarkSnapshot(
  snapshot: BookmarkSnapshot,
  format: ExportFormat,
): string {
  if (format === 'json') return JSON.stringify(snapshot, null, 2) + '\n'
  if (format === 'csv') {
    const rows = [
      [
        'id',
        'url',
        'title',
        'description',
        'note',
        'tags',
        'collection_path',
        'important',
        'type',
        'created',
        'lastUpdate',
      ],
      ...snapshot.bookmarks.map((bookmark) => [
        bookmark._id,
        bookmark.link,
        bookmark.title,
        bookmark.excerpt,
        bookmark.note,
        JSON.stringify(bookmark.tags ?? []),
        collectionPath(bookmark.collection?.$id, snapshot.collections),
        bookmark.important ?? false,
        bookmark.type,
        bookmark.created,
        bookmark.lastUpdate,
      ]),
    ]
    return (
      '\uFEFF' +
      rows.map((row) => row.map(csvCell).join(',')).join('\r\n') +
      '\r\n'
    )
  }
  return serializeBookmarkHtml(snapshot)
}
