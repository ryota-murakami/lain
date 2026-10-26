import { describe, expect, test } from 'vitest'

import type { ShortcutBinding, ShortcutMap } from '@/store/slices/settingsSlice'

import {
  bindingFromKeyboardEvent,
  findConflict,
  formatShortcut,
  isEditableTarget,
  isSameBinding,
  matchesBinding,
} from './shortcut-utils'

// Helper to create a minimal KeyboardEvent-like object
function makeEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: '',
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    ...overrides,
  } as KeyboardEvent
}

describe('matchesBinding', () => {
  const cmdN: ShortcutBinding = {
    key: 'n',
    meta: true,
    shift: false,
    alt: false,
    ctrl: false,
  }

  test('matches Cmd+N', () => {
    const event = makeEvent({ key: 'n', metaKey: true })
    expect(matchesBinding(event, cmdN)).toBe(true)
  })

  test('matches case-insensitively', () => {
    const event = makeEvent({ key: 'N', metaKey: true })
    expect(matchesBinding(event, cmdN)).toBe(true)
  })

  test('rejects when meta is not pressed', () => {
    const event = makeEvent({ key: 'n', metaKey: false })
    expect(matchesBinding(event, cmdN)).toBe(false)
  })

  test('rejects when shift is pressed but not expected', () => {
    const event = makeEvent({ key: 'n', metaKey: true, shiftKey: true })
    expect(matchesBinding(event, cmdN)).toBe(false)
  })

  test('matches Cmd+Shift+K', () => {
    const cmdShiftK: ShortcutBinding = {
      key: 'k',
      meta: true,
      shift: true,
      alt: false,
      ctrl: false,
    }
    const event = makeEvent({ key: 'k', metaKey: true, shiftKey: true })
    expect(matchesBinding(event, cmdShiftK)).toBe(true)
  })

  test('matches Escape (no modifiers)', () => {
    const esc: ShortcutBinding = {
      key: 'Escape',
      meta: false,
      shift: false,
      alt: false,
      ctrl: false,
    }
    const event = makeEvent({ key: 'Escape' })
    expect(matchesBinding(event, esc)).toBe(true)
  })

  test('rejects wrong key', () => {
    const event = makeEvent({ key: 'x', metaKey: true })
    expect(matchesBinding(event, cmdN)).toBe(false)
  })
})

describe('isEditableTarget', () => {
  test('returns true for INPUT', () => {
    const input = document.createElement('input')
    expect(isEditableTarget(input)).toBe(true)
  })

  test('returns true for TEXTAREA', () => {
    const textarea = document.createElement('textarea')
    expect(isEditableTarget(textarea)).toBe(true)
  })

  test('returns true for contenteditable', () => {
    const div = document.createElement('div')
    div.contentEditable = 'true'
    expect(isEditableTarget(div)).toBe(true)
  })

  test('returns false for regular div', () => {
    const div = document.createElement('div')
    expect(isEditableTarget(div)).toBe(false)
  })

  test('returns false for null', () => {
    expect(isEditableTarget(null)).toBe(false)
  })
})

describe('formatShortcut', () => {
  test('formats Cmd+N', () => {
    const binding: ShortcutBinding = {
      key: 'n',
      meta: true,
      shift: false,
      alt: false,
      ctrl: false,
    }
    expect(formatShortcut(binding)).toBe('\u2318N')
  })

  test('formats Cmd+Shift+K', () => {
    const binding: ShortcutBinding = {
      key: 'k',
      meta: true,
      shift: true,
      alt: false,
      ctrl: false,
    }
    expect(formatShortcut(binding)).toBe('\u21E7\u2318K')
  })

  test('formats Escape', () => {
    const binding: ShortcutBinding = {
      key: 'Escape',
      meta: false,
      shift: false,
      alt: false,
      ctrl: false,
    }
    expect(formatShortcut(binding)).toBe('Esc')
  })

  test('formats Cmd+Backspace', () => {
    const binding: ShortcutBinding = {
      key: 'Backspace',
      meta: true,
      shift: false,
      alt: false,
      ctrl: false,
    }
    expect(formatShortcut(binding)).toBe('\u2318\u232B')
  })

  test('formats Cmd+, (comma)', () => {
    const binding: ShortcutBinding = {
      key: ',',
      meta: true,
      shift: false,
      alt: false,
      ctrl: false,
    }
    expect(formatShortcut(binding)).toBe('\u2318,')
  })

  test('formats Cmd+1', () => {
    const binding: ShortcutBinding = {
      key: '1',
      meta: true,
      shift: false,
      alt: false,
      ctrl: false,
    }
    expect(formatShortcut(binding)).toBe('\u23181')
  })
})

