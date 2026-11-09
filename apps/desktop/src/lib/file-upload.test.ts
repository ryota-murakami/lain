import { AxiosError } from 'axios'
import { beforeEach, expect, test, vi } from 'vitest'

import { lainAxios } from './axios'
import {
  uploadFile,
  validateUpload,
  type UploadEntry,
  type UploadMetadata,
  type UploadQuota,
} from './file-upload'

vi.mock('./axios', () => ({ lainAxios: { put: vi.fn() } }))
const freeQuota: UploadQuota = {
  pro: false,
  used: 0,
  total: 100_000_000,
  maxFileSize: 100_000_000,
}
const metadata: UploadMetadata = {
  collectionId: 'unsorted',
  title: 'Research 日本語',
  tags: ['research'],
  note: 'Line one\nLine two',
  important: true,
}
const makeEntry = (): UploadEntry => ({
  key: 'file-1',
  file: new File(['hello'], 'research.txt'),
  title: 'Research',
  phase: 'queued',
  progress: 0,
})
beforeEach(() => vi.resetAllMocks())

test('unsupported and empty files cannot consume the upload quota', () => {
  // Arrange / Act / Assert
  expect(validateUpload({ name: 'archive.zip', size: 500 }, freeQuota)).toBe(
    'Unsupported format. Choose a supported document, image, audio or video file.',
  )
  expect(validateUpload({ name: 'notes.txt', size: 0 }, freeQuota)).toBe(
    'Empty files cannot be uploaded.',
  )
})

test('file and monthly quota boundaries are enforced before transfer', () => {
  // Arrange / Act / Assert
  expect(
    validateUpload({ name: 'photo.PNG', size: 100_000_000 }, freeQuota),
  ).toBeUndefined()
  expect(
    validateUpload({ name: 'photo.png', size: 100_000_001 }, freeQuota),
  ).toBe('This file exceeds your 100 MB per-file limit.')
  expect(
    validateUpload(
      { name: 'notes.txt', size: 6 },
      { ...freeQuota, used: 99_999_995 },
    ),
  ).toBe('Your remaining monthly upload quota is too small for this file.')
})

test('successful uploads save tags, note and importance against the returned bookmark', async () => {
  // Arrange
  const put = vi.mocked(lainAxios.put)
  put
    .mockResolvedValueOnce({ data: { result: true, item: { _id: 700 } } })
    .mockResolvedValueOnce({ data: { result: true } })
  const patches: Partial<UploadEntry>[] = []
  // Act
  await uploadFile(
    makeEntry(),
    metadata,
    new AbortController().signal,
    (patch) => patches.push(patch),
  )
  // Assert
  expect(put).toHaveBeenNthCalledWith(
    2,
    '/raindrop/700',
    {
      title: 'Research 日本語',
      tags: ['research'],
      note: 'Line one\nLine two',
      important: true,
      collection: { $id: -1 },
    },
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
  expect(patches.at(-1)).toEqual({ phase: 'done', error: undefined })
  expect((put.mock.calls[0][1] as FormData).get('collectionId')).toBe('-1')
})

test('the selected destination is confirmed even if file creation initially lands in Unsorted', async () => {
  // Arrange
  const put = vi.mocked(lainAxios.put)
  put
    .mockResolvedValueOnce({
      data: { result: true, item: { _id: 700, collection: { $id: -1 } } },
    })
    .mockResolvedValueOnce({ data: { result: true } })
  // Act
  await uploadFile(
    makeEntry(),
    { ...metadata, collectionId: '100' },
    new AbortController().signal,
    vi.fn(),
  )
  // Assert
  expect(put).toHaveBeenNthCalledWith(
    2,
    '/raindrop/700',
    {
      title: 'Research 日本語',
      tags: ['research'],
      note: 'Line one\nLine two',
      important: true,
      collection: { $id: 100 },
    },
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
})

test('retrying failed metadata does not upload a duplicate file', async () => {
  // Arrange
  const put = vi.mocked(lainAxios.put)
  put.mockResolvedValue({ data: { result: true } })
  const patches: Partial<UploadEntry>[] = []
  // Act
  await uploadFile(
    { ...makeEntry(), bookmarkId: 700, phase: 'error' },
    metadata,
    new AbortController().signal,
    (patch) => patches.push(patch),
  )
  // Assert
  expect(put).toHaveBeenCalledTimes(1)
  expect(put.mock.calls[0][0]).toBe('/raindrop/700')
  expect(patches.at(-1)).toEqual({ phase: 'done', error: undefined })
})

test('a lost upload response requires checking the destination before retry', async () => {
  // Arrange
  vi.mocked(lainAxios.put).mockRejectedValue(new AxiosError('Network Error'))
  const patches: Partial<UploadEntry>[] = []
  // Act
  await uploadFile(
    makeEntry(),
    metadata,
    new AbortController().signal,
    (patch) => patches.push(patch),
  )
  // Assert
  expect(lainAxios.put).toHaveBeenCalledTimes(1)
  expect(patches.at(-1)).toEqual({
    phase: 'uncertain',
    error:
      'The upload response was interrupted. Check the destination collection and Unsorted before explicitly retrying; the file may already exist.',
  })
})

test('metadata failure preserves the uploaded bookmark ID for a safe retry', async () => {
  // Arrange
  vi.mocked(lainAxios.put)
    .mockResolvedValueOnce({ data: { result: true, item: { _id: 700 } } })
    .mockRejectedValueOnce(new Error('offline'))
  const patches: Partial<UploadEntry>[] = []
  // Act
  await uploadFile(
    makeEntry(),
    metadata,
    new AbortController().signal,
    (patch) => patches.push(patch),
  )
  // Assert
  expect(patches).toContainEqual({ bookmarkId: 700, progress: 100 })
  expect(patches.at(-1)).toEqual({
    phase: 'error',
    error:
      'File uploaded; metadata is not saved yet. Retry to finish the same bookmark.',
  })
})
