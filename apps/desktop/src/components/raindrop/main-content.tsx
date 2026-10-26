import { DragOverlay, useDndMonitor, useDroppable } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Search,
  Plus,
  List,
  LayoutGrid,
  Table2,
  FolderTree,
  SlidersHorizontal,
  BookmarkPlus,
  Loader2,
  X,
} from 'lucide-react'
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { match } from 'ts-pattern'

import { DirectoryView } from '@/components/raindrop/directory-view'
import { DragPreview } from '@/components/raindrop/drag-preview'
import { RaindropCard } from '@/components/raindrop/raindrop-card'
import { RaindropListItem } from '@/components/raindrop/raindrop-list-item'
import { TableView } from '@/components/raindrop/table-view'
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
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { useViewNavigation } from '@/hooks/useViewNavigation'
import { parseCollectionDndId } from '@/lib/collection-organization'
import {
  RAINDROP_LIST_DND_ID,
  getRaindropDndId,
  parseRaindropDndId,
  resolveDraggedRaindropIds,
} from '@/lib/raindrop-organization'
import { filterByScope } from '@/lib/search'
import type {
  Raindrop,
  Group,
  Collection,
  ViewMode,
  SortOption,
  SearchMode,
  SearchScope,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { buildDirectoryTree } from '@/utils/build-directory-tree'

/**
 * Keep the view-mode menu open after toggling "Remember for this collection", so a
 * view can be picked right away (Radix closes menus on item select by default).
 * @param event - Radix `onSelect` custom event
 * @example <DropdownMenuCheckboxItem onSelect={keepMenuOpen} />
 */
const keepMenuOpen = (event: Event) => event.preventDefault()

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

/**
 * Infinite scroll hook using IntersectionObserver on a sentinel element.
 * Returns a ref to attach to the sentinel div at the bottom of the list.
 *
 * @param options.hasMore - Whether more pages are available
 * @param options.isFetching - Whether a fetch is currently in progress
 * @param options.onLoadMore - Callback to load the next page
 * @returns Ref to attach to the sentinel element
 *
 * @example
 *   const sentinelRef = useInfiniteScroll({ hasMore, isFetching, onLoadMore })
 *   // <div ref={sentinelRef} /> at the bottom of the list
 */
function useInfiniteScroll({
  hasMore,
  isFetching,
  onLoadMore,
  scrollContainerRef,
}: {
  hasMore: boolean
  isFetching: boolean
  onLoadMore?: () => void
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  // Store volatile values in refs to keep the observer stable.
  // useEffect sync avoids "Cannot access refs during render" (React compiler).
  const hasMoreRef = useRef(hasMore)
  const isFetchingRef = useRef(isFetching)
  const onLoadMoreRef = useRef(onLoadMore)
  useEffect(() => {
    hasMoreRef.current = hasMore
    isFetchingRef.current = isFetching
    onLoadMoreRef.current = onLoadMore
  })

  useEffect(() => {
    const sentinel = sentinelRef.current
    // ScrollArea renders a [data-slot="scroll-area-viewport"] as the scroll container
    const root =
      scrollContainerRef.current?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]',
      ) ?? null
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMoreRef.current &&
          !isFetchingRef.current
        ) {
          onLoadMoreRef.current?.()
        }
      },
      { root, rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [scrollContainerRef]) // stable ref object — observer created once

  return sentinelRef
}

/**
 * Props for the MainContent component.
 */
