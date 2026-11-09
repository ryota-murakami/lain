import { act, render } from '@testing-library/react'
import { memo, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useInfiniteScroll } from './useInfiniteScroll'

let callback: IntersectionObserverCallback
const observe = vi.fn()
const disconnect = vi.fn()
const constructed = vi.fn()

beforeEach(() => {
  observe.mockReset()
  disconnect.mockClear()
  constructed.mockClear()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(
        listener: IntersectionObserverCallback,
        options: IntersectionObserverInit,
      ) {
        callback = listener
        constructed(options)
      }
      observe = observe
      disconnect = disconnect
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

/** Render the real sentinel under the scrolling viewport so tests exercise its observer lifecycle. */
const ScrollFixture = memo(function ScrollFixture({
  hasMore,
  isFetching,
  isError,
  onLoadMore,
  conditional = false,
}: Omit<Parameters<typeof useInfiniteScroll>[0], 'scrollContainerRef'> & {
  conditional?: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  const sentinel = useInfiniteScroll({
    hasMore,
    isFetching,
    isError,
    onLoadMore,
    scrollContainerRef: container,
  })
  return (
    <div ref={container}>
      <div data-slot="scroll-area-viewport">
        {(!conditional || hasMore) && <div ref={sentinel} />}
      </div>
    </div>
  )
})

/** Simulate a browser visibility notification; only the intersection flag is consumed by the hook. */
function intersect(isIntersecting: boolean): void {
  act(() =>
    callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  )
}

describe('infinite scrolling', () => {
  it('waits for explicit error recovery instead of automatically retrying a visible failed page', () => {
    // Arrange — the first next-page request is pending while the sentinel remains in view.
    const onLoadMore = vi.fn()
    observe.mockImplementation(() =>
      callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    )
    const screen = render(
      <ScrollFixture hasMore isFetching onLoadMore={onLoadMore} />,
    )

    // Act — the request fails, then an explicit retry succeeds and clears the error.
    screen.rerender(
      <ScrollFixture
        hasMore
        isFetching={false}
        isError
        onLoadMore={onLoadMore}
      />,
    )
    expect(onLoadMore).not.toHaveBeenCalled()
    screen.rerender(
      <ScrollFixture hasMore isFetching onLoadMore={onLoadMore} />,
    )
    screen.rerender(
      <ScrollFixture hasMore isFetching={false} onLoadMore={onLoadMore} />,
    )

    // Assert — automatic paging resumes only after recovery.
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('loads another page when the sentinel mounts after the initial delayed response', () => {
    // Arrange — MainContent omits its sentinel until the first response establishes hasMore.
    const onLoadMore = vi.fn()
    const screen = render(
      <ScrollFixture
        conditional
        hasMore={false}
        isFetching
        onLoadMore={onLoadMore}
      />,
    )
    expect(observe).not.toHaveBeenCalled()

    // Act — the first page arrives and the user scrolls to its newly mounted sentinel.
    screen.rerender(
      <ScrollFixture
        conditional
        hasMore
        isFetching={false}
        onLoadMore={onLoadMore}
      />,
    )
    expect(observe).toHaveBeenCalledTimes(1)
    intersect(true)

    // Assert
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('continues filling a visible viewport after a fetch finishes without duplicate intersection requests', () => {
    // Arrange — browsers report the visible sentinel once for each observer attachment.
    const onLoadMore = vi.fn()
    observe.mockImplementation(() =>
      callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    )
    const screen = render(
      <ScrollFixture hasMore isFetching onLoadMore={onLoadMore} />,
    )
    expect(onLoadMore).not.toHaveBeenCalled()

    // Act — the viewport remains near the end across successive completed page requests.
    screen.rerender(
      <ScrollFixture hasMore isFetching={false} onLoadMore={onLoadMore} />,
    )
    expect(onLoadMore).toHaveBeenCalledTimes(1)
    intersect(true)
    expect(onLoadMore).toHaveBeenCalledTimes(1)
    screen.rerender(
      <ScrollFixture hasMore isFetching onLoadMore={onLoadMore} />,
    )
    screen.rerender(
      <ScrollFixture hasMore isFetching={false} onLoadMore={onLoadMore} />,
    )

    // Assert — each finished page may trigger its successor, while repeated notifications cannot duplicate it.
    expect(onLoadMore).toHaveBeenCalledTimes(2)
    observe.mockReset()
  })

  it('loads the next page when the sentinel becomes visible and detaches on unmount', () => {
    // Arrange
    const onLoadMore = vi.fn()
    const screen = render(
      <ScrollFixture hasMore isFetching={false} onLoadMore={onLoadMore} />,
    )
    // Act
    intersect(true)
    screen.unmount()
    // Assert
    expect(onLoadMore).toHaveBeenCalledTimes(1)
    expect(observe).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('does not load offscreen, during a fetch, or after the final page', () => {
    // Arrange
    const onLoadMore = vi.fn()
    const screen = render(
      <ScrollFixture hasMore isFetching={false} onLoadMore={onLoadMore} />,
    )
    // Act
    intersect(false)
    screen.rerender(
      <ScrollFixture hasMore isFetching onLoadMore={onLoadMore} />,
    )
    intersect(true)
    screen.rerender(
      <ScrollFixture
        hasMore={false}
        isFetching={false}
        onLoadMore={onLoadMore}
      />,
    )
    intersect(true)
    // Assert
    expect(onLoadMore).not.toHaveBeenCalled()
  })

  it('uses the latest page callback without recreating the scroll observer', () => {
    // Arrange
    const oldCallback = vi.fn()
    const newCallback = vi.fn()
    const screen = render(
      <ScrollFixture hasMore isFetching={false} onLoadMore={oldCallback} />,
    )
    // Act
    screen.rerender(
      <ScrollFixture hasMore isFetching={false} onLoadMore={newCallback} />,
    )
    intersect(true)
    // Assert
    expect(oldCallback).not.toHaveBeenCalled()
    expect(newCallback).toHaveBeenCalledTimes(1)
    expect(constructed).toHaveBeenCalledTimes(1)
  })

  it('tolerates a view without a page-loading action', () => {
    // Arrange
    render(<ScrollFixture hasMore isFetching={false} />)
    // Act / Assert
    expect(() => intersect(true)).not.toThrow()
  })
})
