import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

import { useHasPendingWork } from '@/hooks/usePendingWork'
import type { Group } from '@/lib/types'

import { CollectionDialog } from './collection-dialog'

const groups: Group[] = [{ id: 'dev', name: 'Development', collections: [] }]

const refreshedGroups: Group[] = [
  ...groups,
  { id: 'new', name: 'New Group', collections: [] },
]
const child = {
  id: '902',
  name: 'Child',
  icon: 'Folder',
  count: 0,
  groupId: 'dev',
}
const editing = {
  id: '901',
  name: 'Edited root',
  icon: 'Folder',
  count: 0,
  groupId: 'dev',
  children: [child],
}
const tree: Group[] = [
  { id: 'dev', name: 'Development', collections: [editing] },
  {
    id: 'work',
    name: 'Work',
    collections: [
      {
        id: '903',
        name: 'Target parent',
        icon: 'Folder',
        count: 0,
        groupId: 'work',
      },
    ],
  },
]
const groupsWithSynthetic: Group[] = [
  { id: 'ungrouped', name: 'Other collections', collections: [] },
  ...tree,
]

test('creates in the requested group and captures a different group when reopened', async () => {
  // Arrange
  const onSave = vi.fn().mockResolvedValue(undefined)
  const props = { onOpenChange: vi.fn(), groups: tree, onSave }
  const view = render(
    <CollectionDialog {...props} open initialGroupId="work" />,
  )
  expect(screen.getByRole('combobox', { name: 'Group' })).toHaveTextContent(
    'Work',
  )

  // Act
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Work reading' },
  })
  fireEvent.submit(
    screen.getByRole('button', { name: 'Create Collection' }).closest('form')!,
  )

  // Assert
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      name: 'Work reading',
      icon: 'Folder',
      color: '#8b5cf6',
      groupId: 'work',
      parentId: undefined,
      viewMode: 'list',
      isPublic: false,
      id: undefined,
    }),
  )

  // Act
  view.rerender(
    <CollectionDialog {...props} open={false} initialGroupId="work" />,
  )
  view.rerender(<CollectionDialog {...props} open initialGroupId="dev" />)

  // Assert
  expect(screen.getByLabelText('Name')).toHaveValue('')
  expect(screen.getByRole('combobox', { name: 'Group' })).toHaveTextContent(
    'Development',
  )
})

