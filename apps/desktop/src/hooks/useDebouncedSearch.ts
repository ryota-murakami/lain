import { useEffect, useState } from 'react'

/**
 * Delay remote search requests while typing, without delaying controlled input or local highlighting.
 * {@link MainApp} uses this value as its query key to avoid spending the API budget on every keystroke.
 * @example const remoteQuery = useDebouncedSearch(query)
 */
export function useDebouncedSearch(query: string): string {
  const [settled, setSettled] = useState(query)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query), 300)
    return (): void => clearTimeout(timer)
  }, [query])
  return settled
}
