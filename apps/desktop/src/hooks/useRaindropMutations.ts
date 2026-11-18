import { useCallback } from 'react'
import { toast } from 'sonner'

import { toApiRaindropCreate, toApiRaindropUpdate } from '@/lib/api-mappers'
import type { CreateBookmarkData } from '@/lib/api-mappers'
import { reorderRaindrops } from '@/lib/raindrop-organization'
import type { Raindrop } from '@/lib/types'
import {
  useDeleteRaindropByIdMutation,
  usePostRaindropMutation,
  usePutRaindropByIdMutation,
} from '@/store/api/raindropApi'

import { useRaindropBatchActions } from './useRaindropBatchActions'
import type { useRaindropProjection } from './useRaindropProjection'

/**
 * Own bookmark writes independently from infinite-page loading and optimistic rendering.
 * The CRUD hook supplies its projection so failed move/reorder operations roll back and reject.
 * @example const mutations = useRaindropMutations(fetchedRows, projection, scopeKey)
 */
export function useRaindropMutations(
  fetched: Raindrop[],
  projection: ReturnType<typeof useRaindropProjection>,
  scopeKey: string,
) {
  const [postRaindrop] = usePostRaindropMutation()
  const [putRaindrop] = usePutRaindropByIdMutation()
  const [deleteMutation] = useDeleteRaindropByIdMutation()
  const batch = useRaindropBatchActions(fetched, scopeKey)
  const { raindrops, hide, clearHidden, setOrder } = projection

  const createRaindrop = useCallback(
    async (data: CreateBookmarkData): Promise<void> => {
      await postRaindrop({ raindropCreate: toApiRaindropCreate(data) }).unwrap()
      toast.success('Bookmark created')
    },
    [postRaindrop],
  )
  const updateRaindrop = useCallback(
    async (id: string, updates: Partial<Raindrop>): Promise<void> => {
      await putRaindrop({
        id: Number(id),
        raindropUpdate: toApiRaindropUpdate(updates),
      }).unwrap()
      toast.success('Bookmark updated')
    },
    [putRaindrop],
  )
  const deleteRaindrop = useCallback(
    async (id: string): Promise<void> => {
      await deleteMutation({ id: Number(id) }).unwrap()
      toast.success('Bookmark deleted')
    },
    [deleteMutation],
  )
  const move = batch.batchMoveToCollection
  const batchMoveToCollection = useCallback(
    async (ids: string[], targetId: string): Promise<void> => {
      hide(ids)
      try {
        await move(ids, targetId)
      } catch (cause) {
        clearHidden()
        throw cause
      }
    },
    [clearHidden, hide, move],
  )
  const reorderRaindrop = useCallback(
    async (activeId: string, overId: string): Promise<void> => {
      const order = reorderRaindrops(raindrops, activeId, overId)
      if (order === raindrops) return
      const ids = order.map((bookmark) => bookmark.id)
      setOrder(ids)
      try {
        await putRaindrop({
          id: Number(activeId),
          raindropUpdate: { order: ids.indexOf(activeId) },
        }).unwrap()
      } catch (cause) {
        setOrder(null)
        throw cause
      }
    },
    [putRaindrop, raindrops, setOrder],
  )
  return {
    ...batch,
    createRaindrop,
    updateRaindrop,
    deleteRaindrop,
    batchMoveToCollection,
    reorderRaindrop,
  }
}
