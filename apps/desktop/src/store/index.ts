import { createStorageMiddleware } from '@laststance/redux-storage-middleware'
import { combineReducers, configureStore } from '@reduxjs/toolkit'

import { api } from './api/emptyApi'
import {
  listenerMiddleware,
  setupAuthListeners,
  setupThemeListeners,
} from './listenerMiddleware'
import { withEphemeralUiReset } from './persistence'
import { authSlice } from './slices/authSlice'
import { dialogSlice } from './slices/dialogSlice'
import { searchSlice } from './slices/searchSlice'
import { hydrateShortcuts, settingsSlice } from './slices/settingsSlice'
import { uiSlice } from './slices/uiSlice'

/**
 * Root reducer combining all slices and RTK Query API.
 */
const rootReducer = combineReducers({
  [api.reducerPath]: api.reducer,
  ui: uiSlice.reducer,
  search: searchSlice.reducer,
  dialog: dialogSlice.reducer,
  settings: settingsSlice.reducer,
  auth: authSlice.reducer,
})

export type RootState = ReturnType<typeof rootReducer>

/**
 * Storage middleware for localStorage persistence.
 * Persists: ui (viewMode, sidebarWidth, collectionViewModes),
 *           search (recentSearches), settings (shortcuts, theme, defaultViewMode).
 * Does NOT persist: RTK Query cache, dialog states, auth (checked via IPC on launch).
 * The `ui` slice is stored wholesale, so {@link withEphemeralUiReset} discards the
 * selected collection / selection / detail panel state after hydration (SPEC §3.5).
 */
const {
  middleware: storageMiddleware,
  reducer,
  api: storageApi,
} = createStorageMiddleware<RootState>({
  rootReducer,
  key: 'lain-state',
  slices: ['ui', 'search', 'settings'],
})

/**
 * Redux store configured with listener middleware, RTK Query, and storage persistence.
 * Theme DOM operations and auth IPC subscriptions are managed by listenerMiddleware.
 *
 * @example
 *   // In App.tsx
 *   <Provider store={store}>
 *     <App />
 *   </Provider>
 *
 *   // In components
 *   const dispatch = useAppDispatch()
 *   const viewMode = useAppSelector(state => state.ui.viewMode)
 */
export const store = configureStore({
  reducer: withEphemeralUiReset(reducer),
  middleware: (getDefault) =>
    getDefault()
      .prepend(listenerMiddleware.middleware)
      .concat(api.middleware, storageMiddleware),
})

// Initialize side effects after store creation (synchronous for theme, async for auth)
setupThemeListeners(store)
setupAuthListeners(store)

// Merge persisted shortcuts with defaults so new shortcuts from code updates appear.
// Must run AFTER storage middleware finishes hydrating from localStorage,
// otherwise HYDRATE_COMPLETE overwrites our merged map via microtask.
storageApi.onFinishHydration(() => {
  store.dispatch(hydrateShortcuts())
})

// Expose store for E2E testing (allows verifying Redux state in Playwright tests)
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__STORE__ = store
}

export type AppDispatch = typeof store.dispatch
export { storageApi }
