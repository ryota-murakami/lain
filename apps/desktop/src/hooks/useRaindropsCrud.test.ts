import { waitFor, act } from '@testing-library/react'
import { describe, test, expect } from 'vitest'

import { useRaindropsCrud } from '@/hooks/useRaindropsCrud'
import { renderHookWithProviders } from '@test/render-with-providers'

describe('useRaindropsCrud', () => {
  test('fetches and maps raindrops from API', async () => {
    const { result } = renderHookWithProviders(() =>
      useRaindropsCrud({ collectionId: 'all' }),
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // MSW returns 60 mock raindrops, perpage=50 → first page has 50
    expect(result.current.raindrops).toHaveLength(50)

    // Verify mapping from API types to UI types
    const first = result.current.raindrops[0]
    expect(first.id).toBe('1') // _id: 1 → string
    expect(first.title).toBe('React Documentation')
    expect(first.url).toBe('https://react.dev') // link → url
    expect(first.type).toBe('link')
    expect(first.tags).toEqual(['react', 'frontend'])
    expect(first.collectionId).toBe('100') // collection.$id → string
  })

  test('maps important flag correctly', async () => {
    const { result } = renderHookWithProviders(() =>
      useRaindropsCrud({ collectionId: 'all' }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.raindrops[0].isImportant).toBe(false)
    expect(result.current.raindrops[1].isImportant).toBe(true)
  })

  test('creates a raindrop via mutation', async () => {
    const { result } = renderHookWithProviders(() =>
      useRaindropsCrud({ collectionId: 'all' }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Create should not throw
    await act(async () => {
      await result.current.createRaindrop({
        url: 'https://example.com',
        title: 'Test Bookmark',
      })
    })
  })

  test('updates a raindrop via mutation', async () => {
    const { result } = renderHookWithProviders(() =>
      useRaindropsCrud({ collectionId: 'all' }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.updateRaindrop('1', { title: 'Updated Title' })
    })
  })

  test('deletes a raindrop via mutation', async () => {
    const { result } = renderHookWithProviders(() =>
      useRaindropsCrud({ collectionId: 'all' }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.deleteRaindrop('1')
    })
  })

  test('reports hasMore based on count vs loaded items', async () => {
    const { result } = renderHookWithProviders(() =>
      useRaindropsCrud({ collectionId: 'all' }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // MSW returns count: 60 with 50 loaded → hasMore should be true
    expect(result.current.hasMore).toBe(true)
  })

  test('batch moves raindrops to another collection', async () => {
    const { result } = renderHookWithProviders(() =>
      useRaindropsCrud({ collectionId: 'all' }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.batchMoveToCollection(['1', '2'], '100')
    })
  })

  test('batch adds tags to raindrops', async () => {
    const { result } = renderHookWithProviders(() =>
      useRaindropsCrud({ collectionId: 'all' }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.batchAddTag(['1', '2'], ['new-tag'])
    })
  })

  test('batch deletes raindrops', async () => {
    const { result } = renderHookWithProviders(() =>
      useRaindropsCrud({ collectionId: 'all' }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.batchDeleteRaindrops(['1', '2'])
    })
  })

  test('accepts sort parameter for API-driven sorting', async () => {
    const { result } = renderHookWithProviders(() =>
      useRaindropsCrud({ collectionId: 'all', sort: 'title' }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Verify data loaded (sorting is handled by API/MSW)
    expect(result.current.raindrops.length).toBeGreaterThan(0)
  })

  test('hides moved bookmarks at once and shows them again when the move fails', async () => {
    // Arrange — the batch update endpoint rejects the move
    const { server } = await import('@test/mocks/server')
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.put('https://api.raindrop.io/rest/v1/raindrops/0', () =>
        HttpResponse.json({ result: false }, { status: 500 }),
      ),
    )
    const { result } = renderHookWithProviders(() =>
      useRaindropsCrud({ collectionId: 'all' }),
    )
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.raindrops.some((r) => r.id === '1')).toBe(true)

    // Act — start the move without awaiting it
    let move: Promise<void> = Promise.resolve()
    act(() => {
      move = result.current.batchMoveToCollection(['1'], '101')
    })

    // Assert — gone immediately, back after the API refused
    expect(result.current.raindrops.some((r) => r.id === '1')).toBe(false)
    await act(async () => {
      await move
    })
    expect(result.current.raindrops.some((r) => r.id === '1')).toBe(true)
  })

  test('reorders optimistically and sends the bookmark its new position', async () => {
    // Arrange — capture the manual-order update
    const { server } = await import('@test/mocks/server')
    const { http, HttpResponse } = await import('msw')
    const updates: Array<{ id: string; body: unknown }> = []
    server.use(
      http.put(
        'https://api.raindrop.io/rest/v1/raindrop/:id',
        async ({ request, params }) => {
          updates.push({ id: String(params.id), body: await request.json() })
          return HttpResponse.json({
            result: true,
            item: { _id: Number(params.id) },
          })
        },
      ),
    )
    const { result } = renderHookWithProviders(() =>
      useRaindropsCrud({ collectionId: '100', sort: '-sort' }),
    )
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.raindrops.slice(0, 2).map((r) => r.id)).toEqual([
      '1',
      '2',
    ])

    // Act — drop bookmark 2 onto bookmark 1
    let reorder: Promise<void> = Promise.resolve()
    act(() => {
      reorder = result.current.reorderRaindrop('2', '1')
    })

    // Assert — the list flips immediately; the API receives position 0 for bookmark 2
    expect(result.current.raindrops.slice(0, 2).map((r) => r.id)).toEqual([
      '2',
      '1',
    ])
    await act(async () => {
      await reorder
    })
    expect(updates).toEqual([{ id: '2', body: { order: 0 } }])
  })
})
