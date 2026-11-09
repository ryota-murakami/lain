import { useCallback, type RefObject } from 'react'
import type React from 'react'

import type { MainContentProps } from '@/components/raindrop/main-content.types'
import type { Raindrop } from '@/lib/types'

import { useViewNavigation } from './useViewNavigation'

type BookmarkInteractionOptions = Pick<
  MainContentProps,
  | 'selectedRaindropIds'
  | 'selectedRaindropId'
  | 'onSelectedRaindropIdsChange'
  | 'onSelectRaindrop'
  | 'onFocusRaindrop'
  | 'onTogglePreview'
> & {
  filteredRaindrops: Raindrop[]
  scrollAreaRef: RefObject<HTMLDivElement | null>
}

/**
 * Coordinate pointer selection and keyboard navigation for the visible bookmark rows.
 * Called by {@link MainContentProps} consumers so every view shares range and checkbox selection.
 *
 * @returns Stable callbacks for opening URLs, selecting rows, and toggling selection.
 * @example
 * const handlers = useBookmarkInteraction({ ...options, filteredRaindrops, scrollAreaRef })
 */
export function useBookmarkInteraction({
  selectedRaindropIds,
  selectedRaindropId,
  onSelectedRaindropIdsChange,
  onSelectRaindrop,
  onFocusRaindrop,
  onTogglePreview,
  filteredRaindrops,
  scrollAreaRef,
}: BookmarkInteractionOptions) {
  /**
   * Toggle a single raindrop's selection state (used by checkbox click).
   * @param raindropId - The ID of the raindrop to toggle
   */
  const handleToggleSelect = useCallback(
    (raindropId: string) => {
      const next = new Set(selectedRaindropIds)
      if (next.has(raindropId)) {
        next.delete(raindropId)
      } else {
        next.add(raindropId)
      }
      onSelectedRaindropIdsChange(next)
    },
    [selectedRaindropIds, onSelectedRaindropIdsChange],
  )

  /**
   * Handle click on a raindrop with multi-select support.
   * @param raindrop - The clicked raindrop
   * @param event - Mouse event for detecting modifier keys
   */
  const handleRaindropClick = useCallback(
    (raindrop: Raindrop, event: React.MouseEvent) => {
      if (event.metaKey || event.ctrlKey) {
        handleToggleSelect(raindrop.id)
      } else if (event.shiftKey && selectedRaindropId) {
        // Range select
        const currentIndex = filteredRaindrops.findIndex(
          (r) => r.id === selectedRaindropId,
        )
        const clickedIndex = filteredRaindrops.findIndex(
          (r) => r.id === raindrop.id,
        )
        if (currentIndex !== -1 && clickedIndex !== -1) {
          const start = Math.min(currentIndex, clickedIndex)
          const end = Math.max(currentIndex, clickedIndex)
          const rangeIds = filteredRaindrops
            .slice(start, end + 1)
            .map((r) => r.id)
          onSelectedRaindropIdsChange(new Set(rangeIds))
        }
      } else {
        onSelectedRaindropIdsChange(new Set())
        onSelectRaindrop(raindrop)
      }
    },
    [
      handleToggleSelect,
      selectedRaindropId,
      filteredRaindrops,
      onSelectedRaindropIdsChange,
      onSelectRaindrop,
    ],
  )

  /**
   * Handle double-click to open URL in external browser.
   * @param raindrop - The double-clicked raindrop
   */
  const handleRaindropDoubleClick = useCallback((raindrop: Raindrop) => {
    window.shell.openExternal(raindrop.url)
  }, [])

  // Table / directory views hand back a URL rather than a raindrop
  const handleOpenUrl = useCallback((url: string) => {
    window.shell.openExternal(url)
  }, [])

  // --- Keyboard Navigation (F7.6) ---
  // The hook reports row ids; resolve them against what is on screen
  const handleNavigateToRaindrop = useCallback(
    (raindropId: string) => {
      const raindrop = filteredRaindrops.find((r) => r.id === raindropId)
      if (raindrop) onFocusRaindrop(raindrop)
    },
    [filteredRaindrops, onFocusRaindrop],
  )
  const handleOpenRaindrop = useCallback(
    (raindropId: string) => {
      const raindrop = filteredRaindrops.find((r) => r.id === raindropId)
      if (raindrop) window.shell.openExternal(raindrop.url)
    },
    [filteredRaindrops],
  )
  const handleTogglePreview = useCallback(
    (raindropId: string) => {
      const raindrop = filteredRaindrops.find((r) => r.id === raindropId)
      if (raindrop) onTogglePreview(raindrop)
    },
    [filteredRaindrops, onTogglePreview],
  )
  useViewNavigation({
    containerRef: scrollAreaRef,
    selectedRaindropId,
    onNavigate: handleNavigateToRaindrop,
    onOpen: handleOpenRaindrop,
    onPreviewToggle: handleTogglePreview,
  })

  return {
    handleRaindropClick,
    handleToggleSelect,
    handleRaindropDoubleClick,
    handleOpenUrl,
  }
}
