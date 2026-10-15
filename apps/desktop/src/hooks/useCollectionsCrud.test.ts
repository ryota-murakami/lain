import { act } from '@testing-library/react'
import { describe, test } from 'vitest'

import { useCollectionsCrud } from '@/hooks/useCollectionsCrud'
import type { Group } from '@/lib/types'
import { renderHookWithProviders } from '@test/render-with-providers'

describe('useCollectionsCrud', () => {
  test('creates a collection via mutation', async () => {
    const { result } = renderHookWithProviders(() => useCollectionsCrud())

    await act(async () => {
      await result.current.createCollection({ title: 'New Collection' })
    })

    // Should not throw — MSW handles the POST
  })

  test('updates a collection via mutation', async () => {
    const { result } = renderHookWithProviders(() => useCollectionsCrud())

    await act(async () => {
      await result.current.updateCollection('100', { title: 'Renamed' })
    })
  })

  test('deletes a collection via mutation', async () => {
    const { result } = renderHookWithProviders(() => useCollectionsCrud())

    await act(async () => {
      await result.current.deleteCollection('100')
    })
  })

  test('merges collections via mutation', async () => {
    const { result } = renderHookWithProviders(() => useCollectionsCrud())

    await act(async () => {
      await result.current.merge('100', ['101'])
    })
  })

  test('empties trash via deleteCollection99', async () => {
    const { result } = renderHookWithProviders(() => useCollectionsCrud())

    await act(async () => {
      await result.current.emptyTrash()
    })
  })

  test('persists group ordering via putUser', async () => {
    const { result } = renderHookWithProviders(() => useCollectionsCrud())
    const groups: Group[] = [
      {
        id: 'group-0',
        name: 'Development',
        collections: [
          {
            id: '100',
            name: 'Development',
            icon: 'Folder',
            count: 10,
            groupId: 'group-0',
          },
        ],
      },
    ]

    await act(async () => {
      await result.current.updateUserGroups(groups)
    })
  })

  test('renames collection via updateCollection wrapper', async () => {
    const { result } = renderHookWithProviders(() => useCollectionsCrud())

    await act(async () => {
      await result.current.renameCollection('100', 'Renamed in Sidebar')
    })
  })

  test('updates collection color via putCollection', async () => {
    const { result } = renderHookWithProviders(() => useCollectionsCrud())

    await act(async () => {
      await result.current.recolorCollection('100', '#3b82f6')
    })
  })
})
