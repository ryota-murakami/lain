import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

import type { ViewMode } from '@/lib/types'

/**
 * Keyboard shortcut binding: modifier keys + key code.
 *
 * @example
 *   const shortcut: ShortcutBinding = {
 *     key: 'n',
 *     meta: true,    // ⌘
 *     shift: false,
 *     alt: false,
 *     ctrl: false,
 *   }
 */
export interface ShortcutBinding {
  key: string
  meta: boolean
  shift: boolean
  alt: boolean
  ctrl: boolean
}

/**
 * All 20 keyboard shortcut action IDs from SPEC Section 6.1.
 * PR1 wires modifier-key shortcuts; PR2 wires navigation keys.
 */
export type ShortcutActionId =
  | 'search'
  | 'newBookmark'
  | 'newCollection'
  | 'viewGrid'
  | 'viewList'
  | 'viewTable'
  | 'viewDirectory'
  | 'settings'
  | 'delete'
  | 'selectAll'
  | 'navigateUp'
  | 'navigateDown'
  | 'openSelected'
  | 'previewToggle'
  | 'escape'
  | 'editShortcuts'
  | 'searchInView'
  | 'searchGlobal'
  | 'toggleImportant'
  | 'manageTags'

export type ShortcutMap = Record<string, ShortcutBinding>

/**
 * Shortcut category for grouping in the settings UI.
 */
export type ShortcutCategory = 'navigation' | 'editing' | 'view' | 'system'

/**
 * Metadata for a shortcut action, used by the settings dialog shortcut table.
 * @example
 *   SHORTCUT_DEFINITIONS[0]
 *   // => { actionId: 'search', label: 'Global Search', category: 'navigation' }
 */
export interface ShortcutDefinition {
  actionId: ShortcutActionId
  label: string
  category: ShortcutCategory
}

/**
 * All 20 shortcut definitions with human-readable labels and categories.
 * Used by the settings dialog to render the read-only shortcut table.
 */
export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  { actionId: 'search', label: 'Global Search', category: 'navigation' },
  { actionId: 'searchInView', label: 'Search in View', category: 'navigation' },
  {
    actionId: 'searchGlobal',
    label: 'Search All Collections',
    category: 'navigation',
  },
  { actionId: 'navigateUp', label: 'Move Up', category: 'navigation' },
  { actionId: 'navigateDown', label: 'Move Down', category: 'navigation' },
  { actionId: 'openSelected', label: 'Open Selected', category: 'navigation' },
  { actionId: 'escape', label: 'Close Panel / Dialog', category: 'navigation' },
  { actionId: 'newBookmark', label: 'New Bookmark', category: 'editing' },
  { actionId: 'newCollection', label: 'New Collection', category: 'editing' },
  { actionId: 'delete', label: 'Delete Selected', category: 'editing' },
  { actionId: 'selectAll', label: 'Select All', category: 'editing' },
  {
    actionId: 'toggleImportant',
    label: 'Toggle Important',
    category: 'editing',
  },
  { actionId: 'manageTags', label: 'Manage Tags', category: 'editing' },
  { actionId: 'viewGrid', label: 'Grid View', category: 'view' },
  { actionId: 'viewList', label: 'List View', category: 'view' },
  { actionId: 'viewTable', label: 'Table View', category: 'view' },
  { actionId: 'viewDirectory', label: 'Directory View', category: 'view' },
  {
    actionId: 'previewToggle',
    label: 'Toggle Preview Panel',
    category: 'view',
  },
  { actionId: 'settings', label: 'Settings', category: 'system' },
  {
    actionId: 'editShortcuts',
    label: 'Keyboard Shortcuts',
    category: 'system',
  },
]

/**
 * Settings state for shortcuts, theme, and preferences.
 * All values in this slice are persisted to localStorage.
 *
 * @example
 *   dispatch(setDefaultViewMode('grid'))
 *   dispatch(updateShortcut({ actionId: 'newBookmark', binding: { key: 'n', meta: true, ... } }))
 */
interface SettingsState {
  shortcuts: ShortcutMap
  theme: 'light' | 'dark' | 'system'
  /** Computed actual theme after resolving 'system' via matchMedia. Updated by listenerMiddleware. */
  resolvedTheme: 'light' | 'dark'
  defaultViewMode: ViewMode
}

/**
 * Default keyboard shortcut bindings following macOS conventions.
 * All 20 shortcuts from SPEC Section 6.1.
 */
