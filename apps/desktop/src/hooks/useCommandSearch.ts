import { useCallback } from 'react'

import type { Raindrop, SearchMode, SearchScope } from '@/lib/types'
import { useAppDispatch } from '@/store/hooks'
import {
  addRecentSearch as addRecentSearchAction,
  clearRecentSearches as clearRecentSearchesAction,
  setSearchMode as setSearchModeAction,
  setSearchQuery as setSearchQueryAction,
  setSearchScope as setSearchScopeAction,
} from '@/store/slices/searchSlice'

import { useSearchState } from './useSearchState'

/**
 * Bind command-palette events to shared search state and record successful result selections.
 * Called while the palette renders; selecting a bookmark closes it and clears the input.
 * @example
 * const search = useCommandSearch({ currentCollectionId, onOpenChange, onSelectRaindrop })
 */
export function useCommandSearch({
  currentCollectionId,
  onOpenChange,
  onSelectRaindrop,
}: {
  currentCollectionId?: string
  onOpenChange: (open: boolean) => void
  onSelectRaindrop?: (bookmark: Raindrop) => void
}) {
  const dispatch = useAppDispatch()
  const {
    query: searchQuery,
    scope: searchScope,
    mode: searchMode,
    recentSearches,
  } = useSearchState()

  const canToggleGlobalSearch = currentCollectionId !== 'all'
  const isScopedSearch = canToggleGlobalSearch && searchMode === 'scoped'
  const handleCommandQueryChange = useCallback(
    (value: string) => {
      dispatch(setSearchQueryAction(value))
    },
    [dispatch],
  )
  const toggleSearchMode = useCallback(() => {
    if (!canToggleGlobalSearch) return
    const nextMode: SearchMode = isScopedSearch ? 'global' : 'scoped'
    dispatch(setSearchModeAction(nextMode))
  }, [canToggleGlobalSearch, isScopedSearch, dispatch])

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

  const handleClearQuery = useCallback(() => {
    dispatch(setSearchQueryAction(''))
  }, [dispatch])
  const handleClearRecent = useCallback(() => {
    dispatch(clearRecentSearchesAction())
  }, [dispatch])
  const handleScopeChange = useCallback(
    (scope: SearchScope) => {
      dispatch(setSearchScopeAction(scope))
    },
    [dispatch],
  )

  return {
    searchQuery,
    searchScope,
    searchMode,
    recentSearches,
    canToggleGlobalSearch,
    isScopedSearch,
    handleCommandQueryChange,
    toggleSearchMode,
    handleSelect,
    handleRecentSearchClick,
    handleClearQuery,
    handleClearRecent,
    handleScopeChange,
  }
}