describe('findConflict', () => {
  const map: ShortcutMap = {
    search: { key: 'k', meta: true, shift: false, alt: false, ctrl: false },
    newBookmark: {
      key: 'n',
      meta: true,
      shift: false,
      alt: false,
      ctrl: false,
    },
  }

  test('finds a conflict', () => {
    const binding: ShortcutBinding = {
      key: 'k',
      meta: true,
      shift: false,
      alt: false,
      ctrl: false,
    }
    expect(findConflict(map, binding)).toBe('search')
  })

  test('excludes specified action', () => {
    const binding: ShortcutBinding = {
      key: 'k',
      meta: true,
      shift: false,
      alt: false,
      ctrl: false,
    }
    expect(findConflict(map, binding, 'search')).toBeNull()
  })

  test('returns null for no conflict', () => {
    const binding: ShortcutBinding = {
      key: 'x',
      meta: true,
      shift: false,
      alt: false,
      ctrl: false,
    }
    expect(findConflict(map, binding)).toBeNull()
  })
})

describe('isSameBinding', () => {
  const cmdK: ShortcutBinding = {
    key: 'k',
    meta: true,
    shift: false,
    alt: false,
    ctrl: false,
  }

  test('treats key case as irrelevant so ⌘K and ⌘k are one shortcut', () => {
    // Arrange
    const upperCaseCmdK: ShortcutBinding = { ...cmdK, key: 'K' }

    // Act
    const result = isSameBinding(cmdK, upperCaseCmdK)

    // Assert
    expect(result).toBe(true)
  })

  test('treats a different modifier as a different shortcut', () => {
    // Arrange
    const cmdShiftK: ShortcutBinding = { ...cmdK, shift: true }

    // Act
    const result = isSameBinding(cmdK, cmdShiftK)

    // Assert
    expect(result).toBe(false)
  })
})

describe('bindingFromKeyboardEvent', () => {
  test('ignores a modifier-only press while the user is still holding keys', () => {
    // Arrange
    const event = makeEvent({ key: 'Meta', metaKey: true })

    // Act
    const binding = bindingFromKeyboardEvent(event)

    // Assert
    expect(binding).toBeNull()
  })

  test('ignores a bare letter so plain typing can never become a shortcut', () => {
    // Arrange
    const event = makeEvent({ key: 'n' })

    // Act
    const binding = bindingFromKeyboardEvent(event)

    // Assert
    expect(binding).toBeNull()
  })

  test('captures a command combo with the key stored lower-case', () => {
    // Arrange
    const event = makeEvent({ key: 'N', metaKey: true, shiftKey: true })

    // Act
    const binding = bindingFromKeyboardEvent(event)

    // Assert
    expect(binding).toEqual({
      key: 'n',
      meta: true,
      shift: true,
      alt: false,
      ctrl: false,
    })
  })

  test('captures navigation keys without a modifier', () => {
    // Arrange
    const event = makeEvent({ key: 'ArrowUp' })

    // Act
    const binding = bindingFromKeyboardEvent(event)

    // Assert
    expect(binding).toEqual({
      key: 'ArrowUp',
      meta: false,
      shift: false,
      alt: false,
      ctrl: false,
    })
  })

  test('ignores dead keys produced by option combos', () => {
    // Arrange
    const event = makeEvent({ key: 'Dead', altKey: true })

    // Act
    const binding = bindingFromKeyboardEvent(event)

    // Assert
    expect(binding).toBeNull()
  })
})
