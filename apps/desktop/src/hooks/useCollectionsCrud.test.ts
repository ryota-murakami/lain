import { act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { useCollectionsCrud } from '@/hooks/useCollectionsCrud'
import type { Group } from '@/lib/types'
import { server } from '@test/mocks/server'
import { renderHookWithProviders } from '@test/render-with-providers'

const base = 'https://api.raindrop.io/rest/v1'

afterEach(() => vi.restoreAllMocks())

describe('collection persistence', () => {
  test('keeps explicit colors locally while sending only documented collection fields to the service', async () => {
    // Arrange
    const bodies: unknown[] = []
    server.use(
      http.put(`${base}/collection/100`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ result: true, item: { _id: 100 } })
      }),
    )
    const { result, store } = renderHookWithProviders(() =>
      useCollectionsCrud(),
    )

    // Act — context recoloring needs no network; a combined metadata save still updates the server.
    await act(async () => result.current.recolorCollection('100', '#06b6d4'))
    expect(bodies).toEqual([])
    expect(store.getState().ui.collectionColors['100']).toBe('#06b6d4')
    await act(async () =>
      result.current.updateCollection('100', {
        title: 'Renamed',
        color: '#123456',
      }),
    )

    // Assert — cover-derived API color is not an undocumented write parameter.
    expect(bodies).toEqual([{ title: 'Renamed' }])
    expect(store.getState().ui.collectionColors['100']).toBe('#123456')
  })

  test('retains the prior local color when the accompanying remote metadata save fails', async () => {
    // Arrange
    server.use(
      http.put(`${base}/collection/100`, () =>
        HttpResponse.json({ result: false }, { status: 503 }),
      ),
    )
    const { result, store } = renderHookWithProviders(() =>
      useCollectionsCrud(),
    )
    await act(async () => result.current.recolorCollection('100', '#06b6d4'))

    // Act / Assert
    await act(async () =>
      expect(
        result.current.updateCollection('100', {
          title: 'Draft',
          color: '#123456',
        }),
      ).rejects.toMatchObject({ status: 503 }),
    )
    expect(store.getState().ui.collectionColors['100']).toBe('#06b6d4')
  })

  test('creates a nested public collection and exposes its confirmed ID for subsequent edits', async () => {
    // Arrange
    const bodies: unknown[] = []
    server.use(
      http.post(`${base}/collection`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ result: true, item: { _id: 777 } })
      }),
    )
    const { result } = renderHookWithProviders(() => useCollectionsCrud())

    // Act
    let id = ''
    await act(async () => {
      id = await result.current.createCollection({
        title: '参考資料',
        parentId: '100',
        isPublic: true,
      })
    })

    // Assert
    expect(id).toBe('777')
    expect(bodies).toEqual([
      { title: '参考資料', public: true, parent: { $id: 100 } },
    ])
  })

  test('rejects creation without a confirmed ID so dependent edits cannot target an unknown collection', async () => {
    // Arrange
    server.use(
      http.post(`${base}/collection`, () =>
        HttpResponse.json({ result: true }),
      ),
    )
    const { result } = renderHookWithProviders(() => useCollectionsCrud())

    // Act / Assert
    await act(async () => {
      await expect(
        result.current.createCollection({ title: 'New' }),
      ).rejects.toThrow('did not return a collection ID')
    })
  })

  test('distinguishes moving to the root from an unrelated update that leaves the parent unchanged', async () => {
    // Arrange
    const bodies: unknown[] = []
    server.use(
      http.put(`${base}/collection/100`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ result: true })
      }),
    )
    const { result } = renderHookWithProviders(() => useCollectionsCrud())

    // Act
    await act(async () => {
      await result.current.updateCollection('100', {
        title: 'Root',
        parentId: undefined,
      })
      await result.current.renameCollection('100', 'Renamed')
      await result.current.updateCollection('100', { parentId: '101' })
    })

    // Assert
    expect(bodies).toEqual([
      { title: 'Root', parent: {} },
      { title: 'Renamed' },
      { parent: { $id: 101 } },
    ])
  })

  test('preserves group ordering while excluding the local orphan-visibility container from remote writes', async () => {
    // Arrange
    const bodies: unknown[] = []
    server.use(
      http.put(`${base}/user`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ result: true })
      }),
    )
    const groups: Group[] = [
      {
        id: 'ungrouped',
        name: 'Other collections',
        collections: [
          {
            id: '999',
            name: 'Orphan',
            count: 0,
            icon: 'Folder',
            groupId: 'ungrouped',
          },
        ],
      },
      {
        id: 'group-1',
        name: 'Research',
        hidden: true,
        collections: [
          {
            id: '101',
            name: 'Notes',
            count: 0,
            icon: 'Folder',
            groupId: 'group-1',
          },
        ],
      },
      { id: 'group-0', name: 'Work', collections: [] },
    ]
    const { result } = renderHookWithProviders(() => useCollectionsCrud())

    // Act
    await act(async () => result.current.updateUserGroups(groups))

    // Assert
    expect(bodies).toEqual([
      {
        groups: [
          { title: 'Research', hidden: true, sort: 0, collections: [101] },
          { title: 'Work', hidden: false, sort: 1, collections: [] },
        ],
      },
    ])
    expect(groups[0].collections[0].id).toBe('999')
  })

  test('targets merge, collection delete and empty trash at their distinct API endpoints', async () => {
    // Arrange
    const writes: unknown[] = []
    server.use(
      http.put(`${base}/collections/merge`, async ({ request }) => {
        writes.push(await request.json())
        return HttpResponse.json({ result: true })
      }),
      http.delete(`${base}/collection/:id`, ({ params }) => {
        writes.push(params.id)
        return HttpResponse.json({ result: true })
      }),
    )
    const { result } = renderHookWithProviders(() => useCollectionsCrud())

    // Act
    await act(async () => {
      await result.current.merge('100', ['101', '102'])
      await result.current.deleteCollection('103')
      await result.current.emptyTrash()
    })

    // Assert
    expect(writes).toEqual([{ to: 100, ids: [101, 102] }, '103', '-99'])
  })

  test.each([
    'delete',
    'merge',
    'empty-trash',
    'group-save',
    'rename',
  ] as const)(
    '%s rejects service failures so the caller keeps the retryable editor open',
    async (operation) => {
      // Arrange
      server.use(
        http.put(`${base}/*`, () =>
          HttpResponse.json({ result: false }, { status: 503 }),
        ),
        http.delete(`${base}/*`, () =>
          HttpResponse.json({ result: false }, { status: 503 }),
        ),
      )
      const { result } = renderHookWithProviders(() => useCollectionsCrud())
      const actions = {
        delete: async (): Promise<void> =>
          result.current.deleteCollection('100'),
        merge: async (): Promise<void> => result.current.merge('100', ['101']),
        'empty-trash': async (): Promise<void> => result.current.emptyTrash(),
        'group-save': async (): Promise<void> =>
          result.current.updateUserGroups([]),
        rename: async (): Promise<void> =>
          result.current.renameCollection('100', 'Retry'),
      }

      // Act / Assert
      await act(async () => {
        await expect(actions[operation]()).rejects.toMatchObject({
          status: 503,
        })
      })
    },
  )

  test.each([
    'update',
    'delete',
    'merge',
    'empty-trash',
    'group-save',
    'rename',
  ] as const)(
    '%s rejects HTTP-200 service refusals without a success notification',
    async (operation) => {
      // Arrange — exercise the real base query instead of mocking the mutation hook.
      const successToast = vi.spyOn(toast, 'success')
      server.use(
        http.put(`${base}/*`, () =>
          HttpResponse.json({
            result: false,
            errorMessage: 'Synthetic refusal',
          }),
        ),
        http.delete(`${base}/*`, () =>
          HttpResponse.json({
            result: false,
            errorMessage: 'Synthetic refusal',
          }),
        ),
      )
      const { result } = renderHookWithProviders(() => useCollectionsCrud())
      const actions = {
        update: async (): Promise<void> =>
          result.current.updateCollection('100', { title: 'Saved' }),
        delete: async (): Promise<void> =>
          result.current.deleteCollection('100'),
        merge: async (): Promise<void> => result.current.merge('100', ['101']),
        'empty-trash': async (): Promise<void> => result.current.emptyTrash(),
        'group-save': async (): Promise<void> =>
          result.current.updateUserGroups([]),
        rename: async (): Promise<void> =>
          result.current.renameCollection('100', 'Saved'),
      }

      // Act / Assert — callers must retain their pending form and must not receive success.
      await act(async () => {
        await expect(actions[operation]()).rejects.toEqual({
          status: 200,
          message: 'Synthetic refusal',
        })
      })
      expect(successToast).not.toHaveBeenCalled()
    },
  )

  test('accepts successful collection and group responses that omit the optional result field', async () => {
    // Arrange — generated GenericResult, CollectionItemResponse and UserResponse permit omission.
    const successToast = vi.spyOn(toast, 'success')
    server.use(
      http.put(`${base}/*`, () => HttpResponse.json({})),
      http.delete(`${base}/*`, () => HttpResponse.json({})),
    )
    const { result } = renderHookWithProviders(() => useCollectionsCrud())

    // Act
    await act(async () => {
      await result.current.updateCollection('100', { title: 'Saved' })
      await result.current.deleteCollection('101')
      await result.current.merge('100', ['102'])
      await result.current.emptyTrash()
      await result.current.updateUserGroups([])
    })

    // Assert
    expect(successToast).toHaveBeenCalledTimes(3)
    expect(successToast).toHaveBeenNthCalledWith(1, 'Collection deleted')
    expect(successToast).toHaveBeenNthCalledWith(2, 'Collections merged')
    expect(successToast).toHaveBeenNthCalledWith(3, 'Trash emptied')
  })
})