interface MainContentProps {
  /** Breadcrumb path segments for current navigation */
  breadcrumbs: string[]
  /** Currently selected collection ID in sidebar */
  selectedCollectionId: string
  /** Array of raindrops (bookmarks) to display (already sorted by API) */
  raindrops: Raindrop[]
  /** True during initial load (no cached data) */
  isLoading?: boolean
  /** True while fetching (including background refetch / next page) */
  isFetching?: boolean
  /** True if more pages are available for infinite scroll */
  hasMore?: boolean
  /** Load the next page of results */
  onLoadMore?: () => void
  /** Callback when a raindrop is selected */
  onSelectRaindrop: (raindrop: Raindrop) => void
  /** ↑/↓ moved keyboard focus to a raindrop: highlight it without opening the detail panel (F7.6) */
  onFocusRaindrop: (raindrop: Raindrop) => void
  /** Space on the focused raindrop: open or close its detail panel (KB.14) */
  onTogglePreview: (raindrop: Raindrop) => void
  /** ID of the currently selected raindrop */
  selectedRaindropId?: string
  /** Set of selected raindrop IDs for multi-select */
  selectedRaindropIds: Set<string>
  /** Callback to update selected raindrop IDs */
  onSelectedRaindropIdsChange: (ids: Set<string>) => void
  /** Available groups for context actions */
  groups: Group[]
  /** Flat list of all collections */
  collections: Collection[]
  /** Callback to open the add bookmark dialog */
  onAddBookmark: () => void
  /** Current sort option (controlled by parent) */
  sortOption: SortOption
  /** Callback when sort changes (lifts state to parent for API sort) */
  onSortChange: (sort: SortOption) => void
  /** Current search query from Redux */
  searchQuery: string
  /** Current field scope from Redux */
  searchScope: SearchScope
  /** Current collection/global search mode from Redux */
  searchMode: SearchMode
  /** Update search query */
  onSearchQueryChange: (query: string) => void
  /** Update search field scope */
  onSearchScopeChange: (scope: SearchScope) => void
  /** Update search mode (scoped/global) */
  onSearchModeChange: (mode: SearchMode) => void
  /** Batch move selected raindrops to a collection */
  onBatchMove?: (ids: string[], targetCollectionId: string) => Promise<void>
  /** Batch add tags to selected raindrops */
  onBatchAddTag?: (ids: string[], tags: string[]) => Promise<void>
  /** Batch delete selected raindrops */
  onBatchDelete?: (ids: string[]) => Promise<void>
  /** Current view mode from Redux (effective: per-collection override > global) */
  viewMode: ViewMode
  /** Callback when view mode changes */
  onViewModeChange: (mode: ViewMode) => void
  /** True when the selected collection is remembered with its own view mode (F3.3) */
  hasCollectionViewModeOverride: boolean
  /** Remember / forget the selected collection's own view mode */
  onCollectionViewModeOverrideChange: (enabled: boolean) => void
  /** Toggle the important flag of a single raindrop (table view row actions) */
  onToggleImportant?: (raindropId: string) => void
  /** Bookmark rows accept drops from each other (manual sort inside one collection) */
  canReorderRaindrops?: boolean
  /** A bookmark was dropped on another one while reordering is allowed */
  onReorderRaindrop?: (activeRaindropId: string, overRaindropId: string) => void
  /** Ref to expose the search input for programmatic focus (Cmd+F) */
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}

/**
 * Main content area displaying the raindrop list with toolbar controls.
 * Supports multiple view modes (list, grid, table, directory),
 * search with configurable scope, sorting, and multi-select.
 *
 * @param breadcrumbs - Path segments for the breadcrumb navigation
 * @param raindrops - Bookmarks to display in the chosen view mode
 * @param onSelectRaindrop - Fires when a single raindrop is clicked
 * @param onFocusRaindrop - Fires when ↑/↓ moves keyboard focus to a raindrop
 * @param onTogglePreview - Fires when Space toggles the detail panel of the focused raindrop
 * @param selectedRaindropId - Currently focused raindrop for detail panel
 * @param selectedRaindropIds - Set of IDs for multi-selection
 * @param onSelectedRaindropIdsChange - Updates multi-selection state
 * @param groups - Groups used for move-to actions
 * @param collections - Flat collection list for move-to actions
 * @param onAddBookmark - Opens the add bookmark dialog
 *
 * @example
 *   <MainContent
 *     breadcrumbs={["Work", "Development"]}
 *     raindrops={filteredRaindrops}
 *     onSelectRaindrop={handleSelect}
 *     selectedRaindropId={selected?.id}
 *     selectedRaindropIds={selectedIds}
 *     onSelectedRaindropIdsChange={setSelectedIds}
 *     groups={groups}
 *     collections={allCollections}
 *     onAddBookmark={() => setIsAddOpen(true)}
 *   />
 */

