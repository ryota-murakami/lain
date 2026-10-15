import { Sun, Moon, Monitor } from 'lucide-react'
import React, { useCallback } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useTheme } from '@/store/hooks'

/**
 * Theme toggle dropdown button.
 * Cycles between light, dark, and system themes with visual feedback.
 *
 * @example
 *   <ThemeToggle />
 */
const ThemeToggle = React.memo(function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const handleSetLight = useCallback(() => setTheme('light'), [setTheme])
  const handleSetDark = useCallback(() => setTheme('dark'), [setTheme])
  const handleSetSystem = useCallback(() => setTheme('system'), [setTheme])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          {resolvedTheme === 'dark' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={handleSetLight}
          className={cn(theme === 'light' && 'bg-accent')}
        >
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleSetDark}
          className={cn(theme === 'dark' && 'bg-accent')}
        >
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleSetSystem}
          className={cn(theme === 'system' && 'bg-accent')}
        >
          <Monitor className="mr-2 h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
export { ThemeToggle }
export default ThemeToggle
