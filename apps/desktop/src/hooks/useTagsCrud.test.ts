import { waitFor, act } from '@testing-library/react'
import { describe, test, expect } from 'vitest'

import { useTagsCrud } from '@/hooks/useTagsCrud'
import { renderHookWithProviders } from '@test/render-with-providers'

describe('useTagsCrud', () => {
  test('fetches and maps tags from API', async () => {
    const { result } = renderHookWithProviders(() => useTagsCrud())

    await waitFor(() => {
      expect(result.current.tags.length).toBeGreaterThan(0)
    })

    // MSW returns tags from fixtures → mapped _id to name
    expect(result.current.tags[0]).toEqual({ name: 'react', count: 8 })
    expect(result.current.tags[1]).toEqual({ name: 'typescript', count: 6 })
    expect(result.current.tags[2]).toEqual({ name: 'design', count: 12 })
  })

  test('renames a tag via mutation', async () => {
    const { result } = renderHookWithProviders(() => useTagsCrud())

    await waitFor(() => {
      expect(result.current.tags.length).toBeGreaterThan(0)
    })

    await act(async () => {
      await result.current.renameTag('all', 'react', 'reactjs')
    })
  })

  test('deletes tags via mutation', async () => {
    const { result } = renderHookWithProviders(() => useTagsCrud())

    await waitFor(() => {
      expect(result.current.tags.length).toBeGreaterThan(0)
    })

    await act(async () => {
      await result.current.deleteTag('all', ['react'])
    })
  })
})
