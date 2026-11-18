import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { Raindrop } from '@/lib/types'

import { useBookmarkDrag } from './useBookmarkDrag'

const mock = vi.hoisted(() => ({
  monitor: {} as {
    onDragStart: (event: DragStartEvent) => void
    onDragEnd: (event: DragEndEvent) => void
  },
  error: vi.fn(),
}))
vi.mock('@dnd-kit/core', () => ({
  useDndMonitor: (listeners: typeof mock.monitor): void => {
    mock.monitor = listeners
  },
  useDroppable: () => ({ setNodeRef: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { error: mock.error } }))
const BOOKMARKS: Raindrop[] = [
  {
    id: '1',
    title: 'Reading',
    url: 'https://example.com',
    type: 'link',
    domain: 'example.com',
    tags: [],
    createdAt: '',
    updatedAt: '',
    collectionId: '100',
  },
]

/** Simulate only the dnd fields consumed by bookmark routing. */
function drop(active: string, over: string): DragEndEvent {
  return { active: { id: active }, over: { id: over } } as DragEndEvent
}

describe('bookmark drag routing', () => {
  test('dropping a selected bookmark on a collection moves the complete selection', async () => {
    // Arrange
    const onBatchMove = vi.fn(async () => {})
    const selectedRaindropIds = new Set(['1', '2'])
    renderHook(() =>
      useBookmarkDrag({
        filteredRaindrops: BOOKMARKS,
        selectedCollectionId: '100',
        selectedRaindropIds,
        onBatchMove,
      }),
    )

    // Act
    await act(async () =>
      mock.monitor.onDragEnd(drop('raindrop:1', 'collection:200')),
    )

    // Assert
    expect(onBatchMove).toHaveBeenCalledWith(['1', '2'], '200')
  })

  test('dropping on the current collection does not repeat the move', async () => {
    // Arrange
    const onBatchMove = vi.fn(async () => {})
    renderHook(() =>
      useBookmarkDrag({
        filteredRaindrops: BOOKMARKS,
        selectedCollectionId: '100',
        selectedRaindropIds: new Set(),
        onBatchMove,
      }),
    )

    // Act
    await act(async () =>
      mock.monitor.onDragEnd(drop('raindrop:1', 'collection:100')),
    )

    // Assert
    expect(onBatchMove).not.toHaveBeenCalled()
  })

  test('failed manual ordering clears the preview and presents a retryable error', async () => {
    // Arrange
    const onReorderRaindrop = vi.fn().mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() =>
      useBookmarkDrag({
        filteredRaindrops: BOOKMARKS,
        selectedCollectionId: '100',
        selectedRaindropIds: new Set(),
        canReorderRaindrops: true,
        onReorderRaindrop,
      }),
    )
    act(() =>
      mock.monitor.onDragStart({
        active: { id: 'raindrop:1' },
      } as DragStartEvent),
    )
    expect(result.current.activeDragRaindrop?.id).toBe('1')

    // Act
    await act(async () =>
      mock.monitor.onDragEnd(drop('raindrop:1', 'raindrop:2')),
    )

    // Assert
    expect(onReorderRaindrop).toHaveBeenCalledWith('1', '2')
    expect(result.current.activeDragRaindrop).toBeUndefined()
    expect(mock.error).toHaveBeenCalledWith(
      'Bookmark order could not be saved. Please try again.',
    )
  })

  test('sorted search results cannot be manually reordered', async () => {
    // Arrange
    const onReorderRaindrop = vi.fn()
    renderHook(() =>
      useBookmarkDrag({
        filteredRaindrops: BOOKMARKS,
        selectedCollectionId: '100',
        selectedRaindropIds: new Set(),
        canReorderRaindrops: false,
        onReorderRaindrop,
      }),
    )

    // Act
    await act(async () =>
      mock.monitor.onDragEnd(drop('raindrop:1', 'raindrop:2')),
    )

    // Assert
    expect(onReorderRaindrop).not.toHaveBeenCalled()
  })
})
