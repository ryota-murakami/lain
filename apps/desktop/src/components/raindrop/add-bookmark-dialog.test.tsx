import {
  act,
  fireEvent,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, test, expect, vi } from 'vitest'

import { useHasPendingWork } from '@/hooks/usePendingWork'
import type { Group } from '@/lib/types'
import type * as favicon from '@/utils/favicon'
import { renderWithProviders } from '@test/render-with-providers'

import { AddBookmarkDialog } from './add-bookmark-dialog'

const noGroups: Group[] = []
const noTags: string[] = []
const existingTags = ['typescript']

const { fetchSuggestion, resolveIcon } = vi.hoisted(() => ({
  fetchSuggestion: vi.fn(),
  resolveIcon: vi.fn(),
}))
vi.mock('@/hooks/useUrlSuggest', () => ({
  useUrlSuggest: () => ({ fetchSuggestion }),
}))
vi.mock('@/utils/favicon', async (importOriginal) => ({
  ...(await importOriginal<typeof favicon>()),
  resolveIcon,
}))
beforeEach(() => {
  fetchSuggestion.mockReset().mockResolvedValue(null)
  resolveIcon.mockReset().mockResolvedValue(null)
})

test('bookmark creation keeps the form open until the server confirms saving', async () => {
  // Arrange
  let finish: (() => void) | undefined
  const onSave = vi.fn(
    async () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  const onOpenChange = vi.fn()
  renderWithProviders(
    <AddBookmarkDialog
      open
      onOpenChange={onOpenChange}
      groups={noGroups}
      existingTags={noTags}
      onSave={onSave}
    />,
  )
  fireEvent.change(screen.getByLabelText('URL'), {
    target: { value: 'https://example.com/qa' },
  })

  // Act
  fireEvent.submit(
    screen.getByRole('button', { name: 'Save Bookmark' }).closest('form')!,
  )
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))

  // Assert
  expect(onOpenChange).not.toHaveBeenCalled()
  expect(screen.getByLabelText('URL')).toHaveValue('https://example.com/qa')
  finish?.()
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
})

test('bookmark save failure preserves the URL and exposes a retryable error', async () => {
  // Arrange
  const onSave = vi.fn().mockRejectedValue(new Error('Network unavailable'))
  const onOpenChange = vi.fn()
  renderWithProviders(
    <AddBookmarkDialog
      open
      onOpenChange={onOpenChange}
      groups={noGroups}
      existingTags={noTags}
      onSave={onSave}
    />,
  )
  fireEvent.change(screen.getByLabelText('URL'), {
    target: { value: 'https://example.com/retry' },
  })

  // Act
  fireEvent.submit(
    screen.getByRole('button', { name: 'Save Bookmark' }).closest('form')!,
  )

  // Assert
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not save the bookmark. Your input is preserved; try again.',
  )
  expect(screen.getByLabelText('URL')).toHaveValue('https://example.com/retry')
  expect(onOpenChange).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Save Bookmark' })).toBeEnabled()
})

test('treats shared tag edits as pending work and preserves them after save failure', async () => {
  // Arrange
  const user = userEvent.setup()
  const onSave = vi.fn().mockRejectedValue(new Error('Offline'))
  renderWithProviders(
    <AddBookmarkDialog
      open
      onOpenChange={vi.fn()}
      groups={noGroups}
      existingTags={existingTags}
      onSave={onSave}
    />,
  )
  const pending = renderHook(() => useHasPendingWork())
  // Act
  await user.type(
    screen.getByRole('combobox', { name: 'Tags' }),
    ' React {Enter}',
  )
  // Assert
  expect(pending.result.current).toBe(true)
  expect(screen.getByRole('button', { name: 'Remove react tag' })).toBeVisible()
  // Act
  fireEvent.change(screen.getByLabelText('URL'), {
    target: { value: 'https://example.com/tags' },
  })
  fireEvent.submit(
    screen.getByRole('button', { name: 'Save Bookmark' }).closest('form')!,
  )
  // Assert
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(onSave).toHaveBeenCalledExactlyOnceWith({
    url: 'https://example.com/tags',
    title: '',
    description: '',
    collectionId: '',
    type: 'link',
    notes: '',
    isImportant: false,
    tags: ['react'],
  })
  expect(screen.getByRole('button', { name: 'Remove react tag' })).toBeVisible()
})

