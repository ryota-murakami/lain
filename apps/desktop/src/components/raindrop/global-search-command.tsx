import {
  Search,
  Globe,
  FileText,
  Image,
  Video,
  File,
  Music,
  Clock,
  X,
  ArrowRight,
} from 'lucide-react'
import React, { useCallback, useMemo } from 'react'

import { FaviconIcon } from '@/components/raindrop/favicon-icon'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildSubstringHighlightSegments, filterByScope } from '@/lib/search'
import type {
  Raindrop,
  Collection,
  Group,
  SearchMode,
  SearchScope,
  ContentType,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  addRecentSearch as addRecentSearchAction,
  clearRecentSearches as clearRecentSearchesAction,
  setSearchMode as setSearchModeAction,
  setSearchQuery as setSearchQueryAction,
  setSearchScope as setSearchScopeAction,
} from '@/store/slices/searchSlice'

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
  /** Callback when navigating to a collection */
  onSelectCollection?: (collectionId: string) => void
  /** Available groups for context */
  groups?: Group[]
  /** Available collections for context */
  collections?: Collection[]
  /** Currently active collection ID (for scope display) */
  currentCollectionId?: string
}

/**
 * Static map of content type to Lucide icon component.
 */
const TYPE_ICON_MAP: Record<ContentType, typeof Globe> = {
  link: Globe,
  article: FileText,
  image: Image,
  video: Video,
  document: File,
  audio: Music,
}

/**
 * Render a content type icon.
 */
const TypeIconDisplay = React.memo(function TypeIconDisplay({
  type,
  className,
}: {
  type: ContentType
  className?: string
}) {
  const Icon = TYPE_ICON_MAP[type] || Globe
  return <Icon className={className} />
})

/**
 * Render highlighted text segments for matched search content.
 * @param text - Original text to render
 * @param query - Active search query
 * @returns Text with matching segments wrapped in <mark>
 */
