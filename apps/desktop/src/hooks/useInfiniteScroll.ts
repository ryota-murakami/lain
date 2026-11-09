import { useEffect, useRef, type RefObject } from 'react'

/**
 * Infinite scroll hook using IntersectionObserver on a sentinel element.
 * {@link MainContent} attaches the returned ref to its conditional paging sentinel.
 * Reconnects after the first page mounts that sentinel and after each completed fetch,
 * so a still-visible sentinel can fill the viewport without duplicate requests.
 *
 * @param options.hasMore - Whether more pages are available
 * @param options.isFetching - Whether a fetch is currently in progress
 * @param options.onLoadMore - Callback to load the next page
 * @returns Ref to attach to the sentinel element
 *
 * @example
 *   const sentinelRef = useInfiniteScroll({ hasMore, isFetching, onLoadMore, scrollContainerRef })
 *   // <div ref={sentinelRef} /> at the bottom of the list
 */
export function useInfiniteScroll({
  hasMore,
  isFetching,
  isError = false,
  onLoadMore,
  scrollContainerRef,
}: {
  hasMore: boolean
  isFetching: boolean
  isError?: boolean
  onLoadMore?: () => void
  scrollContainerRef: RefObject<HTMLDivElement | null>
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  // Callback changes do not require replacing an observer while its paging state is unchanged.
  const onLoadMoreRef = useRef(onLoadMore)
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  }, [onLoadMore])

  useEffect(() => {
    // hasMore also controls whether MainContent renders the sentinel at all.
    // A failed page waits for the explicit retry action instead of reissuing while still visible.
    if (!hasMore || isFetching || isError) return
    const sentinel = sentinelRef.current
    // ScrollArea renders a [data-slot="scroll-area-viewport"] as the scroll container
    const root =
      scrollContainerRef.current?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]',
      ) ?? null
    if (!sentinel) return

    let active = true
    let requested = false
    const observer = new IntersectionObserver(
      (entries) => {
        if (active && !requested && entries[0]?.isIntersecting) {
          // Repeated notifications before React commits fetching=true must not submit the same page twice.
          requested = true
          onLoadMoreRef.current?.()
        }
      },
      { root, rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return (): void => {
      active = false
      observer.disconnect()
    }
  }, [hasMore, isFetching, isError, scrollContainerRef])

  return sentinelRef
}
