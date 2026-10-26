import { Check, ChevronsUpDown, ChevronRight, Folder } from 'lucide-react'
import React, { useState, useMemo, useCallback } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { buildIndexedHighlightSegments, fuzzySearchByName } from '@/lib/search'
import type { Group, Collection } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Props for CollectionSelector component.
 */
interface CollectionSelectorProps {
  /** Available groups with their collections */
  groups: Group[]
  /** Currently selected collection ID */
  value?: string
  /** Callback when selection changes */
  onChange: (collectionId: string) => void
  /** Placeholder text when nothing selected */
  placeholder?: string
  /** Whether to allow selecting "None" (root level) */
  allowNone?: boolean
}

/**
 * Flattened collection entry with full parent path and group metadata.
 */
interface FlatCollectionOption {
  id: string
  name: string
  color?: string
  count: number
  path: string[]
  groupName: string
}

/**
 * Fuzzy search result shape for flattened collections.
 */
interface FlatCollectionSearchResult {
  item: FlatCollectionOption
  indices: [number, number][]
}

/**
 * Flatten nested collection trees into searchable rows.
 * @param groups - Source groups with nested collections
 * @returns Flat collection options with path metadata
 */
function flattenCollections(groups: Group[]): FlatCollectionOption[] {
  const result: FlatCollectionOption[] = []

  const walk = (
    collections: Collection[],
    groupName: string,
    parentPath: string[],
  ) => {
    for (const collection of collections) {
      const currentPath = [...parentPath, collection.name]
      result.push({
        id: collection.id,
        name: collection.name,
        color: collection.color,
        count: collection.count,
        path: currentPath,
        groupName,
      })
      if (collection.children) {
        walk(collection.children, groupName, currentPath)
      }
    }
  }

  for (const group of groups) {
    walk(group.collections, group.name, [])
  }

  return result
}

/**
 * Render highlighted collection name from Fuse.js index matches.
 * @param name - Collection name text
 * @param indices - Inclusive [start, end] ranges from Fuse.js
 * @returns Highlighted React node
 */
function renderHighlightedName(
  name: string,
  indices: [number, number][],
): React.ReactNode {
  return buildIndexedHighlightSegments(name, indices).map((segment, index) =>
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
  )
}

/**
 * Searchable dropdown tree selector for choosing a collection.
 * Shows groups and their nested collections in a hierarchical popover.
 *
 * @param groups - Available groups containing collections
 * @param value - Currently selected collection ID
 * @param onChange - Callback when a collection is selected
 * @param placeholder - Placeholder text when no selection
 * @param allowNone - Whether to show a "None" option for root level
 *
 * @example
 *   <CollectionSelector
 *     groups={groups}
 *     value={selectedId}
 *     onChange={setSelectedId}
 *     placeholder="Select collection..."
 *   />
 */
const CollectionSelector = React.memo(function CollectionSelector({
  groups,
  value,
  onChange,
  placeholder = 'Select collection...',
  allowNone = false,
}: CollectionSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value)
    },
    [],
  )

  const selectedCollection = useMemo(() => {
    const findCollection = (
      collections: Collection[],
    ): Collection | undefined => {
      for (const col of collections) {
        if (col.id === value) return col
        if (col.children) {
          const found = findCollection(col.children)
          if (found) return found
        }
      }
      return undefined
    }

    for (const group of groups) {
      const found = findCollection(group.collections)
      if (found) return found
    }
    return undefined
  }, [groups, value])
  const flatCollections = useMemo(() => flattenCollections(groups), [groups])
  const hasSearchQuery = searchQuery.trim().length > 0
  const fuzzyCollections = useMemo(() => {
    if (!hasSearchQuery) return []
    return fuzzySearchByName(flatCollections, searchQuery).map(
      (result): FlatCollectionSearchResult => ({
        item: result.item,
        indices: result.indices,
      }),
    )
  }, [flatCollections, hasSearchQuery, searchQuery])

  const renderCollection = (collection: Collection, depth: number = 0) => {
    const isSelected = value === collection.id

    return (
      <div key={collection.id}>
        <button
          type="button"
          className={cn(
            'hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm',
            isSelected && 'bg-accent',
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => {
            onChange(collection.id)
            setOpen(false)
            setSearchQuery('')
          }}
        >
          {collection.children && collection.children.length > 0 && (
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
        {collection.children?.map((child) =>
          renderCollection(child, depth + 1),
        )}
      </div>
    )
  }
  const renderFuzzyCollection = useCallback(
    (result: FlatCollectionSearchResult) => {
      const collection = result.item
      const isSelected = value === collection.id
      const parentPath = collection.path.slice(0, -1).join(' / ')

      return (
        <button
          key={collection.id}
          type="button"
          className={cn(
            'hover:bg-accent flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-sm',
            isSelected && 'bg-accent',
          )}
          onClick={() => {
            onChange(collection.id)
            setOpen(false)
            setSearchQuery('')
          }}
        >
          <div
            className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-sm"
            style={{ backgroundColor: collection.color || '#8b5cf6' }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-left font-medium">
                {renderHighlightedName(collection.name, result.indices)}
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
    },
    [onChange, value],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedCollection ? (
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 flex-shrink-0 rounded-sm"
                style={{
                  backgroundColor: selectedCollection.color || '#8b5cf6',
                }}
              />
              <span className="truncate">{selectedCollection.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="p-2">
          <Input
            placeholder="Search collections..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="h-8"
          />
        </div>
        <ScrollArea className="max-h-[300px]">
          <div className="p-1">
            {allowNone && (
              <button
                type="button"
                className={cn(
                  'hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                  !value && 'bg-accent',
                )}
                onClick={() => {
                  onChange('')
                  setOpen(false)
                  setSearchQuery('')
                }}
              >
                <Folder className="text-muted-foreground h-4 w-4" />
                <span>None (root level)</span>
                {!value && <Check className="text-primary ml-auto h-4 w-4" />}
              </button>
            )}
            {hasSearchQuery ? (
              fuzzyCollections.length === 0 ? (
                <div className="px-2 py-4 text-center">
                  <span className="text-muted-foreground text-xs">
                    No collections matching "{searchQuery}"
                  </span>
                </div>
              ) : (
                fuzzyCollections.map((result) => renderFuzzyCollection(result))
              )
            ) : (
              groups.map((group) => (
                <div key={group.id} className="mb-1">
                  <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium tracking-wider uppercase">
                    {group.name}
                  </div>
                  {group.collections.map((col) => renderCollection(col))}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
})
export { CollectionSelector }
export default CollectionSelector
