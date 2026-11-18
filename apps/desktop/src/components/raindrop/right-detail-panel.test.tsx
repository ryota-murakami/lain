import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

import type { Raindrop, Group } from '@/lib/types'

import { RightDetailPanel } from './right-detail-panel'

const bookmark: Raindrop = {
  id: '101',
  title: 'Original title',
  url: 'https://example.com/article',
  description: 'Original description',
  type: 'article',
  tags: ['react'],
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  collectionId: 'leaf',
  isImportant: false,
  notes: 'Original notes',
}

const noGroups: Group[] = []
const noTags: string[] = []
const existingTags = ['typescript']
const remoteBookmark: Raindrop = {
  ...bookmark,
  title: 'Remote title',
  tags: ['remote'],
  updatedAt: '2026-11-02T00:00:00Z',
}
const refreshedBookmark: Raindrop = {
  ...bookmark,
  title: 'Refreshed title',
  tags: ['updated'],
}
const conflictBookmark: Raindrop = { ...bookmark, title: 'Remote title' }
const leaf = {
  id: 'leaf',
  name: 'Deep collection',
  icon: 'Folder',
  count: 1,
  groupId: 'dev',
}
const nestedGroups: Group[] = [
  {
    id: 'dev',
    name: 'Development',
    collections: [
      {
        ...leaf,
        id: 'root',
        name: 'Root',
        children: [{ ...leaf, id: 'middle', name: 'Middle', children: [leaf] }],
      },
    ],
  },
]

test('preserves shared tag edits and dirty navigation state after saving fails', async () => {
  // Arrange
  const user = userEvent.setup()
  const onSave = vi.fn().mockRejectedValue(new Error('Offline'))
  const onDirtyChange = vi.fn()
  render(
    <RightDetailPanel
      raindrop={bookmark}
      isOpen
      onClose={vi.fn()}
      groups={noGroups}
      existingTags={existingTags}
      onSave={onSave}
      onDelete={vi.fn().mockResolvedValue(undefined)}
      onDirtyChange={onDirtyChange}
    />,
  )
  // Act
  await user.type(
    screen.getByRole('combobox', { name: 'Tags' }),
    'typescript{Enter}',
  )
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  // Assert
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Your input is preserved; try again.',
  )
  expect(
    screen.getByRole('button', { name: 'Remove typescript tag' }),
  ).toBeVisible()
  expect(onSave).toHaveBeenCalledExactlyOnceWith({
    ...bookmark,
    tags: ['react', 'typescript'],
  })
  expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
})

test('preserves local edits during a remote update and explicitly reloads the latest values', async () => {
  // Arrange
  const user = userEvent.setup()
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    groups: [],
    existingTags: [],
    onSave: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onDirtyChange: vi.fn(),
  }
  const view = render(<RightDetailPanel {...props} raindrop={bookmark} />)
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Local title' },
  })
  // Act
  view.rerender(<RightDetailPanel {...props} raindrop={remoteBookmark} />)
  // Assert
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Your edits are preserved.',
  )
  expect(screen.getByLabelText('Title')).toHaveValue('Local title')
  expect(screen.getByRole('button', { name: 'Remove react tag' })).toBeVisible()
  // Act
  await user.click(
    screen.getByRole('button', { name: 'Discard edits and load latest' }),
  )
  // Assert
  expect(screen.getByLabelText('Title')).toHaveValue('Remote title')
  expect(
    screen.getByRole('button', { name: 'Remove remote tag' }),
  ).toBeVisible()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  expect(props.onDirtyChange).toHaveBeenLastCalledWith(false)
})

test('loads refreshed remote values automatically when the form has no local changes', () => {
  // Arrange
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    groups: [],
    existingTags: [],
    onSave: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
  }
  const view = render(<RightDetailPanel {...props} raindrop={bookmark} />)
  // Act
  view.rerender(<RightDetailPanel {...props} raindrop={refreshedBookmark} />)
  // Assert
  expect(screen.getByLabelText('Title')).toHaveValue('Refreshed title')
  expect(
    screen.getByRole('button', { name: 'Remove updated tag' }),
  ).toBeVisible()
  expect(screen.queryByRole('alert')).toBeNull()
})

test('clears a resolved conflict while keeping edits typed after a save request started', async () => {
  // Arrange
  let finishSave = (): void => {}
  const onSave = vi.fn(
    async () =>
      new Promise<void>((resolve) => {
        finishSave = resolve
      }),
  )
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    groups: [],
    existingTags: [],
    onSave,
    onDelete: vi.fn().mockResolvedValue(undefined),
  }
  const view = render(<RightDetailPanel {...props} raindrop={bookmark} />)
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Submitted title' },
  })
  view.rerender(<RightDetailPanel {...props} raindrop={conflictBookmark} />)
  // Act
  fireEvent.submit(
    screen.getByRole('button', { name: 'Save my edits' }).closest('form')!,
  )
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Newer unsaved title' },
  })
  await act(async () => {
    finishSave()
  })
  // Assert
  expect(screen.getByLabelText('Title')).toHaveValue('Newer unsaved title')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
  expect(onSave).toHaveBeenCalledExactlyOnceWith({
    ...bookmark,
    title: 'Submitted title',
  })
})

test('keeps the detail panel and input intact when moving to Trash fails', async () => {
  // Arrange
  let rejectDelete: (error: Error) => void = () => {}
  const onDelete = vi.fn(
    async () =>
      new Promise<void>((_resolve, reject) => {
        rejectDelete = reject
      }),
  )
  const onClose = vi.fn()
  const user = userEvent.setup()
  render(
    <RightDetailPanel
      raindrop={bookmark}
      isOpen
      onClose={onClose}
      groups={noGroups}
      existingTags={noTags}
      onSave={vi.fn().mockResolvedValue(undefined)}
      onDelete={onDelete}
    />,
  )
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Do not lose this edit' },
  })
  // Act
  await user.click(screen.getByRole('button', { name: 'Move to Trash' }))
  // Assert
  expect(
    screen.getByRole('button', { name: 'Moving to Trash…' }),
  ).toBeDisabled()
  expect(onClose).not.toHaveBeenCalled()
  // Act
  await act(async () => {
    rejectDelete(new Error('Offline'))
  })
  // Assert
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not move this bookmark to Trash.',
  )
  expect(screen.getByLabelText('Title')).toHaveValue('Do not lose this edit')
  expect(screen.getByRole('button', { name: 'Move to Trash' })).toBeEnabled()
  expect(onClose).not.toHaveBeenCalled()
  expect(onDelete).toHaveBeenCalledExactlyOnceWith('101')
})

test('shows the collection name for bookmarks nested more than two levels deep', () => {
  // Arrange
  // Act
  render(
    <RightDetailPanel
      raindrop={bookmark}
      isOpen
      onClose={vi.fn()}
      groups={nestedGroups}
      existingTags={noTags}
      onSave={vi.fn().mockResolvedValue(undefined)}
      onDelete={vi.fn().mockResolvedValue(undefined)}
    />,
  )
  // Assert
  expect(screen.getByText('in Deep collection')).toBeVisible()
})
