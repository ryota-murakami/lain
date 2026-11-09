import { useCallback, useRef } from 'react'
import { toast } from 'sonner'

import { collectionIdToApi } from '@/lib/api-mappers'
import { groupSelectedRaindrops } from '@/lib/raindrop-organization'
import type { Raindrop } from '@/lib/types'
import {
  useDeleteRaindropsByCollectionIdMutation,
  usePutRaindropsByCollectionIdMutation,
} from '@/store/api/raindropApi'
import type { RaindropsBatchUpdateRequest } from '@/store/api/raindropApi'

/**
 * Describe confirmed partial progress so the UI retains only unfinished selections.
 * The batch hook throws this after at least one source collection succeeds.
 * @example if (error instanceof PartialBookmarkBatchError) select(error.remainingIds)
 */
export class PartialBookmarkBatchError extends Error {
  readonly completedIds: string[]
  readonly remainingIds: string[]

  constructor(completedIds: string[], remainingIds: string[], cause: unknown) {
    super(
      `Completed ${completedIds.length} bookmarks. ${remainingIds.length} remain; retry to finish the selection.`,
      { cause },
    )
    this.name = 'PartialBookmarkBatchError'
    this.completedIds = completedIds
    this.remainingIds = remainingIds
  }
}

interface BatchProgress {
  key: string
  completedIds: string[]
  remainingIds: string[]
}

/**
 * Apply bulk changes through concrete source collections and resume confirmed partial progress.
 * The CRUD hook supplies the loaded snapshot. Repeating the same failed operation skips IDs
 * already confirmed by the service, even after they disappear from the source query.
 * @param scopeKey - Separates retries across collection, search and sort scopes.
 * @returns Awaitable bulk actions that reject failures instead of reporting partial success.
 * @example const actions = useRaindropBatchActions(bookmarks, scopeKey)
 */
export function useRaindropBatchActions(
  fetchedRaindrops: Raindrop[],
  scopeKey: string,
) {
  const [updateMutation] = usePutRaindropsByCollectionIdMutation()
  const [deleteMutation] = useDeleteRaindropsByCollectionIdMutation()
  const progressRef = useRef<BatchProgress | null>(null)
  const activeRef = useRef(false)

  const run = useCallback(
    async (
      kind: 'update' | 'delete',
      ids: string[],
      changes?: Omit<RaindropsBatchUpdateRequest, 'ids'>,
    ): Promise<void> => {
      if (activeRef.current)
        throw new Error(
          'Another bookmark operation is still running. Please wait.',
        )
      const uniqueIds = [...new Set(ids)]
      if (uniqueIds.length === 0) return
      const key = JSON.stringify([
        scopeKey,
        kind,
        [...uniqueIds].sort(),
        changes,
      ])
      const progress =
        progressRef.current?.key === key
          ? progressRef.current
          : { key, completedIds: [], remainingIds: uniqueIds }
      const sources = groupSelectedRaindrops(
        fetchedRaindrops,
        progress.remainingIds,
      )
      progressRef.current = progress
      activeRef.current = true
      try {
        // A service confirmation is the only event that advances this retry cursor.
        for (const [source, selected] of sources) {
          const collectionId = collectionIdToApi(source)
          const response =
            kind === 'delete'
              ? await deleteMutation({
                  collectionId,
                  body: { ids: selected.map(Number) },
                }).unwrap()
              : await updateMutation({
                  collectionId,
                  raindropsBatchUpdateRequest: {
                    ...changes,
                    ids: selected.map(Number),
                  },
                }).unwrap()
          if (response.result !== true)
            throw new Error('The service did not confirm the bookmark changes.')
          progress.completedIds.push(...selected)
          const completed = new Set(selected)
          progress.remainingIds = progress.remainingIds.filter(
            (id) => !completed.has(id),
          )
        }
        progressRef.current = null
      } catch (cause) {
        if (progress.completedIds.length > 0)
          throw new PartialBookmarkBatchError(
            [...progress.completedIds],
            [...progress.remainingIds],
            cause,
          )
        throw cause
      } finally {
        activeRef.current = false
      }
    },
    [deleteMutation, fetchedRaindrops, scopeKey, updateMutation],
  )

  const batchMoveToCollection = useCallback(
    async (ids: string[], targetId: string): Promise<void> => {
      await run('update', ids, {
        collection: { $id: collectionIdToApi(targetId) },
      })
      if (ids.length) toast.success(`Moved ${new Set(ids).size} bookmarks`)
    },
    [run],
  )
  const batchAddTag = useCallback(
    async (ids: string[], tags: string[]): Promise<void> => {
      await run('update', ids, { tags })
      if (ids.length) toast.success(`Tagged ${new Set(ids).size} bookmarks`)
    },
    [run],
  )
  const batchMarkImportant = useCallback(
    async (ids: string[]): Promise<void> => {
      await run('update', ids, { important: true })
      if (ids.length)
        toast.success(`Marked ${new Set(ids).size} bookmarks important`)
    },
    [run],
  )
  const batchDeleteRaindrops = useCallback(
    async (ids: string[]): Promise<void> => {
      await run('delete', ids)
      if (ids.length) toast.success(`Deleted ${new Set(ids).size} bookmarks`)
    },
    [run],
  )
  return {
    batchMoveToCollection,
    batchAddTag,
    batchMarkImportant,
    batchDeleteRaindrops,
  }
}
