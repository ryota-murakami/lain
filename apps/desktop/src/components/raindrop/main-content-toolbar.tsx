import {
  Search,
  Plus,
  List,
  LayoutGrid,
  Table2,
  FolderTree,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import React, { useCallback } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ViewMode, SearchScope } from '@/lib/types'

import type { MainContentProps } from './main-content.types'

/**
 * Keep the view-mode menu open after toggling "Remember for this collection", so a
 * view can be picked right away (Radix closes menus on item select by default).
 * @param event - Radix `onSelect` custom event
 * @example <DropdownMenuCheckboxItem onSelect={keepMenuOpen} />
 */
const keepMenuOpen = (event: Event): void => event.preventDefault()

/**
 * Static map of view mode to icon component and label for the toolbar dropdown.
 */
const VIEW_MODE_OPTIONS: {
  value: ViewMode
  label: string
  icon: typeof List
}[] = [
  { value: 'list', label: 'List', icon: List },
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'table', label: 'Table', icon: Table2 },
  { value: 'directory', label: 'Directory', icon: FolderTree },
]

type HeaderProps = Pick<
  MainContentProps,
  'breadcrumbs' | 'totalCount' | 'onAddBookmark'
> & {
  shownCount: number
  loadedCount: number
  openExport: () => void
  openUpload: () => void
}
type ViewControlProps = Pick<
  MainContentProps,
  | 'viewMode'
  | 'hasCollectionViewModeOverride'
  | 'onCollectionViewModeOverrideChange'
  | 'sortOption'
> & {
  handleViewModeChange: (value: string) => void
  handleSortChange: (value: string) => void
}
type SearchControlProps = Pick<
  MainContentProps,
  'searchInputRef' | 'searchQuery' | 'searchScope' | 'onSearchScopeChange'
> & {
  collectionScope: {
    canToggleGlobalSearch: boolean
    isScopedSearch: boolean
    currentCollectionName: string
  }
  isAdvancedSearchOpen: boolean
  handleSearchQueryChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleSearchInputClear: () => void
  handleToggleSearchMode: () => void
  handleAdvancedSearchToggle: () => void
  handleSetSearchScope: (scope: SearchScope) => void
  viewControls: ViewControlProps
}
type BulkBarProps = Pick<
  MainContentProps,
  'viewMode' | 'onBatchMove' | 'onBatchAddTag' | 'onBatchDelete'
> & {
  selectedCount: number
  handleDeselectAll: () => void
  moveSelection: () => void
  tagSelection: () => void
  handleBatchDelete: () => Promise<void>
}

/**
 * Search scope button used inside a .map() to allow useCallback.
 */
const SearchScopeButton = React.memo(function SearchScopeButton({
  value,
  label,
  isActive,
  onSetScope,
}: {
  value: SearchScope
  label: string
  isActive: boolean
  onSetScope: (scope: SearchScope) => void
}) {
  const handleClick = useCallback(() => onSetScope(value), [onSetScope, value])
  return (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      size="sm"
      className="h-6 px-2 text-xs"
      onClick={handleClick}
    >
      {label}
    </Button>
  )
})

/**
 * Show the current path and authoritative loaded/total counts alongside import/export actions.
 * Rendered by the main bookmark toolbar when its controlled state changes.
 * @example
 * <BookmarkHeader {...props} />
 */
