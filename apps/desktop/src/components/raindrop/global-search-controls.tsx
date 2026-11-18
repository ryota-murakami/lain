import { Search, X } from 'lucide-react'
import React from 'react'

import { CommandInput } from '@/components/ui/command'
import type { SearchScope } from '@/lib/types'
import { cn } from '@/lib/utils'

const SEARCH_SCOPE_LABELS: Record<SearchScope, string> = {
  all: 'All Fields',
  url: 'URL Only',
  title: 'Title Only',
  description: 'Description Only',
}

/**
 * Render the command palette's query and scope choices with controlled search state.
 * Called by GlobalSearchCommand so scope changes use its Redux actions consistently.
 * @example
 * <GlobalSearchControls {...props} />
 */
export const GlobalSearchControls = React.memo(function GlobalSearchControls({
  searchQuery,
  searchScope,
  isScopedSearch,
  currentCollectionName,
  canToggleGlobalSearch,
  onQueryChange,
  onClearQuery,
  onScopeChange,
  onToggleMode,
}: {
  searchQuery: string
  searchScope: SearchScope
  isScopedSearch: boolean
  currentCollectionName?: string
  canToggleGlobalSearch: boolean
  onQueryChange: (query: string) => void
  onClearQuery: () => void
  onScopeChange: (scope: SearchScope) => void
  onToggleMode: () => void
}) {
  return (
    <>
      {' '}
      <div className="flex items-center border-b px-3">
        <Search className="text-muted-foreground mr-2 h-4 w-4 shrink-0" />
        <CommandInput
          placeholder={
            isScopedSearch && currentCollectionName
              ? `Search in ${currentCollectionName}... (⌘K)`
              : 'Search all bookmarks... (⌘K)'
          }
          value={searchQuery}
          onValueChange={onQueryChange}
          className="border-0 focus:ring-0"
        />
        {searchQuery && (
          <button
            type="button"
            className="hover:bg-muted rounded-sm p-1"
            aria-label="Clear search"
            onClick={onClearQuery}
          >
            <X className="text-muted-foreground h-4 w-4" />
          </button>
        )}
      </div>
      {/* Collection scope toggle */}
      {currentCollectionName && canToggleGlobalSearch && (
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-muted-foreground text-xs">
            {isScopedSearch
              ? `Searching in ${currentCollectionName}`
              : 'Searching everywhere'}
          </span>
          <button
            type="button"
            className="hover:bg-muted rounded-full px-2.5 py-0.5 text-xs font-medium"
            onClick={onToggleMode}
          >
            {isScopedSearch
              ? 'Search everywhere'
              : `Search in ${currentCollectionName}`}
          </button>
        </div>
      )}
      {/* Search scope selector */}
      <div className="flex items-center gap-1.5 border-b px-3 py-2">
        <span className="text-muted-foreground mr-1 text-xs">Scope:</span>
        {(Object.keys(SEARCH_SCOPE_LABELS) as SearchScope[]).map((scope) => (
          <button
            key={scope}
            type="button"
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
              searchScope === scope
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
            onClick={() => onScopeChange(scope)}
          >
            {SEARCH_SCOPE_LABELS[scope]}
          </button>
        ))}
      </div>
    </>
  )
})
