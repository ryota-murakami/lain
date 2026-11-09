import { describe, expect, test } from 'vitest'

import type { Collection, Raindrop } from '@/lib/types'

import { buildDirectoryTree } from './build-directory-tree'

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
const ROOTS = [DEVELOPMENT, DESIGN]

/**
 * Minimal raindrop for tree-building tests.
 * @param id - Raindrop id
 * @param collectionId - Owning collection id
 * @returns Raindrop with placeholder metadata
 * @example makeRaindrop('1', '100') // => { id: '1', collectionId: '100', ... }
 */
function makeRaindrop(id: string, collectionId: string): Raindrop {
  return {
    id,
    title: `Bookmark ${id}`,
    url: `https://example.com/${id}`,
    type: 'link',
    tags: [],
    createdAt: '2026-02-08T10:00:00Z',
    updatedAt: '2026-02-08T10:00:00Z',
    collectionId,
  }
}

describe('buildDirectoryTree', () => {
  test('hangs raindrops off root and nested collections in the All Bookmarks scope', () => {
    // Arrange
    const raindrops = [
      makeRaindrop('1', '100'),
      makeRaindrop('2', '200'),
      makeRaindrop('3', '101'),
    ]

    // Act
    const tree = buildDirectoryTree({
      collections: ROOTS,
      raindrops,
      selectedCollectionId: 'all',
      currentCollectionName: 'All Bookmarks',
    })

    // Assert
    expect(tree.collections).toEqual([DEVELOPMENT, DESIGN])
    expect(tree.raindropsByCollection).toEqual({
      '100': [raindrops[0]],
      '200': [raindrops[1]],
      '101': [raindrops[2]],
    })
  })

  test('adds an Unsorted folder after the roots for raindrops outside the tree', () => {
    // Arrange
    const raindrops = [makeRaindrop('1', '100'), makeRaindrop('9', '-1')]

    // Act
    const tree = buildDirectoryTree({
      collections: ROOTS,
      raindrops,
      selectedCollectionId: 'all',
      currentCollectionName: 'All Bookmarks',
    })

    // Assert
    expect(tree.collections.map((c) => c.name)).toEqual([
      'Development',
      'Design',
      'Unsorted',
    ])
    expect(tree.collections[2]).toEqual({
      id: '-1',
      name: 'Unsorted',
      icon: 'Folder',
      count: 1,
      groupId: 'system',
    })
    expect(tree.raindropsByCollection['-1']).toEqual([raindrops[1]])
  })

  test('renders only the selected collection subtree when scoped', () => {
    // Arrange
    const raindrops = [makeRaindrop('3', '101')]

    // Act
    const tree = buildDirectoryTree({
      collections: ROOTS,
      raindrops,
      selectedCollectionId: '101',
      currentCollectionName: 'Design',
    })

    // Assert
    expect(tree.collections).toEqual([DESIGN])
    expect(tree.raindropsByCollection).toEqual({ '101': raindrops })
  })

  test('labels out-of-scope search hits with their real collection name', () => {
    // Arrange — global search from inside Design returned a Development bookmark
    const raindrops = [makeRaindrop('3', '101'), makeRaindrop('1', '100')]

    // Act
    const tree = buildDirectoryTree({
      collections: ROOTS,
      raindrops,
      selectedCollectionId: '101',
      currentCollectionName: 'Design',
    })

    // Assert
    expect(tree.collections.map((c) => c.name)).toEqual([
      'Design',
      'Development',
    ])
    expect(tree.collections[1].children).toBeUndefined()
    expect(tree.raindropsByCollection['100']).toEqual([raindrops[1]])
  })

  test('shows a single folder named after the system collection for Unsorted', () => {
    // Arrange — API returns Unsorted raindrops with collection id -1
    const raindrops = [makeRaindrop('9', '-1'), makeRaindrop('10', '-1')]

    // Act
    const tree = buildDirectoryTree({
      collections: ROOTS,
      raindrops,
      selectedCollectionId: 'unsorted',
      currentCollectionName: 'Unsorted',
    })

    // Assert
    expect(tree.collections).toEqual([
      {
        id: 'unsorted',
        name: 'Unsorted',
        icon: 'Folder',
        count: 2,
        groupId: 'system',
      },
    ])
    expect(tree.raindropsByCollection).toEqual({ unsorted: raindrops })
  })
})

