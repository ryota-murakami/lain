import { act, renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { Group } from '@/lib/types'

import { useSidebarOrganization } from './useSidebarOrganization'

const GROUPS: Group[] = [
  {
    id: 'work',
    name: 'Work',
    collections: [
      {
        id: '100',
        name: 'Reading',
        icon: 'Folder',
        count: 2,
        groupId: 'work',
        color: '#111111',
      },
    ],
  },
  { id: 'personal', name: 'Personal', collections: [] },
  { id: 'ungrouped', name: 'Other collections', collections: [] },
]

/** Build independent mutation spies for each observable sidebar scenario. */
function options() {
  return {
    groups: GROUPS,
    onPersistGroups: vi.fn(async () => {}),
    onDeleteCollection: vi.fn(async () => {}),
    onRenameCollection: vi.fn(async () => {}),
    onChangeCollectionColor: vi.fn(async () => {}),
  }
}

describe('sidebar collection mutations', () => {
  test('a pending rename appears immediately and a failed save restores its editable draft', async () => {
    // Arrange
    const props = options()
    let rejectWrite!: (reason: Error) => void
    props.onRenameCollection.mockImplementation(
      async () =>
        new Promise((_, reject) => {
          rejectWrite = reject
        }),
    )
    const { result } = renderHook(() => useSidebarOrganization(props))
    act(() => result.current.handleStartInlineRename(GROUPS[0].collections[0]))

    // Act
    let save!: Promise<void>
    act(() => {
      save = result.current.handleSubmitInlineRename('100', '  New reading  ')
    })
    expect(result.current.displayedGroups[0].collections[0].name).toBe(
      'New reading',
    )
    await act(async () => {
      rejectWrite(new Error('offline'))
      await save
    })

    // Assert
    expect(result.current.displayedGroups[0].collections[0].name).toBe(
      'Reading',
    )
    expect(result.current.editingCollectionId).toBe('100')
    expect(result.current.editingName).toBe('  New reading  ')
    expect(props.onRenameCollection).toHaveBeenCalledWith('100', 'New reading')
  })

  test('a rejected move restores the source group and preserves its bookmarks', async () => {
    // Arrange
    const props = options()
    props.onPersistGroups.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useSidebarOrganization(props))

    // Act
    await act(async () =>
      result.current.handleMoveCollectionToGroup('100', 'personal'),
    )

    // Assert
    expect(
      result.current.displayedGroups[0].collections.map((item) => item.id),
    ).toEqual(['100'])
    expect(result.current.displayedGroups[1].collections).toEqual([])
    expect(result.current.displayedGroups[0].collections[0].count).toBe(2)
  })

  test('Escape followed by blur does not persist the cancelled collection name', async () => {
    // Arrange
    const props = options()
    const { result } = renderHook(() => useSidebarOrganization(props))
    act(() => result.current.handleStartInlineRename(GROUPS[0].collections[0]))

    // Act
    act(() => result.current.handleCancelInlineRename())
    await act(async () =>
      result.current.handleSubmitInlineRename('100', 'Cancelled'),
    )

    // Assert
    expect(props.onRenameCollection).not.toHaveBeenCalled()
    expect(result.current.editingCollectionId).toBeNull()
    expect(result.current.displayedGroups[0].collections[0].name).toBe(
      'Reading',
    )
  })

  test('the synthetic Other collections group cannot receive persisted moves', async () => {
    // Arrange
    const props = options()
    const { result } = renderHook(() => useSidebarOrganization(props))

    // Act
    await act(async () =>
      result.current.handleMoveCollectionToGroup('100', 'ungrouped'),
    )

    // Assert
    expect(props.onPersistGroups).not.toHaveBeenCalled()
    expect(
      result.current.displayedGroups[0].collections.map((item) => item.id),
    ).toEqual(['100'])
  })
})
