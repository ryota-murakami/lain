import { waitFor } from '@testing-library/react'
import { describe, test, expect } from 'vitest'

import { useSidebarData } from '@/hooks/useSidebarData'
import { renderHookWithProviders } from '@test/render-with-providers'

describe('useSidebarData', () => {
  test('loads and reconstructs sidebar groups from API', async () => {
    const { result } = renderHookWithProviders(() => useSidebarData())

    // Initially loading
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Groups should be reconstructed from user.groups + collections
    expect(result.current.groups.length).toBeGreaterThanOrEqual(1)
    expect(result.current.groups[0].name).toBe('Development')
    expect(result.current.groups[0].collections).toHaveLength(2)
    expect(result.current.groups[0].collections[0].name).toBe('Development')
  })

  test('builds system collections with correct structure', async () => {
    const { result } = renderHookWithProviders(() => useSidebarData())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const { systemCollections } = result.current
    expect(systemCollections).toHaveLength(3)
    expect(systemCollections[0].id).toBe('all')
    expect(systemCollections[0].name).toBe('All Bookmarks')
    expect(systemCollections[1].id).toBe('unsorted')
    expect(systemCollections[2].id).toBe('trash')
  })

  test('aggregates total count for All Bookmarks', async () => {
    const { result } = renderHookWithProviders(() => useSidebarData())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // MSW returns collections with count 20 + 15 + 12 + 13 = 60
    expect(result.current.systemCollections[0].count).toBe(60)
  })
})
