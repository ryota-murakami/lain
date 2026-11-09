import { act, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { updateShortcut } from '@/store/slices/settingsSlice'
import { renderHookWithProviders } from '@test/render-with-providers'
import { SHORTCUT_PLATFORMS } from '@test/shortcut-platforms'

import { useKeyboardShortcuts } from './useKeyboardShortcuts'

afterEach(() => vi.restoreAllMocks())

describe.each(SHORTCUT_PLATFORMS)('keyboard dispatch on $name', (platform) => {
  beforeEach(() => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue(
      platform.navigatorPlatform,
    )
  })

  test('the primary modifier creates a bookmark while the other platform modifier does nothing', () => {
    // Arrange
    const create = vi.fn()
    const { unmount } = renderHookWithProviders(() =>
      useKeyboardShortcuts({ newBookmark: create }),
    )
    // Act / Assert — reject the wrong modifier before accepting the platform's actual default.
    fireEvent.keyDown(document.body, {
      key: 'n',
      ...platform.rejectedModifiers,
    })
    expect(create).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, { key: 'n', ...platform.eventModifiers })
    expect(create).toHaveBeenCalledTimes(1)
    unmount()
  })

  test('a focused dialog button cannot delete the background bookmark selection', () => {
    // Arrange
    const remove = vi.fn()
    const { unmount } = renderHookWithProviders(() =>
      useKeyboardShortcuts({ delete: remove }),
    )
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const button = document.createElement('button')
    dialog.append(button)
    document.body.append(dialog)
    // Act — establish the same key fires outside the modal before testing its guard.
    fireEvent.keyDown(document.body, {
      key: 'Backspace',
      ...platform.eventModifiers,
    })
    expect(remove).toHaveBeenCalledTimes(1)
    remove.mockClear()
    fireEvent.keyDown(button, { key: 'Backspace', ...platform.eventModifiers })
    // Assert
    expect(remove).not.toHaveBeenCalled()
    dialog.remove()
    unmount()
  })

  test('IME composition and normal input editing never trigger configured bookmark actions', () => {
    // Arrange
    const selectAll = vi.fn()
    const create = vi.fn()
    const { unmount } = renderHookWithProviders(() =>
      useKeyboardShortcuts({ selectAll, newBookmark: create }),
    )
    const input = document.createElement('input')
    document.body.append(input)
    // Act — these modifiers must be active before editable/IME targets suppress them.
    fireEvent.keyDown(document.body, { key: 'a', ...platform.eventModifiers })
    fireEvent.keyDown(document.body, { key: 'n', ...platform.eventModifiers })
    expect(selectAll).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(1)
    selectAll.mockClear()
    create.mockClear()
    fireEvent.keyDown(input, { key: 'a', ...platform.eventModifiers })
    fireEvent.keyDown(document.body, {
      key: 'n',
      ...platform.eventModifiers,
      isComposing: true,
    })
    // Assert
    expect(selectAll).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    input.remove()
    unmount()
  })
})

test('a saved Alt shortcut runs outside inputs and stops after the hook unmounts', () => {
  // Arrange
  const create = vi.fn()
  const { store, unmount } = renderHookWithProviders(() =>
    useKeyboardShortcuts({ newBookmark: create }),
  )
  act(() => {
    store.dispatch(
      updateShortcut({
        actionId: 'newBookmark',
        binding: {
          key: 'b',
          alt: true,
          ctrl: false,
          meta: false,
          shift: false,
        },
      }),
    )
  })
  // Act
  fireEvent.keyDown(document.body, { key: 'b', altKey: true })
  unmount()
  fireEvent.keyDown(document.body, { key: 'b', altKey: true })
  // Assert
  expect(create).toHaveBeenCalledTimes(1)
})
