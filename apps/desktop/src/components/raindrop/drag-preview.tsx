import { Bookmark } from 'lucide-react'
import React from 'react'

import type { Collection, Raindrop } from '@/lib/types'

/**
 * Props for the drag overlay preview.
 */
interface DragPreviewProps {
  /** Active collection being dragged. */
  collection?: Collection
  /** Active bookmark being dragged (takes precedence over `collection`). */
  raindrop?: Raindrop
  /** Bookmarks travelling with the dragged one when it is part of a multi-selection. */
  count?: number
}

/**
 * Floating drag preview shown by `DragOverlay` for a collection or a bookmark.
 * @param collection - Currently dragged root collection
 * @param raindrop - Currently dragged bookmark
 * @param count - Bookmarks in the drag; a badge appears above one
 * @returns Overlay content or null when no active drag exists
 * @example
 *   <DragPreview collection={activeCollection} />
 *   <DragPreview raindrop={activeRaindrop} count={selectedIds.size} />
 */
const DragPreview = React.memo(function DragPreview({
  collection,
  raindrop,
  count = 1,
}: DragPreviewProps) {
  if (raindrop) {
    return (
      <div
        data-testid="drag-preview"
        className="bg-popover text-popover-foreground flex max-w-72 min-w-44 items-center gap-2 rounded-md border px-3 py-2 shadow-lg"
      >
        <Bookmark className="text-muted-foreground h-4 w-4 flex-shrink-0" />
        <span className="truncate text-sm font-medium">{raindrop.title}</span>
        {count > 1 && (
          <span
            data-testid="drag-preview-count"
            className="bg-primary text-primary-foreground ml-auto rounded-full px-1.5 text-xs tabular-nums"
          >
            {count}
          </span>
        )}
      </div>
    )
  }

  if (!collection) return null

  return (
    <div
      data-testid="drag-preview"
      className="bg-popover text-popover-foreground flex min-w-44 items-center gap-2 rounded-md border px-3 py-2 shadow-lg"
    >
      <div
        className="h-3 w-3 flex-shrink-0 rounded-sm"
        style={{ backgroundColor: collection.color || '#8b5cf6' }}
      />
      <span className="truncate text-sm font-medium">{collection.name}</span>
    </div>
  )
})

export { DragPreview }
export default DragPreview