export const DEFAULT_SHORTCUTS: ShortcutMap = {
  search: { key: 'k', meta: true, shift: false, alt: false, ctrl: false },
  newBookmark: { key: 'n', meta: true, shift: false, alt: false, ctrl: false },
  newCollection: {
    key: 'n',
    meta: true,
    shift: true,
    alt: false,
    ctrl: false,
  },
  viewGrid: { key: '1', meta: true, shift: false, alt: false, ctrl: false },
  viewList: { key: '2', meta: true, shift: false, alt: false, ctrl: false },
  viewTable: { key: '3', meta: true, shift: false, alt: false, ctrl: false },
  viewDirectory: {
    key: '4',
    meta: true,
    shift: false,
    alt: false,
    ctrl: false,
  },
  settings: {
    key: ',',
    meta: true,
    shift: false,
    alt: false,
    ctrl: false,
  },
  delete: {
    key: 'Backspace',
    meta: true,
    shift: false,
    alt: false,
    ctrl: false,
  },
  selectAll: { key: 'a', meta: true, shift: false, alt: false, ctrl: false },
  navigateUp: {
    key: 'ArrowUp',
    meta: false,
    shift: false,
    alt: false,
    ctrl: false,
  },
  navigateDown: {
    key: 'ArrowDown',
    meta: false,
    shift: false,
    alt: false,
    ctrl: false,
  },
  openSelected: {
    key: 'Enter',
    meta: false,
    shift: false,
    alt: false,
    ctrl: false,
  },
  previewToggle: {
    key: ' ',
    meta: false,
    shift: false,
    alt: false,
    ctrl: false,
  },
  escape: {
    key: 'Escape',
    meta: false,
    shift: false,
    alt: false,
    ctrl: false,
  },
  editShortcuts: {
    key: 'k',
    meta: true,
    shift: true,
    alt: false,
    ctrl: false,
  },
  searchInView: {
    key: 'f',
    meta: true,
    shift: false,
    alt: false,
    ctrl: false,
  },
  searchGlobal: {
    key: 'f',
    meta: true,
    shift: true,
    alt: false,
    ctrl: false,
  },
  toggleImportant: {
    key: 'd',
    meta: true,
    shift: false,
    alt: false,
    ctrl: false,
  },
  manageTags: {
    key: 't',
    meta: true,
    shift: true,
    alt: false,
    ctrl: false,
  },
}

const initialState: SettingsState = {
  shortcuts: DEFAULT_SHORTCUTS,
  theme: 'system',
  resolvedTheme: 'light',
  defaultViewMode: 'list',
}

/**
 * Merge persisted shortcuts with defaults so new shortcuts added in code
 * are available without clearing localStorage.
 * Persisted bindings take precedence over defaults for existing keys.
 *
 * @param persisted - ShortcutMap from localStorage (may be missing new keys)
 * @returns Complete ShortcutMap with all 20 shortcuts
 * @example
 *   migrateShortcuts({ search: { key: 'k', ... } })
 *   // => { search: { key: 'k', ... }, settings: { key: ',', ... }, ... } (all 20)
 */
export function migrateShortcuts(persisted: ShortcutMap): ShortcutMap {
  return { ...DEFAULT_SHORTCUTS, ...persisted }
}

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<'light' | 'dark' | 'system'>) {
      state.theme = action.payload
    },
    setDefaultViewMode(state, action: PayloadAction<ViewMode>) {
      state.defaultViewMode = action.payload
    },
    updateShortcut(
      state,
      action: PayloadAction<{
        actionId: string
        binding: ShortcutBinding
      }>,
    ) {
      state.shortcuts[action.payload.actionId] = action.payload.binding
    },
    setResolvedTheme(state, action: PayloadAction<'light' | 'dark'>) {
      state.resolvedTheme = action.payload
    },
    resetShortcuts(state) {
      state.shortcuts = DEFAULT_SHORTCUTS
    },
    /**
     * Exchange the bindings of two actions — the "Swap" outcome of the shortcut
     * editor's conflict prompt. Unknown ids leave the map untouched.
     */
    swapShortcuts(
      state,
      action: PayloadAction<{ actionId: string; otherActionId: string }>,
    ) {
      const { actionId, otherActionId } = action.payload
      const binding = state.shortcuts[actionId]
      const otherBinding = state.shortcuts[otherActionId]
      // A stale persisted map may miss an id — never write undefined into the map
      if (!binding || !otherBinding) return
      state.shortcuts[actionId] = otherBinding
      state.shortcuts[otherActionId] = binding
    },
    /**
     * Called after hydration to merge persisted shortcuts with defaults.
     * Ensures new shortcuts from code updates are available.
     */
    hydrateShortcuts(state) {
      state.shortcuts = migrateShortcuts(state.shortcuts)
    },
  },
})

export const {
  setTheme,
  setResolvedTheme,
  setDefaultViewMode,
  updateShortcut,
  resetShortcuts,
  swapShortcuts,
  hydrateShortcuts,
} = settingsSlice.actions
