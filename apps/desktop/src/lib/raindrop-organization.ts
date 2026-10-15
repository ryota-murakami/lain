/**
 * Prefix used for bookmark row IDs in dnd-kit.
 */
const RAINDROP_DND_ID_PREFIX = 'raindrop:'

/**
 * Droppable ID of the bookmark list itself. The collision rules use it to tell
 * "pointer over the list" (manual reorder) from "pointer over the sidebar" (move).
 */
export const RAINDROP_LIST_DND_ID = 'raindrop-list'

/**
 * Build the draggable ID for a bookmark row.
 * @param raindropId - Bookmark identifier
 * @returns DnD ID string
 * @example
 * getRaindropDndId('1') // => 'raindrop:1'
 */
export function getRaindropDndId(raindropId: string): string {
  return `${RAINDROP_DND_ID_PREFIX}${raindropId}`
}

/**
 * Extract a bookmark ID from a dnd-kit item ID.
 * @param dndId - Raw dnd-kit ID value
 * @returns Bookmark ID when the prefix matches, otherwise null
 * @example
 * parseRaindropDndId('raindrop:1')     // => '1'
 * parseRaindropDndId('collection:100') // => null
 */
export function parseRaindropDndId(dndId: unknown): string | null {
  if (typeof dndId !== 'string') return null
  if (!dndId.startsWith(RAINDROP_DND_ID_PREFIX)) return null
  return dndId.slice(RAINDROP_DND_ID_PREFIX.length)
}

/**
 * Bookmarks a drag carries (Finder-style): the whole selection when the grabbed row
 * is part of it, otherwise only the grabbed row.
 * @param activeRaindropId - Bookmark under the pointer when the drag started
 * @param selectedRaindropIds - Current multi-selection
 * @returns IDs to move, in selection order
 * @example
 * resolveDraggedRaindropIds('1', new Set(['1', '2'])) // => ['1', '2']
 * resolveDraggedRaindropIds('3', new Set(['1', '2'])) // => ['3']
 */
export function resolveDraggedRaindropIds(
  activeRaindropId: string,
  selectedRaindropIds: ReadonlySet<string>,
): string[] {
  return selectedRaindropIds.has(activeRaindropId)
    ? [...selectedRaindropIds]
    : [activeRaindropId]
}

/**
 * Manual reorder: move the dragged bookmark to the position of the bookmark it was
 * dropped on (dnd-kit `arrayMove` semantics).
 * @param items - Bookmarks in their current on-screen order
 * @param activeRaindropId - Dragged bookmark
 * @param overRaindropId - Bookmark it was dropped on
 * @returns
 * - A new array with the bookmark moved when both IDs are present and differ
 * - The same array instance when nothing changes
 * @example
 * reorderRaindrops([a, b, c], 'c', 'a') // => [c, a, b]
 * reorderRaindrops([a, b, c], 'a', 'a') // => the input array
 */
export function reorderRaindrops<T extends { id: string }>(
  items: T[],
  activeRaindropId: string,
  overRaindropId: string,
): T[] {
  const fromIndex = items.findIndex((item) => item.id === activeRaindropId)
  const toIndex = items.findIndex((item) => item.id === overRaindropId)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}
