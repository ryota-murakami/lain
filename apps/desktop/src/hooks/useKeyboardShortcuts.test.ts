import { act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderHookWithProviders } from '@test/render-with-providers'

import { useKeyboardShortcuts } from './useKeyboardShortcuts'

function fireKeydown(
  key: string,
  modifiers: Partial<{
    metaKey: boolean
    shiftKey: boolean
    altKey: boolean
    ctrlKey: boolean
  }> = {},
  target?: EventTarget,
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  })
  if (target) {
    Object.defineProperty(event, 'target', { value: target })
  }
  window.dispatchEvent(event)
  return event
}

describe('useKeyboardShortcuts', () => {
  it('fires handler for Cmd+N', () => {
    const handler = vi.fn()
    renderHookWithProviders(() =>
      useKeyboardShortcuts({ newBookmark: handler }),
    )

    act(() => {
      fireKeydown('n', { metaKey: true })
    })

    expect(handler).toHaveBeenCalledOnce()
  })

  it('fires handler for Cmd+Shift+K', () => {
    const handler = vi.fn()
    renderHookWithProviders(() =>
      useKeyboardShortcuts({ editShortcuts: handler }),
    )

    act(() => {
      fireKeydown('k', { metaKey: true, shiftKey: true })
    })

    expect(handler).toHaveBeenCalledOnce()
  })

  it('does NOT fire for non-modifier keys (ArrowDown)', () => {
    const handler = vi.fn()
    renderHookWithProviders(() =>
      useKeyboardShortcuts({ navigateDown: handler }),
    )

    act(() => {
      fireKeydown('ArrowDown')
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('suppresses selectAll when focus is in an input', () => {
    const handler = vi.fn()
    renderHookWithProviders(() => useKeyboardShortcuts({ selectAll: handler }))

    const input = document.createElement('input')
    document.body.appendChild(input)

    act(() => {
      fireKeydown('a', { metaKey: true }, input)
    })

    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('suppresses searchInView when focus is in an input', () => {
    const handler = vi.fn()
    renderHookWithProviders(() =>
      useKeyboardShortcuts({ searchInView: handler }),
    )

    const input = document.createElement('input')
    document.body.appendChild(input)

    act(() => {
      fireKeydown('f', { metaKey: true }, input)
    })

    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('still fires Cmd+N when focus is in an input (not a native text shortcut)', () => {
    const handler = vi.fn()
    renderHookWithProviders(() =>
      useKeyboardShortcuts({ newBookmark: handler }),
    )

    const input = document.createElement('input')
    document.body.appendChild(input)

    act(() => {
      fireKeydown('n', { metaKey: true }, input)
    })

    expect(handler).toHaveBeenCalledOnce()
    document.body.removeChild(input)
  })

  it('does not fire handler for unregistered actions', () => {
    const handler = vi.fn()
    renderHookWithProviders(() =>
      useKeyboardShortcuts({ newBookmark: handler }),
    )

    act(() => {
      fireKeydown('x', { metaKey: true })
    })

    expect(handler).not.toHaveBeenCalled()
  })
})
