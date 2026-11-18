import { useCallback } from 'react'

import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  closeAddBookmark,
  closeMergeDialog,
  closeSettings,
  closeTagManagement,
  openAddBookmark,
  openMergeDialog,
  openTagManagement,
} from '@/store/slices/dialogSlice'

/**
 * Connect simple toolbar dialogs to Redux while remembering the current bookmark destination.
 * Collection and group editors own their richer draft state in dedicated hooks.
 * @example const dialogs = useMainAppDialogs(selectedCollectionId)
 */
export function useMainAppDialogs(selectedCollectionId: string) {
  const dispatch = useAppDispatch()
  const dialogs = useAppSelector((state) => state.dialog)
  const defaultCollectionId = ['all', 'trash'].includes(selectedCollectionId)
    ? undefined
    : selectedCollectionId
  const handleAddBookmark = useCallback(
    () =>
      dispatch(
        openAddBookmark(
          defaultCollectionId ? { defaultCollectionId } : undefined,
        ),
      ),
    [dispatch, defaultCollectionId],
  )
  const handleManageTags = useCallback(
    () => dispatch(openTagManagement()),
    [dispatch],
  )
  const handleOpenMerge = useCallback(
    () => dispatch(openMergeDialog()),
    [dispatch],
  )
  const handleAddBookmarkOpenChange = useCallback(
    (open: boolean): void => {
      if (!open) dispatch(closeAddBookmark())
    },
    [dispatch],
  )
  const handleTagManagementOpenChange = useCallback(
    (open: boolean): void => {
      if (!open) dispatch(closeTagManagement())
    },
    [dispatch],
  )
  const handleMergeDialogOpenChange = useCallback(
    (open: boolean): void => {
      if (!open) dispatch(closeMergeDialog())
    },
    [dispatch],
  )
  const handleSettingsOpenChange = useCallback(
    (open: boolean): void => {
      if (!open) dispatch(closeSettings())
    },
    [dispatch],
  )
  return {
    defaultCollectionId,
    isAddBookmarkOpen: dialogs.addBookmark.open,
    isTagManagementOpen: dialogs.tagManagement.open,
    isMergeDialogOpen: dialogs.mergeDialog.open,
    isSettingsOpen: dialogs.settings.open,
    settingsTab: dialogs.settings.tab,
    handleAddBookmark,
    handleManageTags,
    handleOpenMerge,
    handleAddBookmarkOpenChange,
    handleTagManagementOpenChange,
    handleMergeDialogOpenChange,
    handleSettingsOpenChange,
  }
}
