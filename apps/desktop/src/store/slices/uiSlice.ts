import { createSelector, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

import type { ViewMode } from '@/lib/types'

/**
 * UI state for layout, view modes, and selection.
 *
 * @example
 *   dispatch(setViewMode('table'))
 *   dispatch(setSelectedCollectionId('123'))
 *   const mode = useAppSelector(state => state.ui.viewMode)
 */
interface UiState {
  viewMode: ViewMode
  selectedCollectionId: string
  isDetailPanelOpen: boolean
  sidebarWidth: number
  selectedRaindropIds: string[]
  collectionViewModes: Record<string, ViewMode>
}

const initialState: UiState = {
  viewMode: 'list',
  selectedCollectionId: 'all',
  isDetailPanelOpen: false,
  sidebarWidth: 260,
  selectedRaindropIds: [],
  collectionViewModes: {},
}

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setViewMode(state, action: PayloadAction<ViewMode>) {
      state.viewMode = action.payload
    },
    setSelectedCollectionId(state, action: PayloadAction<string>) {
      state.selectedCollectionId = action.payload
      state.selectedRaindropIds = []
    },
    setDetailPanelOpen(state, action: PayloadAction<boolean>) {
      state.isDetailPanelOpen = action.payload
    },
    setSidebarWidth(state, action: PayloadAction<number>) {
      state.sidebarWidth = action.payload
    },
    setSelectedRaindropIds(state, action: PayloadAction<string[]>) {
      state.selectedRaindropIds = action.payload
    },
    toggleRaindropSelection(state, action: PayloadAction<string>) {
      const id = action.payload
      const index = state.selectedRaindropIds.indexOf(id)
      if (index >= 0) {
        state.selectedRaindropIds.splice(index, 1)
      } else {
        state.selectedRaindropIds.push(id)
      }
    },
    selectAllRaindrops(state, action: PayloadAction<string[]>) {
      state.selectedRaindropIds = action.payload
    },
    clearSelection(state) {
      state.selectedRaindropIds = []
    },
    setCollectionViewMode(
      state,
      action: PayloadAction<{ collectionId: string; viewMode: ViewMode }>,
    ) {
      state.collectionViewModes[action.payload.collectionId] =
        action.payload.viewMode
    },
    clearCollectionViewMode(state, action: PayloadAction<string>) {
      delete state.collectionViewModes[action.payload]
    },
  },
})

export const {
  setViewMode,
  setSelectedCollectionId,
  setDetailPanelOpen,
  setSidebarWidth,
  setSelectedRaindropIds,
  toggleRaindropSelection,
  selectAllRaindrops,
  clearSelection,
  setCollectionViewMode,
  clearCollectionViewMode,
} = uiSlice.actions

/**
 * Select the effective view mode: per-collection override > global default.
 * @example
 *   const viewMode = useAppSelector(getEffectiveViewMode) // 'grid' | 'list' | ...
 */
export const getEffectiveViewMode = createSelector(
  [
    (state: { ui: UiState }) => state.ui.collectionViewModes,
    (state: { ui: UiState }) => state.ui.selectedCollectionId,
    (state: { ui: UiState }) => state.ui.viewMode,
  ],
  (collectionViewModes, selectedCollectionId, viewMode) =>
    collectionViewModes[selectedCollectionId] ?? viewMode,
)

/**
 * Whether the selected collection is remembered with its own view mode (F3.3).
 * @example
 *   const isRemembered = useAppSelector(getHasCollectionViewModeOverride) // true | false
 */
export const getHasCollectionViewModeOverride = (state: {
  ui: UiState
}): boolean => state.ui.selectedCollectionId in state.ui.collectionViewModes
