import { describe, expect, test } from 'vitest'

import type { Collection } from '@/lib/types'

import { findCollectionInTree } from './find-collection-in-tree'

const REACT: Collection = {
  id: '200',
  name: 'React',
  icon: 'Folder',
  count: 8,
  groupId: 'group-0',
  parentId: '100',
}
const DEVELOPMENT: Collection = {
  id: '100',
  name: 'Development',
  icon: 'Folder',
  count: 20,
  groupId: 'group-0',
  children: [REACT],
}
const DESIGN: Collection = {
  id: '101',
  name: 'Design',
  icon: 'Palette',
  count: 15,
  groupId: 'group-0',
}

describe('findCollectionInTree', () => {
  test('finds a nested child collection by id', () => {
    // Arrange
    const roots = [DEVELOPMENT, DESIGN]

    // Act
    const found = findCollectionInTree(roots, '200')

    // Assert
    expect(found).toBe(REACT)
  })

  test('returns undefined for system ids that are not part of the tree', () => {
    // Arrange
    const roots = [DEVELOPMENT, DESIGN]

    // Act
    const found = findCollectionInTree(roots, 'unsorted')

    // Assert
    expect(found).toBeUndefined()
  })
})
