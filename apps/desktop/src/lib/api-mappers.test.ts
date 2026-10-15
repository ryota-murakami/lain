import { describe, test, expect } from 'vitest'

import type {
  Raindrop as ApiRaindrop,
  Collection as ApiCollection,
  User as ApiUser,
} from '@/store/api/raindropApi'

import {
  collectionIdToApi,
  collectionIdToUi,
  mapSortOptionToApi,
  toUiRaindrop,
  toApiRaindropCreate,
  toApiRaindropUpdate,
  toUiGroups,
  toUiSystemCollections,
} from './api-mappers'

describe('collectionIdToApi', () => {
  test('maps special UI IDs to API numeric IDs', () => {
    expect(collectionIdToApi('all')).toBe(0)
    expect(collectionIdToApi('unsorted')).toBe(-1)
    expect(collectionIdToApi('trash')).toBe(-99)
  })

  test('converts numeric string IDs', () => {
    expect(collectionIdToApi('42')).toBe(42)
    expect(collectionIdToApi('100')).toBe(100)
  })
})

describe('collectionIdToUi', () => {
  test('maps special API numeric IDs to UI strings', () => {
    expect(collectionIdToUi(0)).toBe('all')
    expect(collectionIdToUi(-1)).toBe('unsorted')
    expect(collectionIdToUi(-99)).toBe('trash')
  })

  test('converts numeric IDs to strings', () => {
    expect(collectionIdToUi(42)).toBe('42')
    expect(collectionIdToUi(100)).toBe('100')
  })
})

describe('mapSortOptionToApi', () => {
  test('maps all UI sort options to API sort params', () => {
    expect(mapSortOptionToApi('newest')).toBe('-created')
    expect(mapSortOptionToApi('oldest')).toBe('created')
    expect(mapSortOptionToApi('title-asc')).toBe('title')
    expect(mapSortOptionToApi('title-desc')).toBe('-title')
    expect(mapSortOptionToApi('domain')).toBe('domain')
    expect(mapSortOptionToApi('relevance')).toBe('score')
  })
})

describe('toUiRaindrop', () => {
  const fullApiRaindrop: ApiRaindrop = {
    _id: 1,
    title: 'React Docs',
    link: 'https://react.dev',
    excerpt: 'The library for web UIs',
    type: 'article',
    cover: 'https://react.dev/og.png',
    tags: ['react', 'docs'],
    created: '2024-01-15T00:00:00.000Z',
    lastUpdate: '2024-02-01T00:00:00.000Z',
    collection: { $id: 100 },
    note: 'Great resource',
    highlights: [{ _id: 'h1', text: 'highlighted text', note: '', color: '' }],
  }

  test('maps all fields correctly', () => {
    const result = toUiRaindrop(fullApiRaindrop)

    expect(result.id).toBe('1')
    expect(result.title).toBe('React Docs')
    expect(result.url).toBe('https://react.dev')
    expect(result.description).toBe('The library for web UIs')
    expect(result.type).toBe('article')
    expect(result.coverImage).toBe('https://react.dev/og.png')
    expect(result.domain).toBe('react.dev')
    expect(result.tags).toEqual(['react', 'docs'])
    expect(result.createdAt).toBe('2024-01-15T00:00:00.000Z')
    expect(result.updatedAt).toBe('2024-02-01T00:00:00.000Z')
    expect(result.collectionId).toBe('100')
    expect(result.isImportant).toBe(false)
    expect(result.notes).toBe('Great resource')
    expect(result.highlights).toEqual(['highlighted text'])
  })

  test('handles missing optional fields gracefully', () => {
    const minimal: ApiRaindrop = { _id: 2 }
    const result = toUiRaindrop(minimal)

    expect(result.id).toBe('2')
    expect(result.title).toBe('')
    expect(result.url).toBe('')
    expect(result.type).toBe('link')
    expect(result.description).toBeUndefined()
    expect(result.coverImage).toBeUndefined()
    expect(result.domain).toBeUndefined()
    expect(result.tags).toEqual([])
    expect(result.collectionId).toBe('all')
    expect(result.isImportant).toBe(false)
    expect(result.highlights).toEqual([])
  })

  test('maps important flag correctly', () => {
    const important: ApiRaindrop = {
      ...fullApiRaindrop,
      important: true,
    } as ApiRaindrop & { important: boolean }
    const result = toUiRaindrop(important)
    expect(result.isImportant).toBe(true)
  })

  test('extracts domain from various URL formats', () => {
    expect(
      toUiRaindrop({ ...fullApiRaindrop, link: 'https://docs.github.com/en' })
        .domain,
    ).toBe('docs.github.com')
    expect(
      toUiRaindrop({ ...fullApiRaindrop, link: 'http://localhost:3000' })
        .domain,
    ).toBe('localhost')
  })
})

