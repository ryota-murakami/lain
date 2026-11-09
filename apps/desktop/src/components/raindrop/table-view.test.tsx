import { fireEvent, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import type { Raindrop } from '@/lib/types'
import { renderWithProviders } from '@test/render-with-providers'

import { TableView } from './table-view'

const bookmarks: Raindrop[] = Array.from({ length: 101 }, (_, index) => ({
  id: String(index + 1),
  title: `Bookmark ${String(index + 1).padStart(3, '0')}`,
  url: `https://example.com/${index + 1}`,
  type: 'link',
  tags: [],
  createdAt: '2026-11-01',
  updatedAt: '2026-11-01',
  collectionId: '100',
}))
const sixtyBookmarks = bookmarks.slice(0, 60)
const oneBookmark = bookmarks.slice(0, 1)
const emptyBookmarks: Raindrop[] = []
const otherPageSelection = new Set(
  Array.from({ length: 50 }, (_, index) => String(index + 51)),
)
const allFirstHundred = new Set(
  Array.from({ length: 100 }, (_, index) => String(index + 1)),
)
const apiOrder: Raindrop[] = [
  { ...bookmarks[0], id: 'z', title: 'Zulu' },
  { ...bookmarks[0], id: 'a', title: 'Alpha' },
  { ...bookmarks[0], id: 'm', title: 'Mike' },
]

/** Read the rendered keyboard-navigation row order after a view interaction. */
function visibleIds(container: HTMLElement): (string | null)[] {
  return Array.from(container.querySelectorAll('[data-raindrop-id]'), (row) =>
    row.getAttribute('data-raindrop-id'),
  )
}

test('Table clamps a removed final page to the new last page and remembers it when more items load', () => {
  // Arrange
  const { rerender, container } = renderWithProviders(
    <TableView raindrops={bookmarks} />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Page 3' }))
  expect(visibleIds(container)).toEqual(['101'])
  // Act
  rerender(<TableView raindrops={sixtyBookmarks} />)
  // Assert
  expect(visibleIds(container)).toEqual([
    '51',
    '52',
    '53',
    '54',
    '55',
    '56',
    '57',
    '58',
    '59',
    '60',
  ])
  expect(screen.getByText('Showing 51-60 of 60')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  rerender(<TableView raindrops={bookmarks} />)
  expect(visibleIds(container)[0]).toBe('51')
  expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

test('Table filtering from a later page to one result shows that result immediately', () => {
  // Arrange
  const { rerender } = renderWithProviders(<TableView raindrops={bookmarks} />)
  fireEvent.click(screen.getByRole('button', { name: 'Page 3' }))
  // Act
  rerender(<TableView raindrops={oneBookmark} />)
  // Assert
  expect(screen.getByText('Bookmark 001')).toBeVisible()
  expect(screen.queryByText('No bookmarks to display')).toBeNull()
  expect(screen.getByText('Showing 1-1 of 1')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
})

test('Table recovers from an empty filtered result without returning to the stale old page', () => {
  // Arrange
  const { rerender, container } = renderWithProviders(
    <TableView raindrops={bookmarks} />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Page 3' }))
  // Act
  rerender(<TableView raindrops={emptyBookmarks} />)
  // Assert
  expect(screen.getByText('No bookmarks to display')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
  rerender(<TableView raindrops={bookmarks} />)
  expect(visibleIds(container)[0]).toBe('1')
  expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

test('Table preserves API order until a column sort is chosen and can restore library order', () => {
  // Arrange
  const { container } = renderWithProviders(<TableView raindrops={apiOrder} />)
  expect(visibleIds(container)).toEqual(['z', 'a', 'm'])
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Title' }))
  // Assert
  expect(visibleIds(container)).toEqual(['a', 'm', 'z'])
  expect(screen.getByRole('columnheader', { name: 'Title' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
  expect(
    screen.getByText('Column sorting applies to loaded bookmarks only.'),
  ).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Title' }))
  expect(visibleIds(container)).toEqual(['z', 'm', 'a'])
  fireEvent.click(screen.getByRole('button', { name: 'Use library order' }))
  expect(visibleIds(container)).toEqual(['z', 'a', 'm'])
  expect(screen.getByRole('columnheader', { name: 'Title' })).toHaveAttribute(
    'aria-sort',
    'none',
  )
})

test('Table select-all reflects current page IDs and retains selection on other pages', () => {
  // Arrange
  const onSelectionChange = vi.fn()
  const { rerender } = renderWithProviders(
    <TableView
      raindrops={bookmarks}
      selectedIds={otherPageSelection}
      onSelectionChange={onSelectionChange}
    />,
  )
  expect(screen.getByRole('checkbox', { name: 'Select all' })).not.toBeChecked()
  // Act
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
  // Assert
  expect(onSelectionChange.mock.calls[0][0].size).toBe(100)
  expect(onSelectionChange.mock.calls[0][0].has('1')).toBe(true)
  expect(onSelectionChange.mock.calls[0][0].has('100')).toBe(true)
  rerender(
    <TableView
      raindrops={bookmarks}
      selectedIds={allFirstHundred}
      onSelectionChange={onSelectionChange}
    />,
  )
  expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeChecked()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
  expect(onSelectionChange.mock.calls[1][0].size).toBe(50)
  expect(onSelectionChange.mock.calls[1][0].has('1')).toBe(false)
  expect(onSelectionChange.mock.calls[1][0].has('51')).toBe(true)
})

test('Table modifier-click changes selection while ordinary row clicks still open detail', () => {
  // Arrange
  const onSelectionChange = vi.fn()
  const onSelect = vi.fn()
  const { container } = renderWithProviders(
    <TableView
      raindrops={oneBookmark}
      onSelectionChange={onSelectionChange}
      onSelect={onSelect}
    />,
  )
  const row = container.querySelector('[data-raindrop-id="1"]')!
  // Act
  fireEvent.click(row, { metaKey: true })
  fireEvent.click(row, { ctrlKey: true })
  // Assert
  expect(onSelectionChange).toHaveBeenCalledTimes(2)
  expect(onSelectionChange.mock.calls[0][0].has('1')).toBe(true)
  expect(onSelect).not.toHaveBeenCalled()
  fireEvent.click(row)
  expect(onSelect).toHaveBeenCalledWith(bookmarks[0])
})
