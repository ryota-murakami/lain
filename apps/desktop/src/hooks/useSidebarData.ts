import { useMemo } from 'react'

import { toUiGroups, toUiSystemCollections } from '@/lib/api-mappers'
import type { Group, SystemCollection } from '@/lib/types'
import {
  useGetCollectionsChildrensQuery,
  useGetCollectionsQuery,
  useGetUserQuery,
} from '@/store/api/raindropApi'

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
  const userQuery = useGetUserQuery()
  const collectionsQuery = useGetCollectionsQuery()
  const childrenQuery = useGetCollectionsChildrensQuery()

  const isLoading =
    userQuery.isLoading || collectionsQuery.isLoading || childrenQuery.isLoading
  const isError =
    userQuery.isError || collectionsQuery.isError || childrenQuery.isError

  const groups = useMemo(() => {
    const user = userQuery.data?.user
    const rootCollections = collectionsQuery.data?.items
    if (!user || !rootCollections) return []
    return toUiGroups(user, rootCollections, childrenQuery.data?.items ?? [])
  }, [userQuery.data, collectionsQuery.data, childrenQuery.data])

  const systemCollections = useMemo(() => {
    const rootCollections = collectionsQuery.data?.items
    // Always return system collections — fall back to 0 counts when API is unavailable
    return toUiSystemCollections(rootCollections ?? [])
  }, [collectionsQuery.data])

  return { groups, systemCollections, isLoading, isError }
}

interface UseSidebarDataReturn {
  /** Collection groups with nested children */
  groups: Group[]
  /** System collections: All Bookmarks, Unsorted, Trash */
  systemCollections: SystemCollection[]
  /** True while any of the three queries is loading */
  isLoading: boolean
  /** True if any query failed */
  isError: boolean
}
