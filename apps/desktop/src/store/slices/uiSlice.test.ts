import { describe, expect, test } from 'vitest'

import {
  clearCollectionViewMode,
  getEffectiveViewMode,
  getHasCollectionViewModeOverride,
  setCollectionViewMode,
  setSelectedCollectionId,
  uiSlice,
} from './uiSlice'

/**
 * Run a sequence of actions through the ui reducer from the initial state.
 * @param actions - Actions to apply in order
 * @returns Root-shaped state for the selectors
 * @example reduceUi([setViewMode('grid')]) // => { ui: { viewMode: 'grid', ... } }
 */
function reduceUi(actions: Parameters<typeof uiSlice.reducer>[1][]) {
  const ui = actions.reduce(uiSlice.reducer, uiSlice.getInitialState())
  return { ui }
}

describe('uiSlice per-collection view mode (F3.3)', () => {
  test('a remembered collection uses its own view mode instead of the global default', () => {
    // Arrange
    const state = reduceUi([
      setSelectedCollectionId('101'),
      setCollectionViewMode({ collectionId: '101', viewMode: 'grid' }),
    ])

    // Act
    const effectiveViewMode = getEffectiveViewMode(state)

    // Assert — global default is still 'list'
    expect(effectiveViewMode).toBe('grid')
    expect(state.ui.viewMode).toBe('list')
  })

  test('forgetting a collection falls back to the global view mode', () => {
    // Arrange
    const state = reduceUi([
      setSelectedCollectionId('101'),
      setCollectionViewMode({ collectionId: '101', viewMode: 'grid' }),
      clearCollectionViewMode('101'),
    ])

    // Act
    const effectiveViewMode = getEffectiveViewMode(state)

    // Assert
    expect(effectiveViewMode).toBe('list')
    expect(state.ui.collectionViewModes).toEqual({})
  })

  test('reports whether the selected collection is remembered', () => {
    // Arrange
    const remembered = reduceUi([
      setSelectedCollectionId('101'),
      setCollectionViewMode({ collectionId: '101', viewMode: 'table' }),
    ])
    const other = reduceUi([
      setCollectionViewMode({ collectionId: '101', viewMode: 'table' }),
      setSelectedCollectionId('100'),
    ])

    // Act + Assert
    expect(getHasCollectionViewModeOverride(remembered)).toBe(true)
    expect(getHasCollectionViewModeOverride(other)).toBe(false)
  })
})