export const BookmarkHeader = React.memo(function BookmarkHeader({
  breadcrumbs,
  totalCount,
  onAddBookmark,
  shownCount,
  loadedCount,
  openExport,
  openUpload,
}: HeaderProps) {
  return (
    <>
      {/* Top row: Breadcrumb + Actions */}
      <div className="flex items-center justify-between px-4 py-2">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1
              return (
                <BreadcrumbItem key={`${crumb}-${index}`}>
                  {!isLast ? (
                    <>
                      <BreadcrumbLink className="hover:text-foreground cursor-pointer text-sm">
                        {crumb}
                      </BreadcrumbLink>
                      <BreadcrumbSeparator />
                    </>
                  ) : (
                    <BreadcrumbPage className="text-sm font-medium">
                      {crumb}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={openExport}>
            Export
          </Button>
          <Button size="sm" variant="outline" onClick={openUpload}>
            Upload
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums">
            {shownCount} items shown · {loadedCount} loaded
            {totalCount !== undefined ? ` of ${totalCount}` : ''}
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" onClick={onAddBookmark} className="h-8">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add a new bookmark</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  )
})

/**
 * Choose bookmark layout, collection preference, and server ordering.
 * Rendered by the main bookmark toolbar when its controlled state changes.
 * @example
 * <BookmarkViewControls {...props} />
 */
const BookmarkViewControls = React.memo(function BookmarkViewControls({
  viewMode,
  hasCollectionViewModeOverride,
  onCollectionViewModeOverrideChange,
  sortOption,
  handleViewModeChange,
  handleSortChange,
}: ViewControlProps) {
  return (
    <>
      {/* View Mode Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            aria-label="View mode"
          >
            {(() => {
              const current = VIEW_MODE_OPTIONS.find(
                (o) => o.value === viewMode,
              )
              const Icon = current?.icon ?? List
              return <Icon className="h-3.5 w-3.5" />
            })()}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuLabel>View Mode</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={viewMode}
            onValueChange={handleViewModeChange}
          >
            {VIEW_MODE_OPTIONS.map((opt) => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                <opt.icon className="mr-2 h-3.5 w-3.5" />
                {opt.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={hasCollectionViewModeOverride}
            onCheckedChange={onCollectionViewModeOverrideChange}
            onSelect={keepMenuOpen}
          >
            Remember for this collection
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-5" />

      {/* Sort Dropdown */}
      <Select value={sortOption} onValueChange={handleSortChange}>
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest First</SelectItem>
          <SelectItem value="oldest">Oldest First</SelectItem>
          <SelectItem value="title-asc">Title A-Z</SelectItem>
          <SelectItem value="title-desc">Title Z-A</SelectItem>
          <SelectItem value="domain">By Domain</SelectItem>
          <SelectItem value="relevance">By Relevance</SelectItem>
          <SelectItem value="manual">Manual Order</SelectItem>
        </SelectContent>
      </Select>
    </>
  )
})

/**
 * Keep query, collection scope, and field-scope controls together.
 * Rendered by the main bookmark toolbar when its controlled state changes.
 * @example
 * <BookmarkSearchControls {...props} />
 */
/**
 * Offer field scopes only while advanced search is expanded in the bookmark toolbar.
 * @example
 * <SearchFieldScopes {...props} />
 */
const FIELD_SCOPES = [
  { value: 'all', label: 'All Fields' },
  { value: 'url', label: 'URL Only' },
  { value: 'title', label: 'Title Only' },
  { value: 'description', label: 'Description Only' },
] as const
const SearchFieldScopes = React.memo(function SearchFieldScopes({
  isAdvancedSearchOpen,
  searchScope,
  handleSetSearchScope,
}: Pick<
  SearchControlProps,
  'isAdvancedSearchOpen' | 'searchScope' | 'handleSetSearchScope'
>) {
  if (!isAdvancedSearchOpen) return null
  return (
    <div className="flex items-center gap-2 px-4 pb-2">
      <span className="text-muted-foreground text-xs">Search in:</span>
      <div className="flex gap-1">
        {FIELD_SCOPES.map((scope) => (
          <SearchScopeButton
            key={scope.value}
            value={scope.value}
            label={scope.label}
            isActive={searchScope === scope.value}
            onSetScope={handleSetSearchScope}
          />
        ))}
      </div>
    </div>
  )
})

/**
 * Expose bulk operations for selected rows outside the table’s own toolbar.
 * Rendered by the main bookmark toolbar when its controlled state changes.
 * @example
 * <BookmarkBulkBar {...props} />
 */
export const BookmarkBulkBar = React.memo(function BookmarkBulkBar({
  selectedCount,
  viewMode,
  onBatchMove,
  onBatchAddTag,
  onBatchDelete,
  handleDeselectAll,
  moveSelection,
  tagSelection,
  handleBatchDelete,
}: BulkBarProps) {
  return (
    <>
      {/* Bulk Actions Bar — the table view renders its own */}
      {selectedCount > 0 && viewMode !== 'table' && (
        <div className="bg-muted/30 flex items-center gap-2 border-t px-4 pt-2 pb-2">
          <span className="text-xs font-medium">{selectedCount} selected</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={handleDeselectAll}
          >
            Deselect All
          </Button>
          <Separator orientation="vertical" className="h-4" />
          {onBatchMove && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={moveSelection}
            >
              Move to...
            </Button>
          )}
          {onBatchAddTag && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={tagSelection}
            >
              Add Tag...
            </Button>
          )}
          {onBatchDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-6 text-xs"
              onClick={handleBatchDelete}
            >
              Delete
            </Button>
          )}
        </div>
      )}
    </>
  )
})

export const BookmarkSearchControls = React.memo(
  function BookmarkSearchControls({
    collectionScope,
    searchInputRef,
    searchQuery,
    searchScope,
    onSearchScopeChange,
    isAdvancedSearchOpen,
    handleSearchQueryChange,
    handleSearchInputClear,
    handleToggleSearchMode,
    handleAdvancedSearchToggle,
    handleSetSearchScope,
    viewControls,
  }: SearchControlProps) {
    const { canToggleGlobalSearch, isScopedSearch, currentCollectionName } =
      collectionScope
    return (
      <>
        {/* Second row: Search + View Controls */}
        <div className="flex items-center gap-2 px-4 pb-2">
          {/* Search Input */}
          <div className="relative max-w-md flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              ref={searchInputRef}
              placeholder="Search bookmarks... (⌘K)"
              value={searchQuery}
              onChange={handleSearchQueryChange}
              className="h-8 pr-8 pl-8 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleSearchInputClear}
                aria-label="Clear search"
                className="hover:bg-accent absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5"
              >
                <X className="text-muted-foreground h-3 w-3" />
              </button>
            )}
          </div>

          {/* Collection Scope Badge + Toggle */}
          {canToggleGlobalSearch && (
            <>
              <Badge variant={isScopedSearch ? 'secondary' : 'outline'}>
                {isScopedSearch
                  ? `in ${currentCollectionName}`
                  : 'searching everywhere'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={handleToggleSearchMode}
              >
                {isScopedSearch
                  ? 'Search everywhere'
                  : `Search in ${currentCollectionName}`}
              </Button>
            </>
          )}

          {/* Search Scope Badge */}
          {searchScope !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-xs">
              {searchScope}
              <button
                type="button"
                onClick={() => onSearchScopeChange('all')}
                aria-label="Search all fields"
                className="ml-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}

          {/* Advanced Search Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isAdvancedSearchOpen ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={handleAdvancedSearchToggle}
                aria-label="Search options"
                aria-expanded={isAdvancedSearchOpen}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Search options</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5" />

          <BookmarkViewControls {...viewControls} />
        </div>

        <SearchFieldScopes
          isAdvancedSearchOpen={isAdvancedSearchOpen}
          searchScope={searchScope}
          handleSetSearchScope={handleSetSearchScope}
        />
      </>
    )
  },
)
