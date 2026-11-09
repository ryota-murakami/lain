import { Check, ChevronRight } from 'lucide-react'
import React from 'react'

import type { FuzzyNameSearchResult } from '@/lib/search'
import type { SearchableCollection } from '@/lib/searchable-collections'
import type { Collection, Group } from '@/lib/types'
import { cn } from '@/lib/utils'

import { IndexedSearchHighlight } from './indexed-search-highlight'

interface SelectionProps {
  value?: string
  onSelect: (id: string) => void
}

/** Render a collection and its descendants while sharing the picker's selection action. */
const CollectionTreeOption = React.memo(function CollectionTreeOption({
  collection,
  depth = 0,
  value,
  onSelect,
}: SelectionProps & { collection: Collection; depth?: number }) {
  const isSelected = value === collection.id
  const handleSelect = (): void => onSelect(collection.id)
  return (
    <div>
      <button
        type="button"
        aria-pressed={isSelected}
        className={cn(
          'hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm',
          isSelected && 'bg-accent',
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleSelect}
      >
        {Boolean(collection.children?.length) && (
          <ChevronRight className="text-muted-foreground h-3 w-3" />
        )}
        <div
          className="h-3 w-3 flex-shrink-0 rounded-sm"
          style={{ backgroundColor: collection.color || '#8b5cf6' }}
        />
        <span className="flex-1 truncate text-left">{collection.name}</span>
        <span className="text-muted-foreground text-xs">
          {collection.count}
        </span>
        {isSelected && <Check className="text-primary h-4 w-4" />}
      </button>
      {collection.children?.map((child) => (
        <CollectionTreeOption
          key={child.id}
          collection={child}
          depth={depth + 1}
          value={value}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
})

/** Present a fuzzy result with its original group/path so identically named collections remain distinguishable. */
const FuzzyCollectionOption = React.memo(function FuzzyCollectionOption({
  result,
  value,
  onSelect,
}: SelectionProps & { result: FuzzyNameSearchResult<SearchableCollection> }) {
  const collection = result.item
  const isSelected = value === collection.id
  const parentPath = collection.path.slice(0, -1).join(' / ')
  const handleSelect = (): void => onSelect(collection.id)
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      className={cn(
        'hover:bg-accent flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-sm',
        isSelected && 'bg-accent',
      )}
      onClick={handleSelect}
    >
      <div
        className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-sm"
        style={{ backgroundColor: collection.color || '#8b5cf6' }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-left font-medium">
            <IndexedSearchHighlight
              text={collection.name}
              indices={result.indices}
            />
          </span>
          <span className="text-muted-foreground flex-shrink-0 text-xs tabular-nums">
            {collection.count}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-0.5">
          <span className="text-muted-foreground text-[10px]">
            {collection.groupName}
          </span>
          {parentPath && (
            <>
              <ChevronRight className="text-muted-foreground h-2.5 w-2.5" />
              <span className="text-muted-foreground truncate text-[10px]">
                {parentPath}
              </span>
            </>
          )}
        </div>
      </div>
      {isSelected && <Check className="text-primary ml-auto h-4 w-4" />}
    </button>
  )
})

/**
 * Switch between the full hierarchy and fuzzy matches without owning picker state.
 * {@link CollectionSelector} supplies the query/results and one shared selection callback.
 * @example <CollectionSelectorResults groups={groups} query={query} results={results} onSelect={select} />
 */
export const CollectionSelectorResults = React.memo(
  function CollectionSelectorResults({
    groups,
    query,
    results,
    value,
    onSelect,
  }: SelectionProps & {
    groups: Group[]
    query: string
    results: FuzzyNameSearchResult<SearchableCollection>[]
  }) {
    // Empty query preserves the hierarchy instead of presenting a flattened search list.
    if (!query.trim())
      return groups.map((group) => (
        <div key={group.id} className="mb-1">
          <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium tracking-wider uppercase">
            {group.name}
          </div>
          {group.collections.map((collection) => (
            <CollectionTreeOption
              key={collection.id}
              collection={collection}
              value={value}
              onSelect={onSelect}
            />
          ))}
        </div>
      ))
    if (results.length === 0)
      return (
        <div className="px-2 py-4 text-center">
          <span className="text-muted-foreground text-xs">
            No collections matching "{query}"
          </span>
        </div>
      )
    return results.map((result) => (
      <FuzzyCollectionOption
        key={result.item.id}
        result={result}
        value={value}
        onSelect={onSelect}
      />
    ))
  },
)
