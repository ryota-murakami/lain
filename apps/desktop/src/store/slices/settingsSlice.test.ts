import { describe, expect, test } from 'vitest'

import {
  DEFAULT_SHORTCUTS,
  migrateShortcuts,
  resetShortcuts,
  settingsSlice,
  swapShortcuts,
  updateShortcut,
} from './settingsSlice'
import type { ShortcutBinding } from './settingsSlice'

const CMD_SHIFT_E: ShortcutBinding = {
  key: 'e',
  meta: true,
  shift: true,
  alt: false,
  ctrl: false,
}

describe('settingsSlice shortcuts', () => {
  test('swaps the bindings of both actions when a conflict is resolved with Swap', () => {
    // Arrange
    const initial = settingsSlice.getInitialState()

    // Act
    const next = settingsSlice.reducer(
      initial,
      swapShortcuts({ actionId: 'newBookmark', otherActionId: 'search' }),
    )

    // Assert — New Bookmark now owns ⌘K, Global Search owns ⌘N
    expect(next.shortcuts.newBookmark).toEqual({
      key: 'k',
      meta: true,
      shift: false,
      alt: false,
      ctrl: false,
    })
    expect(next.shortcuts.search).toEqual({
      key: 'n',
      meta: true,
      shift: false,
      alt: false,
      ctrl: false,
    })
  })

  test('leaves every binding untouched when swapping with an unknown action', () => {
    // Arrange
    const initial = settingsSlice.getInitialState()

    // Act
    const next = settingsSlice.reducer(
      initial,
      swapShortcuts({ actionId: 'newBookmark', otherActionId: 'doesNotExist' }),
    )

    // Assert
    expect(next.shortcuts).toEqual(DEFAULT_SHORTCUTS)
  })

  test('restores every default binding on reset', () => {
    // Arrange — one customised binding
    const customised = settingsSlice.reducer(
      settingsSlice.getInitialState(),
      updateShortcut({ actionId: 'newBookmark', binding: CMD_SHIFT_E }),
    )
    expect(customised.shortcuts.newBookmark).toEqual(CMD_SHIFT_E)

    // Act
    const next = settingsSlice.reducer(customised, resetShortcuts())

    // Assert
    expect(next.shortcuts).toEqual(DEFAULT_SHORTCUTS)
  })

  test('keeps shortcuts added in newer builds when migrating an older persisted map', () => {
    // Arrange — persisted map from a build that only knew "search"
    const persisted = { search: CMD_SHIFT_E }

    // Act
    const migrated = migrateShortcuts(persisted)

    // Assert — the custom value survives and the other 19 defaults are filled in
    expect(migrated.search).toEqual(CMD_SHIFT_E)
    expect(Object.keys(migrated)).toHaveLength(20)
    expect(migrated.newBookmark).toEqual(DEFAULT_SHORTCUTS.newBookmark)
  })
})
