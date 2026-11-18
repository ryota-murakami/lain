import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, test } from 'vitest'

import { toUiRaindrop } from '@/lib/api-mappers'
import { mockStore } from '@test/mocks/mock-store'
import { server } from '@test/mocks/server'
import { renderHookWithProviders } from '@test/render-with-providers'

import {
  PartialBookmarkBatchError,
  useRaindropBatchActions,
} from './useRaindropBatchActions'

const endpoint = 'https://api.raindrop.io/rest/v1/raindrops/:collectionId'

// Two concrete sources reproduce an All Bookmarks selection without private account data.
const rows = () => [
  {
    ...toUiRaindrop({ ...mockStore.raindrops[0], highlights: [] }),
    id: '1',
    collectionId: '100',
  },
  {
    ...toUiRaindrop({ ...mockStore.raindrops[1], highlights: [] }),
    id: '2',
    collectionId: '101',
  },
]

describe('bulk bookmark writes', () => {
  test('sends each deduplicated selection to its concrete source collection', async () => {
    // Arrange
    const requests: unknown[] = []
    server.use(
      http.put(endpoint, async ({ request, params }) => {
        requests.push({
          source: params.collectionId,
          body: await request.json(),
        })
        return HttpResponse.json({ result: true })
      }),
    )
    const { result } = renderHookWithProviders(() =>
      useRaindropBatchActions(rows(), 'all'),
    )

    // Act
    await act(async () =>
      result.current.batchMoveToCollection(['1', '1', '2'], '105'),
    )

    // Assert
    expect(requests).toEqual([
      { source: '100', body: { ids: [1], collection: { $id: 105 } } },
      { source: '101', body: { ids: [2], collection: { $id: 105 } } },
    ])
  })

  test('retries only unconfirmed deletes after successful rows disappear from the loaded scope', async () => {
    // Arrange
    const sources: string[] = []
    let rejectSecond = true
    server.use(
      http.delete(endpoint, ({ params }) => {
        sources.push(String(params.collectionId))
        if (params.collectionId === '101' && rejectSecond)
          return HttpResponse.json({ result: false }, { status: 503 })
        return HttpResponse.json({ result: true })
      }),
    )
    const bookmarks = rows()
    const { result, rerender } = renderHookWithProviders(
      ({ visible }) => useRaindropBatchActions(visible, 'all'),
      { initialProps: { visible: bookmarks } },
    )

    // Act — the first source confirms; its rows disappear before retry.
    await act(async () => {
      await expect(
        result.current.batchDeleteRaindrops(['1', '2']),
      ).rejects.toMatchObject({
        name: 'PartialBookmarkBatchError',
        completedIds: ['1'],
        remainingIds: ['2'],
      })
    })
    rerender({ visible: [bookmarks[1]] })
    rejectSecond = false
    await act(async () => result.current.batchDeleteRaindrops(['1', '2']))

    // Assert — source 100 is never re-applied, and a new completed batch can run normally.
    expect(sources).toEqual(['100', '101', '101'])
    await act(async () => result.current.batchDeleteRaindrops(['2']))
    expect(sources).toEqual(['100', '101', '101', '101'])
  })

  test('does not reuse prior confirmations when the user changes the move destination', async () => {
    // Arrange
    const destinations: number[] = []
    server.use(
      http.put(endpoint, async ({ request, params }) => {
        const body = (await request.json()) as { collection: { $id: number } }
        destinations.push(body.collection.$id)
        if (params.collectionId === '101' && body.collection.$id === 105)
          return HttpResponse.json({ result: false }, { status: 503 })
        return HttpResponse.json({ result: true })
      }),
    )
    const { result } = renderHookWithProviders(() =>
      useRaindropBatchActions(rows(), 'all'),
    )

    // Act
    await act(async () => {
      await expect(
        result.current.batchMoveToCollection(['1', '2'], '105'),
      ).rejects.toBeInstanceOf(PartialBookmarkBatchError)
      await result.current.batchMoveToCollection(['1', '2'], '106')
    })

    // Assert
    expect(destinations).toEqual([105, 105, 106, 106])
  })

  test('rejects stale selections before any source collection is modified', async () => {
    // Arrange
    const requests: string[] = []
    server.use(
      http.put(endpoint, ({ params }) => {
        requests.push(String(params.collectionId))
        return HttpResponse.json({ result: true })
      }),
    )
    const { result } = renderHookWithProviders(() =>
      useRaindropBatchActions(rows(), 'all'),
    )

    // Act
    await act(async () => {
      await expect(
        result.current.batchAddTag(['1', 'missing'], ['work']),
      ).rejects.toThrow()
      await result.current.batchAddTag([], ['work'])
    })

    // Assert
    expect(requests).toEqual([])
  })

  test('rejects double submission while preserving the original operation', async () => {
    // Arrange
    let release = (): void => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const requests: string[] = []
    server.use(
      http.put(endpoint, async ({ params }) => {
        requests.push(String(params.collectionId))
        await gate
        return HttpResponse.json({ result: true })
      }),
    )
    const { result } = renderHookWithProviders(() =>
      useRaindropBatchActions(rows(), 'all'),
    )
    let first = Promise.resolve()

    // Act
    act(() => {
      first = result.current.batchMarkImportant(['1'])
    })
    await waitFor(() => expect(requests).toEqual(['100']))
    await act(async () => {
      await expect(result.current.batchMarkImportant(['1'])).rejects.toThrow(
        'Another bookmark operation',
      )
      release()
      await first
    })

    // Assert
    expect(requests).toEqual(['100'])
  })

  test('allows retry when a successful HTTP response does not confirm the change', async () => {
    // Arrange
    let attempts = 0
    server.use(
      http.put(endpoint, () => {
        attempts += 1
        return HttpResponse.json(attempts === 1 ? {} : { result: true })
      }),
    )
    const { result } = renderHookWithProviders(() =>
      useRaindropBatchActions(rows(), 'all'),
    )

    // Act
    await act(async () => {
      await expect(result.current.batchAddTag(['1'], ['work'])).rejects.toThrow(
        'did not confirm',
      )
      await result.current.batchAddTag(['1'], ['work'])
    })

    // Assert
    expect(attempts).toBe(2)
  })
})
