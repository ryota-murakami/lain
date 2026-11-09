import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { ShortcutBinding, ShortcutMap } from '@/store/slices/settingsSlice'
import { SHORTCUT_PLATFORMS } from '@test/shortcut-platforms'

import {
  bindingFromKeyboardEvent,
  findConflict,
  formatShortcut,
  isEditableTarget,
  isSameBinding,
  matchesBinding,
} from './shortcut-utils'

afterEach(() => vi.restoreAllMocks())

test('Linux Control activates Command defaults and shares their conflict identity', () => {
  // Arrange
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Linux x86_64')
  const defaultBinding: ShortcutBinding = {
    key: 'k',
    meta: true,
    ctrl: false,
    alt: false,
    shift: true,
  }
  const capturedBinding: ShortcutBinding = {
    key: 'k',
    meta: false,
    ctrl: true,
    alt: false,
    shift: true,
  }
  // Act / Assert
  expect(
    matchesBinding(
      makeEvent({ key: 'K', ctrlKey: true, shiftKey: true }),
      defaultBinding,
    ),
  ).toBe(true)
  expect(isSameBinding(defaultBinding, capturedBinding)).toBe(true)
  expect(formatShortcut(defaultBinding)).toBe('Ctrl+Shift+K')
  expect(findConflict({ search: defaultBinding }, capturedBinding)).toBe(
    'search',
  )
})

test('Linux Super cannot be saved as a shortcut that later expects Control', () => {
  // Arrange
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Linux x86_64')
  // Act / Assert
  expect(bindingFromKeyboardEvent(makeEvent({ key: 'n', metaKey: true }))).toBe(
    null,
  )
  expect(
    bindingFromKeyboardEvent(makeEvent({ key: 'n', ctrlKey: true })),
  ).toEqual({ key: 'n', meta: false, ctrl: true, alt: false, shift: false })
})

test('native select fields retain their normal keyboard navigation', () => {
  // Arrange
  const select = document.createElement('select')
  // Act / Assert
  expect(isEditableTarget(select)).toBe(true)
})

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

describe.each(SHORTCUT_PLATFORMS)('matchesBinding on $name', (platform) => {
  beforeEach(() => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue(
      platform.navigatorPlatform,
    )
  })
  const cmdN: ShortcutBinding = {
    key: 'n',
    meta: true,
    shift: false,
    alt: false,
    ctrl: false,
  }

  test('the platform primary modifier activates the New Bookmark default', () => {
    const event = makeEvent({ key: 'n', ...platform.eventModifiers })
    expect(matchesBinding(event, cmdN)).toBe(true)
  })

  test('an uppercase letter still activates the saved lowercase shortcut', () => {
    const event = makeEvent({ key: 'N', ...platform.eventModifiers })
    expect(matchesBinding(event, cmdN)).toBe(true)
  })

  test('plain typing does not activate a primary-modifier shortcut', () => {
    const event = makeEvent({ key: 'n', metaKey: false })
    expect(matchesBinding(event, cmdN)).toBe(false)
  })

  test('rejects when shift is pressed but not expected', () => {
    const event = makeEvent({
      key: 'n',
      ...platform.eventModifiers,
      shiftKey: true,
    })
    expect(matchesBinding(event, cmdN)).toBe(false)
  })

  test('the platform primary modifier and Shift activate a shifted default', () => {
    const cmdShiftK: ShortcutBinding = {
      key: 'k',
      meta: true,
      shift: true,
      alt: false,
      ctrl: false,
    }
    const event = makeEvent({
      key: 'k',
      ...platform.eventModifiers,
      shiftKey: true,
    })
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

  test('the other platform modifier cannot activate the primary shortcut', () => {
    // Arrange
    const event = makeEvent({ key: 'n', ...platform.rejectedModifiers })
    // Act / Assert
    expect(matchesBinding(event, cmdN)).toBe(false)
  })

  test('rejects wrong key', () => {
    const event = makeEvent({ key: 'x', ...platform.eventModifiers })
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

describe.each(SHORTCUT_PLATFORMS)('formatShortcut on $name', (platform) => {
  beforeEach(() => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue(
      platform.navigatorPlatform,
    )
  })
  test('New Bookmark displays the platform primary modifier', () => {
    const binding: ShortcutBinding = {
      key: 'n',
      meta: true,
      shift: false,
      alt: false,
      ctrl: false,
    }
    expect(formatShortcut(binding)).toBe(platform.labels.newBookmark)
  })

  test('a shifted primary shortcut displays both modifiers', () => {
    const binding: ShortcutBinding = {
      key: 'k',
      meta: true,
      shift: true,
      alt: false,
      ctrl: false,
    }
    expect(formatShortcut(binding)).toBe(platform.labels.shiftSearch)
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

  test('Delete displays the primary modifier and Backspace', () => {
    const binding: ShortcutBinding = {
      key: 'Backspace',
      meta: true,
      shift: false,
      alt: false,
      ctrl: false,
    }
    expect(formatShortcut(binding)).toBe(platform.labels.delete)
  })

  test('Settings displays the primary modifier and comma', () => {
    const binding: ShortcutBinding = {
      key: ',',
      meta: true,
      shift: false,
      alt: false,
      ctrl: false,
    }
    expect(formatShortcut(binding)).toBe(platform.labels.settings)
  })

  test('Grid view displays the primary modifier and numeric key', () => {
    const binding: ShortcutBinding = {
      key: '1',
      meta: true,
      shift: false,
      alt: false,
      ctrl: false,
    }
    expect(formatShortcut(binding)).toBe(platform.labels.grid)
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

describe.each(SHORTCUT_PLATFORMS)(
  'bindingFromKeyboardEvent on $name',
  (platform) => {
    beforeEach(() => {
      vi.spyOn(navigator, 'platform', 'get').mockReturnValue(
        platform.navigatorPlatform,
      )
    })
    test('ignores a modifier-only press while the user is still holding keys', () => {
      // Arrange
      const event = makeEvent({
        key: platform.primaryKey,
        ...platform.eventModifiers,
      })

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

    test('capturing a primary combo stores the platform modifier and lowercase key', () => {
      // Arrange
      const event = makeEvent({
        key: 'N',
        ...platform.eventModifiers,
        shiftKey: true,
      })

      // Act
      const binding = bindingFromKeyboardEvent(event)

      // Assert
      expect(binding).toEqual({
        key: 'n',
        meta: platform.modifiers.meta,
        shift: true,
        alt: false,
        ctrl: platform.modifiers.ctrl,
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
  },
)
