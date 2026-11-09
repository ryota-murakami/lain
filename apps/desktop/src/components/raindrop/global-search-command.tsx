import React, { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Command } from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCommandSearch } from '@/hooks/useCommandSearch'
import { filterByScope } from '@/lib/search'
import type { Collection, Raindrop } from '@/lib/types'
import { findCollectionInTree } from '@/utils/find-collection-in-tree'

import { GlobalSearchControls } from './global-search-controls'
import { SearchResultsList } from './global-search-results'

/**
 * Props for the GlobalSearchCommand component.
 */
interface GlobalSearchCommandProps {
  /** All available raindrops to search through */
  raindrops: Raindrop[]
  /** Whether the command palette is open */
  open: boolean
  /** Callback to toggle the palette */
  onOpenChange: (open: boolean) => void
  /** Callback when a raindrop result is selected */
  onSelectRaindrop?: (raindrop: Raindrop) => void
  totalCount?: number
  hasMore?: boolean
  isFetching?: boolean
  onLoadMore?: () => void
  /** Available collections for context */
  collections?: Collection[]
  /** Currently active collection ID (for scope display) */
  currentCollectionId?: string
}

/**
 * Show palette keyboard hints and the active collection scope after the result list.
 * @example
 * <SearchFooter isScopedSearch currentCollectionName="Reading" />
 */
const SearchFooter = React.memo(function SearchFooter({
  currentCollectionName,
  isScopedSearch,
}: {
  currentCollectionName?: string
  isScopedSearch: boolean
}) {
  return (
    <>
      {' '}
      {/* Footer */}
      <div className="text-muted-foreground flex items-center justify-between border-t px-3 py-2 text-xs">
        <div className="flex items-center gap-3">
          <span>
            <kbd className="bg-muted rounded border px-1 py-0.5 font-mono text-[10px]">
              ↑↓
            </kbd>{' '}
            Navigate
          </span>
          <span>
            <kbd className="bg-muted rounded border px-1 py-0.5 font-mono text-[10px]">
              ↵
            </kbd>{' '}
            Select
          </span>
          <span>
            <kbd className="bg-muted rounded border px-1 py-0.5 font-mono text-[10px]">
              Esc
            </kbd>{' '}
            Close
          </span>
        </div>
        {currentCollectionName && isScopedSearch && (
          <span className="flex items-center gap-1">
            Searching in:{' '}
            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
              {currentCollectionName}
            </Badge>
          </span>
        )}
      </div>
    </>
  )
})

/**
 * Global search command palette triggered by Cmd+K.
 * Searches across all raindrops with scope filtering and recent searches.
 *
 * @param raindrops - All available raindrops to search
 * @param open - Whether the palette is visible
 * @param onOpenChange - Callback when visibility changes
 * @param onSelectRaindrop - Callback when a search result is selected
 * @param collections - Available collections for context
 * @param currentCollectionId - Currently active collection ID for scope indicator
 *
 * @example
 *   <GlobalSearchCommand
 *     raindrops={allRaindrops}
 *     open={isSearchOpen}
 *     onOpenChange={setIsSearchOpen}
 *     onSelectRaindrop={(rd) => handleSelect(rd)}
 *     currentCollectionId="dev-react"
 *   />
 */
const GlobalSearchCommand = React.memo(function GlobalSearchCommand({
  raindrops,
  open,
  onOpenChange,
  onSelectRaindrop,
  totalCount,
  hasMore,
  isFetching,
  onLoadMore,
  collections,
  currentCollectionId,
}: GlobalSearchCommandProps) {
  const {
    searchQuery,
    searchScope,
    recentSearches,
    canToggleGlobalSearch,
    isScopedSearch,
    handleCommandQueryChange,
    toggleSearchMode,
    handleSelect,
    handleRecentSearchClick,
    handleClearQuery,
    handleClearRecent,
    handleScopeChange,
  } = useCommandSearch({ currentCollectionId, onOpenChange, onSelectRaindrop })

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    return filterByScope(raindrops, searchQuery, searchScope)
  }, [raindrops, searchQuery, searchScope])

  const currentCollectionName = useMemo(() => {
    if (!currentCollectionId || !collections) return undefined
    return findCollectionInTree(collections, currentCollectionId)?.name
  }, [currentCollectionId, collections])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Search bookmarks</DialogTitle>
          <DialogDescription>
            Search across all your bookmarks by title, URL, description, or
            tags.
          </DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false} className="rounded-lg border-0">
          <GlobalSearchControls
            searchQuery={searchQuery}
            searchScope={searchScope}
            isScopedSearch={isScopedSearch}
            currentCollectionName={currentCollectionName}
            canToggleGlobalSearch={canToggleGlobalSearch}
            onQueryChange={handleCommandQueryChange}
            onClearQuery={handleClearQuery}
            onScopeChange={handleScopeChange}
            onToggleMode={toggleSearchMode}
          />

          <SearchResultsList
            searchQuery={searchQuery}
            searchScope={searchScope}
            searchResults={searchResults}
            recentSearches={recentSearches}
            totalCount={totalCount}
            hasMore={hasMore}
            isFetching={isFetching}
            onLoadMore={onLoadMore}
            onSelect={handleSelect}
            onRecentSelect={handleRecentSearchClick}
            onClearRecent={handleClearRecent}
          />

          <SearchFooter
            currentCollectionName={currentCollectionName}
            isScopedSearch={isScopedSearch}
          />
        </Command>
      </DialogContent>
    </Dialog>
  )
})
export { GlobalSearchCommand }
