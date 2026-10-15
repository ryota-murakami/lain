import type { Collection, Raindrop } from '@/lib/types'

import { findCollectionInTree } from './find-collection-in-tree'

/** Folder names for raindrops whose API collection id has no node in the user's tree. */
const SYSTEM_COLLECTION_NAMES: Record<string, string> = {
  '-1': 'Unsorted',
  '-99': 'Trash',
}

/** Group id given to synthetic folders that belong to no user group. */
const SYSTEM_GROUP_ID = 'system'

export interface DirectoryTree {
  /** Root nodes the Directory view renders (nested via `children`) */
  collections: Collection[]
  /** Loaded raindrops keyed by the collection id they belong to */
  raindropsByCollection: Record<string, Raindrop[]>
}

export interface BuildDirectoryTreeArgs {
  /** Root collections of every group, with nested `children` */
  collections: Collection[]
  /** Raindrops currently loaded for the selected scope */
  raindrops: Raindrop[]
  /** Sidebar selection: 'all' | 'unsorted' | 'trash' | collection id */
  selectedCollectionId: string
  /** Display name of the selection, used to label synthetic system folders */
  currentCollectionName: string
}

/**
 * Create a flat stand-in folder for raindrops that live outside the rendered subtree.
 * @param id - Collection id the raindrops carry
 * @param name - Folder label
 * @param count - Number of loaded raindrops in the folder
 * @returns Collection without children or group membership
 * @example
 * createSyntheticCollection('-1', 'Unsorted', 3) // => { id: '-1', name: 'Unsorted', count: 3, ... }
 */
function createSyntheticCollection(
  id: string,
  name: string,
  count: number,
): Collection {
  return { id, name, icon: 'Folder', count, groupId: SYSTEM_GROUP_ID }
}

/**
 * Bucket raindrops by `collectionId`, preserving the incoming (API-sorted) order.
 * @param raindrops - Loaded raindrops
 * @returns Map of collection id → raindrops in that collection
 * @example
 * groupRaindropsByCollection([{ id: '1', collectionId: '100' }]) // => { '100': [{ id: '1', ... }] }
 */
function groupRaindropsByCollection(
  raindrops: Raindrop[],
): Record<string, Raindrop[]> {
  const grouped: Record<string, Raindrop[]> = {}
  for (const raindrop of raindrops) {
    ;(grouped[raindrop.collectionId] ??= []).push(raindrop)
  }
  return grouped
}

/**
 * Collect every collection id reachable in a tree, including nested children.
 * @param collections - Root collections
 * @returns Set of all ids in the tree
 * @example
 * collectTreeIds([{ id: '100', children: [{ id: '200' }] }]) // => Set { '100', '200' }
 */
function collectTreeIds(collections: Collection[]): Set<string> {
  const ids = new Set<string>()
  const visit = (nodes: Collection[]) => {
    for (const node of nodes) {
      ids.add(node.id)
      visit(node.children ?? [])
    }
  }
  visit(collections)
  return ids
}

/**
 * Stand-in folders for raindrops whose collection is not in the rendered subtree
 * (global search hits from other collections, Unsorted, Trash).
 * @param allCollections - Full tree, used to label folders with the real collection name
 * @param visibleIds - Ids already rendered
 * @param raindropsByCollection - Grouped raindrops
 * @returns One synthetic folder per out-of-tree collection id, in first-seen order
 * @example
 * createOrphanFolders(roots, new Set(['101']), { '100': [dev], '101': [design] })
 * // => [{ id: '100', name: 'Development', count: 1, ... }]
 */
function createOrphanFolders(
  allCollections: Collection[],
  visibleIds: Set<string>,
  raindropsByCollection: Record<string, Raindrop[]>,
): Collection[] {
  return Object.entries(raindropsByCollection)
    .filter(([collectionId]) => !visibleIds.has(collectionId))
    .map(([collectionId, orphanRaindrops]) => {
      const knownCollection = findCollectionInTree(allCollections, collectionId)
      const name =
        knownCollection?.name ??
        SYSTEM_COLLECTION_NAMES[collectionId] ??
        'Other'
      return createSyntheticCollection(
        collectionId,
        name,
        orphanRaindrops.length,
      )
    })
}

/**
 * Shape the Directory view's input for the current sidebar scope so every loaded raindrop
 * hangs off a folder; MainContent recomputes it whenever raindrops or the selection change.
 * @param args - See {@link BuildDirectoryTreeArgs}
 * @returns
 * - 'all': every root collection, plus a synthetic folder per out-of-tree collection id
 * - a user collection: that subtree, plus synthetic folders for out-of-scope search hits
 * - a system collection (Unsorted / Trash): one synthetic folder holding all loaded raindrops
 * @example
 * buildDirectoryTree({ collections: roots, raindrops, selectedCollectionId: '101', currentCollectionName: 'Design' })
 * // => { collections: [designCollection], raindropsByCollection: { '101': [...] } }
 */
export function buildDirectoryTree({
  collections,
  raindrops,
  selectedCollectionId,
  currentCollectionName,
}: BuildDirectoryTreeArgs): DirectoryTree {
  const raindropsByCollection = groupRaindropsByCollection(raindrops)
  const scopedCollection =
    selectedCollectionId === 'all'
      ? undefined
      : findCollectionInTree(collections, selectedCollectionId)

  // Unsorted / Trash are not part of the user tree: show a single folder with everything loaded
  if (selectedCollectionId !== 'all' && !scopedCollection) {
    return {
      collections: [
        createSyntheticCollection(
          selectedCollectionId,
          currentCollectionName,
          raindrops.length,
        ),
      ],
      raindropsByCollection: { [selectedCollectionId]: raindrops },
    }
  }

  const visibleRoots = scopedCollection ? [scopedCollection] : collections
  const orphanFolders = createOrphanFolders(
    collections,
    collectTreeIds(visibleRoots),
    raindropsByCollection,
  )
  return {
    collections: [...visibleRoots, ...orphanFolders],
    raindropsByCollection,
  }
}
