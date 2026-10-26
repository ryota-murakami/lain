import { describe, expect, test } from 'vitest'

import type { Collection, Group } from '@/lib/types'

import {
  findRootCollectionLocation,
  moveRootCollection,
  parseCollectionId,
  reorderRootCollectionInGroup,
  toUserGroupPayload,
  updateRootCollection,
} from './collection-organization'

/**
 * Build a minimal root collection for organization tests.
 * @param id - Collection ID
 * @param name - Collection name
 * @param groupId - Parent group ID
 * @returns Collection test object
 */
function buildCollection(
  id: string,
  name: string,
  groupId: string,
): Collection {
  return {
    id,
    name,
    icon: 'Folder',
    count: 0,
    groupId,
  }
}

/**
 * Build test groups with deterministic ordering.
 * @returns Two groups with three root collections total
 */
function buildGroups(): Group[] {
  return [
    {
      id: 'group-0',
      name: 'Development',
      collections: [
        buildCollection('100', 'Development', 'group-0'),
        buildCollection('102', 'Research', 'group-0'),
      ],
    },
    {
      id: 'group-1',
      name: 'Creative',
      collections: [buildCollection('101', 'Design', 'group-1')],
    },
  ]
}

describe('collection-organization', () => {
  test('finds root collection location by id', () => {
    const groups = buildGroups()
    expect(findRootCollectionLocation(groups, '102')).toEqual({
      groupId: 'group-0',
      index: 1,
    })
    expect(findRootCollectionLocation(groups, '999')).toBeNull()
  })

  test('moves root collection between groups', () => {
    const groups = buildGroups()
    const next = moveRootCollection(groups, '102', 'group-1', 1)

    expect(next[0].collections.map((collection) => collection.id)).toEqual([
      '100',
    ])
    expect(next[1].collections.map((collection) => collection.id)).toEqual([
      '101',
      '102',
    ])
    expect(next[1].collections[1].groupId).toBe('group-1')
  })

  test('reorders root collections within one group', () => {
    const groups = buildGroups()
    const next = reorderRootCollectionInGroup(groups, 'group-0', 0, 1)

    expect(next[0].collections.map((collection) => collection.id)).toEqual([
      '102',
      '100',
    ])
    expect(next[1].collections.map((collection) => collection.id)).toEqual([
      '101',
    ])
  })

  test('updates a root collection immutably', () => {
    const groups = buildGroups()
    const next = updateRootCollection(groups, '101', (collection) => ({
      ...collection,
      name: 'Design System',
      color: '#3b82f6',
    }))

    expect(next[1].collections[0].name).toBe('Design System')
    expect(next[1].collections[0].color).toBe('#3b82f6')
    expect(groups[1].collections[0].name).toBe('Design')
  })

  test('builds ordered user group payload for persistence', () => {
    const groups = buildGroups()
    const payload = toUserGroupPayload(groups)

    expect(payload).toEqual([
      {
        title: 'Development',
        hidden: false,
        sort: 0,
        collections: [100, 102],
      },
      {
        title: 'Creative',
        hidden: false,
        sort: 1,
        collections: [101],
      },
    ])
  })

  test('returns null for empty collection ids', () => {
    expect(parseCollectionId('')).toBeNull()
    expect(parseCollectionId('   ')).toBeNull()
  })
})
