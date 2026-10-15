import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { login, logout } from './slices/authSlice'
import { setTheme } from './slices/settingsSlice'

import type { AppDispatch, RootState } from './index'

/**
 * Typed version of useDispatch for the Lain Redux store.
 * Use this instead of plain `useDispatch` for correct action typing.
 *
 * @example
 *   const dispatch = useAppDispatch()
 *   dispatch(setViewMode('grid'))
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()

/**
 * Typed version of useSelector for the Lain Redux store.
 * Use this instead of plain `useSelector` for correct state typing.
 *
 * @example
 *   const viewMode = useAppSelector(state => state.ui.viewMode)
 *   const query = useAppSelector(state => state.search.query)
 */
export const useAppSelector = useSelector.withTypes<RootState>()

/**
 * Access current theme state and setter.
 * Drop-in replacement for the old Context-based useTheme().
 *
 * @returns theme (user preference), resolvedTheme (computed 'light'|'dark'), setTheme
 * @example
 *   const { resolvedTheme, setTheme } = useTheme()
 *   setTheme('dark')
 */
export function useTheme() {
  const theme = useAppSelector((s) => s.settings.theme)
  const resolvedTheme = useAppSelector((s) => s.settings.resolvedTheme)
  const dispatch = useAppDispatch()
  const setThemeAction = useCallback(
    (t: 'light' | 'dark' | 'system') => dispatch(setTheme(t)),
    [dispatch],
  )
  return { theme, resolvedTheme, setTheme: setThemeAction } as const
}

/**
 * Access auth state and actions.
 * Drop-in replacement for the old Context-based useAuth().
 *
 * @returns Auth state (isAuthenticated, isLoading, user) and actions (login, logout)
 * @example
 *   const { isAuthenticated, user, login, logout } = useAuth()
 */
export function useAuth() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated)
  const isLoading = useAppSelector((s) => s.auth.isLoading)
  const user = useAppSelector((s) => s.auth.user)
  const dispatch = useAppDispatch()
  const loginAction = useCallback(async () => dispatch(login()), [dispatch])
  const logoutAction = useCallback(async () => dispatch(logout()), [dispatch])
  return {
    isAuthenticated,
    isLoading,
    user,
    login: loginAction,
    logout: logoutAction,
  } as const
}
