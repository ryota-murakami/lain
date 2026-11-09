import { GripVertical, Star } from 'lucide-react'
import React from 'react'

import { FaviconIcon } from '@/components/raindrop/favicon-icon'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { getSearchHighlightState } from '@/lib/search'
import type { Raindrop, SearchScope } from '@/lib/types'
import { cn } from '@/lib/utils'
import { extractDomain } from '@/utils/favicon'
import { formatRelativeDate } from '@/utils/format-relative-date'

import {
  BookmarkItemMenu,
  type BookmarkItemActions,
} from './bookmark-item-menu'
import { ContentTypeIcon } from './content-type-icon'
import { SearchHighlight } from './search-highlight'

/**
 * Props for the RaindropListItem component.
 */
interface RaindropListItemProps {
  actions: BookmarkItemActions
  /** The raindrop (bookmark) data to display */
  raindrop: Raindrop
  /** Whether this row is currently selected */
  isSelected: boolean
  /** Click handler with mouse event for modifier key detection */
  onClick: (event: React.MouseEvent) => void
  /** Toggle this item's selection state (used by checkbox) */
  onToggleSelect: () => void
  /** Double-click handler to open the URL externally */
  onDoubleClick: () => void
  /** Current query used for field highlighting */
  searchQuery?: string
  /** Active field scope used for field highlighting */
  searchScope?: SearchScope
}

/**
 * List row view for a single raindrop bookmark.
 * Shows type icon (or checkbox on hover), favicon thumbnail,
 * title, domain, excerpt, tags, date, and important indicator.
 * Supports selection, hover actions, and context menu.
 *
 * @param raindrop - Bookmark data including title, URL, type, tags, etc.
 * @param isSelected - Whether this row has active selection styling
 * @param onClick - Handles click with support for multi-select modifiers
 * @param onDoubleClick - Opens the bookmark URL in the external browser
 *
 * @example
 *   <RaindropListItem
 *     raindrop={bookmark}
 *     isSelected={selectedId === bookmark.id}
 *     onClick={(e) => handleClick(bookmark, e)}
 *     onDoubleClick={() => openExternal(bookmark.url)}
 *   />
 */
const RaindropListItem = React.memo(function RaindropListItem({
  actions,
  raindrop,
  isSelected,
  onClick,
  onToggleSelect,
  onDoubleClick,
  searchQuery,
  searchScope = 'all',
}: RaindropListItemProps) {
  const handleCheckboxWrapperClick = (e: React.MouseEvent): void =>
    e.stopPropagation()

  const visibleTags = raindrop.tags.slice(0, 3)
  const remainingTagCount = raindrop.tags.length - 3
  const {
    normalizedSearchQuery,
    shouldHighlightTitle,
    shouldHighlightUrl,
    shouldHighlightDescription,
  } = getSearchHighlightState(searchQuery, searchScope)
  const domainText =
    raindrop.domain || extractDomain(raindrop.url) || raindrop.url

  return (
    <div
      data-raindrop-id={raindrop.id}
      tabIndex={-1}
      className={cn(
        'group flex h-16 cursor-pointer items-center gap-3 px-4 transition-colors duration-150',
        'hover:bg-accent/50 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
        isSelected && 'bg-accent',
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Drag affordance — the whole row is the drag source (see DraggableRaindrop) */}
      <GripVertical
        aria-hidden
        className="text-muted-foreground h-4 w-4 flex-shrink-0 cursor-grab opacity-0 transition-opacity group-hover:opacity-100"
      />

      {/* The mounted checkbox keeps pointer and keyboard activation stable during hover. */}
      <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        <ContentTypeIcon
          type={raindrop.type}
          className={cn(
            'text-muted-foreground h-4 w-4 group-hover:opacity-0',
            isSelected && 'opacity-0',
          )}
        />
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 focus-within:opacity-100',
            isSelected && 'opacity-100',
          )}
          onClick={handleCheckboxWrapperClick}
          onPointerDown={handleCheckboxWrapperClick}
        >
          <Checkbox
            aria-label={`Select ${raindrop.title}`}
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="h-4 w-4"
          />
        </div>
      </div>

      {/* Favicon Thumbnail */}
      <FaviconIcon
        url={raindrop.url}
        type={raindrop.type}
        size={32}
        className="flex-shrink-0"
        data-testid={`favicon-${raindrop.id}`}
      />

      {/* Title + Domain + Description */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-medium">
            <SearchHighlight
              enabled={shouldHighlightTitle}
              text={raindrop.title}
              query={normalizedSearchQuery}
            />
          </h3>
          {raindrop.isImportant && (
            <Star
              data-testid="important-indicator"
              className="h-3 w-3 flex-shrink-0 fill-yellow-400 text-yellow-400"
            />
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground truncate text-xs">
            <SearchHighlight
              enabled={shouldHighlightUrl}
              text={domainText}
              query={normalizedSearchQuery}
            />
          </span>
          {raindrop.description && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground flex-1 truncate text-xs">
                <SearchHighlight
                  enabled={shouldHighlightDescription}
                  text={raindrop.description}
                  query={normalizedSearchQuery}
                />
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="flex max-w-[200px] flex-shrink-0 items-center gap-1">
        {visibleTags.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="h-4 max-w-[70px] truncate px-1.5 py-0 text-[10px]"
          >
            {tag}
          </Badge>
        ))}
        {remainingTagCount > 0 && (
          <span className="text-muted-foreground text-[10px]">
            +{remainingTagCount}
          </span>
        )}
      </div>

      {/* Date */}
      <span className="text-muted-foreground w-16 flex-shrink-0 text-right text-xs tabular-nums">
        {formatRelativeDate(raindrop.createdAt)}
      </span>

      {/* More Menu */}
      <div
        className={cn(
          'shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100',
        )}
      >
        <BookmarkItemMenu
          raindrop={raindrop}
          actions={actions}
          variant="list"
        />
      </div>
    </div>
  )
})
export { RaindropListItem }
