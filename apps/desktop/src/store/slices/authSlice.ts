import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

import type { AuthState, RaindropUser } from '@/lib/types'

/**
 * Authentication state managed by Redux.
 * IPC subscription in listenerMiddleware pushes state changes from main process.
 *
 * @example
 *   const { isAuthenticated, user, isLoading } = useAppSelector(s => s.auth)
 */
interface AuthSliceState {
  isAuthenticated: boolean
  user: RaindropUser | null
  isLoading: boolean
}

const initialState: AuthSliceState = {
  isAuthenticated: false,
  user: null,
  isLoading: true, // Wait for IPC getState() response before showing UI
}

/**
 * Trigger Raindrop.io OAuth login flow via IPC.
 * Actual state update arrives via onAuthStateChanged subscription in listenerMiddleware.
 *
 * @example
 *   dispatch(login())
 */
export const login = createAsyncThunk('auth/login', async (_, { dispatch }) => {
  dispatch(authSlice.actions.setAuthLoading(true))
  try {
    await window.auth.login()
  } catch {
    dispatch(authSlice.actions.setAuthLoading(false))
  }
})

/**
 * Trigger logout via IPC.
 * State update arrives via onAuthStateChanged subscription in listenerMiddleware.
 *
 * @example
 *   dispatch(logout())
 */
export const logout = createAsyncThunk('auth/logout', async () => {
  await window.auth.logout()
})

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthState(state, action: PayloadAction<AuthState>) {
      state.isAuthenticated = action.payload.isAuthenticated
      state.user = action.payload.user
    },
    setAuthLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload
    },
  },
})

export const { setAuthState, setAuthLoading } = authSlice.actions
