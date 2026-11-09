import { fireEvent, screen, waitFor } from '@testing-library/react'
import { AxiosError, CanceledError } from 'axios'
import { beforeEach, expect, test, vi } from 'vitest'

import { lainAxios } from '@/lib/axios'
import type { Group } from '@/lib/types'
import { renderWithProviders } from '@test/render-with-providers'

import { UploadDialog } from './upload-dialog'

vi.mock('@/lib/axios', () => ({ lainAxios: { get: vi.fn(), put: vi.fn() } }))
const get = vi.mocked(lainAxios.get)
const put = vi.mocked(lainAxios.put)
const emptyGroups: Group[] = []
const multipleFiles = [
  new File(['first'], 'first.txt', { lastModified: 100 }),
  new File(['second'], 'second.txt', { lastModified: 200 }),
  new File(['zip'], 'archive.zip'),
]
const interruptedFiles = [new File(['safe'], 'notes.txt')]
const canceledFiles = [
  new File(['one'], 'first.txt'),
  new File(['two'], 'second.txt'),
]
const emptyFiles: File[] = []
const quotaFiles = [new File(['hello'], 'notes.txt')]
beforeEach(() => {
  vi.resetAllMocks()
  get.mockResolvedValue({
    data: {
      result: true,
      user: { pro: false, files: { used: 0, size: 100_000_000 } },
    },
  })
})

test('multiple files keep independent outcomes and retry failed metadata without uploading a duplicate', async () => {
  // Arrange
  put
    .mockResolvedValueOnce({ data: { result: true, item: { _id: 701 } } })
    .mockRejectedValueOnce(new Error('Metadata service unavailable'))
    .mockResolvedValueOnce({ data: { result: true, item: { _id: 702 } } })
    .mockResolvedValueOnce({ data: { result: true } })
  renderWithProviders(
    <UploadDialog
      groups={emptyGroups}
      collectionId="all"
      initialFiles={multipleFiles}
      onClose={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByLabelText('Choose files or drop them here'), {
    target: { files: [multipleFiles[0]] },
  })
  fireEvent.change(screen.getByLabelText('Title for first.txt'), {
    target: { value: 'Edited title 日本語' },
  })
  fireEvent.change(screen.getByLabelText('Tags (comma separated)'), {
    target: { value: 'research, research, notes' },
  })
  fireEvent.change(screen.getByLabelText('Note for these files'), {
    target: { value: 'A preserved note' },
  })
  fireEvent.click(screen.getByLabelText('Mark important'))
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Upload queued files' }))
  await screen.findByText('Uploaded and saved')
  expect(
    await screen.findByText(
      'Unsupported format. Choose a supported document, image, audio or video file.',
    ),
  ).toBeVisible()
  expect(
    screen.getByText(
      'File uploaded; metadata is not saved yet. Retry to finish the same bookmark.',
    ),
  ).toBeVisible()
  put.mockResolvedValueOnce({ data: { result: true } })
  fireEvent.click(screen.getByRole('button', { name: 'Retry metadata' }))
  // Assert
  await waitFor(() =>
    expect(screen.getAllByText('Uploaded and saved')).toHaveLength(2),
  )
  expect(screen.getAllByRole('textbox', { name: /^Title for/ })).toHaveLength(3)
  expect(
    put.mock.calls.filter(([url]) => url === '/raindrop/file'),
  ).toHaveLength(2)
  expect(put).toHaveBeenLastCalledWith(
    '/raindrop/701',
    {
      title: 'Edited title 日本語',
      tags: ['research', 'notes'],
      note: 'A preserved note',
      important: true,
      collection: { $id: -1 },
    },
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
  expect(screen.getByText(/Free plan · 100 MB per file/)).toBeVisible()
})

test('an interrupted upload cannot be retried before checking whether the file already exists', async () => {
  // Arrange
  put.mockRejectedValueOnce(new AxiosError('Network Error'))
  renderWithProviders(
    <UploadDialog
      groups={emptyGroups}
      collectionId="unsorted"
      initialFiles={interruptedFiles}
      onClose={vi.fn()}
    />,
  )
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Upload queued files' }))
  const retry = await screen.findByRole('button', { name: 'Retry upload' })
  // Assert
  expect(retry).toBeDisabled()
  expect(screen.getByText(/The upload response was interrupted/)).toBeVisible()
  // Act
  fireEvent.click(
    screen.getByLabelText(
      'I checked the destination and Unsorted; this file is missing.',
    ),
  )
  put
    .mockResolvedValueOnce({ data: { result: true, item: { _id: 703 } } })
    .mockResolvedValueOnce({ data: { result: true } })
  fireEvent.click(retry)
  // Assert
  expect(await screen.findByText('Uploaded and saved')).toBeVisible()
  expect(
    put.mock.calls.filter(([url]) => url === '/raindrop/file'),
  ).toHaveLength(2)
})

test('canceling a transfer stops later queued files and preserves an ambiguous outcome for review', async () => {
  // Arrange
  put.mockImplementationOnce(
    async (_url, _body, config) =>
      new Promise((_resolve, reject) => {
        config?.signal?.addEventListener?.(
          'abort',
          () => reject(new CanceledError()),
          { once: true },
        )
      }),
  )
  renderWithProviders(
    <UploadDialog
      groups={emptyGroups}
      collectionId="unsorted"
      initialFiles={canceledFiles}
      onClose={vi.fn()}
    />,
  )
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Upload queued files' }))
  await screen.findByText('Uploading 0%')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel transfer' }))
  // Assert
  expect(
    await screen.findByText(/The upload response was interrupted/),
  ).toBeVisible()
  expect(screen.getByText('queued')).toBeVisible()
  expect(put).toHaveBeenCalledTimes(1)
  expect(
    screen.getByRole('button', { name: 'Upload queued files' }),
  ).toBeEnabled()
})

test('dropping files adds a deduplicated queue and removal never contacts the upload service', async () => {
  // Arrange
  const file = new File(['drop'], 'dropped.md', { lastModified: 300 })
  renderWithProviders(
    <UploadDialog
      groups={emptyGroups}
      collectionId="trash"
      initialFiles={emptyFiles}
      onClose={vi.fn()}
    />,
  )
  const dropTarget = screen.getByLabelText(
    'Choose files or drop them here',
  ).parentElement!
  // Act
  fireEvent.drop(dropTarget, { dataTransfer: { files: [file, file] } })
  // Assert
  expect(
    screen.getAllByRole('textbox', { name: 'Title for dropped.md' }),
  ).toHaveLength(1)
  expect(
    screen.getByRole('combobox', { name: 'Collection' }),
  ).toHaveTextContent('Unsorted')
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Remove from queue' }))
  // Assert
  expect(
    screen.queryByRole('textbox', { name: 'Title for dropped.md' }),
  ).toBeNull()
  expect(put).not.toHaveBeenCalled()
})

test('a quota lookup failure keeps queued input and allows a later retry', async () => {
  // Arrange
  get.mockRejectedValue(new Error('Quota unavailable'))
  renderWithProviders(
    <UploadDialog
      groups={emptyGroups}
      collectionId="unsorted"
      initialFiles={quotaFiles}
      onClose={vi.fn()}
    />,
  )
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Upload queued files' }))
  // Assert
  expect(await screen.findByText('Quota unavailable')).toBeVisible()
  expect(
    screen.getByRole('textbox', { name: 'Title for notes.txt' }),
  ).toHaveValue('notes.txt')
  expect(put).not.toHaveBeenCalled()
})
