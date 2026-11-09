import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CanceledError } from 'axios'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type * as BookmarkExportModule from '@/lib/bookmark-export'
import {
  fetchBookmarkSnapshot,
  type BookmarkSnapshot,
} from '@/lib/bookmark-export'
import type { DesktopApi } from '@/lib/desktop-contract'

import { ExportDialog } from './export-dialog'

vi.mock('@/lib/bookmark-export', async (importOriginal) => {
  const original = await importOriginal<typeof BookmarkExportModule>()
  return { ...original, fetchBookmarkSnapshot: vi.fn() }
})

const snapshot: BookmarkSnapshot = {
  schemaVersion: 1,
  exportedAt: '2026-11-09T00:00:00.000Z',
  scope: 0,
  collections: [{ _id: 100, title: 'Research' }],
  groups: [],
  bookmarks: [
    {
      _id: 1,
      title: 'Synthetic bookmark',
      link: 'https://example.com',
      collection: { $id: 100 },
    },
  ],
}
const fetchSnapshot = vi.mocked(fetchBookmarkSnapshot)
const saveExport = vi.fn<DesktopApi['saveExport']>()

beforeEach(() => {
  fetchSnapshot.mockReset().mockResolvedValue(snapshot)
  saveExport
    .mockReset()
    .mockResolvedValue({ canceled: false, filename: 'bookmarks.html' })
  vi.stubGlobal('desktop', { saveExport })
})
afterEach(() => vi.unstubAllGlobals())

test('Export defaults to all bookmarks and writes verified HTML through the native save API', async () => {
  // Arrange
  render(
    <ExportDialog
      collectionId="100"
      collectionName="Research"
      onClose={vi.fn()}
    />,
  )
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  // Assert
  await waitFor(() => expect(saveExport).toHaveBeenCalledTimes(1))
  expect(fetchSnapshot).toHaveBeenCalledWith(
    0,
    expect.any(AbortSignal),
    expect.any(Function),
  )
  expect(saveExport.mock.calls[0][0].format).toBe('html')
  expect(saveExport.mock.calls[0][0].content).toContain(
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
  )
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Exported 1 bookmarks to bookmarks.html.',
  )
})

test.each(['csv', 'json'] as const)(
  'Export saves the selected collection as %s',
  async (format) => {
    // Arrange
    render(
      <ExportDialog
        collectionId="100"
        collectionName="Research"
        onClose={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Scope'), {
      target: { value: 'collection' },
    })
    fireEvent.change(screen.getByLabelText('Format'), {
      target: { value: format },
    })
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    // Assert
    await waitFor(() => expect(saveExport).toHaveBeenCalledTimes(1))
    expect(fetchSnapshot).toHaveBeenCalledWith(
      100,
      expect.any(AbortSignal),
      expect.any(Function),
    )
    expect(saveExport.mock.calls[0][0].format).toBe(format)
    expect(saveExport.mock.calls[0][0].content).toContain('Synthetic bookmark')
    expect(
      screen.getByRole('option', {
        name: 'Research (including subcollections)',
      }),
    ).toBeVisible()
  },
)

