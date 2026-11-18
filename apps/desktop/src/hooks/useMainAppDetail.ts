import { useCallback, useState } from 'react'

import type { Raindrop } from '@/lib/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { setDetailPanelOpen } from '@/store/slices/uiSlice'

import type { useRaindropsCrud } from './useRaindropsCrud'

/**
 * Own detail selection, unsaved-edit protection and confirmed save/delete transitions.
 * MainApp uses this hook so failed mutations never discard the active editor.
 * @example const detail = useMainAppDetail(bookmarkOperations)
 */
export function useMainAppDetail({
  updateRaindrop,
  deleteRaindrop,
}: Pick<
  ReturnType<typeof useRaindropsCrud>,
  'updateRaindrop' | 'deleteRaindrop'
>) {
  const dispatch = useAppDispatch()
  const isDetailPanelOpen = useAppSelector(
    (state) => state.ui.isDetailPanelOpen,
  )
  const [selectedRaindrop, setSelectedRaindrop] = useState<
    Raindrop | undefined
  >()
  const [detailRevision, setDetailRevision] = useState(0)
  const [detailDirty, setDetailDirty] = useState(false)
  const confirmDiscardDetail = useCallback((): boolean => {
    if (!detailDirty) return true
    if (!window.confirm('Discard unsaved bookmark edits?')) return false
    setDetailRevision((revision) => revision + 1)
    setDetailDirty(false)
    return true
  }, [detailDirty])

  const handleSelectRaindrop = useCallback(
    (raindrop: Raindrop) => {
      if (selectedRaindrop?.id !== raindrop.id && !confirmDiscardDetail())
        return
      setSelectedRaindrop(raindrop)
      dispatch(setDetailPanelOpen(true))
    },
    [dispatch, confirmDiscardDetail, selectedRaindrop?.id],
  )

  // ↑/↓ only highlight (and feed an already-open detail panel); Space decides the panel
  const handleFocusRaindrop = useCallback(
    (raindrop: Raindrop) => {
      if (!detailDirty) setSelectedRaindrop(raindrop)
    },
    [detailDirty],
  )

  const handleTogglePreview = useCallback(
    (raindrop: Raindrop) => {
      if (!confirmDiscardDetail()) return
      setSelectedRaindrop(raindrop)
      dispatch(setDetailPanelOpen(!isDetailPanelOpen))
    },
    [dispatch, isDetailPanelOpen, confirmDiscardDetail],
  )

  const handleCloseDetailPanel = useCallback(() => {
    if (confirmDiscardDetail()) dispatch(setDetailPanelOpen(false))
  }, [dispatch, confirmDiscardDetail])

  // A closed panel can reopen the retained bookmark; an empty panel has no meaningful open action.
  const openRetainedDetail = useCallback(
    () => dispatch(setDetailPanelOpen(true)),
    [dispatch],
  )

  const handleSaveRaindrop = useCallback(
    async (raindrop: Raindrop) => updateRaindrop(raindrop.id, raindrop),
    [updateRaindrop],
  )

  const handleDeleteRaindrop = useCallback(
    async (raindropId: string): Promise<void> => {
      await deleteRaindrop(raindropId)
      setSelectedRaindrop(undefined)
      setDetailDirty(false)
      dispatch(setDetailPanelOpen(false))
    },
    [deleteRaindrop, dispatch],
  )

  return {
    selectedRaindrop,
    detailRevision,
    detailDirty,
    setDetailDirty,
    isDetailPanelOpen,
    handleSelectRaindrop,
    handleFocusRaindrop,
    handleTogglePreview,
    handleCloseDetailPanel,
    handleOpenDetailPanel: selectedRaindrop ? openRetainedDetail : undefined,
    handleSaveRaindrop,
    handleDeleteRaindrop,
  }
}