describe('toApiRaindropCreate', () => {
  test('maps form data to API create shape', () => {
    const result = toApiRaindropCreate({
      url: 'https://react.dev',
      title: 'React',
      description: 'UI library',
      collectionId: '100',
      tags: ['react'],
      isImportant: true,
      type: 'article',
      notes: 'Check this out',
    })

    expect(result.link).toBe('https://react.dev')
    expect(result.title).toBe('React')
    expect(result.excerpt).toBe('UI library')
    expect(result.collection).toEqual({ $id: 100 })
    expect(result.tags).toEqual(['react'])
    expect(result.important).toBe(true)
    expect(result.type).toBe('article')
    expect(result.note).toBe('Check this out')
  })

  test('handles minimal form data (URL only)', () => {
    const result = toApiRaindropCreate({ url: 'https://example.com' })

    expect(result.link).toBe('https://example.com')
    expect(result.title).toBeUndefined()
    expect(result.collection).toBeUndefined()
  })

  test('maps special collection IDs correctly', () => {
    const result = toApiRaindropCreate({
      url: 'https://example.com',
      collectionId: 'unsorted',
    })
    expect(result.collection).toEqual({ $id: -1 })
  })
})

describe('toApiRaindropUpdate', () => {
  test('includes only defined fields', () => {
    const result = toApiRaindropUpdate({
      title: 'Updated Title',
      isImportant: true,
    })

    expect(result.title).toBe('Updated Title')
    expect(result.important).toBe(true)
    expect(result.link).toBeUndefined()
    expect(result.excerpt).toBeUndefined()
    expect(result.tags).toBeUndefined()
  })

  test('maps url to link', () => {
    const result = toApiRaindropUpdate({ url: 'https://new-url.com' })
    expect(result.link).toBe('https://new-url.com')
  })

  test('maps collectionId to collection.$id', () => {
    const result = toApiRaindropUpdate({ collectionId: '42' })
    expect(result.collection).toEqual({ $id: 42 })
  })

  test('returns empty object when no fields provided', () => {
    const result = toApiRaindropUpdate({})
    expect(result).toEqual({})
  })
})

