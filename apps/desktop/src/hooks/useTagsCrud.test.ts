import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { expect, test } from 'vitest'

import { useTagsCrud } from '@/hooks/useTagsCrud'
import { mockStore } from '@test/mocks/mock-store'
import { server } from '@test/mocks/server'
import { renderHookWithProviders } from '@test/render-with-providers'

const API = 'https://api.raindrop.io/rest/v1'

test('tag listing exposes global names and usage counts', async () => {
  // Arrange / Act
  const { result } = renderHookWithProviders(() => useTagsCrud())
  // Assert
  await waitFor(() =>
    expect(result.current.tags[0]).toEqual({ name: 'react', count: 8 }),
  )
  expect(result.current.tags[1]).toEqual({ name: 'typescript', count: 6 })
  expect(result.current.tags[2]).toEqual({ name: 'design', count: 12 })
})

test('successful rename refreshes the global tag list with the confirmed name', async () => {
  // Arrange
  const { result } = renderHookWithProviders(() => useTagsCrud())
  await waitFor(() => expect(result.current.tags[0]?.name).toBe('react'))
  // Act
  await act(async () => {
    await result.current.renameTag('all', 'react', 'frontend')
  })
  // Assert
  await waitFor(() =>
    expect(result.current.tags.some((tag) => tag.name === 'frontend')).toBe(
      true,
    ),
  )
  expect(result.current.tags.some((tag) => tag.name === 'react')).toBe(false)
  expect(
    mockStore.raindrops.some((bookmark) => bookmark.tags.includes('react')),
  ).toBe(false)
})

test('successful deletion removes the tag from the global list and bookmarks', async () => {
  // Arrange
  const { result } = renderHookWithProviders(() => useTagsCrud())
  await waitFor(() => expect(result.current.tags[0]?.name).toBe('react'))
  // Act
  await act(async () => {
    await result.current.deleteTag('all', ['react'])
  })
  // Assert
  await waitFor(() =>
    expect(result.current.tags.some((tag) => tag.name === 'react')).toBe(false),
  )
  expect(
    mockStore.raindrops.some((bookmark) => bookmark.tags.includes('react')),
  ).toBe(false)
})

test.each(['rename', 'delete', 'merge'] as const)(
  '%s rejects HTTP failure so callers can preserve unsaved input',
  async (operation) => {
    // Arrange
    server.use(
      http.put(`${API}/tags/0`, () => new HttpResponse(null, { status: 503 })),
      http.delete(
        `${API}/tags/0`,
        () => new HttpResponse(null, { status: 503 }),
      ),
    )
    const { result } = renderHookWithProviders(() => useTagsCrud())
    await waitFor(() => expect(result.current.tags[0]?.name).toBe('react'))
    // Act / Assert
    await act(async () => {
      const promise =
        operation === 'rename'
          ? result.current.renameTag('all', 'react', 'frontend')
          : operation === 'delete'
            ? result.current.deleteTag('all', ['react'])
            : result.current.mergeTags(
                'all',
                ['react', 'typescript'],
                'frontend',
              )
      await expect(promise).rejects.toMatchObject({ status: 503 })
    })
    expect(mockStore.tags.some((tag) => tag._id === 'react')).toBe(true)
  },
)

test.each(['rename', 'delete', 'merge'] as const)(
  '%s rejects a service-level failure inside HTTP 200',
  async (operation) => {
    // Arrange
    server.use(
      http.put(`${API}/tags/0`, () =>
        HttpResponse.json({
          result: false,
          errorMessage: 'Synthetic rejection',
        }),
      ),
      http.delete(`${API}/tags/0`, () =>
        HttpResponse.json({
          result: false,
          errorMessage: 'Synthetic rejection',
        }),
      ),
    )
    const { result } = renderHookWithProviders(() => useTagsCrud())
    // Act / Assert
    await act(async () => {
      const promise =
        operation === 'rename'
          ? result.current.renameTag('all', 'react', 'frontend')
          : operation === 'delete'
            ? result.current.deleteTag('all', ['react'])
            : result.current.mergeTags(
                'all',
                ['react', 'typescript'],
                'frontend',
              )
      await expect(promise).rejects.toMatchObject({
        message: 'Synthetic rejection',
      })
    })
  },
)

test('tag merge sends all distinct sources in one global request and excludes the destination itself', async () => {
  // Arrange
  const requests: unknown[] = []
  server.use(
    http.put(`${API}/tags/0`, async ({ request }) => {
      requests.push(await request.json())
      return HttpResponse.json({ result: true })
    }),
  )
  const { result } = renderHookWithProviders(() => useTagsCrud())
  // Act
  await act(async () => {
    await result.current.mergeTags(
      'all',
      ['react', 'typescript', 'react', 'frontend'],
      ' frontend ',
    )
  })
  // Assert
  expect(requests).toEqual([
    { replace: 'frontend', tags: ['react', 'typescript'] },
  ])
})

test('tag merge rejects an empty destination before sending a mutation', async () => {
  // Arrange
  const requests: unknown[] = []
  server.use(
    http.put(`${API}/tags/0`, async ({ request }) => {
      requests.push(await request.json())
      return HttpResponse.json({ result: true })
    }),
  )
  const { result } = renderHookWithProviders(() => useTagsCrud())
  // Act / Assert
  await act(async () => {
    await expect(
      result.current.mergeTags('all', ['react', 'typescript'], ' '),
    ).rejects.toThrow('Choose source tags')
  })
  expect(requests).toEqual([])
})

test('a successful HTTP response without confirmation is not reported as a saved rename', async () => {
  // Arrange
  server.use(http.put(`${API}/tags/0`, () => HttpResponse.json({})))
  const { result } = renderHookWithProviders(() => useTagsCrud())
  // Act / Assert
  await act(async () => {
    await expect(
      result.current.renameTag('all', 'react', 'frontend'),
    ).rejects.toThrow('Failed to rename tag')
  })
})
