import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import { useAppDispatch } from '@/store/hooks'
import { setSelectedRaindropIds } from '@/store/slices/uiSlice'

import { PartialBookmarkBatchError } from './useRaindropBatchActions'
import type { useRaindropsCrud } from './useRaindropsCrud'
import { useTagsCrud } from './useTagsCrud'

/**
 * Connect bookmark and tag mutations to selection state and user feedback.
 * MainApp passes these handlers to views; partial batches keep only unfinished IDs selected.
 * @example const actions = useMainAppBookmarkActions(bookmarks)
 */
export function useMainAppBookmarkActions(
  operations: Pick<
    ReturnType<typeof useRaindropsCrud>,
    | 'raindrops'
    | 'createRaindrop'
    | 'updateRaindrop'
    | 'batchMoveToCollection'
    | 'batchAddTag'
    | 'batchDeleteRaindrops'
  >,
) {
  const dispatch = useAppDispatch()
  const { tags: allTags, renameTag, deleteTag, mergeTags } = useTagsCrud()
  const existingTags = useMemo(() => allTags.map((tag) => tag.name), [allTags])
  const {
    raindrops,
    createRaindrop,
    updateRaindrop,
    batchMoveToCollection,
    batchAddTag,
    batchDeleteRaindrops,
  } = operations
  const clearCompletedSelection = useCallback(
    (completedIds: string[]) => {
      const completed = new Set(completedIds)
      // Read at confirmation time so navigation or newly selected rows survive an older request.
      dispatch((currentDispatch, getState) => {
        const selectedIds: string[] = getState().ui.selectedRaindropIds
        currentDispatch(
          setSelectedRaindropIds(
            selectedIds.filter((id) => !completed.has(id)),
          ),
        )
      })
    },
    [dispatch],
  )
  const completeSelection = useCallback(
    async (ids: string[], operation: () => Promise<void>): Promise<void> => {
      try {
        await operation()
        clearCompletedSelection(ids)
      } catch (cause) {
        // Keep unconfirmed items available for retry instead of clearing the entire selection.
        if (cause instanceof PartialBookmarkBatchError)
          clearCompletedSelection(cause.completedIds)
        throw cause
      }
    },
    [clearCompletedSelection],
  )
  const handleBatchMove = useCallback(
    async (ids: string[], targetId: string): Promise<void> =>
      completeSelection(ids, async () => batchMoveToCollection(ids, targetId)),
    [batchMoveToCollection, completeSelection],
  )
  const handleBatchAddTag = useCallback(
    async (ids: string[], tags: string[]): Promise<void> =>
      completeSelection(ids, async () => batchAddTag(ids, tags)),
    [batchAddTag, completeSelection],
  )
  const handleBatchDelete = useCallback(
    async (ids: string[]): Promise<void> =>
      completeSelection(ids, async () => batchDeleteRaindrops(ids)),
    [batchDeleteRaindrops, completeSelection],
  )
  const handleRenameTag = useCallback(
    async (oldName: string, newName: string): Promise<void> =>
      renameTag('all', oldName, newName),
    [renameTag],
  )
  const handleDeleteTag = useCallback(
    async (name: string): Promise<void> => deleteTag('all', [name]),
    [deleteTag],
  )
  const handleMergeTags = useCallback(
    async (sources: string[], target: string): Promise<void> =>
      mergeTags('all', sources, target),
    [mergeTags],
  )
  const handleToggleImportant = useCallback(
    (id: string): void => {
      const bookmark = raindrops.find((item) => item.id === id)
      if (bookmark)
        void updateRaindrop(id, { isImportant: !bookmark.isImportant }).catch(
          () => toast.error('Could not change importance. Please retry.'),
        )
    },
    [raindrops, updateRaindrop],
  )
  return {
    allTags,
    existingTags,
    handleSaveBookmark: createRaindrop,
    handleBatchMove,
    handleBatchAddTag,
    handleBatchDelete,
    handleRenameTag,
    handleDeleteTag,
    handleMergeTags,
    handleToggleImportant,
  }
}
