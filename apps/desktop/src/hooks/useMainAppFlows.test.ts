import { act } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { CollectionFormValues } from '@/components/raindrop/collection-dialog'
import type { Group, Raindrop } from '@/lib/types'
import { setSelectedRaindropIds } from '@/store/slices/uiSlice'
import { renderHookWithProviders } from '@test/render-with-providers'

import { useMainAppBookmarkActions } from './useMainAppBookmarkActions'
import { useMainAppCollectionEditor } from './useMainAppCollectionEditor'
import { useMainAppDetail } from './useMainAppDetail'
import { useMainAppGroupEditor } from './useMainAppGroupEditor'
import { useMainAppView } from './useMainAppView'
import { PartialBookmarkBatchError } from './useRaindropBatchActions'

const first: Raindrop = {
  id: '1',
  title: 'First',
  url: 'https://example.com/one',
  type: 'link',
  tags: [],
  createdAt: '',
  updatedAt: '',
  collectionId: '100',
}
const second: Raindrop = { ...first, id: '2', title: 'Second' }
const groups: Group[] = [
  {
    id: 'group-0',
    name: 'Work',
    collections: [
      {
        id: '100',
        name: 'Research',
        groupId: 'group-0',
        count: 2,
        icon: 'Folder',
      },
    ],
  },
  {
    id: 'ungrouped',
    name: 'Other collections',
    collections: [
      {
        id: '101',
        name: 'Orphan',
        groupId: 'ungrouped',
        count: 1,
        icon: 'Folder',
      },
    ],
  },
]
const form: CollectionFormValues = {
  name: 'Saved',
  icon: 'Bookmark',
  color: '#123456',
  groupId: 'ungrouped',
  viewMode: 'table',
  isPublic: false,
}

describe('detail editing transitions', () => {
  test('keeps a dirty editor open after delete failure and closes it only after a confirmed retry', async () => {
    // Arrange
    const deleteRaindrop = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(undefined)
    const { result } = renderHookWithProviders(() =>
      useMainAppDetail({ deleteRaindrop, updateRaindrop: vi.fn() }),
    )
    act(() => result.current.handleSelectRaindrop(first))
    act(() => result.current.setDetailDirty(true))

    // Act / Assert — rejection must preserve the editor, selected record and dirty state.
    await act(async () => {
      await expect(result.current.handleDeleteRaindrop('1')).rejects.toThrow(
        'Offline',
      )
    })
    expect(result.current.selectedRaindrop?.id).toBe('1')
    expect(result.current.isDetailPanelOpen).toBe(true)
    expect(result.current.detailDirty).toBe(true)
    await act(async () => result.current.handleDeleteRaindrop('1'))
    expect(result.current.selectedRaindrop).toBeUndefined()
    expect(result.current.isDetailPanelOpen).toBe(false)
    expect(result.current.detailDirty).toBe(false)
  })

  test('canceled discard preserves the draft while confirmed discard remounts a fresh editor', () => {
    // Arrange
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)
    vi.stubGlobal('confirm', confirm)
    const { result } = renderHookWithProviders(() =>
      useMainAppDetail({ deleteRaindrop: vi.fn(), updateRaindrop: vi.fn() }),
    )
    act(() => result.current.handleSelectRaindrop(first))
    act(() => result.current.setDetailDirty(true))

    // Act
    act(() => result.current.handleFocusRaindrop(second))
    act(() => result.current.handleSelectRaindrop(second))

    // Assert
    expect(result.current.selectedRaindrop?.id).toBe('1')
    expect(result.current.detailRevision).toBe(0)
    expect(result.current.detailDirty).toBe(true)
    act(() => result.current.handleCloseDetailPanel())
    expect(result.current.detailRevision).toBe(1)
    expect(result.current.detailDirty).toBe(false)
    expect(result.current.isDetailPanelOpen).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(2)
    vi.unstubAllGlobals()
  })

  test('reopens the retained bookmark after closing and hides the open action before any selection', () => {
    // Arrange
    const { result } = renderHookWithProviders(() =>
      useMainAppDetail({ deleteRaindrop: vi.fn(), updateRaindrop: vi.fn() }),
    )
    expect(result.current.handleOpenDetailPanel).toBeUndefined()
    act(() => result.current.handleSelectRaindrop(first))
    act(() => result.current.handleCloseDetailPanel())
    expect(result.current.isDetailPanelOpen).toBe(false)

    // Act
    act(() => result.current.handleOpenDetailPanel?.())

    // Assert
    expect(result.current.isDetailPanelOpen).toBe(true)
    expect(result.current.selectedRaindrop?.id).toBe('1')
  })

  test('saving rejects without dropping the editor when the service is unavailable', async () => {
    // Arrange
    const updateRaindrop = vi.fn().mockRejectedValue(new Error('Unavailable'))
    const { result } = renderHookWithProviders(() =>
      useMainAppDetail({ deleteRaindrop: vi.fn(), updateRaindrop }),
    )
    act(() => result.current.handleSelectRaindrop(first))

    // Act / Assert
    await act(async () => {
      await expect(
        result.current.handleSaveRaindrop({ ...first, title: 'Draft' }),
      ).rejects.toThrow('Unavailable')
    })
    expect(updateRaindrop).toHaveBeenCalledWith('1', {
      ...first,
      title: 'Draft',
    })
    expect(result.current.isDetailPanelOpen).toBe(true)
  })
})

