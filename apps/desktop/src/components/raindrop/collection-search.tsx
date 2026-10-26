import { Search, X, ChevronRight } from 'lucide-react'
import React, { useState, useMemo, useCallback } from 'react'

import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { buildIndexedHighlightSegments, fuzzySearchByName } from '@/lib/search'
import type { Group, Collection } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Flattened collection entry with its full parent path and group info.
 */
interface FlatCollection {
  /** Collection ID */
  id: string
  /** Collection display name */
  name: string
  /** Collection color dot */
  color?: string
  /** Bookmark count */
  count: number
  /** Full breadcrumb path, e.g. ["Work", "Design Resources", "UI Inspiration"] */
  path: string[]
  /** Parent group name */
  groupName: string
}

/**
 * Fuzzy search result for flattened collections.
 */
interface FlatCollectionSearchResult {
  item: FlatCollection
  indices: [number, number][]
}

/**
 * Flatten all collections from groups into a searchable list with full paths.
 * @param groups - Array of groups containing nested collections
 * @returns Flat array of collections with path and group metadata
 * @example
 *   flattenCollections(groups)
 *   // => [{ id: "design-ui", name: "UI Inspiration", path: ["Design Resources", "UI Inspiration"], ... }]
 */
function flattenCollections(groups: Group[]): FlatCollection[] {
  const result: FlatCollection[] = []

  const walk = (
    collections: Collection[],
    groupName: string,
    parentPath: string[],
  ) => {
    for (const col of collections) {
      const currentPath = [...parentPath, col.name]
      result.push({
        id: col.id,
        name: col.name,
        color: col.color,
        count: col.count,
        path: currentPath,
        groupName,
      })
      if (col.children) {
        walk(col.children, groupName, currentPath)
      }
    }
  }

  for (const group of groups) {
    walk(group.collections, group.name, [])
  }

  return result
}

/**
 * Highlight matching characters from Fuse.js index ranges.
 * @param text - The original text
 * @param indices - Inclusive [start, end] ranges from Fuse.js
 * @returns JSX with matched portions wrapped in <strong>
 */
function highlightMatch(
  text: string,
  indices: [number, number][],
): React.ReactNode {
  return (
    <>
      {buildIndexedHighlightSegments(text, indices).map((segment, index) =>
        segment.matched ? (
          <strong
            key={`${segment.text}-${index}`}
            className="text-primary font-semibold"
          >
            {segment.text}
          </strong>
        ) : (
          <React.Fragment key={`${segment.text}-${index}`}>
            {segment.text}
          </React.Fragment>
        ),
      )}
    </>
  )
}

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

  const allCollections = useMemo(() => flattenCollections(groups), [groups])

  /**
   * Filter collections by fuzzy matching on name.
   */
  const filteredCollections = useMemo(() => {
    return fuzzySearchByName(allCollections, query).map(
      (result): FlatCollectionSearchResult => ({
        item: result.item,
        indices: result.indices,
      }),
    )
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
  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    <div className="space-y-1" onKeyDown={handleKeyDown}>
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
          <ScrollArea className="max-h-[240px]">
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
                          {highlightMatch(col.name, result.indices)}
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
export default CollectionSearch
