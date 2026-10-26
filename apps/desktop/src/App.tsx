import React from 'react'
import { Provider } from 'react-redux'

import { LoginScreen } from '@/components/LoginScreen'
import { MainApp } from '@/components/main-app'
import { TooltipProvider } from '@/components/ui/tooltip'
import { store } from '@/store'
import { useAuth } from '@/store/hooks'

/**
 * Root component that switches between login and the main 3-panel UI
 * based on Raindrop.io OAuth authentication state.
 *
 * Flow: Provider (Redux) -> TooltipProvider -> LoginScreen | MainApp
 * Theme DOM class and auth IPC subscription are managed by listenerMiddleware.
 */
const AuthenticatedApp = React.memo(function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return <MainApp />
})

const App = React.memo(function App() {
  return (
    <Provider store={store}>
      <TooltipProvider>
        <AuthenticatedApp />
      </TooltipProvider>
    </Provider>
  )
})

export { App }
export default App
