import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { TagManagement } from './tag-management'

const tags = [
  { name: 'react', count: 8 },
  { name: 'typescript', count: 6 },
  { name: 'design', count: 12 },
]

test('tag rename waits for confirmation and prevents repeated Enter submissions', async () => {
  // Arrange
  let finish: () => void = () => {}
  const onRename = vi.fn(
    async () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  const onOpenChange = vi.fn()
  render(
    <TagManagement
      tags={tags}
      open
      onOpenChange={onOpenChange}
      onRename={onRename}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Rename tag react' }))
  const input = screen.getByLabelText('New name for react')
  fireEvent.change(input, { target: { value: 'frontend' } })
  // Act
  fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.keyDown(document, { key: 'Escape' })
  // Assert
  expect(onRename).toHaveBeenCalledTimes(1)
  expect(input).toBeVisible()
  expect(input).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Saving tag changes')
  expect(onOpenChange).not.toHaveBeenCalled()
  await act(async () => {
    finish()
  })
  expect(screen.queryByLabelText('New name for react')).toBeNull()
})

test('failed tag rename retains input and retries the same trimmed name', async () => {
  // Arrange
  const onRename = vi
    .fn()
    .mockRejectedValueOnce(new Error('Rename unavailable'))
    .mockResolvedValue(undefined)
  render(
    <TagManagement
      tags={tags}
      open
      onOpenChange={vi.fn()}
      onRename={onRename}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Rename tag react' }))
  fireEvent.change(screen.getByLabelText('New name for react'), {
    target: { value: ' frontend ' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save name for react' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Rename unavailable',
  )
  expect(screen.getByLabelText('New name for react')).toHaveValue(' frontend ')
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Save name for react' }))
  // Assert
  await waitFor(() =>
    expect(screen.queryByLabelText('New name for react')).toBeNull(),
  )
  expect(onRename.mock.calls).toEqual([
    ['react', 'frontend'],
    ['react', 'frontend'],
  ])
  expect(screen.queryByRole('alert')).toBeNull()
})

test('failed tag deletion keeps confirmation open and permits retry without closing management', async () => {
  // Arrange
  const onDelete = vi
    .fn()
    .mockRejectedValueOnce(new Error('Delete unavailable'))
    .mockResolvedValue(undefined)
  const onOpenChange = vi.fn()
  render(
    <TagManagement
      tags={tags}
      open
      onOpenChange={onOpenChange}
      onDelete={onDelete}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Delete tag react' }))
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Delete',
    }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Delete unavailable',
  )
  expect(screen.getByRole('alertdialog')).toBeVisible()
  // Act
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Delete',
    }),
  )
  // Assert
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  expect(onDelete.mock.calls).toEqual([['react'], ['react']])
  expect(onOpenChange).not.toHaveBeenCalled()
})

test('pending deletion disables cancel and duplicate submission until the server resolves', async () => {
  // Arrange
  let finish: () => void = () => {}
  const onDelete = vi.fn(
    async () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  render(
    <TagManagement
      tags={tags}
      open
      onOpenChange={vi.fn()}
      onDelete={onDelete}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Delete tag react' }))
  // Act
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Delete',
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Deleting…' }))
  // Assert
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(screen.getByRole('alertdialog')).toBeVisible()
  expect(onDelete).toHaveBeenCalledTimes(1)
  await act(async () => {
    finish()
  })
})

test('failed tag merge retains target and sources until a confirmed retry succeeds', async () => {
  // Arrange
  const onMerge = vi
    .fn()
    .mockRejectedValueOnce(new Error('Merge unavailable'))
    .mockResolvedValue(undefined)
  render(
    <TagManagement tags={tags} open onOpenChange={vi.fn()} onMerge={onMerge} />,
  )
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select tag react' }))
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Select tag typescript' }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Merge' }))
  fireEvent.change(screen.getByLabelText('Merged tag name'), {
    target: { value: ' web ' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Merge Tags' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Merge unavailable',
  )
  expect(screen.getByLabelText('Merged tag name')).toHaveValue(' web ')
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Merge Tags' }))
  // Assert
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Merge Tags' })).toBeNull(),
  )
  expect(onMerge.mock.calls).toEqual([
    [['react', 'typescript'], 'web'],
    [['react', 'typescript'], 'web'],
  ])
  expect(
    screen.getByRole('checkbox', { name: 'Select tag react' }),
  ).not.toBeChecked()
  expect(
    screen.getByRole('checkbox', { name: 'Select tag typescript' }),
  ).not.toBeChecked()
})

test('pending tag merge keeps the dialog open and suppresses repeated Enter', async () => {
  // Arrange
  let finish: () => void = () => {}
  const onMerge = vi.fn(
    async () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  render(
    <TagManagement tags={tags} open onOpenChange={vi.fn()} onMerge={onMerge} />,
  )
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select tag react' }))
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Select tag typescript' }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Merge' }))
  const input = screen.getByLabelText('Merged tag name')
  fireEvent.change(input, { target: { value: 'web' } })
  // Act
  fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.keyDown(input, { key: 'Enter' })
  // Assert
  expect(input).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(screen.getByRole('dialog', { name: 'Merge Tags' })).toBeVisible()
  expect(onMerge).toHaveBeenCalledTimes(1)
  await act(async () => {
    finish()
  })
})

test('bulk deletion retains only failed and unattempted selections for retry', async () => {
  // Arrange
  const onDelete = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('Unavailable'))
    .mockResolvedValue(undefined)
  render(
    <TagManagement
      tags={tags}
      open
      onOpenChange={vi.fn()}
      onDelete={onDelete}
    />,
  )
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select tag react' }))
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Select tag typescript' }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Deleted 1 tags.')
  expect(
    screen.getByRole('checkbox', { name: 'Select tag react' }),
  ).not.toBeChecked()
  expect(
    screen.getByRole('checkbox', { name: 'Select tag typescript' }),
  ).toBeChecked()
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  // Assert
  await waitFor(() =>
    expect(
      screen.getByRole('checkbox', { name: 'Select tag typescript' }),
    ).not.toBeChecked(),
  )
  expect(onDelete.mock.calls).toEqual([
    ['react'],
    ['typescript'],
    ['typescript'],
  ])
})

test('select all uses visible identities rather than the number of hidden selections', () => {
  // Arrange
  render(<TagManagement tags={tags} open onOpenChange={vi.fn()} />)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select tag react' }))
  fireEvent.change(screen.getByLabelText('Search tags'), {
    target: { value: 'typescript' },
  })
  // Act / Assert
  expect(
    screen.getByRole('checkbox', { name: 'Select all tags' }),
  ).not.toBeChecked()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all tags' }))
  expect(
    screen.getByRole('checkbox', { name: 'Select tag typescript' }),
  ).toBeChecked()
  expect(
    screen.getByRole('checkbox', { name: 'Select all tags' }),
  ).toBeChecked()
})
