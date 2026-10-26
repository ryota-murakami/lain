import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'

import { DEFAULT_SHORTCUTS, settingsSlice } from '@/store/slices/settingsSlice'
import type { ShortcutBinding } from '@/store/slices/settingsSlice'
import { renderWithProviders } from '@test/render-with-providers'

import { ShortcutEditor } from './shortcut-editor'

const CMD_SHIFT_E: ShortcutBinding = {
  key: 'e',
  meta: true,
  shift: true,
  alt: false,
  ctrl: false,
}

/** Settings state where New Bookmark was rebound to ⌘⇧E. */
function settingsWithCustomNewBookmark() {
  return {
    ...settingsSlice.getInitialState(),
    shortcuts: { ...DEFAULT_SHORTCUTS, newBookmark: CMD_SHIFT_E },
  }
}

describe('ShortcutEditor', () => {
  test('lists every shortcut action with its current binding', () => {
    // Arrange / Act
    renderWithProviders(<ShortcutEditor />)

    // Assert
    expect(screen.getAllByTestId(/^shortcut-row-/)).toHaveLength(20)
    expect(
      within(screen.getByTestId('shortcut-row-newBookmark')).getByText('⌘N'),
    ).toBeVisible()
  })

  test('rebinds an action to the key combo pressed after clicking Edit', async () => {
    // Arrange
    const user = userEvent.setup()
    const { store } = renderWithProviders(<ShortcutEditor />)
    await user.click(
      screen.getByRole('button', { name: 'Edit New Bookmark shortcut' }),
    )

    // Act
    await user.keyboard('{Meta>}{Shift>}e{/Shift}{/Meta}')

    // Assert
    expect(store.getState().settings.shortcuts.newBookmark).toEqual(CMD_SHIFT_E)
    const row = screen.getByTestId('shortcut-row-newBookmark')
    expect(within(row).getByText('⇧⌘E')).toBeVisible()
    expect(within(row).getByText('Custom')).toBeVisible()
  })

  test('warns that the combo belongs to another action and swaps on request', async () => {
    // Arrange
    const user = userEvent.setup()
    const { store } = renderWithProviders(<ShortcutEditor />)
    await user.click(
      screen.getByRole('button', { name: 'Edit New Bookmark shortcut' }),
    )

    // Act — ⌘K already belongs to Global Search
    await user.keyboard('{Meta>}k{/Meta}')

    // Assert — warning shown, nothing changed yet
    expect(screen.getByRole('alert')).toHaveTextContent(
      '⌘K is used by Global Search',
    )
    expect(store.getState().settings.shortcuts.newBookmark).toEqual(
      DEFAULT_SHORTCUTS.newBookmark,
    )

    // Act — swap
    await user.click(screen.getByRole('button', { name: 'Swap' }))

    // Assert — both actions exchanged their bindings
    expect(store.getState().settings.shortcuts.newBookmark).toEqual(
      DEFAULT_SHORTCUTS.search,
    )
    expect(store.getState().settings.shortcuts.search).toEqual(
      DEFAULT_SHORTCUTS.newBookmark,
    )
  })

  test('keeps the current binding when the conflict is cancelled', async () => {
    // Arrange
    const user = userEvent.setup()
    const { store } = renderWithProviders(<ShortcutEditor />)
    await user.click(
      screen.getByRole('button', { name: 'Edit New Bookmark shortcut' }),
    )
    await user.keyboard('{Meta>}k{/Meta}')
    expect(screen.getByRole('alert')).toBeVisible()

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    // Assert
    expect(screen.queryByRole('alert')).toBeNull()
    expect(store.getState().settings.shortcuts.newBookmark).toEqual(
      DEFAULT_SHORTCUTS.newBookmark,
    )
  })

  test('cancels capture with Escape without changing the binding', async () => {
    // Arrange
    const user = userEvent.setup()
    const { store } = renderWithProviders(<ShortcutEditor />)
    await user.click(
      screen.getByRole('button', { name: 'Edit New Bookmark shortcut' }),
    )
    expect(
      screen.getByLabelText('Press new shortcut for New Bookmark'),
    ).toBeVisible()

    // Act
    await user.keyboard('{Escape}')

    // Assert
    expect(
      screen.queryByLabelText('Press new shortcut for New Bookmark'),
    ).toBeNull()
    expect(store.getState().settings.shortcuts.newBookmark).toEqual(
      DEFAULT_SHORTCUTS.newBookmark,
    )
  })

  test('keeps waiting when only a modifier key is pressed', async () => {
    // Arrange
    const user = userEvent.setup()
    const { store } = renderWithProviders(<ShortcutEditor />)
    await user.click(
      screen.getByRole('button', { name: 'Edit New Bookmark shortcut' }),
    )

    // Act
    await user.keyboard('{Meta>}{/Meta}')

    // Assert
    expect(
      screen.getByLabelText('Press new shortcut for New Bookmark'),
    ).toBeVisible()
    expect(store.getState().settings.shortcuts.newBookmark).toEqual(
      DEFAULT_SHORTCUTS.newBookmark,
    )
  })

  test('resets every shortcut to its default after confirming', async () => {
    // Arrange
    const user = userEvent.setup()
    const { store } = renderWithProviders(<ShortcutEditor />, {
      preloadedState: { settings: settingsWithCustomNewBookmark() },
    })
    expect(
      within(screen.getByTestId('shortcut-row-newBookmark')).getByText('⇧⌘E'),
    ).toBeVisible()

    // Act
    await user.click(screen.getByRole('button', { name: 'Reset to Defaults' }))
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    // Assert
    expect(store.getState().settings.shortcuts).toEqual(DEFAULT_SHORTCUTS)
    expect(
      within(screen.getByTestId('shortcut-row-newBookmark')).getByText('⌘N'),
    ).toBeVisible()
    expect(screen.queryByText('Custom')).toBeNull()
  })

  test('shows only the actions whose name matches the filter', async () => {
    // Arrange
    const user = userEvent.setup()
    renderWithProviders(<ShortcutEditor />)

    // Act
    await user.type(screen.getByLabelText('Filter actions'), 'grid')

    // Assert
    expect(screen.getAllByTestId(/^shortcut-row-/)).toHaveLength(1)
    expect(screen.getByTestId('shortcut-row-viewGrid')).toBeVisible()
    expect(screen.queryByTestId('shortcut-row-newBookmark')).toBeNull()
  })

  test('tells the user when no action matches the filter', async () => {
    // Arrange
    const user = userEvent.setup()
    renderWithProviders(<ShortcutEditor />)

    // Act
    await user.type(screen.getByLabelText('Filter actions'), 'zzz')

    // Assert
    expect(screen.getByText('No actions match “zzz”.')).toBeVisible()
  })

  test('marks a binding that differs from the default as custom', () => {
    // Arrange / Act
    renderWithProviders(<ShortcutEditor />, {
      preloadedState: { settings: settingsWithCustomNewBookmark() },
    })

    // Assert
    expect(
      within(screen.getByTestId('shortcut-row-newBookmark')).getByText(
        'Custom',
      ),
    ).toBeVisible()
    expect(
      within(screen.getByTestId('shortcut-row-search')).queryByText('Custom'),
    ).toBeNull()
  })

  test('shows the Escape shortcut as fixed instead of offering Edit', () => {
    // Arrange / Act
    renderWithProviders(<ShortcutEditor />)

    // Assert
    const row = screen.getByTestId('shortcut-row-escape')
    expect(within(row).getByText('Fixed')).toBeVisible()
    expect(within(row).queryByRole('button', { name: /edit/i })).toBeNull()
  })
})