test('Unsorted selection exports system collection -1 without implying subcollections', async () => {
  // Arrange
  render(
    <ExportDialog
      collectionId="unsorted"
      collectionName="Unsorted"
      onClose={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByLabelText('Scope'), {
    target: { value: 'collection' },
  })
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  // Assert
  await waitFor(() =>
    expect(fetchSnapshot).toHaveBeenCalledWith(
      -1,
      expect.any(AbortSignal),
      expect.any(Function),
    ),
  )
  expect(screen.getByRole('option', { name: 'Unsorted' })).toBeVisible()
})

test.each(['all', 'trash', 'not-a-collection'])(
  'Export excludes invalid current scope %s from its picker',
  (collectionId) => {
    // Arrange / Act
    render(
      <ExportDialog
        collectionId={collectionId}
        collectionName="Current"
        onClose={vi.fn()}
      />,
    )
    // Assert
    expect(
      screen.getByLabelText('Scope').querySelectorAll('option'),
    ).toHaveLength(1)
    expect(screen.getByRole('option', { name: 'All bookmarks' })).toBeVisible()
  },
)

test('Export shows page progress and keeps saving unavailable until final verification resolves', async () => {
  // Arrange
  let finish: (value: BookmarkSnapshot) => void = () => {}
  fetchSnapshot.mockImplementation(async (_id, _signal, progress) => {
    progress(50, 51)
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  render(
    <ExportDialog
      collectionId="100"
      collectionName="Research"
      onClose={vi.fn()}
    />,
  )
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  // Assert
  expect(screen.getByRole('status')).toHaveTextContent(
    'Reading bookmarks: 50 / 51',
  )
  expect(
    screen.getByRole('progressbar', { name: 'Bookmarks downloaded' }),
  ).toHaveAttribute('max', '51')
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '50')
  expect(screen.getByLabelText('Scope')).toBeDisabled()
  expect(screen.getByLabelText('Format')).toBeDisabled()
  expect(saveExport).not.toHaveBeenCalled()
  await act(async () => {
    finish(snapshot)
  })
  expect(saveExport).toHaveBeenCalledTimes(1)
})

test('Export marks a fully downloaded snapshot as verifying until validation finishes', async () => {
  // Arrange
  let finish: (value: BookmarkSnapshot) => void = () => {}
  fetchSnapshot.mockImplementation(async (_id, _signal, progress) => {
    progress(1, 1)
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  render(
    <ExportDialog
      collectionId="100"
      collectionName="Research"
      onClose={vi.fn()}
    />,
  )
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  // Assert
  expect(screen.getByRole('status')).toHaveTextContent(
    'Read 1 bookmarks. Verifying the snapshot…',
  )
  expect(saveExport).not.toHaveBeenCalled()
  await act(async () => {
    finish(snapshot)
  })
})

test('Cancel export aborts retrieval without opening a save dialog and permits a new attempt', async () => {
  // Arrange
  fetchSnapshot.mockImplementation(
    async (_id, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new CanceledError()), {
          once: true,
        })
      }),
  )
  render(
    <ExportDialog
      collectionId="100"
      collectionName="Research"
      onClose={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Cancel export' }))
  // Assert
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Export canceled. No file was written.',
    ),
  )
  expect(fetchSnapshot.mock.calls[0][1].aborted).toBe(true)
  expect(saveExport).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled()
})

test('Cancel export ignores a late successful fetch response instead of saving it', async () => {
  // Arrange
  let finish: (value: BookmarkSnapshot) => void = () => {}
  fetchSnapshot.mockImplementation(
    async () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  render(
    <ExportDialog
      collectionId="100"
      collectionName="Research"
      onClose={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Cancel export' }))
  await act(async () => {
    finish(snapshot)
  })
  // Assert
  expect(screen.getByRole('status')).toHaveTextContent(
    'Export canceled. No file was written.',
  )
  expect(saveExport).not.toHaveBeenCalled()
})

test('Retry export retains format and collection after retrieval fails', async () => {
  // Arrange
  fetchSnapshot.mockRejectedValueOnce(
    new Error('Bookmarks changed during export. Please retry.'),
  )
  render(
    <ExportDialog
      collectionId="100"
      collectionName="Research"
      onClose={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByLabelText('Scope'), {
    target: { value: 'collection' },
  })
  fireEvent.change(screen.getByLabelText('Format'), {
    target: { value: 'json' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(saveExport).not.toHaveBeenCalled()
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Retry export' }))
  // Assert
  await waitFor(() => expect(saveExport).toHaveBeenCalledTimes(1))
  expect(fetchSnapshot).toHaveBeenCalledTimes(2)
  expect(fetchSnapshot.mock.calls[1][0]).toBe(100)
  expect(saveExport.mock.calls[0][0].format).toBe('json')
  expect(screen.queryByRole('alert')).toBeNull()
})

test('Canceling the native save dialog reports no file written and leaves Export available', async () => {
  // Arrange
  saveExport.mockResolvedValue({ canceled: true })
  render(
    <ExportDialog
      collectionId="100"
      collectionName="Research"
      onClose={vi.fn()}
    />,
  )
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  // Assert
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Save canceled. No file was written.',
    ),
  )
  expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled()
  expect(screen.queryByRole('alert')).toBeNull()
})

test('Native save failure remains retryable and obtains a fresh snapshot', async () => {
  // Arrange
  saveExport.mockRejectedValueOnce(new Error('Disk full'))
  render(
    <ExportDialog
      collectionId="100"
      collectionName="Research"
      onClose={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Disk full')
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Retry export' }))
  // Assert
  await waitFor(() => expect(saveExport).toHaveBeenCalledTimes(2))
  expect(fetchSnapshot).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('alert')).toBeNull()
})

test('Pending native save prevents a misleading Cancel export action and duplicate saves', async () => {
  // Arrange
  let finish: (value: { canceled: boolean }) => void = () => {}
  saveExport.mockImplementation(
    async () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const onClose = vi.fn()
  render(
    <ExportDialog
      collectionId="100"
      collectionName="Research"
      onClose={onClose}
    />,
  )
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  await waitFor(() => expect(saveExport).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole('button', { name: 'Exporting…' }))
  fireEvent.keyDown(document, { key: 'Escape' })
  // Assert
  expect(screen.getByRole('status')).toHaveTextContent(
    'use the save dialog’s Cancel button',
  )
  expect(
    screen.getByRole('button', { name: 'Save dialog open…' }),
  ).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Cancel export' })).toBeNull()
  expect(saveExport).toHaveBeenCalledTimes(1)
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => {
    finish({ canceled: true })
  })
})

test('Unmounting during retrieval aborts the request and prevents a late native save', async () => {
  // Arrange
  let finish: (value: BookmarkSnapshot) => void = () => {}
  fetchSnapshot.mockImplementation(
    async () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { unmount } = render(
    <ExportDialog
      collectionId="100"
      collectionName="Research"
      onClose={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  // Act
  unmount()
  await act(async () => {
    finish(snapshot)
  })
  // Assert
  expect(fetchSnapshot.mock.calls[0][1].aborted).toBe(true)
  expect(saveExport).not.toHaveBeenCalled()
})

test('An empty verified collection can be saved without fabricating bookmarks', async () => {
  // Arrange
  fetchSnapshot.mockResolvedValue({ ...snapshot, bookmarks: [] })
  render(
    <ExportDialog
      collectionId="100"
      collectionName="Research"
      onClose={vi.fn()}
    />,
  )
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  // Assert
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Exported 0 bookmarks',
    ),
  )
  expect(saveExport.mock.calls[0][0].content).toContain('Research')
  expect(saveExport.mock.calls[0][0].content).not.toContain('<A ')
})
