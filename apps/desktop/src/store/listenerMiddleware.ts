import { createListenerMiddleware } from '@reduxjs/toolkit'
import type { TypedStartListening } from '@reduxjs/toolkit'

import { setAuthLoading, setAuthState } from './slices/authSlice'
import { setResolvedTheme, setTheme } from './slices/settingsSlice'

import type { AppDispatch, RootState } from './index'

export const listenerMiddleware = createListenerMiddleware()

type AppStartListening = TypedStartListening<RootState, AppDispatch>
const startAppListening = listenerMiddleware.startListening as AppStartListening

// ─── Theme Helpers ──────────────────────────────────────────

/**
 * Resolve a theme preference into an actual 'light' or 'dark' value.
 * When 'system', checks the OS-level prefers-color-scheme media query.
 *
 * @param theme - User preference: 'light' | 'dark' | 'system'
 * @returns The resolved theme value
 * @example
 *   resolveTheme('system') // => 'dark' (if OS is dark mode)
 *   resolveTheme('light')  // => 'light'
 */
function resolveTheme(theme: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return theme
}

/**
 * Apply the resolved theme class to the document root element.
 * Removes both 'light' and 'dark' classes, then adds the resolved one.
 *
 * @param resolved - The actual theme to apply
 * @example
 *   applyThemeToDOM('dark') // <html class="dark">
 */
function applyThemeToDOM(resolved: 'light' | 'dark'): void {
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(resolved)
}

// ─── Theme Listener ─────────────────────────────────────────

// React from setTheme dispatch → resolve system preference → apply DOM class
startAppListening({
  actionCreator: setTheme,
  effect: (action, listenerApi) => {
    const resolved = resolveTheme(action.payload)
    listenerApi.dispatch(setResolvedTheme(resolved))
    applyThemeToDOM(resolved)
  },
})

// ─── Setup Functions (called once after store creation) ─────

interface StoreRef {
  getState: () => RootState
  dispatch: AppDispatch
}

/**
 * Initialize theme: apply persisted theme to DOM + subscribe to OS theme changes.
 * Must be called once immediately after store creation.
 *
 * @param store - Redux store reference
 * @example
 *   const store = configureStore({ ... })
 *   setupThemeListeners(store)
 */
export function setupThemeListeners(store: StoreRef): void {
  // Apply persisted theme immediately (synchronous — no FOUC)
  const theme = store.getState().settings.theme
  const resolved = resolveTheme(theme)
  store.dispatch(setResolvedTheme(resolved))
  applyThemeToDOM(resolved)

  // Subscribe to OS-level theme changes for 'system' mode
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      const currentTheme = store.getState().settings.theme
      if (currentTheme === 'system') {
        const newResolved = resolveTheme('system')
        store.dispatch(setResolvedTheme(newResolved))
        applyThemeToDOM(newResolved)
      }
    })
}

/**
 * Initialize auth: check stored auth state via IPC + subscribe to auth changes.
 * Must be called once immediately after store creation.
 *
 * @param store - Redux store reference
 * @example
 *   const store = configureStore({ ... })
 *   setupAuthListeners(store)
 */
export function setupAuthListeners(store: StoreRef): void {
  // Check initial auth state from main process
  window.auth
    .getState()
    .then((state) => {
      store.dispatch(setAuthState(state))
    })
    .catch(() => {
      store.dispatch(setAuthState({ isAuthenticated: false, user: null }))
    })
    .finally(() => {
      store.dispatch(setAuthLoading(false))
    })

  // Subscribe to auth state changes pushed from main process
  window.auth.onAuthStateChanged((state) => {
    store.dispatch(setAuthState(state))
    store.dispatch(setAuthLoading(false))
  })
}
