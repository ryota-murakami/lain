import type { Group, Collection } from '@/lib/types'

/**
 * Prefix used for group container IDs in dnd-kit.
 */
export const GROUP_DND_ID_PREFIX = 'group:'

/**
 * Prefix used for collection item IDs in dnd-kit.
 */
export const COLLECTION_DND_ID_PREFIX = 'collection:'

/**
 * Shape of a persisted user group for `PUT /user` updates.
 */
export interface UserGroupPayload {
  /** Human-readable group name */
  title: string
  /** Group visibility flag (false means visible) */
  hidden: boolean
  /** Group order in sidebar */
  sort: number
  /** Ordered root collection IDs in this group */
  collections: number[]
}

/**
 * Location information for a root collection in grouped data.
 */
export interface RootCollectionLocation {
  /** Group ID containing the collection */
  groupId: string
  /** Collection index within the group's root collection array */
  index: number
}

/**
 * Parse a numeric collection ID from a UI string ID.
 * @param collectionId - String collection ID from UI state
 * @returns Parsed number or null for invalid values
 * @example
 * parseCollectionId('100') // => 100
 * parseCollectionId('abc') // => null
 */
export function parseCollectionId(collectionId: string): number | null {
  if (collectionId.trim() === '') return null
  const parsed = Number(collectionId)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Build the draggable ID for a group drop container.
 * @param groupId - Group identifier
 * @returns DnD ID string
 * @example
 * getGroupDndId('group-0') // => 'group:group-0'
 */
export function getGroupDndId(groupId: string): string {
  return `${GROUP_DND_ID_PREFIX}${groupId}`
}

/**
 * Build the draggable ID for a collection row.
 * @param collectionId - Collection identifier
 * @returns DnD ID string
 * @example
 * getCollectionDndId('100') // => 'collection:100'
 */
export function getCollectionDndId(collectionId: string): string {
  return `${COLLECTION_DND_ID_PREFIX}${collectionId}`
}

/**
 * Extract a group ID from a dnd-kit item ID.
 * @param dndId - Raw dnd-kit ID value
 * @returns Group ID when the prefix matches, otherwise null
 * @example
 * parseGroupDndId('group:group-0') // => 'group-0'
 */
export function parseGroupDndId(dndId: unknown): string | null {
  if (typeof dndId !== 'string') return null
  if (!dndId.startsWith(GROUP_DND_ID_PREFIX)) return null
  return dndId.slice(GROUP_DND_ID_PREFIX.length)
}

/**
 * Extract a collection ID from a dnd-kit item ID.
 * @param dndId - Raw dnd-kit ID value
 * @returns Collection ID when the prefix matches, otherwise null
 * @example
 * parseCollectionDndId('collection:100') // => '100'
 */
export function parseCollectionDndId(dndId: unknown): string | null {
  if (typeof dndId !== 'string') return null
  if (!dndId.startsWith(COLLECTION_DND_ID_PREFIX)) return null
  return dndId.slice(COLLECTION_DND_ID_PREFIX.length)
}

/**
 * Find the root collection location for a collection ID.
 * @param groups - Group tree to inspect
 * @param collectionId - Root collection ID to locate
 * @returns Location when found, otherwise null
 * @example
 * findRootCollectionLocation(groups, '100') // => { groupId: 'group-0', index: 0 }
 */
export function findRootCollectionLocation(
  groups: Group[],
  collectionId: string,
): RootCollectionLocation | null {
  for (const group of groups) {
    const index = group.collections.findIndex((collection) => {
      return collection.id === collectionId
    })
    if (index >= 0) {
      return { groupId: group.id, index }
    }
  }
  return null
}

/**
 * Move a root collection between groups or within the same group.
 * @param groups - Source groups
 * @param collectionId - Root collection ID to move
 * @param targetGroupId - Destination group ID
 * @param targetIndex - Destination index in target group
 * @returns Updated groups with reordered root collections
 * @example
 * moveRootCollection(groups, '100', 'group-1', 0)
 */
export function moveRootCollection(
  groups: Group[],
  collectionId: string,
  targetGroupId: string,
  targetIndex: number,
): Group[] {
  const sourceLocation = findRootCollectionLocation(groups, collectionId)
  if (!sourceLocation) return groups

  const sourceGroupIndex = groups.findIndex(
    (group) => group.id === sourceLocation.groupId,
  )
  const targetGroupIndex = groups.findIndex(
    (group) => group.id === targetGroupId,
  )
  if (sourceGroupIndex < 0 || targetGroupIndex < 0) return groups

  const sourceGroup = groups[sourceGroupIndex]
  const movingCollection = sourceGroup.collections[sourceLocation.index]
  if (!movingCollection) return groups

  const nextGroups = groups.map((group) => ({
    ...group,
    collections: [...group.collections],
  }))

  nextGroups[sourceGroupIndex].collections.splice(sourceLocation.index, 1)

  const boundedTargetIndex = Math.max(
    0,
    Math.min(targetIndex, nextGroups[targetGroupIndex].collections.length),
  )
  nextGroups[targetGroupIndex].collections.splice(boundedTargetIndex, 0, {
    ...movingCollection,
    groupId: targetGroupId,
  })

  return nextGroups
}

/**
 * Reorder root collections within a single group.
 * @param groups - Source groups
 * @param groupId - Target group ID
 * @param fromIndex - Current index
 * @param toIndex - New index
 * @returns Updated groups with reordered root collections
 * @example
 * reorderRootCollectionInGroup(groups, 'group-0', 0, 2)
 */
export function reorderRootCollectionInGroup(
  groups: Group[],
  groupId: string,
  fromIndex: number,
  toIndex: number,
): Group[] {
  const groupIndex = groups.findIndex((group) => group.id === groupId)
  if (groupIndex < 0) return groups

  const nextGroups = groups.map((group) => ({
    ...group,
    collections: [...group.collections],
  }))
  const groupCollections = nextGroups[groupIndex].collections
  if (
    fromIndex < 0 ||
    fromIndex >= groupCollections.length ||
    toIndex < 0 ||
    toIndex >= groupCollections.length
  ) {
    return groups
  }

  const [movedCollection] = groupCollections.splice(fromIndex, 1)
  groupCollections.splice(toIndex, 0, movedCollection)
  return nextGroups
}

/**
 * Update one root collection in all groups.
 * @param groups - Source groups
 * @param collectionId - Root collection ID to update
 * @param updater - Transform function applied to the matched collection
 * @returns Updated groups
 * @example
 * updateRootCollection(groups, '100', (c) => ({ ...c, name: 'Renamed' }))
 */
export function updateRootCollection(
  groups: Group[],
  collectionId: string,
  updater: (collection: Collection) => Collection,
): Group[] {
  return groups.map((group) => ({
    ...group,
    collections: group.collections.map((collection) => {
      if (collection.id !== collectionId) return collection
      return updater(collection)
    }),
  }))
}

/**
 * Convert UI groups to API user group payload for `PUT /user`.
 * @param groups - Current groups with root collection ordering
 * @returns API payload for user group persistence
 * @example
 * toUserGroupPayload(groups) // => [{ title: 'Development', hidden: false, sort: 0, collections: [100, 102] }]
 */
export function toUserGroupPayload(groups: Group[]): UserGroupPayload[] {
  return groups.map((group, index) => ({
    title: group.name,
    hidden: false,
    sort: index,
    collections: group.collections
      .map((collection) => parseCollectionId(collection.id))
      .filter((id): id is number => id !== null),
  }))
}
