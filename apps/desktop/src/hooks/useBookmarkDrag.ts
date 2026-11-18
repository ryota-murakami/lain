import {
  useDndMonitor,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { MainContentProps } from '@/components/raindrop/main-content.types'
import { parseCollectionDndId } from '@/lib/collection-organization'
import {
  RAINDROP_LIST_DND_ID,
  getRaindropDndId,
  parseRaindropDndId,
  resolveDraggedRaindropIds,
} from '@/lib/raindrop-organization'
import type { Raindrop } from '@/lib/types'

type BookmarkDragOptions = Pick<
  MainContentProps,
  | 'selectedCollectionId'
  | 'selectedRaindropIds'
  | 'canReorderRaindrops'
  | 'onBatchMove'
  | 'onReorderRaindrop'
> & { filteredRaindrops: Raindrop[] }

/**
 * Route bookmark drags to a sidebar move or an allowed manual reorder.
 * Registered under the sidebar DndContext by the main list; failed writes remain visible as errors.
 *
 * @returns The drop-zone ref, sortable IDs, and active drag preview data.
 * @example
 * const drag = useBookmarkDrag({ ...options, filteredRaindrops })
 */
export function useBookmarkDrag({
  selectedCollectionId,
  selectedRaindropIds,
  canReorderRaindrops,
  onBatchMove,
  onReorderRaindrop,
  filteredRaindrops,
}: BookmarkDragOptions) {
  // The DndContext lives in LeftSidebar and wraps this content; drops are observed here
  const sortableIds = useMemo(
    () => filteredRaindrops.map((raindrop) => getRaindropDndId(raindrop.id)),
    [filteredRaindrops],
  )
  // Lets the collision rules tell "pointer over the list" from "pointer over the sidebar"
  const { setNodeRef: setListDropZoneRef } = useDroppable({
    id: RAINDROP_LIST_DND_ID,
  })
  const [activeDragRaindropId, setActiveDragRaindropId] = useState<
    string | null
  >(null)
  const activeDragRaindrop = activeDragRaindropId
    ? filteredRaindrops.find((r) => r.id === activeDragRaindropId)
    : undefined
  const draggedCount = activeDragRaindropId
    ? resolveDraggedRaindropIds(activeDragRaindropId, selectedRaindropIds)
        .length
    : 0
  const handleRaindropDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragRaindropId(parseRaindropDndId(event.active.id))
  }, [])
  const handleRaindropDragCancel = useCallback(() => {
    setActiveDragRaindropId(null)
  }, [])
  const handleRaindropDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeRaindropId = parseRaindropDndId(event.active.id)
      if (!activeRaindropId) return
      setActiveDragRaindropId(null)

      // Dropped on a sidebar collection → move the dragged selection there
      const targetCollectionId = parseCollectionDndId(event.over?.id)
      if (targetCollectionId) {
        if (targetCollectionId !== selectedCollectionId) {
          void Promise.resolve(
            onBatchMove?.(
              resolveDraggedRaindropIds(activeRaindropId, selectedRaindropIds),
              targetCollectionId,
            ),
          ).catch(() =>
            toast.error('Bookmarks could not be moved. Please try again.'),
          )
        }
        return
      }

      // Dropped on another bookmark → manual reorder
      const overRaindropId = parseRaindropDndId(event.over?.id)
      if (
        canReorderRaindrops &&
        overRaindropId &&
        overRaindropId !== activeRaindropId
      ) {
        void Promise.resolve(
          onReorderRaindrop?.(activeRaindropId, overRaindropId),
        ).catch(() =>
          toast.error('Bookmark order could not be saved. Please try again.'),
        )
      }
    },
    [
      canReorderRaindrops,
      onBatchMove,
      onReorderRaindrop,
      selectedCollectionId,
      selectedRaindropIds,
    ],
  )
  useDndMonitor(
    useMemo(
      () => ({
        onDragStart: handleRaindropDragStart,
        onDragCancel: handleRaindropDragCancel,
        onDragEnd: handleRaindropDragEnd,
      }),
      [
        handleRaindropDragStart,
        handleRaindropDragCancel,
        handleRaindropDragEnd,
      ],
    ),
  )

  return { sortableIds, setListDropZoneRef, activeDragRaindrop, draggedCount }
}
