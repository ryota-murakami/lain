import { Search, X, ChevronRight } from 'lucide-react'
import React, { useState, useMemo, useCallback } from 'react'

import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { fuzzySearchByName } from '@/lib/search'
import { flattenSearchableCollections } from '@/lib/searchable-collections'
import type { Group } from '@/lib/types'
import { cn } from '@/lib/utils'

import { IndexedSearchHighlight } from './indexed-search-highlight'

/**
 * Props for the CollectionSearch component.
 */
interface CollectionSearchProps {
  /** Available groups containing collections to search */
  groups: Group[]
  /** Callback when a collection is selected from results */
  onSelect: (collectionId: string) => void
  /** Callback to close the search overlay */
  onClose: () => void
}

/**
 * Fuzzy search input for filtering collections in the sidebar.
 * Flattens all nested collections and shows matching results
 * with highlighted text and full path breadcrumbs.
 *
 * @param groups - All groups with their collection trees
 * @param onSelect - Fires when user clicks a matched collection
 * @param onClose - Fires when user dismisses the search (Escape or X)
 *
 * @example
 *   <CollectionSearch
 *     groups={groups}
 *     onSelect={(id) => {
 *       setSelectedCollection(id)
 *       setIsSearchOpen(false)
 *     }}
 *     onClose={() => setIsSearchOpen(false)}
 *   />
 */
const CollectionSearch = React.memo(function CollectionSearch({
  groups,
  onSelect,
  onClose,
}: CollectionSearchProps) {
  const [query, setQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(0)

  const allCollections = useMemo(
    () => flattenSearchableCollections(groups),
    [groups],
  )

  /**
   * Filter collections by fuzzy matching on name.
   */
  const filteredCollections = useMemo(() => {
    return fuzzySearchByName(allCollections, query)
  }, [allCollections, query])

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value)
      setFocusedIndex(0)
    },
    [],
  )

  /**
   * Handle keyboard navigation within search results.
   * @param e - Keyboard event
   */
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    const maxIndex = filteredCollections.length - 1

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (maxIndex < 0) return
        setFocusedIndex((prev) => Math.min(prev + 1, maxIndex))
        break
      case 'ArrowUp':
        e.preventDefault()
        if (maxIndex < 0) return
        setFocusedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCollections[focusedIndex]) {
          onSelect(filteredCollections[focusedIndex].item.id)
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }

  return (
    <div
      data-testid="collection-search"
      className="space-y-1"
      onKeyDown={handleKeyDown}
    >
      {/* Search Input */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
        <Input
          autoFocus
          placeholder="Find collection..."
          value={query}
          onChange={handleQueryChange}
          className="h-7 pr-7 pl-7 text-xs"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close collection search"
          className="hover:bg-accent absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5"
        >
          <X className="text-muted-foreground h-3 w-3" />
        </button>
      </div>

      {/* Results */}
      <div className="bg-popover rounded-md border shadow-md">
        {filteredCollections.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <p className="text-muted-foreground text-xs">
              {query.trim()
                ? `No collections matching "${query}"`
                : 'No collections available'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[240px]">
            <div className="p-1">
              {filteredCollections.map((result, index) => {
                const col = result.item
                return (
                  <button
                    key={col.id}
                    type="button"
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                      index === focusedIndex
                        ? 'bg-accent'
                        : 'hover:bg-accent/50',
                    )}
                    onClick={() => onSelect(col.id)}
                    onMouseEnter={() => setFocusedIndex(index)}
                  >
                    {/* Color dot */}
                    <div
                      className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-sm"
                      style={{ backgroundColor: col.color || '#8b5cf6' }}
                    />

                    <div className="min-w-0 flex-1">
                      {/* Collection name with highlight */}
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium">
                          <IndexedSearchHighlight
                            text={col.name}
                            indices={result.indices}
                          />
                        </span>
                        <span className="text-muted-foreground flex-shrink-0 text-[10px] tabular-nums">
                          {col.count}
                        </span>
                      </div>

                      {/* Path breadcrumb */}
                      <div className="mt-0.5 flex items-center gap-0.5">
                        <span className="text-muted-foreground text-[10px]">
                          {col.groupName}
                        </span>
                        {col.path.length > 1 && (
                          <>
                            <ChevronRight className="text-muted-foreground h-2 w-2" />
                            <span className="text-muted-foreground truncate text-[10px]">
                              {col.path.slice(0, -1).join(' / ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
})
export { CollectionSearch }
