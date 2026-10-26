import type { Collection } from '@/lib/types'

/**
 * Depth-first lookup of a collection anywhere in a nested `children` tree; used by
 * {@link buildDirectoryTree} to scope the Directory view to the selected collection.
 * @param collections - Root collections (each may carry nested `children`)
 * @param collectionId - UI id to look for
 * @returns
 * - The matching collection (root or nested) when found
 * - `undefined` when no collection in the tree has that id
 * @example
 * findCollectionInTree([{ id: '100', children: [{ id: '200' }] }], '200') // => { id: '200' }
 * findCollectionInTree([], 'unsorted')                                    // => undefined
 */
export function findCollectionInTree(
  collections: Collection[],
  collectionId: string,
): Collection | undefined {
  for (const collection of collections) {
    if (collection.id === collectionId) return collection
    const nestedMatch = findCollectionInTree(
      collection.children ?? [],
      collectionId,
    )
    if (nestedMatch) return nestedMatch
  }
  return undefined
}
