import { DndContext } from '@dnd-kit/core'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { MainContent } from '@/components/raindrop/main-content'
import type { Collection, Raindrop } from '@/lib/types'
import { renderWithProviders } from '@test/render-with-providers'

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

const RAINDROPS: Raindrop[] = [
  {
    id: '1',
    title: 'React Documentation',
    url: 'https://react.dev',
    type: 'link',
    domain: 'react.dev',
    tags: ['react'],
    createdAt: '2026-02-08T10:00:00Z',
    updatedAt: '2026-02-08T10:00:00Z',
    collectionId: '100',
  },
  {
    id: '2',
    title: 'Figma Best Practices',
    url: 'https://figma.com/best-practices',
    type: 'article',
    domain: 'figma.com',
    tags: ['design'],
    createdAt: '2026-02-07T10:00:00Z',
    updatedAt: '2026-02-07T10:00:00Z',
    collectionId: '101',
  },
]

type MainContentProps = React.ComponentProps<typeof MainContent>

/**
 * Render MainContent with the minimum realistic props, overriding what a test cares about.
 * @param overrides - Props to override
 * @returns render result plus the props actually used (for spy assertions)
 * @example renderMainContent({ viewMode: 'table' })
 */
function renderMainContent(overrides: Partial<MainContentProps> = {}) {
  const props: MainContentProps = {
    breadcrumbs: ['All Bookmarks'],
    selectedCollectionId: 'all',
    raindrops: RAINDROPS,
    onSelectRaindrop: vi.fn(),
    selectedRaindropIds: new Set<string>(),
    onSelectedRaindropIdsChange: vi.fn(),
    groups: [
      { id: 'group-0', name: 'Work', collections: [DEVELOPMENT, DESIGN] },
    ],
    collections: [DEVELOPMENT, DESIGN],
    onAddBookmark: vi.fn(),
    sortOption: 'newest',
    onSortChange: vi.fn(),
    searchQuery: '',
    searchScope: 'all',
    searchMode: 'scoped',
    onSearchQueryChange: vi.fn(),
    onSearchScopeChange: vi.fn(),
    onSearchModeChange: vi.fn(),
    onBatchDelete: vi.fn(),
    viewMode: 'list',
    onViewModeChange: vi.fn(),
    hasCollectionViewModeOverride: false,
    onCollectionViewModeOverrideChange: vi.fn(),
    onToggleImportant: vi.fn(),
    onFocusRaindrop: vi.fn(),
    onTogglePreview: vi.fn(),
    ...overrides,
  }
  return {
    ...renderWithProviders(
      <DndContext>
        <MainContent {...props} />
      </DndContext>,
    ),
    props,
  }
}

describe('MainContent view modes (F3)', () => {
  test('table view lists every bookmark as a row with sortable column headers', () => {
    // Arrange + Act
    renderMainContent({ viewMode: 'table' })

    // Assert
    const tableView = screen.getByTestId('table-view')
    expect(tableView).toBeVisible()
    expect(screen.getByRole('button', { name: 'Title' })).toBeVisible()
    expect(screen.getByText('React Documentation')).toBeVisible()
    expect(screen.getByText('Figma Best Practices')).toBeVisible()
    expect(screen.queryByTestId('list-view')).not.toBeInTheDocument()
  })

  test('directory view nests bookmarks under their collection folders', () => {
    // Arrange + Act
    renderMainContent({ viewMode: 'directory' })

    // Assert — folders and their bookmarks are visible in one tree
    expect(screen.getByTestId('directory-view')).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Development\/ \(20\)/ }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Design\/ \(15\)/ }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /React Documentation/ }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Figma Best Practices/ }),
    ).toBeVisible()
  })

  test('table view owns the bulk action bar, so the toolbar bar stays hidden', () => {
    // Arrange + Act
    renderMainContent({
      viewMode: 'table',
      selectedRaindropIds: new Set(['1']),
    })

    // Assert — TableView's own "1 selected" bar is the only one
    expect(screen.getByText('1 selected')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Deselect All' }),
    ).not.toBeInTheDocument()
  })

  test('list view shows the toolbar bulk action bar when items are selected', () => {
    // Arrange + Act
    renderMainContent({
      viewMode: 'list',
      selectedRaindropIds: new Set(['1']),
    })

    // Assert
    expect(screen.getByText('1 selected')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Deselect All' })).toBeVisible()
  })

  test('toggling "Remember for this collection" reports the new override state', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderMainContent({ selectedCollectionId: '101' })

    // Act
    await user.click(screen.getByRole('button', { name: 'View mode' }))
    await user.click(
      screen.getByRole('menuitemcheckbox', {
        name: 'Remember for this collection',
      }),
    )

    // Assert — the menu stays open so a view mode can be picked right away
    expect(props.onCollectionViewModeOverrideChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('menuitemradio', { name: 'Grid' })).toBeVisible()
  })

  test('a remembered collection shows the checkbox as checked', async () => {
    // Arrange
    const user = userEvent.setup()
    renderMainContent({
      selectedCollectionId: '101',
      hasCollectionViewModeOverride: true,
    })

    // Act
    await user.click(screen.getByRole('button', { name: 'View mode' }))

    // Assert
    expect(
      screen.getByRole('menuitemcheckbox', {
        name: 'Remember for this collection',
      }),
    ).toBeChecked()
  })
})