describe('toUiGroups', () => {
  const user: ApiUser = {
    _id: 1,
    groups: [
      { title: 'Work', hidden: false, sort: 0, collections: [100, 101] },
      { title: 'Personal', hidden: false, sort: 1, collections: [200] },
    ],
  }

  const rootCollections: ApiCollection[] = [
    { _id: 100, title: 'Development', count: 45, sort: 0 },
    { _id: 101, title: 'Design', count: 23, color: '#ff6b6b', sort: 1 },
    { _id: 200, title: 'Reading', count: 12, sort: 0 },
  ]

  const childCollections: ApiCollection[] = [
    {
      _id: 300,
      title: 'React',
      count: 15,
      parent: { $id: 100 },
      sort: 0,
    },
    {
      _id: 301,
      title: 'TypeScript',
      count: 10,
      parent: { $id: 100 },
      sort: 1,
    },
  ]

  test('reconstructs group tree with nested collections', () => {
    const groups = toUiGroups(user, rootCollections, childCollections)

    expect(groups).toHaveLength(2)
    expect(groups[0].name).toBe('Work')
    expect(groups[0].collections).toHaveLength(2)
    expect(groups[1].name).toBe('Personal')
    expect(groups[1].collections).toHaveLength(1)
  })

  test('nests child collections under parents', () => {
    const groups = toUiGroups(user, rootCollections, childCollections)
    const devCollection = groups[0].collections[0]

    expect(devCollection.name).toBe('Development')
    expect(devCollection.children).toHaveLength(2)
    expect(devCollection.children![0].name).toBe('React')
    expect(devCollection.children![1].name).toBe('TypeScript')
  })

  test('preserves collection metadata', () => {
    const groups = toUiGroups(user, rootCollections, childCollections)
    const designCollection = groups[0].collections[1]

    expect(designCollection.id).toBe('101')
    expect(designCollection.color).toBe('#ff6b6b')
    expect(designCollection.count).toBe(23)
    expect(designCollection.children).toBeUndefined()
  })

  test('handles empty groups', () => {
    const emptyUser: ApiUser = {
      _id: 1,
      groups: [{ title: 'Empty', collections: [] }],
    }
    const groups = toUiGroups(emptyUser, rootCollections, childCollections)

    expect(groups).toHaveLength(1)
    expect(groups[0].collections).toHaveLength(0)
  })

  test('skips hidden groups', () => {
    const userWithHidden: ApiUser = {
      _id: 1,
      groups: [
        { title: 'Visible', hidden: false, sort: 0, collections: [100] },
        { title: 'Hidden', hidden: true, sort: 1, collections: [101] },
      ],
    }
    const groups = toUiGroups(userWithHidden, rootCollections, childCollections)
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Visible')
  })

  test('handles missing collections gracefully', () => {
    const userWithMissing: ApiUser = {
      _id: 1,
      groups: [{ title: 'Group', collections: [100, 999] }],
    }
    const groups = toUiGroups(
      userWithMissing,
      rootCollections,
      childCollections,
    )
    // Collection 999 doesn't exist, should be filtered out
    expect(groups[0].collections).toHaveLength(1)
    expect(groups[0].collections[0].name).toBe('Development')
  })

  test('handles user with no groups', () => {
    const noGroupsUser: ApiUser = { _id: 1 }
    const groups = toUiGroups(noGroupsUser, rootCollections, childCollections)
    expect(groups).toHaveLength(0)
  })

  test('sorts groups by sort field', () => {
    const unsortedUser: ApiUser = {
      _id: 1,
      groups: [
        { title: 'Second', sort: 2, collections: [200] },
        { title: 'First', sort: 0, collections: [100] },
      ],
    }
    const groups = toUiGroups(unsortedUser, rootCollections, childCollections)
    expect(groups[0].name).toBe('First')
    expect(groups[1].name).toBe('Second')
  })
})

describe('toUiSystemCollections', () => {
  test('aggregates total count from all root collections', () => {
    const collections: ApiCollection[] = [
      { _id: 100, count: 45 },
      { _id: 101, count: 23 },
    ]
    const result = toUiSystemCollections(collections)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      id: 'all',
      name: 'All Bookmarks',
      icon: 'Inbox',
      count: 68,
    })
    expect(result[1]).toEqual({
      id: 'unsorted',
      name: 'Unsorted',
      icon: 'FileQuestion',
      count: 0,
    })
    expect(result[2]).toEqual({
      id: 'trash',
      name: 'Trash',
      icon: 'Trash2',
      count: 0,
    })
  })

  test('handles empty collections', () => {
    const result = toUiSystemCollections([])
    expect(result[0].count).toBe(0)
  })
})