/**
 * Drag source around one bookmark row/card. Pointer drags start anywhere on the row;
 * the row inside keeps its own click and keyboard behaviour. Other rows only become
 * drop targets (with sort animation) while reordering is allowed.
 */
const DraggableRaindrop = React.memo(function DraggableRaindrop({
  raindropId,
  canReorder,
  children,
}: {
  raindropId: string
  canReorder: boolean
  children: React.ReactNode
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: getRaindropDndId(raindropId),
    disabled: { draggable: false, droppable: !canReorder },
  })

  return (
    <div
      // The wrapper is both sortable node and keyboard activator, so Enter/Space
      // bubbling up from the focused row inside never start a keyboard drag
      ref={(node) => {
        setNodeRef(node)
        setActivatorNodeRef(node)
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid={`raindrop-drag-${raindropId}`}
      className={cn(isDragging && 'opacity-40')}
      {...listeners}
    >
      {children}
    </div>
  )
})

/**
 * Wrapper for RaindropCard inside a .map() to allow useCallback for event handlers.
 */
const RaindropCardWrapper = React.memo(function RaindropCardWrapper({
  raindrop,
  isSelected,
  onRaindropClick,
  onRaindropDoubleClick,
  searchQuery,
  searchScope,
}: {
  raindrop: Raindrop
  isSelected: boolean
  onRaindropClick: (raindrop: Raindrop, event: React.MouseEvent) => void
  onRaindropDoubleClick: (raindrop: Raindrop) => void
  searchQuery?: string
  searchScope?: SearchScope
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => onRaindropClick(raindrop, e),
    [onRaindropClick, raindrop],
  )
  const handleDoubleClick = useCallback(
    () => onRaindropDoubleClick(raindrop),
    [onRaindropDoubleClick, raindrop],
  )
  return (
    <RaindropCard
      raindrop={raindrop}
      isSelected={isSelected}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      searchQuery={searchQuery}
      searchScope={searchScope}
    />
  )
})

/**
 * Wrapper for RaindropListItem inside a .map() to allow useCallback for event handlers.
 */
const RaindropListItemWrapper = React.memo(function RaindropListItemWrapper({
  raindrop,
  isSelected,
  onRaindropClick,
  onToggleSelect,
  onRaindropDoubleClick,
  searchQuery,
  searchScope,
}: {
  raindrop: Raindrop
  isSelected: boolean
  onRaindropClick: (raindrop: Raindrop, event: React.MouseEvent) => void
  onToggleSelect: (raindropId: string) => void
  onRaindropDoubleClick: (raindrop: Raindrop) => void
  searchQuery?: string
  searchScope?: SearchScope
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => onRaindropClick(raindrop, e),
    [onRaindropClick, raindrop],
  )
  const handleToggleSelect = useCallback(
    () => onToggleSelect(raindrop.id),
    [onToggleSelect, raindrop.id],
  )
  const handleDoubleClick = useCallback(
    () => onRaindropDoubleClick(raindrop),
    [onRaindropDoubleClick, raindrop],
  )
  return (
    <RaindropListItem
      raindrop={raindrop}
      isSelected={isSelected}
      onClick={handleClick}
      onToggleSelect={handleToggleSelect}
      onDoubleClick={handleDoubleClick}
      searchQuery={searchQuery}
      searchScope={searchScope}
    />
  )
})

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

const MainContent = React.memo(function MainContent({
  breadcrumbs,
  selectedCollectionId,
  raindrops,
  isLoading,
  isFetching,
  hasMore,
  onLoadMore,
  onSelectRaindrop,
  onFocusRaindrop,
  onTogglePreview,
  selectedRaindropId,
  selectedRaindropIds,
  onSelectedRaindropIdsChange,
  groups: _groups,
  collections,
  onAddBookmark,
  sortOption,
  onSortChange,
  searchQuery,
  searchScope,
  searchMode,
  onSearchQueryChange,
  onSearchScopeChange,
  onSearchModeChange,
  onBatchMove,
  onBatchAddTag,
  onBatchDelete,
  viewMode,
  onViewModeChange,
  hasCollectionViewModeOverride,
  onCollectionViewModeOverrideChange,
  onToggleImportant,
  canReorderRaindrops = false,
  onReorderRaindrop,
  searchInputRef,
}: MainContentProps) {
  // Reserved for bulk action "Move to..." functionality
  void _groups
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false)
  const currentCollectionName =
    breadcrumbs[breadcrumbs.length - 1] ?? 'Collection'
  const canToggleGlobalSearch = selectedCollectionId !== 'all'
  const isScopedSearch = canToggleGlobalSearch && searchMode === 'scoped'

  const handleSearchQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onSearchQueryChange(e.target.value),
    [onSearchQueryChange],
  )
  const handleAdvancedSearchToggle = useCallback(
    () => setIsAdvancedSearchOpen((prev) => !prev),
    [],
  )
  const handleViewModeChange = useCallback(
    (val: string) => {
      if (val) onViewModeChange(val as ViewMode)
    },
    [onViewModeChange],
  )
  const handleSortChange = useCallback(
    (val: string) => onSortChange(val as SortOption),
    [onSortChange],
  )
  const handleDeselectAll = useCallback(
    () => onSelectedRaindropIdsChange(new Set()),
    [onSelectedRaindropIdsChange],
  )
  const handleSetSearchScope = useCallback(
    (scope: SearchScope) => onSearchScopeChange(scope),
    [onSearchScopeChange],
  )
  const handleToggleSearchMode = useCallback(() => {
    if (!canToggleGlobalSearch) return
    onSearchModeChange(isScopedSearch ? 'global' : 'scoped')
  }, [canToggleGlobalSearch, isScopedSearch, onSearchModeChange])
  const handleSearchInputClear = () => {
    onSearchQueryChange('')
    setIsAdvancedSearchOpen(false)
  }
  const handleSearchGlobally = useCallback(() => {
    onSearchModeChange('global')
  }, [onSearchModeChange])
  const clearSearch = useCallback(() => {
    onSearchQueryChange('')
    setIsAdvancedSearchOpen(false)
  }, [onSearchQueryChange])
  const showScopedEmptyStateAction =
    Boolean(searchQuery) && isScopedSearch && canToggleGlobalSearch
  const emptyStateDescription = searchQuery
    ? showScopedEmptyStateAction
      ? `No results in ${currentCollectionName}. Try searching everywhere or adjust your filters.`
      : `No results for "${searchQuery}". Try a different search term or clear filters.`
    : 'This collection is empty. Add your first bookmark to get started.'

  const filteredRaindrops = useMemo(() => {
    return filterByScope(raindrops, searchQuery, searchScope)
  }, [raindrops, searchQuery, searchScope])

  // Directory view hangs the loaded raindrops off the collection tree of the current scope
  const directoryTree = useMemo(
    () =>
      buildDirectoryTree({
        collections,
        raindrops: filteredRaindrops,
        selectedCollectionId,
        currentCollectionName,
      }),
    [
      collections,
      filteredRaindrops,
      selectedCollectionId,
      currentCollectionName,
    ],
  )

  const handleBatchDelete = useCallback(async () => {
    await onBatchDelete?.([...selectedRaindropIds])
  }, [onBatchDelete, selectedRaindropIds])

  /**
   * Handle click on a raindrop with multi-select support.
   * @param raindrop - The clicked raindrop
   * @param event - Mouse event for detecting modifier keys
   */
  const handleRaindropClick = useCallback(
    (raindrop: Raindrop, event: React.MouseEvent) => {
      if (event.metaKey || event.ctrlKey) {
        // Toggle multi-select
        const next = new Set(selectedRaindropIds)
        if (next.has(raindrop.id)) {
          next.delete(raindrop.id)
        } else {
          next.add(raindrop.id)
        }
        onSelectedRaindropIdsChange(next)
      } else if (event.shiftKey && selectedRaindropId) {
        // Range select
        const currentIndex = filteredRaindrops.findIndex(
          (r) => r.id === selectedRaindropId,
        )
        const clickedIndex = filteredRaindrops.findIndex(
          (r) => r.id === raindrop.id,
        )
        if (currentIndex !== -1 && clickedIndex !== -1) {
          const start = Math.min(currentIndex, clickedIndex)
          const end = Math.max(currentIndex, clickedIndex)
          const rangeIds = filteredRaindrops
            .slice(start, end + 1)
            .map((r) => r.id)
          onSelectedRaindropIdsChange(new Set(rangeIds))
        }
      } else {
        onSelectedRaindropIdsChange(new Set())
        onSelectRaindrop(raindrop)
      }
    },
    [
      selectedRaindropIds,
      selectedRaindropId,
      filteredRaindrops,
      onSelectedRaindropIdsChange,
      onSelectRaindrop,
    ],
  )

  /**
   * Toggle a single raindrop's selection state (used by checkbox click).
   * @param raindropId - The ID of the raindrop to toggle
   */
  const handleToggleSelect = useCallback(
    (raindropId: string) => {
      const next = new Set(selectedRaindropIds)
      if (next.has(raindropId)) {
        next.delete(raindropId)
      } else {
        next.add(raindropId)
      }
      onSelectedRaindropIdsChange(next)
    },
    [selectedRaindropIds, onSelectedRaindropIdsChange],
  )

  /**
   * Handle double-click to open URL in external browser.
   * @param raindrop - The double-clicked raindrop
   */
  const handleRaindropDoubleClick = useCallback((raindrop: Raindrop) => {
    window.shell.openExternal(raindrop.url)
  }, [])

  // Table / directory views hand back a URL rather than a raindrop
  const handleOpenUrl = useCallback((url: string) => {
    window.shell.openExternal(url)
  }, [])

  const handleDeleteRaindrops = useCallback(
    (ids: string[]) => {
      void onBatchDelete?.(ids)
    },
    [onBatchDelete],
  )

  // --- Infinite Scroll ---
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useInfiniteScroll({
    hasMore: hasMore ?? false,
    isFetching: isFetching ?? false,
    onLoadMore,
    scrollContainerRef: scrollAreaRef,
  })

  // --- Keyboard Navigation (F7.6) ---
  // The hook reports row ids; resolve them against what is on screen
  const handleNavigateToRaindrop = useCallback(
    (raindropId: string) => {
      const raindrop = filteredRaindrops.find((r) => r.id === raindropId)
      if (raindrop) onFocusRaindrop(raindrop)
    },
    [filteredRaindrops, onFocusRaindrop],
  )
  const handleOpenRaindrop = useCallback(
    (raindropId: string) => {
      const raindrop = filteredRaindrops.find((r) => r.id === raindropId)
      if (raindrop) window.shell.openExternal(raindrop.url)
    },
    [filteredRaindrops],
  )
  const handleTogglePreview = useCallback(
    (raindropId: string) => {
      const raindrop = filteredRaindrops.find((r) => r.id === raindropId)
      if (raindrop) onTogglePreview(raindrop)
    },
    [filteredRaindrops, onTogglePreview],
  )
  useViewNavigation({
    containerRef: scrollAreaRef,
    selectedRaindropId,
    onNavigate: handleNavigateToRaindrop,
    onOpen: handleOpenRaindrop,
    onPreviewToggle: handleTogglePreview,
  })

  // --- Bookmark Drag & Drop (F6) ---
  // The DndContext lives in LeftSidebar and wraps this content; drops are observed here
  const sortableIds = useMemo(
    () => filteredRaindrops.map((raindrop) => getRaindropDndId(raindrop.id)),
    [filteredRaindrops],
  )
  // Lets the collision rules tell "pointer over the list" from "pointer over the sidebar"
  const { setNodeRef: setListDropZoneRef } = useDroppable({
    id: RAINDROP_LIST_DND_ID,
  })
  const [activeDragRaindropId, setActiveDragRaindropId] = useState<
    string | null
  >(null)
  const activeDragRaindrop = activeDragRaindropId
    ? filteredRaindrops.find((r) => r.id === activeDragRaindropId)
    : undefined
  const draggedCount = activeDragRaindropId
    ? resolveDraggedRaindropIds(activeDragRaindropId, selectedRaindropIds)
        .length
    : 0
  const handleRaindropDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragRaindropId(parseRaindropDndId(event.active.id))
  }, [])
  const handleRaindropDragCancel = useCallback(() => {
    setActiveDragRaindropId(null)
  }, [])
  const handleRaindropDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeRaindropId = parseRaindropDndId(event.active.id)
      if (!activeRaindropId) return
      setActiveDragRaindropId(null)

      // Dropped on a sidebar collection → move the dragged selection there
      const targetCollectionId = parseCollectionDndId(event.over?.id)
      if (targetCollectionId) {
        if (targetCollectionId !== selectedCollectionId) {
          void onBatchMove?.(
            resolveDraggedRaindropIds(activeRaindropId, selectedRaindropIds),
            targetCollectionId,
          )
        }
        return
      }

      // Dropped on another bookmark → manual reorder
      const overRaindropId = parseRaindropDndId(event.over?.id)
      if (
        canReorderRaindrops &&
        overRaindropId &&
        overRaindropId !== activeRaindropId
      ) {
        onReorderRaindrop?.(activeRaindropId, overRaindropId)
      }
    },
    [
      canReorderRaindrops,
      onBatchMove,
      onReorderRaindrop,
      selectedCollectionId,
      selectedRaindropIds,
    ],
  )
  useDndMonitor(
    useMemo(
      () => ({
        onDragStart: handleRaindropDragStart,
        onDragCancel: handleRaindropDragCancel,
        onDragEnd: handleRaindropDragEnd,
      }),
      [
        handleRaindropDragStart,
        handleRaindropDragCancel,
        handleRaindropDragEnd,
      ],
    ),
  )

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 flex-shrink-0 border-b backdrop-blur">
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
            <span className="text-muted-foreground text-xs tabular-nums">
              {filteredRaindrops.length} items
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
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Search options</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5" />

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
        </div>

        {/* Advanced Search Options */}
        {isAdvancedSearchOpen && (
          <div className="flex items-center gap-2 px-4 pb-2">
            <span className="text-muted-foreground text-xs">Search in:</span>
            <div className="flex gap-1">
              {(
                [
                  { value: 'all', label: 'All Fields' },
                  { value: 'url', label: 'URL Only' },
                  { value: 'title', label: 'Title Only' },
                  { value: 'description', label: 'Description Only' },
                ] as const
              ).map((scope) => (
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
        )}

        {/* Bulk Actions Bar — the table view renders its own */}
        {selectedRaindropIds.size > 0 && viewMode !== 'table' && (
          <div className="bg-muted/30 flex items-center gap-2 border-t px-4 pt-2 pb-2">
            <span className="text-xs font-medium">
              {selectedRaindropIds.size} selected
            </span>
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
                disabled
              >
                Move to...
              </Button>
            )}
            {onBatchAddTag && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                disabled
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
      </div>

      {/* Content Area */}
      <ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1">
        {isLoading ? (
          /* Loading skeleton */
          <div className="flex flex-col items-center justify-center px-4 py-20">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            <p className="text-muted-foreground mt-2 text-sm">
              Loading bookmarks...
            </p>
          </div>
        ) : filteredRaindrops.length === 0 ? (
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSearchGlobally}
                >
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
        ) : (
          match(viewMode)
            .with('grid', () => (
              <div
                ref={setListDropZoneRef}
                data-testid="grid-view"
                className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-4"
              >
                <SortableContext
                  items={sortableIds}
                  strategy={rectSortingStrategy}
                >
                  {filteredRaindrops.map((raindrop) => (
                    <DraggableRaindrop
                      key={raindrop.id}
                      raindropId={raindrop.id}
                      canReorder={canReorderRaindrops}
                    >
                      <RaindropCardWrapper
                        raindrop={raindrop}
                        isSelected={
                          selectedRaindropId === raindrop.id ||
                          selectedRaindropIds.has(raindrop.id)
                        }
                        onRaindropClick={handleRaindropClick}
                        onRaindropDoubleClick={handleRaindropDoubleClick}
                        searchQuery={searchQuery}
                        searchScope={searchScope}
                      />
                    </DraggableRaindrop>
                  ))}
                </SortableContext>
              </div>
            ))
            .with('list', () => (
              <div
                ref={setListDropZoneRef}
                data-testid="list-view"
                className="divide-y"
              >
                <SortableContext
                  items={sortableIds}
                  strategy={verticalListSortingStrategy}
                >
                  {filteredRaindrops.map((raindrop) => (
                    <DraggableRaindrop
                      key={raindrop.id}
                      raindropId={raindrop.id}
                      canReorder={canReorderRaindrops}
                    >
                      <RaindropListItemWrapper
                        raindrop={raindrop}
                        isSelected={
                          selectedRaindropId === raindrop.id ||
                          selectedRaindropIds.has(raindrop.id)
                        }
                        onRaindropClick={handleRaindropClick}
                        onToggleSelect={handleToggleSelect}
                        onRaindropDoubleClick={handleRaindropDoubleClick}
                        searchQuery={searchQuery}
                        searchScope={searchScope}
                      />
                    </DraggableRaindrop>
                  ))}
                </SortableContext>
              </div>
            ))
            .with('table', () => (
              <div data-testid="table-view">
                <TableView
                  raindrops={filteredRaindrops}
                  selectedIds={selectedRaindropIds}
                  onSelectionChange={onSelectedRaindropIdsChange}
                  onSelect={onSelectRaindrop}
                  onOpenUrl={handleOpenUrl}
                  onDelete={handleDeleteRaindrops}
                  onToggleImportant={onToggleImportant}
                />
              </div>
            ))
            .with('directory', () => (
              <div data-testid="directory-view">
                <DirectoryView
                  collections={directoryTree.collections}
                  raindropsByCollection={directoryTree.raindropsByCollection}
                  selectedRaindropId={selectedRaindropId}
                  onSelectRaindrop={onSelectRaindrop}
                  onOpenUrl={handleOpenUrl}
                />
              </div>
            ))
            .exhaustive()
        )}

        {/* Infinite scroll sentinel + loading indicator */}
        {hasMore && (
          <div
            ref={sentinelRef}
            className="flex items-center justify-center py-4"
          >
            {isFetching && (
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            )}
          </div>
        )}
      </ScrollArea>

      <DragOverlay dropAnimation={null}>
        {activeDragRaindrop && (
          <DragPreview raindrop={activeDragRaindrop} count={draggedCount} />
        )}
      </DragOverlay>
    </div>
  )
})
export { MainContent }
export default MainContent