test('Directory scope keeps empty descendants and the API order within each folder', () => {
  // Arrange
  const empty: Collection = {
    id: '300',
    name: 'Empty',
    icon: 'Folder',
    count: 0,
    groupId: 'group-0',
  }
  const selected: Collection = {
    ...DEVELOPMENT,
    children: [{ ...REACT, children: [empty] }],
  }
  const raindrops = [
    makeRaindrop('later', '200'),
    makeRaindrop('earlier', '200'),
  ]
  // Act
  const tree = buildDirectoryTree({
    collections: [selected],
    raindrops,
    selectedCollectionId: '100',
    currentCollectionName: 'Development',
  })
  // Assert
  expect(tree.collections[0].children?.[0].children?.[0].name).toBe('Empty')
  expect(
    tree.raindropsByCollection['200'].map((bookmark) => bookmark.id),
  ).toEqual(['later', 'earlier'])
})

test('global search from Unsorted keeps outside hits under their actual collection', () => {
  // Arrange
  const raindrops = [
    makeRaindrop('unsorted', '-1'),
    makeRaindrop('development', '100'),
  ]
  // Act
  const tree = buildDirectoryTree({
    collections: ROOTS,
    raindrops,
    selectedCollectionId: 'unsorted',
    currentCollectionName: 'Unsorted',
  })
  // Assert
  expect(tree.collections.map((collection) => collection.name)).toEqual([
    'Unsorted',
    'Development',
  ])
  expect(tree.collections.map((collection) => collection.count)).toEqual([1, 1])
  expect(
    tree.raindropsByCollection.unsorted.map((bookmark) => bookmark.id),
  ).toEqual(['unsorted'])
  expect(
    tree.raindropsByCollection['100'].map((bookmark) => bookmark.id),
  ).toEqual(['development'])
})

test('Directory recovers cyclic and repeated collection edges without modifying API input', () => {
  // Arrange
  const root: Collection = { ...DEVELOPMENT, children: [] }
  const child: Collection = { ...REACT, children: [root] }
  root.children = [child, child]
  // Act
  const tree = buildDirectoryTree({
    collections: [root],
    raindrops: [],
    selectedCollectionId: 'all',
    currentCollectionName: 'All',
  })
  // Assert
  expect(tree.collections).toHaveLength(1)
  expect(tree.collections[0].children).toHaveLength(1)
  expect(tree.collections[0].children?.[0].children).toEqual([])
  expect(root.children).toHaveLength(2)
  expect(child.children?.[0]).toBe(root)
})

test('Directory preserves first-seen orphan folder order for numeric collection IDs', () => {
  // Arrange
  const raindrops = [
    makeRaindrop('first', '999'),
    makeRaindrop('second', '888'),
  ]
  // Act
  const tree = buildDirectoryTree({
    collections: [],
    raindrops,
    selectedCollectionId: 'all',
    currentCollectionName: 'All',
  })
  // Assert
  expect(tree.collections.map((collection) => collection.id)).toEqual([
    '999',
    '888',
  ])
  expect(tree.raindropsByCollection['999'][0].id).toBe('first')
})

test('Directory supports collection keys that collide with object prototype names', () => {
  // Arrange
  const raindrops = [
    makeRaindrop('one', '__proto__'),
    makeRaindrop('two', 'constructor'),
  ]
  // Act
  const tree = buildDirectoryTree({
    collections: [],
    raindrops,
    selectedCollectionId: 'all',
    currentCollectionName: 'All',
  })
  // Assert
  expect(tree.collections.map((collection) => collection.id)).toEqual([
    '__proto__',
    'constructor',
  ])
  expect(tree.raindropsByCollection.__proto__[0].id).toBe('one')
  expect(
    Object.entries(tree.raindropsByCollection).map(([key, items]) => [
      key,
      items[0].id,
    ]),
  ).toEqual([
    ['__proto__', 'one'],
    ['constructor', 'two'],
  ])
  expect(tree.collections.map((collection) => collection.name)).toEqual([
    'Other',
    'Other',
  ])
})
