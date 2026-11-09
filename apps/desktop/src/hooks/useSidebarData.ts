import { useEffect, useMemo, useRef } from 'react'

import { toUiGroups, toUiSystemCollections } from '@/lib/api-mappers'
import { applyCollectionAppearance } from '@/lib/collection-organization'
import type { Group, SystemCollection } from '@/lib/types'
import { useGetUserStatsQuery } from '@/store/api/accountApi'
import {
  useGetCollectionsChildrensQuery,
  useGetCollectionsQuery,
  useGetUserQuery,
  raindropApi,
} from '@/store/api/raindropApi'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { getCollectionAppearance } from '@/store/slices/uiSlice'

import { useNetworkStatus } from './useNetworkStatus'

/**
 * Combines three RTK Query calls to reconstruct the sidebar tree structure.
 *
 * The Raindrop.io API splits sidebar data across three endpoints:
 * - `GET /user` → `user.groups[]` (group names + collection ID lists)
 * - `GET /collections` → root-level collections
 * - `GET /collections/childrens` → nested child collections
 *
 * This hook merges them into UI-ready `Group[]` and `SystemCollection[]`.
 *
 * @returns Sidebar data with loading/error states
 * @example
 *   const { groups, systemCollections, isLoading } = useSidebarData()
 *   // groups: [{ id: 'group-0', name: 'Work', collections: [...] }]
 *   // systemCollections: [{ id: 'all', name: 'All Bookmarks', count: 68 }]
 */
export function useSidebarData(): UseSidebarDataReturn {
  const appearance = useAppSelector(getCollectionAppearance)
  const online = useNetworkStatus()
  const dispatch = useAppDispatch()
  const polling = {
    pollingInterval: online ? 4000 : 0,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  }
  const statsQuery = useGetUserStatsQuery(undefined, {
    ...polling,
    pollingInterval: online ? 3000 : 0,
  })
  useBookmarkChangeMarker(statsQuery.data?.meta?.changedBookmarksDate)
  const userQuery = useGetUserQuery(undefined, polling)
  const collectionsQuery = useGetCollectionsQuery(undefined, polling)
  const childrenQuery = useGetCollectionsChildrensQuery(undefined, polling)

  const queries = [userQuery, collectionsQuery, childrenQuery, statsQuery]
  const isLoading = queries.some((query) => query.isLoading)
  const isError = queries.some((query) => query.isError)

  const groups = useMemo(() => {
    const user = userQuery.data?.user
    const rootCollections = collectionsQuery.data?.items
    if (!user || !rootCollections) return []
    return applyCollectionAppearance(
      toUiGroups(user, rootCollections, childrenQuery.data?.items ?? []),
      appearance.icons,
      appearance.colors,
    )
  }, [userQuery.data, collectionsQuery.data, childrenQuery.data, appearance])

  const systemCollections = useMemo(() => {
    return toUiSystemCollections([]).map((collection) => ({
      ...collection,
      count:
        statsQuery.data?.items?.find(
          (item) =>
            item._id === { all: 0, unsorted: -1, trash: -99 }[collection.id],
        )?.count ?? 0,
    }))
  }, [statsQuery.data])

  const refresh = (): void => {
    dispatch(
      raindropApi.util.invalidateTags([
        'user',
        'collections',
        'raindrops',
        'tags',
        'filters',
      ]),
    )
  }
  return {
    groups,
    systemCollections,
    isLoading,
    isError,
    refresh,
    online,
    isSyncing: statsQuery.isFetching,
    lastSynced: statsQuery.fulfilledTimeStamp,
    syncError:
      isError ||
      Boolean(
        statsQuery.data &&
        (!statsQuery.data.result ||
          !Array.isArray(statsQuery.data.items) ||
          !statsQuery.data.meta),
      ),
  }
}

/** Refresh bookmark caches when {@link useSidebarData} observes a different server change marker. */
function useBookmarkChangeMarker(marker?: string): void {
  const dispatch = useAppDispatch()
  const lastMarker = useRef<string | undefined>(undefined)
  useEffect(() => {
    // The marker catches edits from another client without assuming a push API exists.
    if (lastMarker.current && marker && marker !== lastMarker.current) {
      dispatch(
        raindropApi.util.invalidateTags(['raindrops', 'tags', 'filters']),
      )
    }
    lastMarker.current = marker
  }, [dispatch, marker])
}

interface UseSidebarDataReturn {
  refresh: () => void
  online: boolean
  isSyncing: boolean
  lastSynced?: number
  syncError: boolean
  /** Collection groups with nested children */
  groups: Group[]
  /** System collections: All Bookmarks, Unsorted, Trash */
  systemCollections: SystemCollection[]
  /** True while any of the three queries is loading */
  isLoading: boolean
  /** True if any query failed */
  isError: boolean
}
