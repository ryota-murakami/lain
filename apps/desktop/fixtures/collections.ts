/**
 * Mock collection fixtures matching Raindrop.io API response shape.
 * 4 root collections + 2 child collections.
 *
 * @example
 *   import { mockCollections, mockChildCollections } from '@fixtures'
 */

interface MockCollection {
  _id: number
  title: string
  parent: { $id: number } | null
  color: string | null
  cover: string[]
  count: number
  expanded: boolean
  sort: number
  view: 'list' | 'simple' | 'grid' | 'masonry'
  access: { level: number; draggable: boolean }
  creatorRef: { _id: number }
}

/** Root-level collections (returned by GET /collections) */
export const mockCollections: MockCollection[] = [
  {
    _id: 100,
    title: 'Development',
    parent: null,
    color: '#4a9eff',
    cover: [],
    count: 20,
    expanded: true,
    sort: 0,
    view: 'list',
    access: { level: 4, draggable: true },
    creatorRef: { _id: 1 },
  },
  {
    _id: 101,
    title: 'Design',
    parent: null,
    color: '#ff6b6b',
    cover: [],
    count: 15,
    expanded: true,
    sort: 1,
    view: 'grid',
    access: { level: 4, draggable: true },
    creatorRef: { _id: 1 },
  },
  {
    _id: 102,
    title: 'Research',
    parent: null,
    color: '#51cf66',
    cover: [],
    count: 12,
    expanded: true,
    sort: 2,
    view: 'list',
    access: { level: 4, draggable: true },
    creatorRef: { _id: 1 },
  },
  {
    _id: 103,
    title: 'Tools & Utilities',
    parent: null,
    color: '#fcc419',
    cover: [],
    count: 13,
    expanded: true,
    sort: 3,
    view: 'list',
    access: { level: 4, draggable: true },
    creatorRef: { _id: 1 },
  },
]

/** Child collections (returned by GET /collections/childrens) */
export const mockChildCollections: MockCollection[] = [
  {
    _id: 200,
    title: 'React',
    parent: { $id: 100 },
    color: '#61dafb',
    cover: [],
    count: 8,
    expanded: false,
    sort: 0,
    view: 'list',
    access: { level: 4, draggable: true },
    creatorRef: { _id: 1 },
  },
  {
    _id: 201,
    title: 'UI/UX',
    parent: { $id: 101 },
    color: '#e64980',
    cover: [],
    count: 5,
    expanded: false,
    sort: 0,
    view: 'grid',
    access: { level: 4, draggable: true },
    creatorRef: { _id: 1 },
  },
]