function renderHighlightedText(text: string, query: string): React.ReactNode {
  return buildSubstringHighlightSegments(text, query).map((segment, index) =>
    segment.matched ? (
      <mark
        key={`${segment.text}-${index}`}
        className="bg-primary/20 text-foreground rounded-sm px-0.5"
      >
        {segment.text}
      </mark>
    ) : (
      <React.Fragment key={`${segment.text}-${index}`}>
        {segment.text}
      </React.Fragment>
    ),
  )
}

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
  const normalizedSearchQuery = searchQuery.trim()
  const hasSearchQuery = normalizedSearchQuery.length > 0
  const shouldHighlightTitle =
    hasSearchQuery && (searchScope === 'all' || searchScope === 'title')
  const shouldHighlightUrl =
    hasSearchQuery && (searchScope === 'all' || searchScope === 'url')
  const shouldHighlightDescription =
    hasSearchQuery && (searchScope === 'all' || searchScope === 'description')
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
            {shouldHighlightTitle
              ? renderHighlightedText(raindrop.title, normalizedSearchQuery)
              : raindrop.title}
          </span>
          {raindrop.isImportant && (
            <span className="flex-shrink-0 text-amber-500">★</span>
          )}
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <TypeIconDisplay
            type={raindrop.type}
            className="h-3 w-3 flex-shrink-0"
          />
          <span className="truncate">
            {shouldHighlightUrl
              ? renderHighlightedText(domainText, normalizedSearchQuery)
              : domainText}
          </span>
        </div>
        {descriptionText && shouldHighlightDescription && (
          <div className="text-muted-foreground truncate text-xs">
            {renderHighlightedText(descriptionText, normalizedSearchQuery)}
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

const SEARCH_SCOPE_LABELS: Record<SearchScope, string> = {
  all: 'All Fields',
  url: 'URL Only',
  title: 'Title Only',
  description: 'Description Only',
}

/**
 * Global search command palette triggered by Cmd+K.
 * Searches across all raindrops with scope filtering and recent searches.
 *
 * @param raindrops - All available raindrops to search
 * @param open - Whether the palette is visible
 * @param onOpenChange - Callback when visibility changes
 * @param onSelectRaindrop - Callback when a search result is selected
 * @param onSelectCollection - Callback when navigating to a collection
 * @param groups - Available groups for context
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
  onSelectCollection: _onSelectCollection,
  groups: _groups,
  collections,
  currentCollectionId,
}: GlobalSearchCommandProps) {
  const dispatch = useAppDispatch()
  const searchQuery = useAppSelector((s) => s.search.query)
  const searchScope = useAppSelector((s) => s.search.scope)
  const searchMode = useAppSelector((s) => s.search.mode)
  const recentSearches = useAppSelector((s) => s.search.recentSearches)

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    return filterByScope(raindrops, searchQuery, searchScope).slice(0, 20)
  }, [raindrops, searchQuery, searchScope])

  const currentCollectionName = useMemo(() => {
    if (!currentCollectionId || !collections) return undefined
    const findName = (cols: Collection[]): string | undefined => {
      for (const col of cols) {
        if (col.id === currentCollectionId) return col.name
        if (col.children) {
          const found = findName(col.children)
          if (found) return found
        }
      }
      return undefined
    }
    return findName(collections)
  }, [currentCollectionId, collections])
  const canToggleGlobalSearch = currentCollectionId !== 'all'
  const isScopedSearch = canToggleGlobalSearch && searchMode === 'scoped'
  const handleCommandQueryChange = useCallback(
    (value: string) => {
      dispatch(setSearchQueryAction(value))
    },
    [dispatch],
  )
  const toggleSearchMode = () => {
    if (!canToggleGlobalSearch) return
    const nextMode: SearchMode = isScopedSearch ? 'global' : 'scoped'
    dispatch(setSearchModeAction(nextMode))
  }

  const handleSelect = useCallback(
    (raindrop: Raindrop) => {
      dispatch(addRecentSearchAction(searchQuery))
      onSelectRaindrop?.(raindrop)
      onOpenChange(false)
      dispatch(setSearchQueryAction(''))
    },
    [dispatch, searchQuery, onSelectRaindrop, onOpenChange],
  )

  const handleRecentSearchClick = useCallback(
    (query: string) => {
      dispatch(setSearchQueryAction(query))
    },
    [dispatch],
  )

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
          <div className="flex items-center border-b px-3">
            <Search className="text-muted-foreground mr-2 h-4 w-4 shrink-0" />
            <CommandInput
              placeholder={
                isScopedSearch && currentCollectionName
                  ? `Search in ${currentCollectionName}... (⌘K)`
                  : 'Search all bookmarks... (⌘K)'
              }
              value={searchQuery}
              onValueChange={handleCommandQueryChange}
              className="border-0 focus:ring-0"
            />
            {searchQuery && (
              <button
                type="button"
                className="hover:bg-muted rounded-sm p-1"
                onClick={() => dispatch(setSearchQueryAction(''))}
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
                onClick={toggleSearchMode}
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
            {(Object.keys(SEARCH_SCOPE_LABELS) as SearchScope[]).map(
              (scope) => (
                <button
                  key={scope}
                  type="button"
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                    searchScope === scope
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                  onClick={() => dispatch(setSearchScopeAction(scope))}
                >
                  {SEARCH_SCOPE_LABELS[scope]}
                </button>
              ),
            )}
          </div>

          <CommandList className="max-h-[400px]">
            <CommandEmpty>
              {searchQuery
                ? 'No bookmarks found.'
                : 'Start typing to search...'}
            </CommandEmpty>

            {/* Recent searches — shown when query is empty */}
            {!searchQuery && recentSearches.length > 0 && (
              <CommandGroup
                heading={
                  <div className="flex items-center justify-between">
                    <span>Recent Searches</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground text-xs"
                      onClick={() => dispatch(clearRecentSearchesAction())}
                    >
                      Clear
                    </button>
                  </div>
                }
              >
                {recentSearches.map((query) => (
                  <RecentSearchItem
                    key={query}
                    query={query}
                    onSelect={handleRecentSearchClick}
                  />
                ))}
              </CommandGroup>
            )}

            {/* Search results */}
            {searchQuery && searchResults.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading={`Results (${searchResults.length})`}>
                  {searchResults.map((raindrop) => (
                    <SearchResultItem
                      key={raindrop.id}
                      raindrop={raindrop}
                      onSelect={handleSelect}
                      searchQuery={searchQuery}
                      searchScope={searchScope}
                    />
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>

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
        </Command>
      </DialogContent>
    </Dialog>
  )
})
export { GlobalSearchCommand }
export default GlobalSearchCommand
