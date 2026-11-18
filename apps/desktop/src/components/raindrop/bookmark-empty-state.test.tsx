import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BookmarkEmptyState } from './bookmark-empty-state'

describe('empty bookmark scope recovery', () => {
  it('offers global search when the current collection has no matching bookmarks', () => {
    // Arrange
    const searchGlobally = vi.fn()
    const clearSearch = vi.fn()
    const add = vi.fn()
    render(
      <BookmarkEmptyState
        searchQuery="React"
        isScopedSearch
        currentCollectionName="Reading"
        handleSearchGlobally={searchGlobally}
        clearSearch={clearSearch}
        onAddBookmark={add}
      />,
    )
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Search everywhere' }))
    // Assert
    expect(
      screen.getByText(
        'No results in Reading. Try searching everywhere or adjust your filters.',
      ),
    ).toBeVisible()
    expect(searchGlobally).toHaveBeenCalledTimes(1)
    expect(clearSearch).not.toHaveBeenCalled()
    expect(add).not.toHaveBeenCalled()
  })

  it('offers clearing the query when global search has no matching bookmarks', () => {
    // Arrange
    const searchGlobally = vi.fn()
    const clearSearch = vi.fn()
    const add = vi.fn()
    render(
      <BookmarkEmptyState
        searchQuery="React"
        isScopedSearch={false}
        currentCollectionName="All Bookmarks"
        handleSearchGlobally={searchGlobally}
        clearSearch={clearSearch}
        onAddBookmark={add}
      />,
    )
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Clear Search' }))
    // Assert
    expect(
      screen.getByText(
        'No results for "React". Try a different search term or clear filters.',
      ),
    ).toBeVisible()
    expect(clearSearch).toHaveBeenCalledTimes(1)
    expect(searchGlobally).not.toHaveBeenCalled()
    expect(add).not.toHaveBeenCalled()
  })

  it('offers creating the first bookmark for an empty collection without a query', () => {
    // Arrange
    const searchGlobally = vi.fn()
    const clearSearch = vi.fn()
    const add = vi.fn()
    render(
      <BookmarkEmptyState
        searchQuery=""
        isScopedSearch
        currentCollectionName="Reading"
        handleSearchGlobally={searchGlobally}
        clearSearch={clearSearch}
        onAddBookmark={add}
      />,
    )
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Add Bookmark' }))
    // Assert
    expect(
      screen.getByText(
        'This collection is empty. Add your first bookmark to get started.',
      ),
    ).toBeVisible()
    expect(add).toHaveBeenCalledTimes(1)
    expect(searchGlobally).not.toHaveBeenCalled()
    expect(clearSearch).not.toHaveBeenCalled()
  })
})
