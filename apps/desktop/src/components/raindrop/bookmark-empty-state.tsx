import { BookmarkPlus, Plus } from 'lucide-react'
import React from 'react'

import { Button } from '@/components/ui/button'

/**
 * Offer the next useful action when the current bookmark scope has no visible results.
 * MainContent uses this after initial loading has finished.
 * @example
 * <BookmarkEmptyState {...props} />
 */
export const BookmarkEmptyState = React.memo(function BookmarkEmptyState({
  searchQuery,
  isScopedSearch,
  currentCollectionName,
  handleSearchGlobally,
  clearSearch,
  onAddBookmark,
}: {
  searchQuery: string
  isScopedSearch: boolean
  currentCollectionName: string
  handleSearchGlobally: () => void
  clearSearch: () => void
  onAddBookmark: () => void
}) {
  const showScopedEmptyStateAction = Boolean(searchQuery) && isScopedSearch
  const emptyStateDescription = searchQuery
    ? showScopedEmptyStateAction
      ? `No results in ${currentCollectionName}. Try searching everywhere or adjust your filters.`
      : `No results for "${searchQuery}". Try a different search term or clear filters.`
    : 'This collection is empty. Add your first bookmark to get started.'

  return (
    /* Empty State */
    <div className="flex flex-col items-center justify-center px-4 py-20">
      <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
        <BookmarkPlus className="text-muted-foreground h-8 w-8" />
      </div>
      <h3 className="mb-1 text-lg font-semibold">No bookmarks found</h3>
      <p className="text-muted-foreground mb-4 max-w-sm text-center text-sm">
        {emptyStateDescription}
      </p>
      {searchQuery ? (
        showScopedEmptyStateAction ? (
          <Button variant="outline" size="sm" onClick={handleSearchGlobally}>
            Search everywhere
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={clearSearch}>
            Clear Search
          </Button>
        )
      ) : (
        <Button size="sm" onClick={onAddBookmark}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Bookmark
        </Button>
      )}
    </div>
  )
})
