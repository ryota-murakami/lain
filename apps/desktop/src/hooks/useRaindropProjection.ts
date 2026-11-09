import { useCallback, useMemo, useState } from 'react'

import type { Raindrop } from '@/lib/types'

const EMPTY_IDS: ReadonlySet<string> = new Set()

/**
 * Overlay in-flight moves and manual order on the currently fetched bookmark pages.
 * Fresh server data or a new query scope replaces the overlay before children render.
 * @param dataToken - The infinite-query response identity; new pages/refetches reset optimistic state.
 * @example const projection = useRaindropProjection(rows, queryData, scopeKey)
 */
export function useRaindropProjection(
  fetched: Raindrop[],
  dataToken: unknown,
  scopeKey: string,
) {
  const [state, setState] = useState<{
    dataToken: unknown
    scopeKey: string
    hiddenIds: ReadonlySet<string>
    orderIds: string[] | null
  }>({ dataToken, scopeKey, hiddenIds: EMPTY_IDS, orderIds: null })
  // Query changes invalidate optimistic state synchronously, without a stale visible frame.
  if (state.dataToken !== dataToken || state.scopeKey !== scopeKey)
    setState({ dataToken, scopeKey, hiddenIds: EMPTY_IDS, orderIds: null })
  const raindrops = useMemo(() => {
    const visible = fetched.filter(
      (bookmark) => !state.hiddenIds.has(bookmark.id),
    )
    if (!state.orderIds) return visible
    const positions = new Map(state.orderIds.map((id, index) => [id, index]))
    return [...visible].sort(
      (left, right) =>
        (positions.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (positions.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    )
  }, [fetched, state.hiddenIds, state.orderIds])
  const hide = useCallback(
    (ids: string[]): void =>
      setState((previous) => ({ ...previous, hiddenIds: new Set(ids) })),
    [],
  )
  const clearHidden = useCallback(
    (): void => setState((previous) => ({ ...previous, hiddenIds: EMPTY_IDS })),
    [],
  )
  const setOrder = useCallback(
    (ids: string[] | null): void =>
      setState((previous) => ({ ...previous, orderIds: ids })),
    [],
  )
  return { raindrops, hide, clearHidden, setOrder }
}
