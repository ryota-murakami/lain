import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  collectionIdToApi,
  toApiRaindropCreate,
  toApiRaindropUpdate,
  toUiRaindrop,
} from '@/lib/api-mappers'
import type { CreateBookmarkData } from '@/lib/api-mappers'
import { reorderRaindrops } from '@/lib/raindrop-organization'
import type { Raindrop } from '@/lib/types'
import {
  useDeleteRaindropByIdMutation,
  useDeleteRaindropsByCollectionIdMutation,
  useGetRaindropsByCollectionIdQuery,
  usePostRaindropMutation,
  usePutRaindropByIdMutation,
  usePutRaindropsByCollectionIdMutation,
} from '@/store/api/raindropApi'
import type { GetRaindropsByCollectionIdApiArg } from '@/store/api/raindropApi'

/** Items per page for Raindrop.io API (max 50) */
const PERPAGE = 50

/** Shared empty set so "nothing hidden" never allocates */
const EMPTY_ID_SET: ReadonlySet<string> = new Set()

/** API sort values accepted by `GET /raindrops/:collectionId` */
type ApiSort = GetRaindropsByCollectionIdApiArg['sort']

/**
 * Full CRUD + infinite scroll pagination for raindrops in a collection.
 *
 * Uses a `Map<page, Raindrop[]>` ref to accumulate pages and `useMemo`
 * to derive the flat list — no effects, no cascading renders. Resets
 * automatically on collection/sort/search changes and after create/delete.
 *
 * @param options - Collection ID (UI string), optional sort and search
 * @returns Accumulated raindrops, pagination controls, and CRUD functions
 *
 * @example
 *   const {
 *     raindrops, isLoading, hasMore, loadMore,
 *     createRaindrop, updateRaindrop, deleteRaindrop,
 *   } = useRaindropsCrud({ collectionId: 'all' })
 */
