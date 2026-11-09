import { createSelector, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

import type { ViewMode } from '@/lib/types'

import { setDefaultViewMode } from './settingsSlice'

/**
 * UI state for layout, view modes, and selection.
 *
 * @example
 *   dispatch(setViewMode('table'))
 *   dispatch(setSelectedCollectionId('123'))
 *   const mode = useAppSelector(state => state.ui.viewMode)
 */
interface UiState {
  accountId?: number
  viewMode: ViewMode
  collectionIcons: Record<string, string>
  collectionColors: Record<string, string>
  expandedCollectionIds: string[]
  selectedCollectionId: string
  isDetailPanelOpen: boolean
  sidebarWidth: number
  selectedRaindropIds: string[]
  collectionViewModes: Record<string, ViewMode>
}

const initialState: UiState = {
  viewMode: 'list',
  collectionIcons: {},
  collectionColors: {},
  expandedCollectionIds: [],
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
    resetAccountUi() {
      return initialState
    },
    setUiAccountId(state, action: PayloadAction<number>) {
      state.accountId = action.payload
    },
    setCollectionColor(
      state,
      action: PayloadAction<{ id: string; color: string }>,
    ) {
      state.collectionColors ??= {}
      state.collectionColors[action.payload.id] = action.payload.color
    },
    setCollectionIcon(
      state,
      action: PayloadAction<{ id: string; icon: string }>,
    ) {
      state.collectionIcons ??= {}
      state.collectionIcons[action.payload.id] = action.payload.icon
    },
    setExpandedCollectionIds(state, action: PayloadAction<string[]>) {
      state.expandedCollectionIds = action.payload
    },
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
    setSelectedRaindropIds(state, action: PayloadAction<string[]>) {
      state.selectedRaindropIds = action.payload
    },
    selectAllRaindrops(state, action: PayloadAction<string[]>) {
      state.selectedRaindropIds = action.payload
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
  extraReducers: (builder) => {
    builder.addCase(setDefaultViewMode, (state, action) => {
      state.viewMode = action.payload
    })
  },
})

export const {
  resetAccountUi,
  setUiAccountId,
  setCollectionIcon,
  setCollectionColor,
  setExpandedCollectionIds,
  setViewMode,
  setSelectedCollectionId,
  setDetailPanelOpen,
  setSelectedRaindropIds,
  selectAllRaindrops,
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

/** Apply this account's persisted display preferences after the sidebar refreshes remote collection metadata. */
export const getCollectionAppearance = createSelector(
  [
    (state: { ui: UiState }) => state.ui.collectionIcons,
    (state: { ui: UiState }) => state.ui.collectionColors,
  ],
  (icons, colors) => ({ icons: icons ?? {}, colors: colors ?? {} }),
)
