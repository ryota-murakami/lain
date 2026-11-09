/**
 * Explicit renderer platforms for keyboard utility, editor and dispatcher regressions.
 * Each suite spies on navigator.platform per test, then restores it; the host OS never
 * chooses expectations and Linux Control behavior runs alongside macOS Command behavior.
 */
export const SHORTCUT_PLATFORMS = [
  {
    name: 'macOS',
    navigatorPlatform: 'MacIntel',
    primaryKey: 'Meta',
    modifiers: { meta: true, ctrl: false },
    eventModifiers: { metaKey: true, ctrlKey: false },
    rejectedModifiers: { metaKey: false, ctrlKey: true },
    labels: {
      newBookmark: '⌘N',
      search: '⌘K',
      shiftSearch: '⇧⌘K',
      delete: '⌘⌫',
      settings: '⌘,',
      grid: '⌘1',
      customBookmark: '⇧⌘E',
    },
  },
  {
    name: 'Linux',
    navigatorPlatform: 'Linux x86_64',
    primaryKey: 'Control',
    modifiers: { meta: false, ctrl: true },
    eventModifiers: { metaKey: false, ctrlKey: true },
    rejectedModifiers: { metaKey: true, ctrlKey: false },
    labels: {
      newBookmark: 'Ctrl+N',
      search: 'Ctrl+K',
      shiftSearch: 'Ctrl+Shift+K',
      delete: 'Ctrl+⌫',
      settings: 'Ctrl+,',
      grid: 'Ctrl+1',
      customBookmark: 'Ctrl+Shift+E',
    },
  },
] as const
