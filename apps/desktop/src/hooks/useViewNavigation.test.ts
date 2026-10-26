import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { renderHookWithProviders } from '@test/render-with-providers'

import { useViewNavigation } from './useViewNavigation'

/**
 * Dispatch a bubbling keydown from `target` (defaults to body, like a real keypress
 * with nothing focused) so it reaches the hook's window listener.
 * @param key - KeyboardEvent key
 * @param target - Element the key is pressed on
 * @returns The dispatched event (check `defaultPrevented`)
 * @example fireKeydown('ArrowDown') // target = document.body
 */
function fireKeydown(
  key: string,
  target: Element = document.body,
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  })
  target.dispatchEvent(event)
  return event
}

/** Three focusable rows inside a container, like a rendered list view. */
function mountRows(): { container: HTMLDivElement; rows: HTMLDivElement[] } {
  const container = document.createElement('div')
  const rows = ['1', '2', '3'].map((id) => {
    const row = document.createElement('div')
    row.setAttribute('data-raindrop-id', id)
    row.tabIndex = -1
    container.appendChild(row)
    return row
  })
  document.body.appendChild(container)
  return { container, rows }
}

describe('useViewNavigation', () => {
  let container: HTMLDivElement
  let rows: HTMLDivElement[]
  const onNavigate = vi.fn()
  const onOpen = vi.fn()
  const onPreviewToggle = vi.fn()

  beforeEach(() => {
    ;({ container, rows } = mountRows())
    onNavigate.mockReset()
    onOpen.mockReset()
    onPreviewToggle.mockReset()
  })

  afterEach(() => {
    container.remove()
  })

  /** Mount the hook against the test container. */
  function renderNavigation(selectedRaindropId?: string) {
    return renderHookWithProviders(() =>
      useViewNavigation({
        containerRef: { current: container },
        selectedRaindropId,
        onNavigate,
        onOpen,
        onPreviewToggle,
      }),
    )
  }

  test('ArrowDown with nothing focused lands on the first bookmark', () => {
    // Arrange
    renderNavigation()

    // Act
    let event: KeyboardEvent | undefined
    act(() => {
      event = fireKeydown('ArrowDown')
    })

    // Assert
    expect(document.activeElement).toBe(rows[0])
    expect(onNavigate).toHaveBeenCalledWith('1')
    expect(event?.defaultPrevented).toBe(true)
  })

  test('ArrowDown moves to the next bookmark and stops at the last one', () => {
    // Arrange
    renderNavigation()
    rows[1].focus()

    // Act
    act(() => {
      fireKeydown('ArrowDown', rows[1])
    })
    act(() => {
      fireKeydown('ArrowDown', rows[2])
    })

    // Assert — second press stays on the last row instead of wrapping
    expect(document.activeElement).toBe(rows[2])
    expect(onNavigate).toHaveBeenNthCalledWith(1, '3')
    expect(onNavigate).toHaveBeenNthCalledWith(2, '3')
  })

  test('ArrowUp moves to the previous bookmark', () => {
    // Arrange
    renderNavigation()
    rows[2].focus()

    // Act
    act(() => {
      fireKeydown('ArrowUp', rows[2])
    })

    // Assert
    expect(document.activeElement).toBe(rows[1])
    expect(onNavigate).toHaveBeenCalledWith('2')
  })

  test('starts from the selected bookmark when no row has focus', () => {
    // Arrange — "2" is highlighted (e.g. after a mouse click) but nothing is focused
    renderNavigation('2')

    // Act
    act(() => {
      fireKeydown('ArrowDown')
    })

    // Assert
    expect(document.activeElement).toBe(rows[2])
    expect(onNavigate).toHaveBeenCalledWith('3')
  })

  test('Enter opens the focused bookmark', () => {
    // Arrange
    renderNavigation()
    rows[0].focus()

    // Act
    act(() => {
      fireKeydown('Enter', rows[0])
    })

    // Assert
    expect(onOpen).toHaveBeenCalledWith('1')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  test('Space toggles the preview of the focused bookmark', () => {
    // Arrange
    renderNavigation()
    rows[1].focus()

    // Act
    act(() => {
      fireKeydown(' ', rows[1])
    })

    // Assert
    expect(onPreviewToggle).toHaveBeenCalledWith('2')
  })

  test('Enter and Space do nothing when no bookmark is current', () => {
    // Arrange
    renderNavigation()

    // Act
    act(() => {
      fireKeydown('Enter')
      fireKeydown(' ')
    })

    // Assert
    expect(onOpen).not.toHaveBeenCalled()
    expect(onPreviewToggle).not.toHaveBeenCalled()
  })

  test('ignores navigation keys while typing in a text field', () => {
    // Arrange
    renderNavigation()
    const input = document.createElement('input')
    document.body.appendChild(input)

    // Act
    let event: KeyboardEvent | undefined
    act(() => {
      event = fireKeydown('ArrowDown', input)
    })

    // Assert — the caret moves, the list does not
    expect(onNavigate).not.toHaveBeenCalled()
    expect(event?.defaultPrevented).toBe(false)
    input.remove()
  })

  test('leaves Space to a focused row checkbox but still lets ArrowDown move on', () => {
    // Arrange
    renderNavigation()
    const checkbox = document.createElement('button')
    checkbox.setAttribute('role', 'checkbox')
    rows[0].appendChild(checkbox)
    checkbox.focus()

    // Act
    act(() => {
      fireKeydown(' ', checkbox)
      fireKeydown('ArrowDown', checkbox)
    })

    // Assert — Space toggles the checkbox natively; ArrowDown continues from that row
    expect(onPreviewToggle).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(rows[1])
    expect(onNavigate).toHaveBeenCalledWith('2')
  })

  test('ignores keys coming from outside the view, such as an open dialog', () => {
    // Arrange
    renderNavigation()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)

    // Act
    act(() => {
      fireKeydown('ArrowDown', dialog)
    })

    // Assert
    expect(onNavigate).not.toHaveBeenCalled()
    dialog.remove()
  })
})
