import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

/**
 * Dialog state for managing open/close of all modal dialogs.
 * Each dialog has an `open` boolean and optional context data.
 *
 * @example
 *   dispatch(openAddBookmark({ defaultCollectionId: '123' }))
 *   dispatch(closeAddBookmark())
 *   const isOpen = useAppSelector(state => state.dialog.addBookmark.open)
 */
interface DialogState {
  addBookmark: { open: boolean; defaultCollectionId?: string }
  collectionDialog: { open: boolean; editingId?: string }
  groupDialog: { open: boolean; editingId?: string }
  tagManagement: { open: boolean }
  mergeDialog: { open: boolean }
  settings: { open: boolean; tab?: string }
}

const initialState: DialogState = {
  addBookmark: { open: false },
  collectionDialog: { open: false },
  groupDialog: { open: false },
  tagManagement: { open: false },
  mergeDialog: { open: false },
  settings: { open: false },
}

export const dialogSlice = createSlice({
  name: 'dialog',
  initialState,
  reducers: {
    openAddBookmark(
      state,
      action: PayloadAction<{ defaultCollectionId?: string } | undefined>,
    ) {
      state.addBookmark = {
        open: true,
        defaultCollectionId: action.payload?.defaultCollectionId,
      }
    },
    closeAddBookmark(state) {
      state.addBookmark = { open: false }
    },
    openCollectionDialog(
      state,
      action: PayloadAction<{ editingId?: string } | undefined>,
    ) {
      state.collectionDialog = {
        open: true,
        editingId: action.payload?.editingId,
      }
    },
    closeCollectionDialog(state) {
      state.collectionDialog = { open: false }
    },
    openGroupDialog(
      state,
      action: PayloadAction<{ editingId?: string } | undefined>,
    ) {
      state.groupDialog = {
        open: true,
        editingId: action.payload?.editingId,
      }
    },
    closeGroupDialog(state) {
      state.groupDialog = { open: false }
    },
    openTagManagement(state) {
      state.tagManagement = { open: true }
    },
    closeTagManagement(state) {
      state.tagManagement = { open: false }
    },
    openMergeDialog(state) {
      state.mergeDialog = { open: true }
    },
    closeMergeDialog(state) {
      state.mergeDialog = { open: false }
    },
    openSettings(state, action: PayloadAction<{ tab?: string } | undefined>) {
      state.settings = { open: true, tab: action.payload?.tab }
    },
    closeSettings(state) {
      state.settings = { open: false }
    },
  },
})

export const {
  openAddBookmark,
  closeAddBookmark,
  openCollectionDialog,
  closeCollectionDialog,
  openGroupDialog,
  closeGroupDialog,
  openTagManagement,
  closeTagManagement,
  openMergeDialog,
  closeMergeDialog,
  openSettings,
  closeSettings,
} = dialogSlice.actions
