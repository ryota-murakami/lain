import { useCallback, useMemo } from 'react'

import { buildSearchQuery } from '@/lib/search'
import type { SearchMode, SearchScope } from '@/lib/types'
import { useAppDispatch } from '@/store/hooks'
import {
  setSearchMode,
  setSearchOpen,
  setSearchQuery,
  setSearchScope,
} from '@/store/slices/searchSlice'

import { useDebouncedSearch } from './useDebouncedSearch'
import { useSearchState } from './useSearchState'

/**
 * Translate shared search state into a debounced API query and explicit input handlers.
 * MainApp supplies the sidebar collection so global searches can widen their read scope.
 * @example const search = useMainAppSearch(selectedCollectionId)
 */
export function useMainAppSearch(selectedCollectionId: string) {
  const dispatch = useAppDispatch()
  const {
    query: searchQuery,
    scope: searchScope,
    mode: searchMode,
    isSearchOpen,
  } = useSearchState()
  const normalizedSearchQuery = searchQuery.trim()
  const remoteSearchQuery = useDebouncedSearch(normalizedSearchQuery)
  const effectiveSearchCollectionId =
    normalizedSearchQuery.length > 0 && searchMode === 'global'
      ? 'all'
      : selectedCollectionId
  const apiSearchQuery = useMemo(
    () =>
      remoteSearchQuery
        ? buildSearchQuery(remoteSearchQuery, searchScope)
        : undefined,
    [remoteSearchQuery, searchScope],
  )
  const handleSearchOpenChange = useCallback(
    (open: boolean) => dispatch(setSearchOpen(open)),
    [dispatch],
  )
  const handleSearchQueryChange = useCallback(
    (query: string) => dispatch(setSearchQuery(query)),
    [dispatch],
  )
  const handleSearchScopeChange = useCallback(
    (scope: SearchScope) => dispatch(setSearchScope(scope)),
    [dispatch],
  )
  const handleSearchModeChange = useCallback(
    (mode: SearchMode) => dispatch(setSearchMode(mode)),
    [dispatch],
  )

  return {
    searchQuery,
    searchScope,
    searchMode,
    isSearchOpen,
    normalizedSearchQuery,
    apiSearchQuery,
    effectiveSearchCollectionId,
    handleSearchOpenChange,
    handleSearchQueryChange,
    handleSearchScopeChange,
    handleSearchModeChange,
  }
}
