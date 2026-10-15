import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { render, renderHook } from '@testing-library/react'
import type { RenderOptions, RenderHookOptions } from '@testing-library/react'
import { Provider } from 'react-redux'

import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/store/api/emptyApi'
import { authSlice } from '@/store/slices/authSlice'
import { dialogSlice } from '@/store/slices/dialogSlice'
import { searchSlice } from '@/store/slices/searchSlice'
import { settingsSlice } from '@/store/slices/settingsSlice'
import { uiSlice } from '@/store/slices/uiSlice'

const rootReducer = combineReducers({
  [api.reducerPath]: api.reducer,
  ui: uiSlice.reducer,
  search: searchSlice.reducer,
  dialog: dialogSlice.reducer,
  settings: settingsSlice.reducer,
  auth: authSlice.reducer,
})

type RootState = ReturnType<typeof rootReducer>

interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: Partial<RootState>
}

/**
 * Render a component wrapped in all required providers for testing.
 * Creates a fresh Redux store per test to avoid state leaks.
 * No listenerMiddleware — theme DOM ops and auth IPC are not tested in unit tests.
 *
 * @param ui - React element to render
 * @param options - Optional preloadedState and render options
 * @returns render result + store reference
 *
 * @example
 *   const { store } = renderWithProviders(<MyComponent />)
 *   const { store } = renderWithProviders(<MyComponent />, {
 *     preloadedState: { ui: { viewMode: 'grid', ... } }
 *   })
 */
export function renderWithProviders(
  ui: React.ReactElement,
  { preloadedState, ...renderOptions }: ExtendedRenderOptions = {},
) {
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault().concat(api.middleware),
    preloadedState,
  })

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <TooltipProvider>{children}</TooltipProvider>
      </Provider>
    )
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) }
}

/**
 * Render a hook wrapped in all required providers for testing.
 * Creates a fresh Redux store per test to avoid state leaks.
 *
 * @param hook - Hook function to render
 * @param options - Optional preloadedState and renderHook options
 * @returns renderHook result + store reference
 *
 * @example
 *   const { result } = renderHookWithProviders(() => useSidebarData())
 *   await waitFor(() => expect(result.current.isLoading).toBe(false))
 */
export function renderHookWithProviders<Result, Props>(
  hook: (props: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, 'wrapper'> & {
    preloadedState?: Partial<RootState>
  },
) {
  const { preloadedState, ...hookOptions } = options ?? {}
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault().concat(api.middleware),
    preloadedState,
  })

  // eslint-disable-next-line @laststance/react-next/all-memo
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>
  }

  return { store, ...renderHook(hook, { wrapper: Wrapper, ...hookOptions }) }
}
