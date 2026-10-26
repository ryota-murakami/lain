import { useCallback } from 'react'

import { raindropApi } from '@/store/api/raindropApi'

/**
 * Hook for fetching URL metadata suggestions from Raindrop.io API.
 * Uses the import/url/parse endpoint for auto-filling bookmark form fields.
 *
 * @returns fetchSuggestion function that resolves with parsed metadata
 *
 * @example
 *   const { fetchSuggestion, isFetching } = useUrlSuggest()
 *   const meta = await fetchSuggestion('https://react.dev')
 *   // => { title: 'React', excerpt: '...', link: 'https://react.dev' }
 */
export function useUrlSuggest() {
  const [trigger, { isFetching }] =
    raindropApi.endpoints.getImportUrlParse.useLazyQuery()

  const fetchSuggestion = useCallback(
    async (
      url: string,
    ): Promise<{
      title?: string
      excerpt?: string
      link?: string
      meta?: { icon?: string }
    } | null> => {
      try {
        const result = await trigger({ url }).unwrap()
        // The API returns { result: boolean, item: { ... } }
        const item = (result as Record<string, unknown>)?.item as
          | Record<string, unknown>
          | undefined
        if (item) {
          return {
            title: item.title as string | undefined,
            excerpt: item.excerpt as string | undefined,
            link: item.link as string | undefined,
            meta: item.meta as { icon?: string } | undefined,
          }
        }
        return null
      } catch {
        return null
      }
    },
    [trigger],
  )

  return { fetchSuggestion, isFetching }
}
