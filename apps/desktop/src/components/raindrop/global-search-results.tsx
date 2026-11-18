import { ArrowRight, Clock } from 'lucide-react'
import React, { useCallback } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { getSearchHighlightState } from '@/lib/search'
import type { Raindrop, SearchScope } from '@/lib/types'

import { ContentTypeIcon } from './content-type-icon'
import { FaviconIcon } from './favicon-icon'
import { SearchHighlight } from './search-highlight'

/**
 * A single recent search item extracted for useCallback.
 */
const RecentSearchItem = React.memo(function RecentSearchItem({
  query,
  onSelect,
}: {
  query: string
  onSelect: (query: string) => void
}) {
  const handleSelect = useCallback(() => onSelect(query), [onSelect, query])
  return (
    <CommandItem value={query} onSelect={handleSelect} className="gap-2">
      <Clock className="text-muted-foreground h-4 w-4" />
      <span>{query}</span>
    </CommandItem>
  )
})

/**
 * A single search result item extracted for useCallback.
 */
const SearchResultItem = React.memo(function SearchResultItem({
  raindrop,
  onSelect,
  searchQuery,
  searchScope,
}: {
  raindrop: Raindrop
  onSelect: (raindrop: Raindrop) => void
  searchQuery: string
  searchScope: SearchScope
}) {
  const handleSelect = useCallback(
    () => onSelect(raindrop),
    [onSelect, raindrop],
  )
  const {
    normalizedSearchQuery,
    shouldHighlightTitle,
    shouldHighlightUrl,
    shouldHighlightDescription,
  } = getSearchHighlightState(searchQuery, searchScope)
  const descriptionText = raindrop.description ?? raindrop.notes ?? ''
  const domainText = raindrop.domain || raindrop.url
  return (
    <CommandItem
      value={raindrop.id}
      onSelect={handleSelect}
      className="gap-3 py-2.5"
    >
      <FaviconIcon
        url={raindrop.url}
        type={raindrop.type}
        size={20}
        className="flex-shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            <SearchHighlight
              enabled={shouldHighlightTitle}
              text={raindrop.title}
              query={normalizedSearchQuery}
            />
          </span>
          {raindrop.isImportant && (
            <span className="flex-shrink-0 text-amber-500">★</span>
          )}
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <ContentTypeIcon
            type={raindrop.type}
            className="h-3 w-3 flex-shrink-0"
          />
          <span className="truncate">
            <SearchHighlight
              enabled={shouldHighlightUrl}
              text={domainText}
              query={normalizedSearchQuery}
            />
          </span>
        </div>
        {descriptionText && shouldHighlightDescription && (
          <div className="text-muted-foreground truncate text-xs">
            {
              <SearchHighlight
                text={descriptionText}
                query={normalizedSearchQuery}
              />
            }
          </div>
        )}
        {raindrop.tags.length > 0 && (
          <div className="mt-0.5 flex items-center gap-1">
            {raindrop.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="h-4 px-1.5 text-[10px]"
              >
                {tag}
              </Badge>
            ))}
            {raindrop.tags.length > 3 && (
              <span className="text-muted-foreground text-[10px]">
                +{raindrop.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
      <ArrowRight className="text-muted-foreground h-4 w-4 flex-shrink-0" />
    </CommandItem>
  )
})

/**
 * Render all loaded search matches and expose explicit pagination without truncating results.
 * Called by the command palette; recent queries appear only when the input is empty.
 * @example
 * <SearchResultsList {...props} />
 */
export const SearchResultsList = React.memo(function SearchResultsList({
  searchQuery,
  searchScope,
  searchResults,
  recentSearches,
  totalCount,
  hasMore,
  isFetching,
  onLoadMore,
  onSelect,
  onRecentSelect,
  onClearRecent,
}: {
  searchQuery: string
  searchScope: SearchScope
  searchResults: Raindrop[]
  recentSearches: string[]
  totalCount?: number
  hasMore?: boolean
  isFetching?: boolean
  onLoadMore?: () => void
  onSelect: (raindrop: Raindrop) => void
  onRecentSelect: (query: string) => void
  onClearRecent: () => void
}) {
  return (
    <CommandList className="max-h-[400px]">
      <CommandEmpty>
        {searchQuery ? 'No bookmarks found.' : 'Start typing to search...'}
      </CommandEmpty>

      {/* Recent searches — shown when query is empty */}
      {!searchQuery && recentSearches.length > 0 && (
        <>
          <div className="flex justify-end px-3 py-1">
            <button
              type="button"
              aria-label="Clear recent searches"
              className="text-muted-foreground hover:text-foreground text-xs"
              onClick={onClearRecent}
            >
              Clear
            </button>
          </div>
          <CommandGroup heading="Recent Searches">
            {recentSearches.map((query) => (
              <RecentSearchItem
                key={query}
                query={query}
                onSelect={onRecentSelect}
              />
            ))}
          </CommandGroup>
        </>
      )}

      {/* Search results */}
      {searchQuery && searchResults.length > 0 && (
        <>
          <CommandSeparator />
          <CommandGroup
            heading={`Results (${searchResults.length} loaded${totalCount !== undefined ? ` of ${totalCount}` : ''})`}
          >
            {searchResults.map((raindrop) => (
              <SearchResultItem
                key={raindrop.id}
                raindrop={raindrop}
                onSelect={onSelect}
                searchQuery={searchQuery}
                searchScope={searchScope}
              />
            ))}
          </CommandGroup>
        </>
      )}
      {searchQuery && hasMore && (
        <CommandItem
          value="load-more-bookmarks"
          disabled={isFetching}
          onSelect={onLoadMore}
        >
          {isFetching ? 'Loading more results…' : 'Load more results'}
        </CommandItem>
      )}
    </CommandList>
  )
})
