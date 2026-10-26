import React, { useCallback } from 'react'

import { ShortcutEditor } from '@/components/raindrop/shortcut-editor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isShortcutCaptureTarget } from '@/lib/shortcut-utils'
import type { ViewMode } from '@/lib/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { setDefaultViewMode, setTheme } from '@/store/slices/settingsSlice'

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
  const theme = useAppSelector((s) => s.settings.theme)
  const defaultViewMode = useAppSelector((s) => s.settings.defaultViewMode)

  // Radix hears Escape in the capture phase, before the editor's field can cancel the capture
  const handleEscapeKeyDown = useCallback((event: KeyboardEvent) => {
    if (isShortcutCaptureTarget(event.target)) event.preventDefault()
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" onEscapeKeyDown={handleEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Customize your Lain experience.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={defaultTab ?? 'general'}>
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">
              General
            </TabsTrigger>
            <TabsTrigger value="shortcuts" className="flex-1">
              Keyboard Shortcuts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-4">
            {/* Theme */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-muted-foreground text-xs">
                  Choose your preferred color scheme.
                </p>
              </div>
              <select
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

            {/* Default View Mode */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Default View</p>
                <p className="text-muted-foreground text-xs">
                  Default view mode for collections.
                </p>
              </div>
              <select
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

          <TabsContent value="shortcuts" className="pt-4">
            <ShortcutEditor />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
})
