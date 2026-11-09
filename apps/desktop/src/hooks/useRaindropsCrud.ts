import { useCallback, useMemo } from 'react'

import { collectionIdToApi, toUiRaindrop } from '@/lib/api-mappers'
import type { CreateBookmarkData } from '@/lib/api-mappers'
import type { Raindrop } from '@/lib/types'
import { useGetBookmarkPagesInfiniteQuery } from '@/store/api/accountApi'
import type { GetRaindropsByCollectionIdApiArg } from '@/store/api/raindropApi'

import { useRaindropMutations } from './useRaindropMutations'
import { useRaindropProjection } from './useRaindropProjection'

type ApiSort = GetRaindropsByCollectionIdApiArg['sort']

/**
 * Load accumulated bookmark pages and expose awaitable writes for the current view.
 * RTK Query owns one cache per collection/sort/search/nested scope and refetches every
 * cached page after invalidation. Projection and mutation hooks own their separate state.
 * @returns Loaded rows, pagination/retry state, and CRUD operations with failure propagation.
 * @example const bookmarks = useRaindropsCrud({ collectionId: 'all', nested: true })
 */
export function useRaindropsCrud({
  collectionId,
  sort,
  search,
  nested = false,
}: UseRaindropsCrudOptions): UseRaindropsCrudReturn {
  const scopeKey = JSON.stringify([collectionId, sort, search, nested])
  const query = useGetBookmarkPagesInfiniteQuery({
    collectionId: collectionIdToApi(collectionId),
    sort,
    search: search || undefined,
    nested,
  })
  const {
    currentData: data,
    isLoading,
    isFetching,
    isError,
    isFetchNextPageError,
    refetch,
    hasNextPage,
    fetchNextPage,
  } = query
  const fetchedRaindrops = useMemo(() => {
    const unique = new Map<string, Raindrop>()
    // Overlapping pages expose a bookmark once; later server data wins for the same ID.
    for (const page of data?.pages ?? [])
      for (const item of page.items ?? []) {
        const bookmark = toUiRaindrop(item)
        unique.set(bookmark.id, bookmark)
      }
    return [...unique.values()]
  }, [data])
  const projection = useRaindropProjection(fetchedRaindrops, data, scopeKey)
  const mutations = useRaindropMutations(fetchedRaindrops, projection, scopeKey)
  const loadMore = useCallback((): void => {
    if (hasNextPage && !isFetching) void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetching])
  const retry = useCallback((): void => {
    // Retry the failed page itself; refetching only cached pages would leave load-more errors unresolved.
    if (isFetchNextPageError) void fetchNextPage()
    else void refetch()
  }, [fetchNextPage, isFetchNextPageError, refetch])
  return {
    raindrops: projection.raindrops,
    totalCount: data?.pages[0]?.count ?? 0,
    // An uncached scope change must show loading rather than a false empty-collection result.
    isLoading: isLoading || (isFetching && !data),
    isFetching,
    isError,
    retry,
    hasMore: hasNextPage,
    loadMore,
    ...mutations,
  }
}

interface UseRaindropsCrudOptions {
  /** UI collection ID ('all', 'unsorted', 'trash', or numeric string) */
  collectionId: string
  /** API sort field (e.g. '-created', 'title') */
  sort?: ApiSort
  /** Search query string */
  search?: string
  nested?: boolean
}

interface UseRaindropsCrudReturn {
  isError: boolean
  retry: () => void
  /** Accumulated raindrops across all loaded pages (UI type) */
  raindrops: Raindrop[]
  /** Total count from API (for progress indicator) */
  totalCount: number
  /** True during initial load (no cached data) */
  isLoading: boolean
  /** True while fetching (including background refetch) */
  isFetching: boolean
  /** True if more pages are available */
  hasMore: boolean
  /** Load the next page of results */
  loadMore: () => void
  /** Create a new raindrop from form data */
  createRaindrop: (data: CreateBookmarkData) => Promise<void>
  /** Update a raindrop by ID with partial UI fields */
  updateRaindrop: (id: string, data: Partial<Raindrop>) => Promise<void>
  /** Delete a raindrop by ID */
  deleteRaindrop: (id: string) => Promise<void>
  /** Move selected raindrops to a different collection */
  batchMoveToCollection: (
    ids: string[],
    targetCollectionId: string,
  ) => Promise<void>
  /** Add tags to selected raindrops */
  batchAddTag: (ids: string[], tags: string[]) => Promise<void>
  batchMarkImportant: (ids: string[]) => Promise<void>
  /** Delete selected raindrops */
  batchDeleteRaindrops: (ids: string[]) => Promise<void>
  /** Manual sort only: drop `activeRaindropId` onto `overRaindropId` (optimistic, persists `order`) */
  reorderRaindrop: (
    activeRaindropId: string,
    overRaindropId: string,
  ) => Promise<void>
}
