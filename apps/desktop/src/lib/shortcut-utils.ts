import type { ShortcutBinding, ShortcutMap } from '@/store/slices/settingsSlice'

/** Subset of KeyboardEvent the shortcut helpers read — React synthetic events and test doubles qualify. */
export type KeyboardEventLike = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'shiftKey' | 'altKey' | 'ctrlKey'
>

/** `event.key` values that can never form a shortcut: held modifiers, dead keys, unknown keys. */
const IGNORED_CAPTURE_KEYS: ReadonlySet<string> = new Set([
  'Meta',
  'Shift',
  'Alt',
  'Control',
  'CapsLock',
  'Fn',
  'Dead',
  'Unidentified',
])

/** Keys used by the default navigation shortcuts — bindable without ⌘/⌃/⌥. */
const BARE_BINDABLE_KEYS: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  ' ',
  'Backspace',
  'Delete',
  'Tab',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

/**
 * Check if a keyboard event matches a shortcut binding.
 *
 * @param event - The keyboard event to check
 * @param binding - The shortcut binding to match against
 * @returns true if the event matches the binding
 * @example
 *   matchesBinding(event, { key: 'n', meta: true, shift: false, alt: false, ctrl: false })
 *   // => true when user presses Cmd+N
 */
export function matchesBinding(
  event: KeyboardEvent,
  binding: ShortcutBinding,
): boolean {
  return (
    event.key.toLowerCase() === binding.key.toLowerCase() &&
    event.metaKey === binding.meta &&
    event.shiftKey === binding.shift &&
    event.altKey === binding.alt &&
    event.ctrlKey === binding.ctrl
  )
}

/**
 * Check if the event target is an editable element (input, textarea, contenteditable).
 *
 * @param target - The event target to check
 * @returns true if the target is an editable element
 * @example
 *   isEditableTarget(document.querySelector('input'))  // => true
 *   isEditableTarget(document.querySelector('div'))     // => false
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tagName = target.tagName
  if (tagName === 'INPUT' || tagName === 'TEXTAREA') return true
  if (target.isContentEditable) return true
  return false
}

/**
 * Whether `target` is the shortcut editor's key-capture field, which is marked with
 * `data-shortcut-capture="true"`. {@link SettingsDialog} uses it to keep Radix from
 * closing on Escape mid-capture (the field itself turns Escape into "cancel").
 *
 * @param target - Event target of a keydown (e.g. Radix `onEscapeKeyDown`)
 * @returns true only for the capture field
 * @example
 *   isShortcutCaptureTarget(document.querySelector('[data-shortcut-capture]')) // => true
 *   isShortcutCaptureTarget(document.body)                                     // => false
 */
export function isShortcutCaptureTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && target.dataset.shortcutCapture === 'true'
  )
}

const SYMBOL_MAP: Record<string, string> = {
  meta: '\u2318',
  shift: '\u21E7',
  alt: '\u2325',
  ctrl: '\u2303',
  Backspace: '\u232B',
  Escape: 'Esc',
  ArrowUp: '\u2191',
  ArrowDown: '\u2193',
  ArrowLeft: '\u2190',
  ArrowRight: '\u2192',
  Enter: '\u21A9',
  ' ': 'Space',
  ',': ',',
}

/**
 * Format a shortcut binding into a human-readable string using macOS symbols.
 *
 * @param binding - The shortcut binding to format
 * @returns Formatted string like "⌘⇧K" or "⌘N"
 * @example
 *   formatShortcut({ key: 'k', meta: true, shift: true, alt: false, ctrl: false })
 *   // => "⌘⇧K"
 *   formatShortcut({ key: 'Escape', meta: false, shift: false, alt: false, ctrl: false })
 *   // => "Esc"
 */
export function formatShortcut(binding: ShortcutBinding): string {
  const parts: string[] = []
  if (binding.ctrl) parts.push(SYMBOL_MAP.ctrl)
  if (binding.alt) parts.push(SYMBOL_MAP.alt)
  if (binding.shift) parts.push(SYMBOL_MAP.shift)
  if (binding.meta) parts.push(SYMBOL_MAP.meta)

  const keyDisplay = SYMBOL_MAP[binding.key] ?? binding.key.toUpperCase()
  parts.push(keyDisplay)

  return parts.join('')
}

/**
 * Find a conflicting shortcut action for a given binding.
 *
 * @param map - The current shortcut map
 * @param binding - The binding to check for conflicts
 * @param excludeId - Optional action ID to exclude (the action being edited)
 * @returns The conflicting action ID, or null if no conflict
 * @example
 *   findConflict(shortcuts, { key: 'n', meta: true, ... }, 'newBookmark')
 *   // => null (excluded)
 *   findConflict(shortcuts, { key: 'n', meta: true, ... })
 *   // => 'newBookmark'
 */
export function findConflict(
  map: ShortcutMap,
  binding: ShortcutBinding,
  excludeId?: string,
): string | null {
  for (const [actionId, existing] of Object.entries(map)) {
    if (actionId === excludeId) continue
    if (isSameBinding(existing, binding)) return actionId
  }
  return null
}

/**
 * Whether two bindings describe the same key combo (key compared case-insensitively).
 * Backs conflict detection and the "Custom" badge in the shortcut editor.
 *
 * @param a - First binding
 * @param b - Second binding
 * @returns true when key and all four modifiers match
 * @example
 *   isSameBinding({ key: 'k', meta: true, ... }, { key: 'K', meta: true, ... }) // => true
 *   isSameBinding({ key: 'k', meta: true, ... }, { key: 'k', meta: true, shift: true, ... }) // => false
 */
export function isSameBinding(a: ShortcutBinding, b: ShortcutBinding): boolean {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    a.meta === b.meta &&
    a.shift === b.shift &&
    a.alt === b.alt &&
    a.ctrl === b.ctrl
  )
}

/**
 * Turn a keydown captured by the shortcut editor into a binding, or null when the press
 * must be ignored: held modifiers / dead keys, and printable keys without ⌘/⌃/⌥ (plain
 * typing may never become a shortcut). Single characters are stored lower-case so
 * ⇧ combos match {@link matchesBinding} regardless of the reported case.
 *
 * @param event - Keydown from the capture field
 * @returns
 * - Binding for a valid combo
 * - null when the press should be ignored
 * @example
 *   bindingFromKeyboardEvent({ key: 'N', metaKey: true, shiftKey: true, altKey: false, ctrlKey: false })
 *   // => { key: 'n', meta: true, shift: true, alt: false, ctrl: false }
 *   bindingFromKeyboardEvent({ key: 'Meta', metaKey: true, ... }) // => null (still holding ⌘)
 *   bindingFromKeyboardEvent({ key: 'n', ...no modifiers })       // => null (plain typing)
 *   bindingFromKeyboardEvent({ key: 'ArrowUp', ...no modifiers }) // => { key: 'ArrowUp', ... }
 */
export function bindingFromKeyboardEvent(
  event: KeyboardEventLike,
): ShortcutBinding | null {
  if (IGNORED_CAPTURE_KEYS.has(event.key)) return null
  const hasCommandModifier = event.metaKey || event.ctrlKey || event.altKey
  if (!hasCommandModifier && !BARE_BINDABLE_KEYS.has(event.key)) return null
  return {
    key: event.key.length === 1 ? event.key.toLowerCase() : event.key,
    meta: event.metaKey,
    shift: event.shiftKey,
    alt: event.altKey,
    ctrl: event.ctrlKey,
  }
}
