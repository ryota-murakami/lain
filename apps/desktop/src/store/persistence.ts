import { ACTION_HYDRATE_COMPLETE } from '@laststance/redux-storage-middleware'
import type { Reducer, UnknownAction } from '@reduxjs/toolkit'

import { uiSlice } from './slices/uiSlice'

type UiState = ReturnType<typeof uiSlice.reducer>

/**
 * Reset ephemeral `ui` state right after localStorage hydration so the app always
 * starts on All Bookmarks with no selection and the detail panel closed (SPEC §3.5).
 * Needed because the storage middleware persists slices wholesale and its hydration
 * reducer returns the persisted payload without consulting slice reducers.
 * Wraps the hydrated reducer returned by {@link createStorageMiddleware} in `store/index.ts`.
 *
 * @param reducer - Hydration-aware root reducer produced by the storage middleware
 * @returns Reducer with identical behavior except on `ACTION_HYDRATE_COMPLETE`, where
 *   `selectedCollectionId` / `selectedRaindropIds` / `isDetailPanelOpen` are reset
 * @example
 *   const reducer = withEphemeralUiReset(hydratedReducer)
 *   reducer(state, { type: ACTION_HYDRATE_COMPLETE, payload: { ...state, ui: persistedUi } })
 *   // => ui.selectedCollectionId === 'all', ui.viewMode === persistedUi.viewMode
 */
export function withEphemeralUiReset<S extends { ui: UiState }>(
  reducer: Reducer<S>,
): Reducer<S> {
  const initialUi = uiSlice.getInitialState()
  return (state, action: UnknownAction) => {
    const nextState = reducer(state, action)
    // Only the hydration payload can carry stale ephemeral values
    if (action.type !== ACTION_HYDRATE_COMPLETE) return nextState
    return {
      ...nextState,
      ui: {
        ...nextState.ui,
        selectedCollectionId: initialUi.selectedCollectionId,
        selectedRaindropIds: initialUi.selectedRaindropIds,
        isDetailPanelOpen: initialUi.isDetailPanelOpen,
      },
    }
  }
}