test.each(['missing', 'ungrouped', undefined])(
  'ignores an unavailable or synthetic initial group (%s)',
  async (initialGroupId) => {
    // Arrange
    const user = userEvent.setup()
    render(
      <CollectionDialog
        open
        initialGroupId={initialGroupId}
        groups={groupsWithSynthetic}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    // Assert
    expect(screen.getByRole('combobox', { name: 'Group' })).toHaveTextContent(
      'Development',
    )

    // Act
    await user.click(screen.getByRole('combobox', { name: 'Group' }))

    // Assert
    expect(
      screen.queryByRole('option', { name: 'Other collections' }),
    ).toBeNull()
    expect(screen.getByRole('option', { name: 'Work' })).toBeVisible()
  },
)

test('an existing collection keeps its group despite a different creation context', () => {
  // Arrange
  render(
    <CollectionDialog
      open
      initialGroupId="work"
      collection={editing}
      groups={tree}
      onOpenChange={vi.fn()}
      onSave={vi.fn()}
    />,
  )

  // Assert
  expect(screen.getByRole('combobox', { name: 'Group' })).toHaveTextContent(
    'Development',
  )
  expect(screen.getByLabelText('Name')).toHaveValue('Edited root')
})

test('saves shared picker values and treats color-only changes as pending work', async () => {
  // Arrange
  const user = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(
    <CollectionDialog
      open
      onOpenChange={vi.fn()}
      groups={groups}
      onSave={onSave}
    />,
  )
  const pending = renderHook(() => useHasPendingWork())
  // Act
  await user.click(
    screen.getByRole('button', {
      name: 'Color (this Lain account on this device)',
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Select color #ef4444' }))
  await user.keyboard('{Escape}')
  // Assert
  expect(pending.result.current).toBe(true)
  expect(onSave).not.toHaveBeenCalled()
  // Act
  await user.click(
    screen.getByRole('button', {
      name: 'Icon (this Lain account on this device)',
    }),
  )
  await user.type(
    screen.getByRole('textbox', { name: 'Search icons' }),
    'Database',
  )
  await user.click(screen.getByRole('button', { name: 'Select icon Database' }))
  await user.type(screen.getByLabelText('Name'), 'Research')
  await user.click(screen.getByRole('button', { name: 'Create Collection' }))
  // Assert
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      name: 'Research',
      icon: 'Database',
      color: '#ef4444',
      groupId: 'dev',
      parentId: undefined,
      viewMode: 'list',
      isPublic: false,
      id: undefined,
    }),
  )
})

test('retains a created collection ID and form input when organization must be retried', async () => {
  // Arrange
  const onSave = vi
    .fn()
    .mockRejectedValueOnce(
      Object.assign(new Error('Organization failed'), { collectionId: '901' }),
    )
    .mockResolvedValue(undefined)
  const onOpenChange = vi.fn()
  render(
    <CollectionDialog
      open
      onOpenChange={onOpenChange}
      groups={groups}
      onSave={onSave}
    />,
  )
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Keep this collection' },
  })
  // Act
  fireEvent.submit(
    screen.getByRole('button', { name: 'Create Collection' }).closest('form')!,
  )
  // Assert
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Your input is preserved; try again.',
  )
  expect(screen.getByLabelText('Name')).toHaveValue('Keep this collection')
  expect(onOpenChange).not.toHaveBeenCalled()
  // Act
  fireEvent.submit(
    screen.getByRole('button', { name: 'Create Collection' }).closest('form')!,
  )
  // Assert
  await waitFor(() =>
    expect(onSave).toHaveBeenNthCalledWith(2, {
      name: 'Keep this collection',
      icon: 'Folder',
      color: '#8b5cf6',
      groupId: 'dev',
      parentId: undefined,
      viewMode: 'list',
      isPublic: false,
      id: '901',
    }),
  )
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
})

test('keeps typed input on group refresh and restores public and view preferences for editing', () => {
  // Arrange
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    groups,
    onSave: vi.fn(),
    collection: {
      id: '901',
      name: 'Shared',
      icon: 'Database',
      count: 0,
      groupId: 'dev',
      isPublic: true,
    },
  }
  const view = render(
    <CollectionDialog {...props} defaultViewMode="directory" />,
  )
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Edited locally' },
  })
  // Act
  view.rerender(
    <CollectionDialog
      {...props}
      defaultViewMode="directory"
      groups={refreshedGroups}
    />,
  )
  // Assert
  expect(screen.getByLabelText('Name')).toHaveValue('Edited locally')
  expect(screen.getByRole('switch', { name: 'Public' })).toBeChecked()
  expect(
    screen.getByRole('combobox', { name: 'Default View (Lain only)' }),
  ).toHaveTextContent('Directory')
})

test('excludes the edited branch from parent choices and uses the chosen parent group', async () => {
  // Arrange
  const onSave = vi.fn().mockResolvedValue(undefined)
  const user = userEvent.setup()
  render(
    <CollectionDialog
      open
      collection={editing}
      groups={tree}
      onOpenChange={vi.fn()}
      onSave={onSave}
    />,
  )
  // Act
  await user.click(screen.getByRole('combobox', { name: 'Parent Collection' }))
  // Assert
  expect(screen.queryByRole('button', { name: 'Edited root 0' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Child 0' })).toBeNull()
  expect(onSave).not.toHaveBeenCalled()
  // Act
  await user.click(screen.getByRole('button', { name: 'Target parent 0' }))
  // Assert
  expect(screen.getByRole('combobox', { name: 'Group' })).toBeDisabled()
  expect(screen.getByRole('combobox', { name: 'Group' })).toHaveTextContent(
    'Work',
  )
  // Act
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  // Assert
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      name: 'Edited root',
      icon: 'Folder',
      color: '#8b5cf6',
      groupId: 'work',
      parentId: '903',
      viewMode: 'list',
      isPublic: false,
      id: '901',
    }),
  )
})
