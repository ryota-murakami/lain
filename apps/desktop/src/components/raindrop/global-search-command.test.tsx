import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { Collection, Raindrop } from '@/lib/types'
import { renderWithProviders } from '@test/render-with-providers'

import { GlobalSearchCommand } from './global-search-command'

const BOOKMARKS: Raindrop[] = Array.from({ length: 25 }, (_, index) => ({
  id: String(index + 1),
  title: `Bookmark ${index + 1}`,
  url: `https://example.com/${index + 1}`,
  type: 'link',
  domain: 'example.com',
  tags: [],
  createdAt: '',
  updatedAt: '',
  collectionId: '300',
}))
const COLLECTIONS: Collection[] = [
  {
    id: '100',
    name: 'Work',
    icon: 'Folder',
    count: 25,
    groupId: 'work',
    children: [
      {
        id: '200',
        name: 'Development',
        icon: 'Folder',
        count: 25,
        groupId: 'work',
        children: [
          {
            id: '300',
            name: 'Deep reading',
            icon: 'Folder',
            count: 25,
            groupId: 'work',
          },
        ],
      },
    ],
  },
]

/** Render the palette with a real Redux store and configurable query/history. */
function renderSearch(query = 'Bookmark', recentSearches: string[] = []) {
  const props = {
    raindrops: BOOKMARKS,
    open: true,
    onOpenChange: vi.fn(),
    onSelectRaindrop: vi.fn(),
    totalCount: 80,
    hasMore: true,
    onLoadMore: vi.fn(),
    collections: COLLECTIONS,
    currentCollectionId: '300',
  }
  return {
    props,
    ...renderWithProviders(<GlobalSearchCommand {...props} />, {
      preloadedState: {
        search: {
          query,
          recentSearches,
          scope: 'all',
          mode: 'scoped',
          isSearchOpen: true,
        },
      },
    }),
  }
}

describe('global bookmark search', () => {
  test('all 25 loaded matches remain selectable and expose the remaining API result count', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderSearch()

    // Act
    await user.click(screen.getByRole('option', { name: /Load more results/ }))

    // Assert
    expect(screen.getByText('Results (25 loaded of 80)')).toBeVisible()
    expect(screen.getByRole('option', { name: /Bookmark 25/ })).toBeVisible()
    expect(props.onLoadMore).toHaveBeenCalledOnce()
  })

  test('selecting a result opens that bookmark, records the query, and clears the search input', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props, store } = renderSearch()

    // Act
    await user.click(screen.getByRole('option', { name: /Bookmark 25/ }))

    // Assert
    expect(props.onSelectRaindrop).toHaveBeenCalledWith(
      expect.objectContaining({ id: '25', title: 'Bookmark 25' }),
    )
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
    expect(store.getState().search.recentSearches).toEqual(['Bookmark'])
    expect(store.getState().search.query).toBe('')
  })

  test('deeply nested collection scope can switch to searching everywhere', async () => {
    // Arrange
    const user = userEvent.setup()
    const { store } = renderSearch()
    expect(
      screen.getByPlaceholderText('Search in Deep reading... (⌘K)'),
    ).toBeVisible()

    // Act
    await user.click(screen.getByRole('button', { name: 'Search everywhere' }))

    // Assert
    expect(store.getState().search.mode).toBe('global')
    expect(
      screen.getByPlaceholderText('Search all bookmarks... (⌘K)'),
    ).toBeVisible()
  })

  test('reusing and clearing recent searches update the same persisted search state', async () => {
    // Arrange
    const user = userEvent.setup()
    const { store } = renderSearch('', ['Bookmark'])

    // Act
    await user.click(screen.getByRole('option', { name: 'Bookmark' }))
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    await user.click(
      screen.getByRole('button', { name: 'Clear recent searches' }),
    )

    // Assert
    expect(store.getState().search.query).toBe('')
    expect(store.getState().search.recentSearches).toEqual([])
  })
})
