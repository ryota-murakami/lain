import type { Collection, Group } from './types'

/** Collection search row shared by the sidebar and collection picker. */
export interface SearchableCollection extends Pick<
  Collection,
  'id' | 'name' | 'color' | 'count'
> {
  path: string[]
  groupName: string
}

/**
 * Preserve every nested collection's identity and breadcrumb for fuzzy search.
 * The sidebar search and collection picker call this when their group tree changes.
 * @returns Depth-first rows retaining group names and full collection paths.
 * @example flattenSearchableCollections(groups)
 */
export function flattenSearchableCollections(
  groups: Group[],
): SearchableCollection[] {
  const result: SearchableCollection[] = []
  const walk = (
    collections: Collection[],
    groupName: string,
    parentPath: string[],
  ): void => {
    // Preserve tree order for the empty-query view while collecting every descendant.
    for (const collection of collections) {
      const path = [...parentPath, collection.name]
      result.push({
        id: collection.id,
        name: collection.name,
        color: collection.color,
        count: collection.count,
        path,
        groupName,
      })
      if (collection.children) walk(collection.children, groupName, path)
    }
  }
  for (const group of groups) walk(group.collections, group.name, [])
  return result
}
