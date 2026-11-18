import {
  findRootCollectionLocation,
  parseCollectionDndId,
  parseGroupDndId,
} from './collection-organization'
import type { Group } from './types'

/**
 * Remove one root collection from groups.
 * @param groups - Current groups
 * @param collectionId - Collection ID to remove
 * @returns Updated groups
 */
export function removeRootCollection(
  groups: Group[],
  collectionId: string,
): Group[] {
  return groups.map((group) => ({
    ...group,
    collections: group.collections.filter(
      (collection) => collection.id !== collectionId,
    ),
  }))
}

/**
 * Serialize root-order structure for optimistic/server sync checks.
 * @param groups - Groups to serialize
 * @returns Stable string for comparison
 */
export function serializeRootStructure(groups: Group[]): string {
  return groups
    .map(
      (group) => `${group.id}:${group.collections.map((c) => c.id).join(',')}`,
    )
    .join('|')
}

/**
 * Resolve drop indicator position from the active `over` ID.
 * @param overId - Raw dnd-kit `over.id`
 * @param groups - Current groups
 * @returns Group and insertion index, or null
 */
export function resolveDropIndicator(
  overId: unknown,
  groups: Group[],
): { groupId: string; index: number } | null {
  const overCollectionId = parseCollectionDndId(overId)
  if (overCollectionId) {
    const location = findRootCollectionLocation(groups, overCollectionId)
    if (!location) return null
    return { groupId: location.groupId, index: location.index }
  }

  const overGroupId = parseGroupDndId(overId)
  if (overGroupId) {
    const group = groups.find((currentGroup) => currentGroup.id === overGroupId)
    if (!group) return null
    return { groupId: overGroupId, index: group.collections.length }
  }

  return null
}
