import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Group } from '@/lib/types'

import { useSidebarDrag } from './useSidebarDrag'

const GROUPS: Group[] = [
  {
    id: 'work',
    name: 'Work',
    collections: [
      { id: '100', name: 'Reading', icon: '', count: 2, groupId: 'work' },
      { id: '200', name: 'Research', icon: '', count: 3, groupId: 'work' },
      { id: '300', name: 'Archive', icon: '', count: 4, groupId: 'work' },
    ],
  },
  { id: 'personal', name: 'Personal', collections: [] },
  { id: 'ungrouped', name: 'Other collections', collections: [] },
]

/** Model only dnd-kit identifiers consumed by the real sidebar drag handler. */
function drop(active: string, over: string | null): DragEndEvent {
  return {
    active: { id: active },
    over: over === null ? null : { id: over },
  } as DragEndEvent
}

/** Independent persistence spies make accidental duplicate group writes visible. */
function options() {
  return {
    displayedGroups: GROUPS,
    handlePersistGroups: vi.fn(
      async (_next: Group[], _previous: Group[]) => {},
    ),
    onDragEditingCancel: vi.fn(),
  }
}

describe('sidebar collection drag persistence', () => {
  it('moves the first collection to the end without an off-by-one position', async () => {
    // Arrange
    const props = options()
    const { result } = renderHook(() => useSidebarDrag(props))
    // Act
    await act(async () =>
      result.current.handleDragEnd(drop('collection:100', 'group:work')),
    )
    // Assert
    expect(props.handlePersistGroups).toHaveBeenCalledTimes(1)
    const [next, previous] = props.handlePersistGroups.mock.calls[0]
    expect(next[0].collections.map((item) => item.id)).toEqual([
      '200',
      '300',
      '100',
    ])
    expect(previous[0].collections.map((item) => item.id)).toEqual([
      '100',
      '200',
      '300',
    ])
  })

  it('moves a root collection to another group while retaining its bookmark count', async () => {
    // Arrange
    const props = options()
    const { result } = renderHook(() => useSidebarDrag(props))
    // Act
    await act(async () =>
      result.current.handleDragEnd(drop('collection:100', 'group:personal')),
    )
    // Assert
    const [next] = props.handlePersistGroups.mock.calls[0]
    expect(next[0].collections.map((item) => item.id)).toEqual(['200', '300'])
    expect(next[1].collections).toEqual([
      { id: '100', name: 'Reading', icon: '', count: 2, groupId: 'personal' },
    ])
  })

  it('inserts a later collection before an earlier sibling', async () => {
    // Arrange
    const props = options()
    const { result } = renderHook(() => useSidebarDrag(props))
    // Act
    await act(async () =>
      result.current.handleDragEnd(drop('collection:300', 'collection:100')),
    )
    // Assert
    expect(
      props.handlePersistGroups.mock.calls[0][0][0].collections.map(
        (item) => item.id,
      ),
    ).toEqual(['300', '100', '200'])
  })

  it.each([
    ['collection:100', 'collection:100'],
    ['collection:100', 'collection:200'],
    ['collection:100', null],
    ['collection:100', 'group:ungrouped'],
    ['collection:100', 'group:missing'],
    ['collection:100', 'collection:missing'],
    ['collection:missing', 'group:personal'],
    ['invalid:100', 'group:personal'],
    ['raindrop:100', 'group:personal'],
  ])(
    'does not persist a no-op or invalid drop from %s to %s',
    async (active, over) => {
      // Arrange
      const props = options()
      const { result } = renderHook(() => useSidebarDrag(props))
      // Act
      await act(async () => result.current.handleDragEnd(drop(active, over)))
      // Assert
      expect(props.handlePersistGroups).not.toHaveBeenCalled()
      expect(result.current.dropIndicator).toBeNull()
      expect(result.current.activeDragCollection).toBeUndefined()
      expect(result.current.isRaindropDragActive).toBe(false)
    },
  )

  it('previews a collection insertion and clears it when the drag is cancelled', () => {
    // Arrange
    const props = options()
    const { result } = renderHook(() => useSidebarDrag(props))
    // Act
    act(() =>
      result.current.handleDragStart(
        drop('collection:200', null) as DragStartEvent,
      ),
    )
    act(() =>
      result.current.handleDragOver(drop('collection:200', 'group:personal')),
    )
    // Assert
    expect(props.onDragEditingCancel).toHaveBeenCalledTimes(1)
    expect(result.current.activeDragCollection?.name).toBe('Research')
    expect(result.current.dropIndicator).toEqual({
      groupId: 'personal',
      index: 0,
    })
    act(() => result.current.handleDragCancel())
    expect(result.current.activeDragCollection).toBeUndefined()
    expect(result.current.dropIndicator).toBeNull()
  })

  it('leaves bookmark targets to the bookmark drag monitor without displaying a collection insertion marker', () => {
    // Arrange
    const props = options()
    const { result } = renderHook(() => useSidebarDrag(props))
    // Act
    act(() =>
      result.current.handleDragStart(
        drop('raindrop:900', null) as DragStartEvent,
      ),
    )
    act(() =>
      result.current.handleDragOver(drop('raindrop:900', 'collection:100')),
    )
    // Assert
    expect(result.current.isRaindropDragActive).toBe(true)
    expect(result.current.activeDragCollection).toBeUndefined()
    expect(result.current.dropIndicator).toBeNull()
    act(() => result.current.handleDragCancel())
    expect(result.current.isRaindropDragActive).toBe(false)
  })
})
