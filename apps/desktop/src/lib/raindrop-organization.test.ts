import { describe, expect, test } from 'vitest'

import {
  getRaindropDndId,
  parseRaindropDndId,
  reorderRaindrops,
  resolveDraggedRaindropIds,
} from './raindrop-organization'

describe('raindrop-organization', () => {
  test('round-trips a bookmark id through its dnd-kit id', () => {
    // Arrange
    const dndId = getRaindropDndId('42')

    // Act
    const parsed = parseRaindropDndId(dndId)

    // Assert
    expect(dndId).toBe('raindrop:42')
    expect(parsed).toBe('42')
  })

  test('does not mistake a collection or group id for a bookmark', () => {
    // Arrange / Act / Assert
    expect(parseRaindropDndId('collection:100')).toBeNull()
    expect(parseRaindropDndId('group:group-0')).toBeNull()
    expect(parseRaindropDndId(7)).toBeNull()
  })

  test('drags the whole selection when the grabbed bookmark is selected', () => {
    // Arrange
    const selected = new Set(['1', '2', '3'])

    // Act
    const dragged = resolveDraggedRaindropIds('2', selected)

    // Assert
    expect(dragged).toEqual(['1', '2', '3'])
  })

  test('drags only the grabbed bookmark when it is outside the selection', () => {
    // Arrange
    const selected = new Set(['1', '2'])

    // Act
    const dragged = resolveDraggedRaindropIds('9', selected)

    // Assert
    expect(dragged).toEqual(['9'])
  })

  test('moves the dragged bookmark to the slot of the one it was dropped on', () => {
    // Arrange
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

    // Act
    const movedUp = reorderRaindrops(items, 'c', 'a')
    const movedDown = reorderRaindrops(items, 'a', 'c')

    // Assert
    expect(movedUp.map((item) => item.id)).toEqual(['c', 'a', 'b'])
    expect(movedDown.map((item) => item.id)).toEqual(['b', 'c', 'a'])
    expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  test('returns the same list when the drop changes nothing', () => {
    // Arrange
    const items = [{ id: 'a' }, { id: 'b' }]

    // Act / Assert — same slot, unknown source, unknown target
    expect(reorderRaindrops(items, 'a', 'a')).toBe(items)
    expect(reorderRaindrops(items, 'zzz', 'a')).toBe(items)
    expect(reorderRaindrops(items, 'a', 'zzz')).toBe(items)
  })
})
