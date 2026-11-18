import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

import type { Collection } from '@/lib/types'

import { MergeDialog } from './merge-dialog'

const collections: Collection[] = [
  { id: '100', name: 'Source', count: 3, icon: 'Folder', groupId: 'group' },
  { id: '200', name: 'Target', count: 4, icon: 'Folder', groupId: 'group' },
]
const remainingCollections = [collections[1]]
const nestedCollections: Collection[] = [
  {
    id: '100',
    name: 'Research',
    count: 0,
    icon: 'Folder',
    groupId: 'group',
    children: [
      {
        id: '101',
        name: 'Reading',
        count: 3,
        icon: 'Folder',
        groupId: 'group',
        parentId: '100',
        children: [
          {
            id: '102',
            name: 'Deep reading',
            count: 1,
            icon: 'Folder',
            groupId: 'group',
            parentId: '101',
          },
        ],
      },
    ],
  },
  {
    id: '200',
    name: 'Archive',
    count: 4,
    icon: 'Folder',
    groupId: 'group',
    children: [
      {
        id: '201',
        name: 'Reading',
        count: 2,
        icon: 'Folder',
        groupId: 'group',
        parentId: '200',
      },
    ],
  },
]
const movedTargetCollections: Collection[] = [
  { ...collections[0], children: [collections[1]] },
]

test('nested collection sources show their full paths and can merge into a different root', async () => {
  // Arrange
  const user = userEvent.setup()
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  render(
    <MergeDialog
      collections={nestedCollections}
      open
      onOpenChange={vi.fn()}
      onConfirm={onConfirm}
    />,
  )

  // Act
  await user.click(
    screen.getByRole('combobox', { name: 'Source (will be deleted)' }),
  )

  // Assert
  expect(
    screen.getByRole('option', { name: 'Research / Reading (3)' }),
  ).toBeVisible()
  expect(
    screen.getByRole('option', { name: 'Archive / Reading (2)' }),
  ).toBeVisible()

  // Act
  await user.click(
    screen.getByRole('option', { name: 'Research / Reading (3)' }),
  )
  await user.click(
    screen.getByRole('combobox', { name: 'Target (receives bookmarks)' }),
  )
  await user.click(screen.getByRole('option', { name: 'Archive (4)' }))
  await user.click(screen.getByRole('button', { name: 'Confirm Merge' }))

  // Assert
  await waitFor(() =>
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith('101', '200'),
  )
})