export function useRaindropsCrud({
  collectionId,
  sort,
  search,
}: UseRaindropsCrudOptions): UseRaindropsCrudReturn {
  const [page, setPage] = useState(0)
  const [resetKey, setResetKey] = useState(0)

  // Optimistic views laid over the fetched pages: rows hidden by an in-flight move and
  // the manual order of an in-flight reorder. Both drop as soon as fresh data arrives.
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(EMPTY_ID_SET)
  const [manualOrderIds, setManualOrderIds] = useState<string[] | null>(null)

  // Per-page data store — avoids effects for accumulation
  const pagesRef = useRef<Map<number, Raindrop[]>>(new Map())

  // Detect filter or reset-key changes → reset pagination during render
  // (Official React pattern: conditional setState during render)
  const [prevFilterKey, setPrevFilterKey] = useState('')
  const filterKey = `${collectionId}-${sort ?? ''}-${search ?? ''}-${resetKey}`
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey)
    setPage(0)
    pagesRef.current = new Map()
  }

  // Leaving the collection / sort / search scope discards optimistic views too
  const [prevScopeKey, setPrevScopeKey] = useState('')
  const scopeKey = `${collectionId}-${sort ?? ''}-${search ?? ''}`
  if (prevScopeKey !== scopeKey) {
    setPrevScopeKey(scopeKey)
    setHiddenIds(EMPTY_ID_SET)
    setManualOrderIds(null)
  }

  const apiCollectionId = collectionIdToApi(collectionId)

  const { data, isLoading, isFetching } = useGetRaindropsByCollectionIdQuery({
    collectionId: apiCollectionId,
    page,
    perpage: PERPAGE,
    sort,
    search: search || undefined,
  })

  // Store current page data in ref (safe during render — idempotent)
  if (data?.items) {
    pagesRef.current.set(page, data.items.map(toUiRaindrop))
  }

  // Fresh data (refetch after a mutation, next page) supersedes any optimistic view
  const [prevData, setPrevData] = useState(data)
  if (prevData !== data) {
    setPrevData(data)
    if (hiddenIds.size > 0) setHiddenIds(EMPTY_ID_SET)
    if (manualOrderIds) setManualOrderIds(null)
  }

  // Derive accumulated raindrops from all loaded pages
  const fetchedRaindrops = useMemo(() => {
    const result: Raindrop[] = []
    for (let p = 0; p <= page; p++) {
      const pageData = pagesRef.current.get(p)
      if (pageData) result.push(...pageData)
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagesRef is stable, data triggers recompute
  }, [data, page, resetKey])

  // Lay the optimistic views over the fetched pages
  const raindrops = useMemo(() => {
    const visible =
      hiddenIds.size > 0
        ? fetchedRaindrops.filter((raindrop) => !hiddenIds.has(raindrop.id))
        : fetchedRaindrops
    if (!manualOrderIds) return visible
    const position = new Map(manualOrderIds.map((id, index) => [id, index]))
    const positionOf = (raindrop: Raindrop) =>
      position.get(raindrop.id) ?? Number.MAX_SAFE_INTEGER
    return [...visible].sort((a, b) => positionOf(a) - positionOf(b))
  }, [fetchedRaindrops, hiddenIds, manualOrderIds])

  const totalCount = data?.count ?? 0
  const hasMore = fetchedRaindrops.length < totalCount

  const loadMore = useCallback(() => {
    if (hasMore && !isFetching) {
      setPage((p) => p + 1)
    }
  }, [hasMore, isFetching])

  // --- Mutations ---

  const [postRaindrop] = usePostRaindropMutation()
  const [putRaindrop] = usePutRaindropByIdMutation()
  const [deleteRaindropMutation] = useDeleteRaindropByIdMutation()
  const [batchUpdateMutation] = usePutRaindropsByCollectionIdMutation()
  const [batchDeleteMutation] = useDeleteRaindropsByCollectionIdMutation()

  const createRaindrop = useCallback(
    async (formData: CreateBookmarkData) => {
      const result = await postRaindrop({
        raindropCreate: toApiRaindropCreate(formData),
      })
      if ('data' in result) {
        toast.success('Bookmark created')
        setResetKey((k) => k + 1)
      }
    },
    [postRaindrop],
  )

  const updateRaindrop = useCallback(
    async (id: string, updates: Partial<Raindrop>) => {
      const result = await putRaindrop({
        id: Number(id),
        raindropUpdate: toApiRaindropUpdate(updates),
      })
      if ('data' in result) {
        toast.success('Bookmark updated')
      }
    },
    [putRaindrop],
  )

  const deleteRaindrop = useCallback(
    async (id: string) => {
      const result = await deleteRaindropMutation({ id: Number(id) })
      if ('data' in result) {
        toast.success('Bookmark deleted')
        setResetKey((k) => k + 1)
      }
    },
    [deleteRaindropMutation],
  )

  const batchMoveToCollection = useCallback(
    async (ids: string[], targetCollectionId: string) => {
      // Optimistic: the rows leave the list at once and only return if the API refuses
      setHiddenIds(new Set(ids))
      const result = await batchUpdateMutation({
        collectionId: apiCollectionId,
        raindropsBatchUpdateRequest: {
          ids: ids.map(Number),
          collection: { $id: collectionIdToApi(targetCollectionId) },
        },
      })
      if ('data' in result) {
        toast.success(`Moved ${ids.length} bookmarks`)
        setResetKey((k) => k + 1)
      } else {
        setHiddenIds(EMPTY_ID_SET)
      }
    },
    [batchUpdateMutation, apiCollectionId],
  )

  const reorderRaindrop = useCallback(
    async (activeRaindropId: string, overRaindropId: string) => {
      const nextOrder = reorderRaindrops(
        raindrops,
        activeRaindropId,
        overRaindropId,
      )
      if (nextOrder === raindrops) return
      const nextIds = nextOrder.map((raindrop) => raindrop.id)
      // Optimistic: show the new order now; the API gets the bookmark's new position
      setManualOrderIds(nextIds)
      const result = await putRaindrop({
        id: Number(activeRaindropId),
        raindropUpdate: { order: nextIds.indexOf(activeRaindropId) },
      })
      if (!('data' in result)) setManualOrderIds(null)
    },
    [putRaindrop, raindrops],
  )

  const batchAddTag = useCallback(
    async (ids: string[], tags: string[]) => {
      const result = await batchUpdateMutation({
        collectionId: apiCollectionId,
        raindropsBatchUpdateRequest: {
          ids: ids.map(Number),
          tags,
        },
      })
      if ('data' in result) {
        toast.success(`Tagged ${ids.length} bookmarks`)
        setResetKey((k) => k + 1)
      }
    },
    [batchUpdateMutation, apiCollectionId],
  )

  const batchDeleteRaindrops = useCallback(
    async (ids: string[]) => {
      const result = await batchDeleteMutation({
        collectionId: apiCollectionId,
        body: { ids: ids.map(Number) },
      })
      if ('data' in result) {
        toast.success(`Deleted ${ids.length} bookmarks`)
        setResetKey((k) => k + 1)
      }
    },
    [batchDeleteMutation, apiCollectionId],
  )

  return {
    raindrops,
    totalCount,
    isLoading,
    isFetching,
    hasMore,
    loadMore,
    createRaindrop,
    updateRaindrop,
    deleteRaindrop,
    batchMoveToCollection,
    batchAddTag,
    batchDeleteRaindrops,
    reorderRaindrop,
  }
}

interface UseRaindropsCrudOptions {
  /** UI collection ID ('all', 'unsorted', 'trash', or numeric string) */
  collectionId: string
  /** API sort field (e.g. '-created', 'title') */
  sort?: ApiSort
  /** Search query string */
  search?: string
}

interface UseRaindropsCrudReturn {
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
  /** Delete selected raindrops */
  batchDeleteRaindrops: (ids: string[]) => Promise<void>
  /** Manual sort only: drop `activeRaindropId` onto `overRaindropId` (optimistic, persists `order`) */
  reorderRaindrop: (
    activeRaindropId: string,
    overRaindropId: string,
  ) => Promise<void>
}
