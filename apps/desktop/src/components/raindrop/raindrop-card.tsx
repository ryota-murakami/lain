import { Star } from 'lucide-react'
import React, { useCallback } from 'react'

import { FaviconIcon } from '@/components/raindrop/favicon-icon'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { getSearchHighlightState } from '@/lib/search'
import type { ContentType, Raindrop, SearchScope } from '@/lib/types'
import { cn } from '@/lib/utils'
import { extractDomain, getDomainColor } from '@/utils/favicon'
import { formatRelativeDate } from '@/utils/format-relative-date'

import {
  BookmarkItemMenu,
  type BookmarkItemActions,
} from './bookmark-item-menu'
import { SearchHighlight } from './search-highlight'

/**
 * Map content type to a display label.
 * @param type - The content type
 * @returns Human-readable type label
 * @example getTypeLabel("article") // => "Article"
 */
function getTypeLabel(type: ContentType): string {
  const map: Record<ContentType, string> = {
    link: 'Link',
    article: 'Article',
    image: 'Image',
    video: 'Video',
    document: 'Document',
    audio: 'Audio',
  }
  return map[type] || 'Link'
}

/**
 * Props for the RaindropCard component.
 */
interface RaindropCardProps {
  onToggleSelect: () => void
  actions: BookmarkItemActions
  /** The raindrop (bookmark) data to display */
  raindrop: Raindrop
  /** Whether this card is currently selected */
  isSelected: boolean
  /** Click handler with mouse event for modifier key detection */
  onClick: (event: React.MouseEvent) => void
  /** Double-click handler to open the URL externally */
  onDoubleClick: () => void
  /** Current query used for field highlighting */
  searchQuery?: string
  /** Active field scope used for field highlighting */
  searchScope?: SearchScope
}

/**
 * Grid card view for a single raindrop bookmark.
 * Shows cover image (or gradient placeholder), favicon, type badge,
 * title, domain, tags, and date. Supports selection, hover actions,
 * and context menu.
 *
 * @param raindrop - Bookmark data including title, URL, type, tags, etc.
 * @param isSelected - Whether this card has active selection styling
 * @param onClick - Handles click with support for multi-select modifiers
 * @param onDoubleClick - Opens the bookmark URL in the external browser
 *
 * @example
 *   <RaindropCard
 *     raindrop={bookmark}
 *     isSelected={selectedId === bookmark.id}
 *     onClick={(e) => handleClick(bookmark, e)}
 *     onDoubleClick={() => openExternal(bookmark.url)}
 *   />
 */
/**
 * Display a bookmark's cover and keep selection/menu controls independent of row dragging.
 * Called by {@link RaindropCard}; the menu stays mounted while its portal has focus.
 * @example
 * <BookmarkCardCover {...props} />
 */
const BookmarkCardCover = React.memo(function BookmarkCardCover({
  raindrop,
  actions,
  isSelected,
  onToggleSelect,
}: Pick<
  RaindropCardProps,
  'raindrop' | 'actions' | 'isSelected' | 'onToggleSelect'
>) {
  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => e.stopPropagation(),
    [],
  )
  const domainColor = getDomainColor(raindrop.domain || '')
  return (
    <>
      {/* Cover Image / Placeholder */}
      <div className="bg-muted relative aspect-video overflow-hidden">
        {raindrop.coverImage ? (
          <img
            src={raindrop.coverImage}
            alt={raindrop.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, ${domainColor} 0%, oklch(0.4 0.15 280) 100%)`,
            }}
          />
        )}

        {/* Favicon overlay on cover */}
        <div className="absolute bottom-2 left-2">
          <FaviconIcon
            url={raindrop.url}
            type={raindrop.type}
            size={24}
            className="shadow-sm ring-1 ring-black/10"
            data-testid={`favicon-${raindrop.id}`}
          />
        </div>

        {/* Type badge */}
        <Badge
          variant="secondary"
          className="bg-background/80 absolute top-2 right-2 h-5 px-1.5 py-0 text-[10px] backdrop-blur-sm"
        >
          {getTypeLabel(raindrop.type)}
        </Badge>

        {/* Important indicator */}
        {raindrop.isImportant && (
          <div className="absolute top-2 left-2">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 drop-shadow" />
          </div>
        )}

        {/* Keep selection controls mounted as hover/focus moves between cover and checkbox. */}
        <div
          className={cn(
            'absolute top-2 left-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100',
            isSelected && 'opacity-100',
          )}
        >
          <Checkbox
            aria-label={`Select ${raindrop.title}`}
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            onClick={handleCheckboxClick}
            onPointerDown={handleCheckboxClick}
            className="bg-background/80 backdrop-blur-sm"
          />
        </div>

        {/* Keep the menu mounted while the pointer enters its portaled content. */}
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <BookmarkItemMenu
            raindrop={raindrop}
            actions={actions}
            variant="grid"
          />
        </div>
      </div>
    </>
  )
})

const RaindropCard = React.memo(function RaindropCard({
  onToggleSelect,
  actions,
  raindrop,
  isSelected,
  onClick,
  onDoubleClick,
  searchQuery,
  searchScope = 'all',
}: RaindropCardProps) {
  const visibleTags = raindrop.tags.slice(0, 2)
  const remainingTagCount = raindrop.tags.length - 2
  const {
    normalizedSearchQuery,
    shouldHighlightTitle,
    shouldHighlightUrl,
    shouldHighlightDescription,
  } = getSearchHighlightState(searchQuery, searchScope)
  const descriptionText = raindrop.description ?? raindrop.notes ?? ''
  const domainText =
    raindrop.domain || extractDomain(raindrop.url) || raindrop.url

  return (
    <Card
      data-raindrop-id={raindrop.id}
      tabIndex={-1}
      className={cn(
        'group relative cursor-pointer overflow-hidden transition-all duration-150',
        'focus-visible:ring-primary hover:scale-[1.01] hover:shadow-md focus-visible:ring-2 focus-visible:outline-none',
        isSelected && 'ring-primary shadow-md ring-2',
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <BookmarkCardCover
        raindrop={raindrop}
        actions={actions}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      />

      {/* Card Content */}
      <CardContent className="space-y-1.5 p-3">
        {/* Title */}
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">
          <SearchHighlight
            enabled={shouldHighlightTitle}
            text={raindrop.title}
            query={normalizedSearchQuery}
          />
        </h3>

        {/* Domain */}
        <p className="text-muted-foreground truncate text-xs">
          <SearchHighlight
            enabled={shouldHighlightUrl}
            text={domainText}
            query={normalizedSearchQuery}
          />
        </p>
        {descriptionText && shouldHighlightDescription && (
          <p className="text-muted-foreground line-clamp-2 text-xs">
            {
              <SearchHighlight
                text={descriptionText}
                query={normalizedSearchQuery}
              />
            }
          </p>
        )}

        {/* Tags + Date row */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {visibleTags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="h-4 max-w-[80px] truncate px-1.5 py-0 text-[10px]"
              >
                {tag}
              </Badge>
            ))}
            {remainingTagCount > 0 && (
              <span className="text-muted-foreground flex-shrink-0 text-[10px]">
                +{remainingTagCount}
              </span>
            )}
          </div>

          <span className="text-muted-foreground flex-shrink-0 text-[10px] tabular-nums">
            {formatRelativeDate(raindrop.createdAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
})
export { RaindropCard }
