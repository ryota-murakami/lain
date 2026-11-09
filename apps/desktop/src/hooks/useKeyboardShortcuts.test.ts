import { act, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { updateShortcut } from '@/store/slices/settingsSlice'
import { renderHookWithProviders } from '@test/render-with-providers'

import { useKeyboardShortcuts } from './useKeyboardShortcuts'

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
  // Act
  fireEvent.keyDown(button, { key: 'Backspace', metaKey: true })
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
  // Act
  fireEvent.keyDown(input, { key: 'a', metaKey: true })
  fireEvent.keyDown(document.body, {
    key: 'n',
    metaKey: true,
    isComposing: true,
  })
  // Assert
  expect(selectAll).not.toHaveBeenCalled()
  expect(create).not.toHaveBeenCalled()
  input.remove()
  unmount()
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
