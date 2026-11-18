import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core'
import { useCallback, useMemo, useState } from 'react'

import {
  findRootCollectionLocation,
  moveRootCollection,
  parseCollectionDndId,
} from '@/lib/collection-organization'
import { parseRaindropDndId } from '@/lib/raindrop-organization'
import {
  resolveDropIndicator,
  serializeRootStructure,
} from '@/lib/sidebar-organization'
import type { Group } from '@/lib/types'

/**
 * Interpret root-collection drag targets while leaving bookmark drops to the list monitor.
 * Used by the shared sidebar DndContext to preview insertion and persist the final order.
 * @example
 * const drag = useSidebarDrag({ displayedGroups, handlePersistGroups, onDragEditingCancel })
 */
export function useSidebarDrag({
  displayedGroups,
  handlePersistGroups,
  onDragEditingCancel,
}: {
  displayedGroups: Group[]
  handlePersistGroups: (
    nextGroups: Group[],
    previousGroups: Group[],
  ) => Promise<void>
  onDragEditingCancel: () => void
}) {
  const [activeDragCollectionId, setActiveDragCollectionId] = useState<
    string | null
  >(null)
  const [dropIndicator, setDropIndicator] = useState<{
    groupId: string
    index: number
  } | null>(null)
  const [isRaindropDragActive, setIsRaindropDragActive] = useState(false)
  const activeDragCollection = useMemo(() => {
    if (!activeDragCollectionId) return undefined
    for (const group of displayedGroups) {
      const found = group.collections.find(
        (collection) => collection.id === activeDragCollectionId,
      )
      if (found) return found
    }
    return undefined
  }, [activeDragCollectionId, displayedGroups])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      onDragEditingCancel()
      setIsRaindropDragActive(parseRaindropDndId(event.active.id) !== null)
      setActiveDragCollectionId(parseCollectionDndId(event.active.id))
    },
    [onDragEditingCancel],
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      // Bookmark drags highlight their target row instead of an insertion line
      if (parseRaindropDndId(event.active.id) !== null) return
      setDropIndicator(resolveDropIndicator(event.over?.id, displayedGroups))
    },
    [displayedGroups],
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDragCollectionId(null)
      setDropIndicator(null)
      setIsRaindropDragActive(false)

      // Bookmark drops are handled by MainContent's drag monitor
      if (parseRaindropDndId(event.active.id) !== null) return

      const activeCollectionId = parseCollectionDndId(event.active.id)
      const dropTarget = resolveDropIndicator(event.over?.id, displayedGroups)
      if (
        !activeCollectionId ||
        !dropTarget ||
        dropTarget.groupId === 'ungrouped'
      )
        return

      const sourceLocation = findRootCollectionLocation(
        displayedGroups,
        activeCollectionId,
      )
      if (!sourceLocation) return

      let toIndex = dropTarget.index
      if (
        sourceLocation.groupId === dropTarget.groupId &&
        sourceLocation.index < dropTarget.index
      ) {
        toIndex -= 1
      }

      const nextGroups = moveRootCollection(
        displayedGroups,
        activeCollectionId,
        dropTarget.groupId,
        toIndex,
      )
      if (
        serializeRootStructure(displayedGroups) ===
        serializeRootStructure(nextGroups)
      ) {
        return
      }

      await handlePersistGroups(nextGroups, displayedGroups)
    },
    [displayedGroups, handlePersistGroups],
  )

  const handleDragCancel = useCallback(() => {
    setActiveDragCollectionId(null)
    setDropIndicator(null)
    setIsRaindropDragActive(false)
  }, [])

  return {
    activeDragCollection,
    dropIndicator,
    isRaindropDragActive,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  }
}
