import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

import type { SearchMode, SearchScope } from '@/lib/types'

/**
 * Search state for query, scope, and recent searches.
 *
 * @example
 *   dispatch(setSearchQuery('react hooks'))
 *   dispatch(setSearchScope('url'))
 *   const { query, scope } = useAppSelector(state => state.search)
 */
interface SearchState {
  query: string
  scope: SearchScope
  mode: SearchMode
  isSearchOpen: boolean
  recentSearches: string[]
}

const MAX_RECENT_SEARCHES = 20

const initialState: SearchState = {
  query: '',
  scope: 'all',
  mode: 'scoped',
  isSearchOpen: false,
  recentSearches: [],
}

export const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.query = action.payload
    },
    setSearchScope(state, action: PayloadAction<SearchScope>) {
      state.scope = action.payload
    },
    setSearchMode(state, action: PayloadAction<SearchMode>) {
      state.mode = action.payload
    },
    setSearchOpen(state, action: PayloadAction<boolean>) {
      state.isSearchOpen = action.payload
    },
    addRecentSearch(state, action: PayloadAction<string>) {
      const search = action.payload.trim()
      if (!search) return
      state.recentSearches = [
        search,
        ...state.recentSearches.filter((s) => s !== search),
      ].slice(0, MAX_RECENT_SEARCHES)
    },
    clearRecentSearches(state) {
      state.recentSearches = []
    },
    clearSearch(state) {
      state.query = ''
      state.isSearchOpen = false
    },
  },
})

export const {
  setSearchQuery,
  setSearchScope,
  setSearchMode,
  setSearchOpen,
  addRecentSearch,
  clearRecentSearches,
  clearSearch,
} = searchSlice.actions
