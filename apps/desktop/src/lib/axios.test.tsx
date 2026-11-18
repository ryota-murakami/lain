import { fireEvent, screen, waitFor } from '@testing-library/react'
import originalAxios, { AxiosError } from 'axios'
import { http, HttpResponse } from 'msw'
import { Toaster, toast } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { UploadDialog } from '@/components/raindrop/upload-dialog'
import { server } from '@test/mocks/server'
import { renderWithProviders } from '@test/render-with-providers'

import { lainAxios } from './axios'
import { fetchUploadQuota, uploadFile } from './file-upload'
import { RequestBudget } from './request-budget'

const api = 'https://api.raindrop.io/rest/v1'
const files = [new File(['notes'], 'feedback.txt')]
const groups: [] = []
const originalAdapter = lainAxios.defaults.adapter

beforeEach(() => vi.spyOn(toast, 'error'))
afterEach(() => {
  toast.dismiss()
  lainAxios.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

test('metadata retry clears the inline upload failure without leaving a contradictory global toast', async () => {
  // Arrange
  let creations = 0
  let metadataAttempts = 0
  // Keep real Axios interceptors while avoiding happy-dom FormData in Node's HTTP adapter.
  lainAxios.defaults.adapter = async (config) => {
    if (config.url !== '/raindrop/file')
      return originalAxios.getAdapter(originalAdapter)(config)
    creations += 1
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { result: true, item: { _id: 700 } },
    }
  }
  server.use(
    http.get(`${api}/user`, () =>
      HttpResponse.json({
        result: true,
        user: { pro: false, files: { used: 0, size: 100_000_000 } },
      }),
    ),
    http.put(`${api}/raindrop/700`, () => {
      metadataAttempts += 1
      return metadataAttempts === 1
        ? new HttpResponse(null, { status: 503 })
        : HttpResponse.json({ result: true })
    }),
  )
  renderWithProviders(
    <>
      <Toaster />
      <UploadDialog
        groups={groups}
        collectionId="unsorted"
        initialFiles={files}
        onClose={vi.fn()}
      />
    </>,
  )
  await screen.findByText(/Free plan · 100 MB per file/)

  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Upload queued files' }))

  // Assert
  expect(
    await screen.findByText(
      'File uploaded; metadata is not saved yet. Retry to finish the same bookmark.',
    ),
  ).toBeVisible()
  expect(toast.error).not.toHaveBeenCalled()
  expect(screen.queryByText('Server error. Please try again later.')).toBeNull()

  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Retry metadata' }))

  // Assert
  expect(await screen.findByText('Uploaded and saved')).toBeVisible()
  await waitFor(() =>
    expect(
      screen.queryByText(/File uploaded; metadata is not saved yet/),
    ).toBeNull(),
  )
  expect(screen.queryByText('Server error. Please try again later.')).toBeNull()
  expect(toast.error).not.toHaveBeenCalled()
  expect(creations).toBe(1)
  expect(metadataAttempts).toBe(2)
})

test('a failed quota lookup rejects for inline retry without adding a global toast', async () => {
  // Arrange
  server.use(
    http.get(`${api}/user`, () => new HttpResponse(null, { status: 503 })),
  )

  // Act / Assert
  await expect(fetchUploadQuota()).rejects.toMatchObject({
    response: { status: 503 },
  })
  expect(toast.error).not.toHaveBeenCalled()
})

test('a failed file transfer preserves the ambiguous per-file outcome without a global toast', async () => {
  // Arrange
  lainAxios.defaults.adapter = async (config) => {
    throw new AxiosError(
      'Service unavailable',
      'ERR_BAD_RESPONSE',
      config,
      undefined,
      {
        config,
        status: 503,
        statusText: 'Service unavailable',
        headers: {},
        data: {},
      },
    )
  }
  const update = vi.fn()

  // Act
  await uploadFile(
    {
      key: 'feedback',
      file: files[0],
      title: 'Feedback',
      phase: 'queued',
      progress: 0,
    },
    {
      collectionId: 'unsorted',
      title: 'Feedback',
      tags: [],
      note: '',
      important: false,
    },
    new AbortController().signal,
    update,
  )

  // Assert
  expect(update).toHaveBeenLastCalledWith({
    phase: 'uncertain',
    error:
      'The upload response was interrupted. Check the destination collection and Unsorted before explicitly retrying; the file may already exist.',
  })
  expect(toast.error).not.toHaveBeenCalled()
})

test('ordinary failed requests still reject and show the global server-error notification', async () => {
  // Arrange
  server.use(
    http.get(`${api}/user`, () => new HttpResponse(null, { status: 503 })),
  )

  // Act / Assert
  await expect(lainAxios.get('/user')).rejects.toMatchObject({
    response: { status: 503 },
  })
  expect(toast.error).toHaveBeenCalledExactlyOnceWith(
    'Server error. Please try again later.',
  )
})

test('an expired upload session still retrieves its token, rejects and announces session expiry globally', async () => {
  // Arrange
  const getToken = vi.spyOn(window.auth, 'getToken')
  const expired = vi.fn()
  window.addEventListener('lain-session-expired', expired, { once: true })
  server.use(
    http.get(`${api}/user`, () => new HttpResponse(null, { status: 401 })),
  )

  // Act / Assert
  try {
    await expect(fetchUploadQuota()).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(getToken).toHaveBeenCalledOnce()
    expect(expired).toHaveBeenCalledOnce()
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(
      'Session expired. Please log in again.',
    )
  } finally {
    window.removeEventListener('lain-session-expired', expired)
  }
})

test('an upload rate limit still blocks later requests until the server reset without duplicating feedback', async () => {
  // Arrange
  const block = vi.spyOn(RequestBudget.prototype, 'block')
  server.use(
    http.get(
      `${api}/user`,
      () =>
        new HttpResponse(null, {
          status: 429,
          headers: { 'x-ratelimit-reset': '1800000000' },
        }),
    ),
  )

  // Act / Assert
  await expect(fetchUploadQuota()).rejects.toMatchObject({
    response: { status: 429 },
  })
  expect(block).toHaveBeenCalledExactlyOnceWith(1800000000000)
  expect(toast.error).not.toHaveBeenCalled()
})

test.each([
  ['network', 'Network Error', undefined],
  ['timeout', 'Request timeout', 'ECONNABORTED'],
  ['unknown', 'Unexpected transport error', undefined],
])(
  'inline %s failures preserve the original rejection without a global notification',
  async (_kind, message, code) => {
    // Arrange
    let original: AxiosError | undefined

    // Act / Assert
    await expect(
      lainAxios.get('/user', {
        errorFeedback: 'inline',
        adapter: async (config) => {
          original = new AxiosError(message, code, config)
          throw original
        },
      }),
    ).rejects.toSatisfy((error: unknown) => error === original)
    expect(toast.error).not.toHaveBeenCalled()
  },
)