describe('collection and group editors', () => {
  test('carries the invoking group into a new collection and clears that context for later global or edit actions', () => {
    // Arrange
    const { result } = renderHookWithProviders(() =>
      useMainAppCollectionEditor(groups, {
        createCollection: vi.fn(),
        updateCollection: vi.fn(),
        updateUserGroups: vi.fn(),
        merge: vi.fn(),
      }),
    )

    // Act / Assert — a group context must not be lost or leak into an unrelated new/edit dialog.
    act(() => result.current.handleAddCollection('group-0'))
    expect(result.current.initialCollectionGroupId).toBe('group-0')
    expect(result.current.isCollectionDialogOpen).toBe(true)
    act(() => result.current.handleCollectionDialogOpenChange(false))
    expect(result.current.initialCollectionGroupId).toBeUndefined()
    act(() => result.current.handleAddCollection())
    expect(result.current.initialCollectionGroupId).toBeUndefined()
    act(() => result.current.handleAddCollection('group-0'))
    act(() => result.current.handleEditCollection(groups[0].collections[0]))
    expect(result.current.initialCollectionGroupId).toBeUndefined()
    expect(result.current.editingCollection?.id).toBe('100')
  })

  test('preserves a newly created collection ID across group-save failure so retry cannot create a duplicate', async () => {
    // Arrange
    const createCollection = vi.fn().mockResolvedValue('777')
    const updateCollection = vi.fn().mockResolvedValue(undefined)
    const updateUserGroups = vi
      .fn()
      .mockRejectedValueOnce(new Error('Group save failed'))
      .mockResolvedValueOnce(undefined)
    const { result, store } = renderHookWithProviders(() =>
      useMainAppCollectionEditor(groups, {
        createCollection,
        updateCollection,
        updateUserGroups,
        merge: vi.fn(),
      }),
    )
    act(() => result.current.handleAddCollection())

    // Act
    await act(async () => {
      await expect(
        result.current.handleSaveCollection(form),
      ).rejects.toMatchObject({
        collectionId: '777',
        message: 'Group save failed',
      })
    })

    // Assert — dialog stays open with no unconfirmed local preferences.
    expect(result.current.isCollectionDialogOpen).toBe(true)
    expect(store.getState().ui.collectionViewModes['777']).toBeUndefined()
    await act(async () =>
      result.current.handleSaveCollection({ ...form, id: '777' }),
    )
    expect(createCollection).toHaveBeenCalledTimes(1)
    expect(updateCollection).toHaveBeenCalledTimes(2)
    expect(result.current.isCollectionDialogOpen).toBe(false)
    expect(store.getState().ui.collectionViewModes['777']).toBe('table')
    expect(store.getState().ui.collectionIcons['777']).toBe('Bookmark')
    expect(updateUserGroups.mock.calls[1][0]).toEqual([
      {
        ...groups[0],
        collections: [
          groups[0].collections[0],
          {
            id: '777',
            name: 'Saved',
            count: 0,
            icon: 'Bookmark',
            groupId: 'group-0',
            color: '#123456',
          },
        ],
      },
    ])
  })

  test('creates a real destination group for an account containing only orphan collections', async () => {
    // Arrange
    const updateUserGroups = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHookWithProviders(() =>
      useMainAppCollectionEditor([groups[1]], {
        createCollection: vi.fn(),
        updateCollection: vi.fn(),
        updateUserGroups,
        merge: vi.fn(),
      }),
    )

    // Act
    await act(async () =>
      result.current.handleSaveCollection({ ...form, id: '101' }),
    )

    // Assert
    expect(updateUserGroups).toHaveBeenCalledWith([
      {
        id: 'new-collections',
        name: 'Collections',
        collections: [
          {
            id: '101',
            name: 'Saved',
            count: 0,
            icon: 'Bookmark',
            groupId: 'new-collections',
            color: '#123456',
          },
        ],
      },
    ])
  })

  test('editing a nested collection leaves root group membership unchanged', async () => {
    // Arrange
    const updateUserGroups = vi.fn()
    const updateCollection = vi.fn()
    const { result } = renderHookWithProviders(() =>
      useMainAppCollectionEditor(groups, {
        createCollection: vi.fn(),
        updateCollection,
        updateUserGroups,
        merge: vi.fn(),
      }),
    )

    // Act
    await act(async () =>
      result.current.handleSaveCollection({
        ...form,
        id: '102',
        parentId: '100',
      }),
    )

    // Assert
    expect(updateUserGroups).not.toHaveBeenCalled()
    expect(updateCollection).toHaveBeenCalledWith('102', {
      title: 'Saved',
      color: '#123456',
      isPublic: false,
      parentId: '100',
    })
  })

  test('removing the final real group retains all its roots without persisting the synthetic group', async () => {
    // Arrange
    const updateUserGroups = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHookWithProviders(() =>
      useMainAppGroupEditor(groups, updateUserGroups),
    )

    // Act
    await act(async () => result.current.handleDeleteGroup('group-0'))

    // Assert
    expect(updateUserGroups).toHaveBeenCalledWith([
      {
        id: 'new-recovered',
        name: 'Collections',
        collections: [groups[0].collections[0]],
      },
    ])
    expect(groups[0].collections[0].id).toBe('100')
  })

  test('does not expose rename or delete operations for the synthetic visibility group', async () => {
    // Arrange
    const updateUserGroups = vi.fn()
    const { result } = renderHookWithProviders(() =>
      useMainAppGroupEditor(groups, updateUserGroups),
    )

    // Act
    act(() => result.current.handleEditGroup(groups[1]))
    await act(async () => {
      await result.current.handleDeleteGroup('ungrouped')
      await expect(
        result.current.handleSaveGroup({
          id: 'ungrouped',
          name: 'Renamed',
          collapsed: false,
        }),
      ).rejects.toThrow('Choose a saved group')
    })

    // Assert
    expect(result.current.isGroupDialogOpen).toBe(false)
    expect(updateUserGroups).not.toHaveBeenCalled()
  })

  test('failed group rename retains the current editor and propagates an actionable error', async () => {
    // Arrange
    const updateUserGroups = vi
      .fn()
      .mockRejectedValue(new Error('Retry group save'))
    const { result } = renderHookWithProviders(() =>
      useMainAppGroupEditor(groups, updateUserGroups),
    )
    act(() => result.current.handleEditGroup(groups[0]))

    // Act / Assert
    await act(async () => {
      await expect(
        result.current.handleSaveGroup({
          id: 'group-0',
          name: 'Renamed',
          collapsed: true,
        }),
      ).rejects.toThrow('Retry group save')
    })
    expect(result.current.isGroupDialogOpen).toBe(true)
    expect(result.current.editingGroup?.name).toBe('Work')
  })
})

