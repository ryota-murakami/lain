import { afterEach, describe, test, expect } from 'vitest'

import { store, storageApi } from '@/store'

describe('Redux Store', () => {
  test('initializes with correct default state', () => {
    const state = store.getState()

    expect(state.ui.viewMode).toBe('list')
    expect(state.ui.selectedCollectionId).toBe('all')
    expect(state.ui.isDetailPanelOpen).toBe(false)
    expect(state.search.query).toBe('')
    expect(state.search.scope).toBe('all')
    expect(state.dialog.addBookmark.open).toBe(false)
    expect(state.settings.theme).toBe('system')
    expect(state.settings.defaultViewMode).toBe('list')
  })

  test('has RTK Query API reducer registered', () => {
    const state = store.getState()
    expect(state).toHaveProperty('raindropApi')
  })

  describe('localStorage rehydration (SPEC §3.5)', () => {
    afterEach(() => {
      storageApi.clearStorage()
      window.localStorage.clear()
    })

    test('restores the persisted view mode but reopens on All Bookmarks', async () => {
      // Arrange — a previous session that ended on Unsorted in grid view
      const previousSession = {
        version: 0,
        state: {
          ui: {
            ...store.getState().ui,
            viewMode: 'grid',
            selectedCollectionId: 'unsorted',
            selectedRaindropIds: ['1'],
            isDetailPanelOpen: true,
          },
        },
      }
      window.localStorage.setItem('lain-state', JSON.stringify(previousSession))

      // Act
      await storageApi.rehydrate()

      // Assert
      const ui = store.getState().ui
      expect(ui.viewMode).toBe('grid')
      expect(ui.selectedCollectionId).toBe('all')
      expect(ui.selectedRaindropIds).toEqual([])
      expect(ui.isDetailPanelOpen).toBe(false)
    })
  })
})
