import { useCallback, useState } from 'react'
import type React from 'react'

import type { MainContentProps } from '@/components/raindrop/main-content.types'
import type { ViewMode, SortOption, SearchScope } from '@/lib/types'

/**
 * Coordinate bookmark search/view controls while preserving the parent's persisted choices.
 * Called by MainContent; clearing a query also closes its advanced field controls.
 * @example
 * const toolbar = useBookmarkToolbar(props)
 */
export function useBookmarkToolbar({
  breadcrumbs,
  selectedCollectionId,
  searchMode,
  onSearchQueryChange,
  onViewModeChange,
  onSortChange,
  onSelectedRaindropIdsChange,
  onSearchScopeChange,
  onSearchModeChange,
}: MainContentProps) {
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
  const handleSearchGlobally = useCallback(() => {
    onSearchModeChange('global')
  }, [onSearchModeChange])
  const clearSearch = useCallback(() => {
    onSearchQueryChange('')
    setIsAdvancedSearchOpen(false)
  }, [onSearchQueryChange])
  return {
    isAdvancedSearchOpen,
    currentCollectionName,
    canToggleGlobalSearch,
    isScopedSearch,
    handleSearchQueryChange,
    handleAdvancedSearchToggle,
    handleViewModeChange,
    handleSortChange,
    handleDeselectAll,
    handleSetSearchScope,
    handleToggleSearchMode,
    handleSearchGlobally,
    clearSearch,
  }
}
