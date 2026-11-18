import React, { useCallback } from 'react'

import { CredentialStorageNotice } from '@/components/CredentialStorageNotice'
import { ShortcutEditor } from '@/components/raindrop/shortcut-editor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useHasPendingWork } from '@/hooks/usePendingWork'
import { isShortcutCaptureTarget } from '@/lib/shortcut-utils'
import type { ViewMode } from '@/lib/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { logout } from '@/store/slices/authSlice'
import { setDefaultViewMode, setTheme } from '@/store/slices/settingsSlice'

import { IconSettings } from './icon-settings'
import { UpdateSettings } from './update-settings'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: string
}

/**
 * Settings dialog with General and Keyboard Shortcuts tabs.
 * The shortcuts tab hosts {@link ShortcutEditor}; while it captures a key combo,
 * Escape cancels the capture instead of closing the dialog.
 *
 * @example
 *   <SettingsDialog open={isOpen} onOpenChange={setIsOpen} defaultTab="shortcuts" />
 */
export const SettingsDialog = React.memo(function SettingsDialog({
  open,
  onOpenChange,
  defaultTab,
}: SettingsDialogProps) {
  const dispatch = useAppDispatch()
  const hasPendingWork = useHasPendingWork()
  const theme = useAppSelector((s) => s.settings.theme)
  const defaultViewMode = useAppSelector((s) => s.settings.defaultViewMode)

  const handleLogout = useCallback((): void => {
    if (!hasPendingWork || window.confirm('Discard pending work and sign out?'))
      void dispatch(logout())
  }, [dispatch, hasPendingWork])

  // Radix hears Escape in the capture phase, before the editor's field can cancel the capture
  const handleEscapeKeyDown = useCallback((event: KeyboardEvent) => {
    if (isShortcutCaptureTarget(event.target)) event.preventDefault()
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        onEscapeKeyDown={handleEscapeKeyDown}
      >
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Customize your Lain experience.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={defaultTab ?? 'general'}>
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">
              General
            </TabsTrigger>
            <TabsTrigger value="icons" className="flex-1">
              Icons
            </TabsTrigger>
            <TabsTrigger value="updates" className="flex-1">
              Updates
            </TabsTrigger>
            <TabsTrigger value="shortcuts" className="flex-1">
              Keyboard Shortcuts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-4">
            <CredentialStorageNotice />
            {/* Theme */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-muted-foreground text-xs">
                  Choose your preferred color scheme.
                </p>
              </div>
              <select
                aria-label="Theme"
                value={theme}
                onChange={(e) =>
                  dispatch(
                    setTheme(e.target.value as 'light' | 'dark' | 'system'),
                  )
                }
                className="bg-background border-input h-8 rounded-md border px-2 text-sm"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Raindrop.io account</p>
                <p className="text-muted-foreground text-xs">
                  Sign out to switch accounts. Local search history and
                  collection preferences will be cleared.
                </p>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                Sign out
              </Button>
            </div>
            {/* Default View Mode */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Default View</p>
                <p className="text-muted-foreground text-xs">
                  Default view mode for collections.
                </p>
              </div>
              <select
                aria-label="Default View"
                value={defaultViewMode}
                onChange={(e) =>
                  dispatch(setDefaultViewMode(e.target.value as ViewMode))
                }
                className="bg-background border-input h-8 rounded-md border px-2 text-sm"
              >
                <option value="list">List</option>
                <option value="grid">Grid</option>
                <option value="table">Table</option>
                <option value="directory">Directory</option>
              </select>
            </div>
          </TabsContent>

          <TabsContent value="icons" className="pt-4">
            <IconSettings />
          </TabsContent>
          <TabsContent value="updates" className="pt-4">
            <UpdateSettings hasPendingWork={hasPendingWork} />
          </TabsContent>
          <TabsContent value="shortcuts" className="pt-4">
            <ShortcutEditor />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
})