describe('navigation and async selection', () => {
  test('collection view overrides leave the global default intact and clearing them restores that default', () => {
    // Arrange
    const { result, store } = renderHookWithProviders(() =>
      useMainAppView(groups),
    )
    act(() => result.current.handleSelectCollection('101'))
    act(() => result.current.handleCollectionViewModeOverrideChange(true))

    // Act
    act(() => result.current.handleViewModeChange('table'))

    // Assert
    expect(result.current.effectiveViewMode).toBe('table')
    expect(store.getState().settings.defaultViewMode).toBe('list')
    expect(result.current.breadcrumbs).toEqual(['Other collections', 'Orphan'])
    act(() => result.current.handleCollectionViewModeOverrideChange(false))
    expect(result.current.effectiveViewMode).toBe('list')
  })

  test('partial bulk failure clears only confirmed items and preserves unfinished selections', async () => {
    // Arrange
    const operations = {
      raindrops: [first, second],
      createRaindrop: vi.fn(),
      updateRaindrop: vi.fn(),
      batchMoveToCollection: vi.fn(),
      batchAddTag: vi.fn(),
      batchDeleteRaindrops: vi
        .fn()
        .mockRejectedValue(
          new PartialBookmarkBatchError(['1'], ['2'], new Error('Offline')),
        ),
    }
    const { result, store } = renderHookWithProviders(() =>
      useMainAppBookmarkActions(operations),
    )
    act(() => store.dispatch(setSelectedRaindropIds(['1', '2'])))

    // Act
    await act(async () => {
      await expect(
        result.current.handleBatchDelete(['1', '2']),
      ).rejects.toThrow('1 remain')
    })

    // Assert
    expect(store.getState().ui.selectedRaindropIds).toEqual(['2'])
  })

  test('completion of an older bulk action does not clear a newly selected bookmark', async () => {
    // Arrange
    let release = (): void => {}
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const operations = {
      raindrops: [first, second],
      createRaindrop: vi.fn(),
      updateRaindrop: vi.fn(),
      batchMoveToCollection: vi.fn(),
      batchAddTag: vi.fn().mockReturnValue(pending),
      batchDeleteRaindrops: vi.fn(),
    }
    const { result, store } = renderHookWithProviders(() =>
      useMainAppBookmarkActions(operations),
    )
    act(() => store.dispatch(setSelectedRaindropIds(['1'])))
    let saving = Promise.resolve()

    // Act
    act(() => {
      saving = result.current.handleBatchAddTag(['1'], ['work'])
    })
    act(() => store.dispatch(setSelectedRaindropIds(['1', '2'])))
    await act(async () => {
      release()
      await saving
    })

    // Assert
    expect(store.getState().ui.selectedRaindropIds).toEqual(['2'])
  })
})