test('fills untouched title and description from fetched metadata', async () => {
  // Arrange
  fetchSuggestion.mockResolvedValue({
    title: 'Fetched article',
    excerpt: 'Fetched description',
    type: 'article',
  })
  renderWithProviders(
    <AddBookmarkDialog
      open
      onOpenChange={vi.fn()}
      groups={noGroups}
      existingTags={noTags}
      onSave={vi.fn()}
    />,
  )
  // Act
  fireEvent.change(screen.getByLabelText('URL'), {
    target: { value: 'https://example.com/article' },
  })
  // Assert
  await waitFor(
    () => expect(screen.getByLabelText('Title')).toHaveValue('Fetched article'),
    { timeout: 1500 },
  )
  expect(screen.getByLabelText('Description')).toHaveValue(
    'Fetched description',
  )
  expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent(
    'article',
  )
})

test('preserves a manually edited and then cleared title when metadata finishes later', async () => {
  // Arrange
  let finishMetadata: (metadata: {
    title: string
    excerpt: string
  }) => void = () => {}
  fetchSuggestion.mockImplementation(
    async () =>
      new Promise((resolve) => {
        finishMetadata = resolve
      }),
  )
  renderWithProviders(
    <AddBookmarkDialog
      open
      onOpenChange={vi.fn()}
      groups={noGroups}
      existingTags={noTags}
      onSave={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByLabelText('URL'), {
    target: { value: 'https://example.com/manual' },
  })
  await waitFor(() => expect(fetchSuggestion).toHaveBeenCalledTimes(1), {
    timeout: 1500,
  })
  // Act
  fireEvent.input(screen.getByLabelText('Title'), {
    target: { value: 'My title' },
  })
  fireEvent.input(screen.getByLabelText('Title'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'My description' },
  })
  await act(async () => {
    finishMetadata({ title: 'Fetched title', excerpt: 'Fetched description' })
  })
  // Assert
  expect(screen.getByLabelText('Title')).toHaveValue('')
  expect(screen.getByLabelText('Description')).toHaveValue('My description')
})

test('ignores a stale URL response after a newer URL has supplied metadata', async () => {
  // Arrange
  let finishOld: (metadata: {
    title: string
    excerpt: string
  }) => void = () => {}
  fetchSuggestion.mockImplementationOnce(
    async () =>
      new Promise((resolve) => {
        finishOld = resolve
      }),
  )
  fetchSuggestion.mockResolvedValueOnce({
    title: 'New page',
    excerpt: 'New description',
    type: 'article',
  })
  renderWithProviders(
    <AddBookmarkDialog
      open
      onOpenChange={vi.fn()}
      groups={noGroups}
      existingTags={noTags}
      onSave={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByLabelText('URL'), {
    target: { value: 'https://example.com/old' },
  })
  await waitFor(() => expect(fetchSuggestion).toHaveBeenCalledTimes(1), {
    timeout: 1500,
  })
  // Act
  fireEvent.change(screen.getByLabelText('URL'), {
    target: { value: 'https://example.com/new' },
  })
  await waitFor(
    () => expect(screen.getByLabelText('Title')).toHaveValue('New page'),
    { timeout: 1500 },
  )
  await act(async () => {
    finishOld({ title: 'Old page', excerpt: 'Old description' })
  })
  // Assert
  expect(screen.getByLabelText('URL')).toHaveValue('https://example.com/new')
  expect(screen.getByLabelText('Title')).toHaveValue('New page')
  expect(screen.getByLabelText('Description')).toHaveValue('New description')
})
