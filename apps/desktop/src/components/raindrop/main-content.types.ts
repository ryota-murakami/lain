import type React from 'react'

import type {
  Raindrop,
  Group,
  Collection,
  ViewMode,
  SortOption,
  SearchMode,
  SearchScope,
} from '@/lib/types'

/**
 * Props for the MainContent component.
 */
export interface MainContentProps {
  /** Breadcrumb path segments for current navigation */
  breadcrumbs: string[]
  /** Currently selected collection ID in sidebar */
  selectedCollectionId: string
  /** Array of raindrops (bookmarks) to display (already sorted by API) */
  raindrops: Raindrop[]
  totalCount?: number
  /** True during initial load (no cached data) */
  isError?: boolean
  onRetry?: () => void
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
  onMarkImportant?: (ids: string[]) => Promise<void>
  /** Bookmark rows accept drops from each other (manual sort inside one collection) */
  canReorderRaindrops?: boolean
  /** A bookmark was dropped on another one while reordering is allowed */
  onReorderRaindrop?: (
    activeRaindropId: string,
    overRaindropId: string,
  ) => void | Promise<void>
  /** Ref to expose the search input for programmatic focus (Cmd+F) */
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}
