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
      http.put('https://api.raindrop.io/rest/v1/raindrops/100', () =>
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
      await expect(move).rejects.toMatchObject({ status: 500 })
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

describe('infinite bookmark query consistency', () => {
  test('shows loading for a newly selected collection until that collection has data', async () => {
    // Arrange — keep the destination request pending while the previous collection is already cached.
    const { server } = await import('@test/mocks/server')
    const { mockStore } = await import('@test/mocks/mock-store')
    const { http, HttpResponse } = await import('msw')
    let finishDestination: () => void = () => undefined
    const destinationReady = new Promise<void>((resolve) => {
      finishDestination = resolve
    })
    server.use(
      http.get('https://api.raindrop.io/rest/v1/raindrops/101', async () => {
        await destinationReady
        return HttpResponse.json({
          result: true,
          ...mockStore.getRaindrops(101, 0, 50),
        })
      }),
    )
    const { result, rerender } = renderHookWithProviders(
      ({ collectionId }) => useRaindropsCrud({ collectionId }),
      { initialProps: { collectionId: '100' } },
    )
    await waitFor(() => expect(result.current.raindrops).toHaveLength(20))

    // Act — switching scope must not expose either old rows or a false loaded-empty state.
    rerender({ collectionId: '101' })
    expect(result.current.raindrops).toEqual([])
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isFetching).toBe(true)
    await act(async () => {
      finishDestination()
    })

    // Assert — only the destination rows end the loading state.
    await waitFor(() => expect(result.current.raindrops).toHaveLength(15))
    expect(result.current.isLoading).toBe(false)
    expect(result.current.raindrops[0].title).toBe(
      'Apple Human Interface Guidelines',
    )
    expect(
      result.current.raindrops.some(
        (bookmark) => bookmark.title === 'React Documentation',
      ),
    ).toBe(false)
  })

  test('refreshes every cached page after a mutation without losing already loaded bookmarks', async () => {
    // Arrange
    const { server } = await import('@test/mocks/server')
    const { mockStore } = await import('@test/mocks/mock-store')
    const { http, HttpResponse } = await import('msw')
    const pages: number[] = []
    server.use(
      http.get('https://api.raindrop.io/rest/v1/raindrops/0', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'))
        pages.push(page)
        return HttpResponse.json({
          result: true,
          ...mockStore.getRaindrops(0, page, 50),
        })
      }),
    )
    const { result } = renderHookWithProviders(() =>
      useRaindropsCrud({ collectionId: 'all' }),
    )
    await waitFor(() => expect(result.current.raindrops).toHaveLength(50))
    act(() => result.current.loadMore())
    await waitFor(() => expect(result.current.raindrops).toHaveLength(60))

    // Act
    await act(async () =>
      result.current.updateRaindrop('1', { title: 'Changed first page' }),
    )
    await waitFor(() => expect(result.current.isFetching).toBe(false))

    // Assert
    expect(pages).toEqual([0, 1, 0, 1])
    expect(result.current.raindrops).toHaveLength(60)
    expect(
      result.current.raindrops.find((item) => item.id === '1')?.title,
    ).toBe('Changed first page')
    expect(result.current.hasMore).toBe(false)
  })

  test('retry requests a failed next page while retaining the first page', async () => {
    // Arrange
    const { server } = await import('@test/mocks/server')
    const { mockStore } = await import('@test/mocks/mock-store')
    const { http, HttpResponse } = await import('msw')
    let rejectPage = true
    const pages: number[] = []
    server.use(
      http.get('https://api.raindrop.io/rest/v1/raindrops/0', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'))
        pages.push(page)
        if (page === 1 && rejectPage)
          return HttpResponse.json({ result: false }, { status: 503 })
        return HttpResponse.json({
          result: true,
          ...mockStore.getRaindrops(0, page, 50),
        })
      }),
    )
    const { result } = renderHookWithProviders(() =>
      useRaindropsCrud({ collectionId: 'all' }),
    )
    await waitFor(() => expect(result.current.raindrops).toHaveLength(50))
    act(() => result.current.loadMore())
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.raindrops).toHaveLength(50)

    // Act
    rejectPage = false
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.raindrops).toHaveLength(60))

    // Assert
    expect(pages).toEqual([0, 1, 1])
    expect(result.current.isError).toBe(false)
  })

  test('rolls back a failed manual reorder and exposes the failure to the drag interaction', async () => {
    // Arrange
    const { server } = await import('@test/mocks/server')
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.put('https://api.raindrop.io/rest/v1/raindrop/2', () =>
        HttpResponse.json({ result: false }, { status: 503 }),
      ),
    )
    const { result } = renderHookWithProviders(() =>
      useRaindropsCrud({ collectionId: '100', sort: '-sort' }),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Act
    await act(async () => {
      await expect(
        result.current.reorderRaindrop('2', '1'),
      ).rejects.toMatchObject({ status: 503 })
    })

    // Assert
    expect(result.current.raindrops.slice(0, 2).map((item) => item.id)).toEqual(
      ['1', '2'],
    )
  })
})
