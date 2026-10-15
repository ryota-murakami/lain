import { useEffect, useRef } from 'react'

import { isEditableTarget, matchesBinding } from '@/lib/shortcut-utils'
import { useAppSelector } from '@/store/hooks'
import type { ShortcutActionId } from '@/store/slices/settingsSlice'

/**
 * Action IDs whose default bindings conflict with native text editing in inputs.
 * These shortcuts are suppressed when focus is in an editable target.
 * - selectAll (Cmd+A): selects all text in input
 * - searchInView (Cmd+F): browser find-in-page
 * - delete (Cmd+Backspace): deletes line in input
 */
const NATIVE_TEXT_SHORTCUTS: ReadonlySet<string> = new Set<ShortcutActionId>([
  'selectAll',
  'searchInView',
  'delete',
])

/**
 * Global keyboard shortcut hook that reads bindings from Redux settingsSlice.
 * Only handles modifier-key shortcuts (Cmd/Ctrl) — navigation keys (arrows,
 * Enter, Space) are handled view-locally in PR2.
 *
 * Escape is NOT handled here — Radix dialogs manage their own Escape.
 *
 * @param handlers - Map of action IDs to handler functions
 * @example
 *   useKeyboardShortcuts({
 *     search: () => dispatch(toggleSearch()),
 *     newBookmark: () => dispatch(openAddBookmark()),
 *     viewGrid: () => dispatch(setViewMode('grid')),
 *   })
 */
export function useKeyboardShortcuts(
  handlers: Partial<Record<ShortcutActionId, () => void>>,
): void {
  const shortcuts = useAppSelector((state) => state.settings.shortcuts)
  const handlersRef = useRef(handlers)
  const shortcutsRef = useRef(shortcuts)

  // Sync refs in effect to satisfy React Compiler (no ref writes during render)
  useEffect(() => {
    handlersRef.current = handlers
    shortcutsRef.current = shortcuts
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentShortcuts = shortcutsRef.current
      const currentHandlers = handlersRef.current

      for (const [actionId, binding] of Object.entries(currentShortcuts)) {
        if (!matchesBinding(e, binding)) continue

        // Only handle modifier shortcuts (Cmd/Ctrl) + Escape-display-only
        if (!binding.meta && !binding.ctrl) continue

        // Suppress shortcuts that conflict with native text editing in inputs
        if (isEditableTarget(e.target) && NATIVE_TEXT_SHORTCUTS.has(actionId)) {
          continue
        }

        const handler = currentHandlers[actionId as ShortcutActionId]
        if (handler) {
          e.preventDefault()
          handler()
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
