import { Check, ChevronsUpDown, Folder } from 'lucide-react'
import React, { useState, useMemo, useCallback } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { fuzzySearchByName } from '@/lib/search'
import { flattenSearchableCollections } from '@/lib/searchable-collections'
import type { Group } from '@/lib/types'
import { cn } from '@/lib/utils'

import { CollectionSelectorResults } from './collection-selector-results'

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

  const flatCollections = useMemo(
    () => flattenSearchableCollections(groups),
    [groups],
  )
  const selectedCollection = flatCollections.find(
    (collection) => collection.id === value,
  )
  const hasSearchQuery = searchQuery.trim().length > 0
  const fuzzyCollections = useMemo(() => {
    if (!hasSearchQuery) return []
    return fuzzySearchByName(flatCollections, searchQuery)
  }, [flatCollections, hasSearchQuery, searchQuery])

  const handleSelect = useCallback(
    (collectionId: string) => {
      onChange(collectionId)
      setOpen(false)
      setSearchQuery('')
    },
    [onChange],
  )
  const handleNone = (): void => handleSelect('')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label={allowNone ? 'Parent Collection' : 'Collection'}
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
      {/* Reserve an edge margin because floating-position rounding can otherwise overflow by half a pixel. */}
      <PopoverContent
        className="w-[300px] gap-0 p-0"
        align="start"
        collisionPadding={8}
      >
        <div className="p-2">
          <Input
            placeholder="Search collections..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="h-8"
          />
        </div>
        {/* Give the viewport a concrete height after reserving the 48px search field. */}
        <ScrollArea className="h-[clamp(0px,calc(var(--radix-popover-content-available-height)-3rem),300px)]">
          <div className="p-1">
            {allowNone && (
              <button
                type="button"
                className={cn(
                  'hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                  !value && 'bg-accent',
                )}
                onClick={handleNone}
              >
                <Folder className="text-muted-foreground h-4 w-4" />
                <span>None (root level)</span>
                {!value && <Check className="text-primary ml-auto h-4 w-4" />}
              </button>
            )}
            <CollectionSelectorResults
              groups={groups}
              query={searchQuery}
              results={fuzzyCollections}
              value={value}
              onSelect={handleSelect}
            />
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
})
export { CollectionSelector }
