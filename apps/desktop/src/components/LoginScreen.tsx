import React from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/store/hooks'

/**
 * Login screen displayed when the user is not authenticated.
 * Shows a card with app branding and a "Login with Raindrop.io" button.
 * Handles loading state during the OAuth flow.
 *
 * @example
 *   <LoginScreen />
 */
export const LoginScreen = React.memo(function LoginScreen() {
  const { login, isLoading } = useAuth()

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Lain</CardTitle>
          <CardDescription>
            Sign in with your Raindrop.io account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            size="lg"
            className="w-full"
            onClick={login}
            disabled={isLoading}
          >
            {isLoading ? 'Connecting...' : 'Login with Raindrop.io'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
})
