import { waitFor, act } from '@testing-library/react'
import { describe, test, expect } from 'vitest'

import { useUrlSuggest } from '@/hooks/useUrlSuggest'
import { renderHookWithProviders } from '@test/render-with-providers'

/** Return type of fetchSuggestion */
type Suggestion = {
  title?: string
  excerpt?: string
  link?: string
  meta?: { icon?: string }
} | null

describe('useUrlSuggest', () => {
  test('returns a fetchSuggestion function and isFetching state', () => {
    const { result } = renderHookWithProviders(() => useUrlSuggest())

    expect(typeof result.current.fetchSuggestion).toBe('function')
    expect(result.current.isFetching).toBe(false)
  })

  test('fetches URL metadata from API', async () => {
    const { result } = renderHookWithProviders(() => useUrlSuggest())

    // Use a mutable container to capture the value inside act()
    const box: { value: Suggestion } = { value: null }

    await act(async () => {
      box.value = await result.current.fetchSuggestion('https://react.dev')
    })

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false)
    })

    // MSW handler returns parsed metadata
    expect(box.value).not.toBeNull()
    expect(box.value?.title).toBeDefined()
  })

  test('returns null for failed requests', async () => {
    // Override MSW handler to simulate a server error
    const { server } = await import('@test/mocks/server')
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.get('https://api.raindrop.io/rest/v1/import/url/parse', () =>
        HttpResponse.error(),
      ),
    )

    const { result } = renderHookWithProviders(() => useUrlSuggest())

    const box: { value: Suggestion } = { value: null }

    await act(async () => {
      box.value = await result.current.fetchSuggestion('https://will-fail.com')
    })

    expect(box.value).toBeNull()
  })
})
