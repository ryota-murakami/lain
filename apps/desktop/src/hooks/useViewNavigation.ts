import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { match } from 'ts-pattern'

import { isEditableTarget, matchesBinding } from '@/lib/shortcut-utils'
import { useAppSelector } from '@/store/hooks'
import type {
  ShortcutActionId,
  ShortcutMap,
} from '@/store/slices/settingsSlice'

/** Attribute every navigable bookmark row carries; rows are visited in DOM order. */
export const RAINDROP_ROW_ATTRIBUTE = 'data-raindrop-id'

const RAINDROP_ROW_SELECTOR = `[${RAINDROP_ROW_ATTRIBUTE}]`

/** Bare-key actions owned by the active view rather than {@link useKeyboardShortcuts}. */
const NAVIGATION_ACTION_IDS = [
  'navigateUp',
  'navigateDown',
  'openSelected',
  'previewToggle',
] as const satisfies readonly ShortcutActionId[]

type NavigationActionId = (typeof NAVIGATION_ACTION_IDS)[number]

/**
 * Where a keydown originated relative to the view:
 * - `view`: page body, the view container, or a bookmark row itself
 * - `rowControl`: a control inside a row (checkbox, menu trigger, …)
 * - `outside`: editable fields, portaled dialogs/menus, anything else
 */
type NavigationTargetKind = 'view' | 'rowControl' | 'outside'

export interface ViewNavigationOptions {
  /** Element containing every `[data-raindrop-id]` row of the active view */
  containerRef: RefObject<HTMLElement | null>
  /** Raindrop to continue from when no row has focus (e.g. after a view switch) */
  selectedRaindropId?: string
  /** ↑ / ↓ moved focus to this raindrop */
  onNavigate: (raindropId: string) => void
  /** Enter on the current raindrop */
  onOpen: (raindropId: string) => void
  /** Space on the current raindrop */
  onPreviewToggle: (raindropId: string) => void
}

/**
 * Classify a keydown target so dialogs, menus and text fields keep their own keys.
 * @param target - `event.target` of the keydown
 * @param container - Active view container
 * @returns
 * - `view` for the body, the container, or a row (all navigation keys apply)
 * - `rowControl` for a control inside a row (only ↑/↓ apply)
 * - `outside` otherwise (nothing applies)
 * @example
 * classifyNavigationTarget(document.body, container) // => 'view'
 * classifyNavigationTarget(rowCheckbox, container)   // => 'rowControl'
 * classifyNavigationTarget(searchInput, container)   // => 'outside'
 */
function classifyNavigationTarget(
  target: EventTarget | null,
  container: HTMLElement,
): NavigationTargetKind {
  if (target === document.body || target === container) return 'view'
  if (!(target instanceof HTMLElement) || isEditableTarget(target)) {
    return 'outside'
  }
  const row = target.closest<HTMLElement>(RAINDROP_ROW_SELECTOR)
  if (!row || !container.contains(row)) return 'outside'
  return row === target ? 'view' : 'rowControl'
}

/**
 * Map a keydown to the navigation action whose binding it matches.
 * @param event - Keydown event
 * @param shortcuts - Current shortcut map from settings
 * @returns The matching action id, or undefined when the key is not a navigation key
 * @example resolveNavigationAction(arrowDownEvent, DEFAULT_SHORTCUTS) // => 'navigateDown'
 */
function resolveNavigationAction(
  event: KeyboardEvent,
  shortcuts: ShortcutMap,
): NavigationActionId | undefined {
  return NAVIGATION_ACTION_IDS.find((actionId) => {
    const binding = shortcuts[actionId]
    return binding !== undefined && matchesBinding(event, binding)
  })
}

/**
 * View-local keyboard navigation (SPEC F7.6, KB.11–KB.14): ↑/↓ move focus between
 * `[data-raindrop-id]` rows in DOM order (so table sorting and the directory tree are
 * respected), Enter opens and Space toggles the preview. Bindings come from settings.
 * Mounted once by {@link MainContent}; {@link useKeyboardShortcuts} ignores bare keys.
 * @param options - Container, current selection and action callbacks
 * @example
 * useViewNavigation({
 *   containerRef: scrollAreaRef,
 *   selectedRaindropId,
 *   onNavigate: (id) => highlight(id),
 *   onOpen: (id) => openExternally(id),
 *   onPreviewToggle: (id) => togglePanel(id),
 * })
 */
export function useViewNavigation(options: ViewNavigationOptions): void {
  const shortcuts = useAppSelector((state) => state.settings.shortcuts)
  const optionsRef = useRef(options)
  const shortcutsRef = useRef(shortcuts)

  // Sync refs in an effect so the single window listener always sees fresh props
  useEffect(() => {
    optionsRef.current = options
    shortcutsRef.current = shortcuts
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const {
        containerRef,
        selectedRaindropId,
        onNavigate,
        onOpen,
        onPreviewToggle,
      } = optionsRef.current
      const container = containerRef.current
      if (!container) return

      const targetKind = classifyNavigationTarget(event.target, container)
      if (targetKind === 'outside') return

      const actionId = resolveNavigationAction(event, shortcutsRef.current)
      if (!actionId) return

      // A focused checkbox keeps Enter/Space for itself; only ↑/↓ leave it
      const isMoveAction =
        actionId === 'navigateUp' || actionId === 'navigateDown'
      if (targetKind === 'rowControl' && !isMoveAction) return

      const rows = Array.from(
        container.querySelectorAll<HTMLElement>(RAINDROP_ROW_SELECTOR),
      )
      if (rows.length === 0) return

      // The row holding focus wins; otherwise continue from the highlighted raindrop
      const activeElement = document.activeElement
      const focusedIndex = rows.findIndex(
        (row) => activeElement !== null && row.contains(activeElement),
      )
      const selectedIndex = rows.findIndex(
        (row) =>
          row.getAttribute(RAINDROP_ROW_ATTRIBUTE) === selectedRaindropId,
      )
      const currentIndex = focusedIndex >= 0 ? focusedIndex : selectedIndex
      const currentRaindropId =
        currentIndex >= 0
          ? rows[currentIndex].getAttribute(RAINDROP_ROW_ATTRIBUTE)
          : null
      const lastIndex = rows.length - 1

      const moveTo = (index: number) => {
        event.preventDefault()
        const row = rows[index]
        row.focus({ preventScroll: true })
        row.scrollIntoView({ block: 'nearest' })
        const raindropId = row.getAttribute(RAINDROP_ROW_ATTRIBUTE)
        if (raindropId) onNavigate(raindropId)
      }

      match(actionId)
        .with('navigateDown', () =>
          moveTo(currentIndex < 0 ? 0 : Math.min(currentIndex + 1, lastIndex)),
        )
        .with('navigateUp', () =>
          moveTo(currentIndex < 0 ? lastIndex : Math.max(currentIndex - 1, 0)),
        )
        .with('openSelected', () => {
          if (!currentRaindropId) return
          event.preventDefault()
          onOpen(currentRaindropId)
        })
        .with('previewToggle', () => {
          if (!currentRaindropId) return
          event.preventDefault()
          onPreviewToggle(currentRaindropId)
        })
        .exhaustive()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
