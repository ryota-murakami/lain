import { useAppSelector } from '@/store/hooks'

/**
 * Share the search slice subscription between the main view and global search command.
 * Both surfaces must read the same query, scope, mode, recent searches and open state.
 * @returns The current search state without changing its Redux identity.
 * @example const { query, scope, mode, recentSearches } = useSearchState()
 */
export function useSearchState() {
  return useAppSelector((state) => state.search)
}
