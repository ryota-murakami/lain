import { Loader2 } from 'lucide-react'
import React from 'react'

import { Button } from '@/components/ui/button'

import type { MainContentProps } from './main-content.types'

/**
 * Keep cached bookmarks usable while presenting refresh failure and an explicit retry.
 * @example
 * <BookmarkLoadError isError onRetry={reload} />
 */
export const BookmarkLoadError = React.memo(function BookmarkLoadError({
  isError,
  onRetry,
}: Pick<MainContentProps, 'isError' | 'onRetry'>) {
  return (
    <>
      {' '}
      {isError && (
        <div
          role="alert"
          className="flex items-center justify-between border-b p-3 text-sm"
        >
          <span>
            Bookmarks could not be refreshed. Previously loaded items are kept.
          </span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry loading
          </Button>
        </div>
      )}
    </>
  )
})

/**
 * Share the observed pagination sentinel with a manual load button when another page is available.
 * @example
 * <BookmarkLoadMore {...props} />
 */
export const BookmarkLoadMore = React.memo(function BookmarkLoadMore({
  hasMore,
  isFetching,
  onLoadMore,
  sentinelRef,
}: Pick<MainContentProps, 'hasMore' | 'isFetching' | 'onLoadMore'> & {
  sentinelRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <>
      {' '}
      {/* Infinite scroll sentinel + loading indicator */}
      {hasMore && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-4"
        >
          {isFetching ? (
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          ) : (
            <Button variant="outline" size="sm" onClick={onLoadMore}>
              Load more bookmarks
            </Button>
          )}
        </div>
      )}
    </>
  )
})
