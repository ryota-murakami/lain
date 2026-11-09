import type { Collection, Raindrop } from '@/lib/types'

const SYSTEM_COLLECTION_NAMES = new Map([
  ['-1', 'Unsorted'],
  ['-99', 'Trash'],
  ['unsorted', 'Unsorted'],
  ['trash', 'Trash'],
])
const SYSTEM_GROUP_ID = 'system'

export interface DirectoryTree {
  /** Root nodes rendered by DirectoryView, with bounded nested children. */
  collections: Collection[]
  /** Loaded bookmarks, preserving API order within each collection. */
  raindropsByCollection: Record<string, Raindrop[]>
}

export interface BuildDirectoryTreeArgs {
  collections: Collection[]
  raindrops: Raindrop[]
  selectedCollectionId: string
  currentCollectionName: string
}

/**
 * Copy and index the hierarchy without repeating nodes or following malformed cycles.
 * {@link buildDirectoryTree} uses the index for selected-scope and orphan-name lookups.
 * @returns Safe roots and all reachable nodes; the caller's collection objects are unchanged.
 * @example const tree = indexDirectoryCollections(collections)
 */
function indexDirectoryCollections(collections: Collection[]) {
  const roots: Collection[] = []
  const byId = new Map<string, Collection>()
  const pending = [...collections]
    .reverse()
    .map((node) => ({ node, destination: roots }))
  while (pending.length) {
    const { node, destination } = pending.pop()!
    // The first occurrence owns a collection ID; cycles and duplicate edges are omitted.
    if (byId.has(node.id)) continue
    const clone: Collection = {
      ...node,
      ...(node.children ? { children: [] } : {}),
    }
    byId.set(node.id, clone)
    destination.push(clone)
    for (const child of [...(node.children ?? [])].reverse())
      pending.push({ node: child, destination: clone.children! })
  }
  return { roots, byId }
}

/**
 * Gather descendants when a selected subtree needs orphan bookmark folders appended.
 * Input comes from {@link indexDirectoryCollections}, which removes malformed cycles.
 * @example const ids = collectDirectoryIds([selectedCollection])
 */
function collectDirectoryIds(collections: Collection[]): Set<string> {
  const ids = new Set<string>()
  const pending = [...collections]
  while (pending.length) {
    const collection = pending.pop()!
    if (ids.has(collection.id)) continue
    ids.add(collection.id)
    pending.push(...(collection.children ?? []))
  }
  return ids
}

/**
 * Represent loaded bookmarks that have no visible collection node, without inventing hierarchy.
 * Called by {@link buildDirectoryTree} for system scopes and out-of-scope search hits.
 * @example syntheticDirectoryFolder('-1', 'Unsorted', 3)
 */
function syntheticDirectoryFolder(
  id: string,
  name: string,
  count: number,
): Collection {
  return { id, name, icon: 'Folder', count, groupId: SYSTEM_GROUP_ID }
}

/** Bucket loaded bookmarks by their actual owner, normalizing only the selected system folder alias. */
function groupDirectoryBookmarks(
  raindrops: Raindrop[],
  selectedCollectionId: string,
): Map<string, Raindrop[]> {
  const grouped = new Map<string, Raindrop[]>()
  const systemId =
    selectedCollectionId === 'unsorted'
      ? '-1'
      : selectedCollectionId === 'trash'
        ? '-99'
        : undefined
  for (const bookmark of raindrops) {
    // Normalize only the selected system folder; other global-search hits keep their owner.
    const id =
      bookmark.collectionId === systemId
        ? selectedCollectionId
        : bookmark.collectionId
    const bucket = grouped.get(id)
    if (bucket) bucket.push(bookmark)
    else grouped.set(id, [bookmark])
  }
  return grouped
}

/**
 * Group loaded bookmarks under the selected collection subtree while preserving API row order.
 * MainContent calls this for Directory mode; empty descendants remain visible and global search
 * hits retain their actual collection names, including searches initiated from a system folder.
 * @returns Safe collection roots plus loaded bookmark buckets; no records are discarded.
 * @example buildDirectoryTree({ collections: roots, raindrops, selectedCollectionId: '101', currentCollectionName: 'Design' })
 */
export function buildDirectoryTree({
  collections,
  raindrops,
  selectedCollectionId,
  currentCollectionName,
}: BuildDirectoryTreeArgs): DirectoryTree {
  const indexed = indexDirectoryCollections(collections)
  const grouped = groupDirectoryBookmarks(raindrops, selectedCollectionId)
  const scoped = indexed.byId.get(selectedCollectionId)
  const visibleRoots =
    selectedCollectionId === 'all'
      ? indexed.roots
      : scoped
        ? [scoped]
        : [
            syntheticDirectoryFolder(
              selectedCollectionId,
              currentCollectionName,
              grouped.get(selectedCollectionId)?.length ?? 0,
            ),
          ]
  const visibleIds = collectDirectoryIds(visibleRoots)
  const orphanFolders: Collection[] = []
  // Map iteration preserves first-seen folder order even for integer-looking IDs.
  for (const [id, bookmarks] of grouped) {
    if (visibleIds.has(id)) continue
    const name =
      indexed.byId.get(id)?.name ?? SYSTEM_COLLECTION_NAMES.get(id) ?? 'Other'
    orphanFolders.push(syntheticDirectoryFolder(id, name, bookmarks.length))
  }
  return {
    collections: [...visibleRoots, ...orphanFolders],
    raindropsByCollection: Object.fromEntries(grouped),
  }
}