test('a source cannot target itself or any nested descendant', async () => {
  // Arrange
  const user = userEvent.setup()
  const onConfirm = vi.fn()
  render(
    <MergeDialog
      collections={nestedCollections}
      open
      onOpenChange={vi.fn()}
      onConfirm={onConfirm}
    />,
  )

  // Act
  await user.click(
    screen.getByRole('combobox', { name: 'Source (will be deleted)' }),
  )
  await user.click(screen.getByRole('option', { name: 'Research (0)' }))
  await user.click(
    screen.getByRole('combobox', { name: 'Target (receives bookmarks)' }),
  )

  // Assert
  expect(screen.getByRole('option', { name: 'Research (0)' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  expect(
    screen.getByRole('option', { name: 'Research / Reading (3)' }),
  ).toHaveAttribute('aria-disabled', 'true')
  expect(
    screen.getByRole('option', {
      name: 'Research / Reading / Deep reading (1)',
    }),
  ).toHaveAttribute('aria-disabled', 'true')
  expect(
    screen.getByText(
      'The target must be outside the source collection and its descendants. Unavailable choices are disabled.',
    ),
  ).toBeVisible()
  expect(onConfirm).not.toHaveBeenCalled()
})

test('choosing the target first disables its ancestors as merge sources', async () => {
  // Arrange
  const user = userEvent.setup()
  render(
    <MergeDialog
      collections={nestedCollections}
      open
      onOpenChange={vi.fn()}
      onConfirm={vi.fn()}
    />,
  )

  // Act
  await user.click(
    screen.getByRole('combobox', { name: 'Target (receives bookmarks)' }),
  )
  await user.click(
    screen.getByRole('option', {
      name: 'Research / Reading / Deep reading (1)',
    }),
  )
  await user.click(
    screen.getByRole('combobox', { name: 'Source (will be deleted)' }),
  )

  // Assert
  expect(screen.getByRole('option', { name: 'Research (0)' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  expect(
    screen.getByRole('option', { name: 'Research / Reading (3)' }),
  ).toHaveAttribute('aria-disabled', 'true')
  expect(
    screen.getByRole('option', {
      name: 'Research / Reading / Deep reading (1)',
    }),
  ).toHaveAttribute('aria-disabled', 'true')
  expect(
    screen.getByRole('option', { name: 'Archive (4)' }),
  ).not.toHaveAttribute('aria-disabled')
})

test('a target moved below the source while the dialog is open cannot be merged', async () => {
  // Arrange
  const onConfirm = vi.fn()
  const view = render(
    <MergeDialog
      collections={collections}
      open
      onOpenChange={vi.fn()}
      onConfirm={onConfirm}
    />,
  )
  await chooseCollections()

  // Act
  view.rerender(
    <MergeDialog
      collections={movedTargetCollections}
      open
      onOpenChange={vi.fn()}
      onConfirm={onConfirm}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Merge' }))

  // Assert
  expect(screen.getByRole('button', { name: 'Confirm Merge' })).toBeDisabled()
  expect(onConfirm).not.toHaveBeenCalled()
})

/**
 * Choose two distinct collections through the real accessible Select controls.
 * Merge-dialog tests call this after rendering their own async mutation behavior.
 * @example await chooseCollections()
 */
async function chooseCollections(): Promise<void> {
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('combobox', { name: 'Source (will be deleted)' }),
  )
  await user.click(await screen.findByRole('option', { name: 'Source (3)' }))
  await user.click(
    screen.getByRole('combobox', { name: 'Target (receives bookmarks)' }),
  )
  await user.click(await screen.findByRole('option', { name: 'Target (4)' }))
}

test('collection merge waits for service confirmation and blocks duplicate clicks or dismissal', async () => {
  // Arrange
  let finish: () => void = () => {}
  const onConfirm = vi.fn(
    async () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  const onOpenChange = vi.fn()
  render(
    <MergeDialog
      collections={collections}
      open
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />,
  )
  await chooseCollections()
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Merge' }))
  fireEvent.click(screen.getByRole('button', { name: 'Merging…' }))
  fireEvent.keyDown(document, { key: 'Escape' })
  // Assert
  expect(onConfirm).toHaveBeenCalledExactlyOnceWith('100', '200')
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(
    screen.getByRole('combobox', { name: 'Source (will be deleted)' }),
  ).toBeDisabled()
  expect(
    screen.getByRole('combobox', { name: 'Target (receives bookmarks)' }),
  ).toBeDisabled()
  expect(onOpenChange).not.toHaveBeenCalled()
  await act(async () => {
    finish()
  })
  expect(onOpenChange).toHaveBeenCalledWith(false)
})

test('failed collection merge keeps both selections and retries them without closing', async () => {
  // Arrange
  const onConfirm = vi
    .fn()
    .mockRejectedValueOnce(new Error('Merge unavailable'))
    .mockResolvedValue(undefined)
  const onOpenChange = vi.fn()
  render(
    <MergeDialog
      collections={collections}
      open
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />,
  )
  await chooseCollections()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Merge' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Merge unavailable',
  )
  expect(
    screen.getByRole('combobox', { name: 'Source (will be deleted)' }),
  ).toHaveTextContent('Source (3)')
  expect(
    screen.getByRole('combobox', { name: 'Target (receives bookmarks)' }),
  ).toHaveTextContent('Target (4)')
  expect(onOpenChange).not.toHaveBeenCalled()
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Retry Merge' }))
  // Assert
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  expect(onConfirm.mock.calls).toEqual([
    ['100', '200'],
    ['100', '200'],
  ])
  expect(screen.queryByRole('alert')).toBeNull()
})

test('collection merge cannot submit before both collections are selected', async () => {
  // Arrange
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  render(
    <MergeDialog
      collections={collections}
      open
      onOpenChange={vi.fn()}
      onConfirm={onConfirm}
    />,
  )
  // Act
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('combobox', { name: 'Source (will be deleted)' }),
  )
  await user.click(await screen.findByRole('option', { name: 'Source (3)' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Merge' }))
  // Assert
  expect(screen.getByRole('button', { name: 'Confirm Merge' })).toBeDisabled()
  expect(onConfirm).not.toHaveBeenCalled()
})

test('a collection removed while the dialog is open cannot be submitted as a stale source', async () => {
  // Arrange
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  const { rerender } = render(
    <MergeDialog
      collections={collections}
      open
      onOpenChange={vi.fn()}
      onConfirm={onConfirm}
    />,
  )
  await chooseCollections()
  // Act
  rerender(
    <MergeDialog
      collections={remainingCollections}
      open
      onOpenChange={vi.fn()}
      onConfirm={onConfirm}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Merge' }))
  // Assert
  expect(screen.getByRole('button', { name: 'Confirm Merge' })).toBeDisabled()
  expect(onConfirm).not.toHaveBeenCalled()
})
