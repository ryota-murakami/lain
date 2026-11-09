import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { Group } from '@/lib/types'
import { renderWithProviders } from '@test/render-with-providers'

import { BulkActionDialog, type BulkAction } from './bulk-action-dialog'

const GROUPS: Group[] = [
  {
    id: 'work',
    name: 'Work',
    collections: [
      { id: '100', name: 'Reading', count: 2, icon: 'Folder', groupId: 'work' },
    ],
  },
]

/** Render a captured two-bookmark selection with isolated async mutation callbacks. */
function renderBulk(kind: BulkAction['kind']) {
  const props = {
    action: { kind, ids: ['1', '2'] },
    groups: GROUPS,
    onClose: vi.fn(),
    onMove: vi.fn(async () => {}),
    onTag: vi.fn(async () => {}),
  }
  return { props, ...renderWithProviders(<BulkActionDialog {...props} />) }
}

describe('bulk bookmark operations', () => {
  test('a chosen destination moves every captured bookmark and closes after success', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderBulk('move')

    // Act
    await user.click(screen.getByRole('combobox', { name: 'Collection' }))
    await user.click(screen.getByRole('button', { name: /Reading/ }))
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    // Assert
    expect(props.onMove).toHaveBeenCalledWith(['1', '2'], '100')
    expect(props.onTag).not.toHaveBeenCalled()
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  test('Unsorted is a valid destination before choosing a saved collection', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderBulk('move')

    // Act
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    // Assert
    expect(props.onMove).toHaveBeenCalledWith(['1', '2'], 'unsorted')
  })

  test('new bulk tags are trimmed, normalized, and deduplicated without replacing existing tags', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderBulk('tag')

    // Act
    await user.type(
      screen.getByLabelText('Tags'),
      ' React, read-later, REACT, , ',
    )
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    // Assert
    expect(screen.getByText(/Existing tags are kept/)).toBeVisible()
    expect(props.onTag).toHaveBeenCalledWith(
      ['1', '2'],
      ['react', 'read-later'],
    )
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  test('a rejected tag update preserves the typed tags and captured selection for retry', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderBulk('tag')
    props.onTag.mockRejectedValueOnce(new Error('offline'))
    await user.type(screen.getByLabelText('Tags'), 'Research, read-later')

    // Act
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your selection is preserved',
    )
    expect(screen.getByLabelText('Tags')).toHaveValue('Research, read-later')
    expect(props.onClose).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(props.onTag).toHaveBeenNthCalledWith(
      2,
      ['1', '2'],
      ['research', 'read-later'],
    )
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  test('a pending move prevents duplicate submissions and dialog dismissal', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderBulk('move')
    let finish!: () => void
    props.onMove.mockImplementation(
      async () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )

    // Act
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await user.keyboard('{Escape}')

    // Assert
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(props.onMove).toHaveBeenCalledOnce()
    expect(props.onClose).not.toHaveBeenCalled()
    await act(async () => finish())
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  test('commas and whitespace alone cannot submit an empty tag update', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderBulk('tag')

    // Act
    await user.type(screen.getByLabelText('Tags'), ' , , ')

    // Assert
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    expect(props.onTag).not.toHaveBeenCalled()
  })
})
