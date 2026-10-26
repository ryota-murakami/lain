import { ACTION_HYDRATE_COMPLETE } from '@laststance/redux-storage-middleware'
import { combineReducers } from '@reduxjs/toolkit'
import { describe, expect, test } from 'vitest'

import { withEphemeralUiReset } from './persistence'
import { setSelectedCollectionId, uiSlice } from './slices/uiSlice'

const rootReducer = combineReducers({ ui: uiSlice.reducer })
type State = ReturnType<typeof rootReducer>

/** Mimics the storage middleware: hydration replaces the whole state with the payload. */
const hydratedReducer = (
  state: State | undefined,
  action: { type: string; payload?: State },
) =>
  action.type === ACTION_HYDRATE_COMPLETE && action.payload
    ? action.payload
    : rootReducer(state, action)

describe('withEphemeralUiReset', () => {
  test('starts on All Bookmarks after hydration even if another collection was persisted', () => {
    // Arrange
    const reducer = withEphemeralUiReset(hydratedReducer)
    const fresh = reducer(undefined, { type: '@@INIT' })
    const persisted: State = {
      ui: {
        ...fresh.ui,
        viewMode: 'grid',
        sidebarWidth: 320,
        collectionViewModes: { '42': 'table' },
        selectedCollectionId: 'unsorted',
        selectedRaindropIds: ['1', '2'],
        isDetailPanelOpen: true,
      },
    }

    // Act
    const next = reducer(fresh, {
      type: ACTION_HYDRATE_COMPLETE,
      payload: persisted,
    })

    // Assert — ephemeral fields reset, preferences kept
    expect(next.ui.selectedCollectionId).toBe('all')
    expect(next.ui.selectedRaindropIds).toEqual([])
    expect(next.ui.isDetailPanelOpen).toBe(false)
    expect(next.ui.viewMode).toBe('grid')
    expect(next.ui.sidebarWidth).toBe(320)
    expect(next.ui.collectionViewModes).toEqual({ '42': 'table' })
  })

  test('keeps the collection the user selects during the session', () => {
    // Arrange
    const reducer = withEphemeralUiReset(hydratedReducer)
    const fresh = reducer(undefined, { type: '@@INIT' })

    // Act
    const next = reducer(fresh, setSelectedCollectionId('unsorted'))

    // Assert — only hydration resets the selection, normal actions pass through
    expect(next.ui.selectedCollectionId).toBe('unsorted')
  })
})
