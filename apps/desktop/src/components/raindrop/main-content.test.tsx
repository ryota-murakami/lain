import { DndContext } from '@dnd-kit/core'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { MainContent } from '@/components/raindrop/main-content'
import { useMainAppBookmarkActions } from '@/hooks/useMainAppBookmarkActions'
import { PartialBookmarkBatchError } from '@/hooks/useRaindropBatchActions'
import type { Collection, Raindrop } from '@/lib/types'
import { updateShortcut } from '@/store/slices/settingsSlice'
import { setSelectedRaindropIds } from '@/store/slices/uiSlice'
import {
  renderHookWithProviders,
  renderWithProviders,
} from '@test/render-with-providers'

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

afterEach(() => vi.restoreAllMocks())

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
  test('scoped toolbar keeps search, sort, scope and add actions available together', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderMainContent({
      selectedCollectionId: '100',
      breadcrumbs: ['Development'],
    })

    // Act
    fireEvent.change(screen.getByPlaceholderText(/^Search bookmarks/), {
      target: { value: 'React' },
    })
    await user.click(screen.getByRole('button', { name: 'Search everywhere' }))
    await user.click(screen.getByRole('button', { name: 'Search options' }))
    await user.click(screen.getByRole('button', { name: 'Title Only' }))
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'Title A-Z' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // Assert
    expect(props.onSearchQueryChange).toHaveBeenCalledExactlyOnceWith('React')
    expect(props.onSearchModeChange).toHaveBeenCalledExactlyOnceWith('global')
    expect(props.onSearchScopeChange).toHaveBeenCalledExactlyOnceWith('title')
    expect(props.onSortChange).toHaveBeenCalledExactlyOnceWith('title-asc')
    expect(props.onAddBookmark).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Export' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Upload' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'View mode' })).toBeVisible()
  })

  test.each([
    {
      platform: 'MacIntel',
      defaultLabel: 'Search bookmarks... (⌘K)',
      customLabel: 'Search bookmarks... (⇧⌘F)',
    },
    {
      platform: 'Linux x86_64',
      defaultLabel: 'Search bookmarks... (Ctrl+K)',
      customLabel: 'Search bookmarks... (Ctrl+Shift+F)',
    },
  ])(
    'search hint on $platform follows the current configured shortcut',
    ({ platform, defaultLabel, customLabel }) => {
      // Arrange
      vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform)
      const { store } = renderMainContent()
      expect(screen.getByPlaceholderText(defaultLabel)).toBeVisible()

      // Act
      act(() => {
        store.dispatch(
          updateShortcut({
            actionId: 'search',
            binding: {
              key: 'f',
              meta: true,
              shift: true,
              alt: false,
              ctrl: false,
            },
          }),
        )
      })

      // Assert
      expect(screen.getByPlaceholderText(customLabel)).toBeVisible()
      expect(screen.queryByPlaceholderText(defaultLabel)).toBeNull()
    },
  )

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
      screen.getByRole('button', { name: 'Development collection' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Design collection' }),
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

describe('MainContent loading and selection', () => {
  test('search count distinguishes displayed matches from loaded and API total bookmarks', () => {
    // Arrange + Act
    renderMainContent({
      searchQuery: 'React',
      searchScope: 'title',
      totalCount: 80,
    })

    // Assert
    expect(screen.getByText('1 items shown · 2 loaded of 80')).toBeVisible()
    expect(screen.getByText('React', { selector: 'mark' })).toBeVisible()
    expect(screen.queryByText('Figma Best Practices')).not.toBeInTheDocument()
  })

  test('refresh failure keeps loaded rows available while offering retry and the next page', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderMainContent({
      isError: true,
      hasMore: true,
      onRetry: vi.fn(),
      onLoadMore: vi.fn(),
    })

    // Act
    await user.click(screen.getByRole('button', { name: 'Retry loading' }))
    await user.click(
      screen.getByRole('button', { name: 'Load more bookmarks' }),
    )

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Previously loaded items are kept.',
    )
    expect(screen.getByText('React Documentation')).toBeVisible()
    expect(props.onRetry).toHaveBeenCalledOnce()
    expect(props.onLoadMore).toHaveBeenCalledOnce()
  })

  test('modifier click toggles an existing selection without opening bookmark details', () => {
    // Arrange
    const { props } = renderMainContent({ selectedRaindropIds: new Set(['1']) })

    // Act
    fireEvent.click(screen.getByText('Figma Best Practices'), { ctrlKey: true })

    // Assert
    expect(props.onSelectedRaindropIdsChange).toHaveBeenCalledWith(
      new Set(['1', '2']),
    )
    expect(props.onSelectRaindrop).not.toHaveBeenCalled()
  })

  test('shift selection follows the visible bookmark order', () => {
    // Arrange
    const { props } = renderMainContent({ selectedRaindropId: '1' })

    // Act
    fireEvent.click(screen.getByText('Figma Best Practices'), {
      shiftKey: true,
    })

    // Assert
    expect(props.onSelectedRaindropIdsChange).toHaveBeenCalledWith(
      new Set(['1', '2']),
    )
    expect(props.onSelectRaindrop).not.toHaveBeenCalled()
  })
})

describe.each(['grid', 'list'] as const)('%s bookmark actions', (viewMode) => {
  test('the row checkbox participates in the main bulk selection', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderMainContent({ viewMode })

    // Act
    await user.hover(screen.getByText('React Documentation'))
    await user.click(
      screen.getByRole('checkbox', { name: 'Select React Documentation' }),
    )

    // Assert
    expect(props.onSelectedRaindropIdsChange).toHaveBeenCalledWith(
      new Set(['1']),
    )
    expect(props.onSelectRaindrop).not.toHaveBeenCalled()
  })

  test('Edit opens the intended bookmark without changing the bulk selection', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderMainContent({ viewMode })

    // Act
    await user.hover(screen.getByText('React Documentation'))
    await user.click(
      screen.getByRole('button', { name: 'Actions for React Documentation' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }))

    // Assert
    expect(props.onSelectRaindrop).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', title: 'React Documentation' }),
    )
    expect(props.onSelectedRaindropIdsChange).not.toHaveBeenCalled()
  })

  test('Move to Collection opens a destination dialog and moves only that row', async () => {
    // Arrange
    const user = userEvent.setup()
    const onBatchMove = vi.fn(async () => {})
    renderMainContent({
      viewMode,
      onBatchMove,
      selectedRaindropIds: new Set(['2']),
    })

    // Act
    await user.hover(screen.getByText('React Documentation'))
    await user.click(
      screen.getByRole('button', { name: 'Actions for React Documentation' }),
    )
    await user.click(
      screen.getByRole('menuitem', { name: 'Move to Collection...' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Move bookmarks' }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    // Assert
    expect(onBatchMove).toHaveBeenCalledWith(['1'], 'unsorted')
  })

  test('Important and Trash execute their existing bookmark mutations', async () => {
    // Arrange
    const user = userEvent.setup()
    const onBatchDelete = vi.fn(async () => {})
    const { props } = renderMainContent({ viewMode, onBatchDelete })

    // Act
    await user.hover(screen.getByText('React Documentation'))
    await user.click(
      screen.getByRole('button', { name: 'Actions for React Documentation' }),
    )
    await user.click(
      screen.getByRole('menuitem', { name: 'Mark as Important' }),
    )
    await user.hover(screen.getByText('React Documentation'))
    await user.click(
      screen.getByRole('button', { name: 'Actions for React Documentation' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Move to Trash' }))

    // Assert
    expect(props.onToggleImportant).toHaveBeenCalledWith('1')
    expect(onBatchDelete).toHaveBeenCalledWith(['1'])
  })
})

describe.each(['grid', 'list', 'table', 'directory'] as const)(
  '%s deletion recovery',
  (viewMode) => {
    test('failed bulk deletion keeps the selection and reports a retryable error', async () => {
      // Arrange
      const user = userEvent.setup()
      const errorToast = vi.spyOn(toast, 'error')
      const onBatchDelete = vi
        .fn()
        .mockRejectedValue(
          new Error('The service did not confirm the bookmark changes.'),
        )
      const { props } = renderMainContent({
        viewMode,
        onBatchDelete,
        selectedRaindropIds: new Set(['1', '2']),
      })

      // Act
      await user.click(screen.getByRole('button', { name: 'Delete' }))

      // Assert — the view does not discard controlled selection or leak a rejected event promise.
      await waitFor(() =>
        expect(errorToast).toHaveBeenCalledWith(
          'Could not delete the selection. Please retry.',
        ),
      )
      expect(onBatchDelete).toHaveBeenCalledWith(['1', '2'])
      expect(props.onSelectedRaindropIdsChange).not.toHaveBeenCalled()
      expect(screen.getByText('2 selected')).toBeVisible()
    })
  },
)

test('partial deletion keeps only the parent-confirmed unfinished IDs and clears them after a successful retry', async () => {
  // Arrange
  const user = userEvent.setup()
  const errorToast = vi.spyOn(toast, 'error')
  let failFirst: (cause: unknown) => void = () => {}
  let finishRetry: () => void = () => {}
  const batchDeleteRaindrops = vi
    .fn()
    .mockImplementationOnce(
      async () =>
        new Promise<void>((_resolve, reject) => {
          failFirst = reject
        }),
    )
    .mockImplementationOnce(
      async () =>
        new Promise<void>((resolve) => {
          finishRetry = resolve
        }),
    )
  const { result, store } = renderHookWithProviders(() =>
    useMainAppBookmarkActions({
      raindrops: RAINDROPS,
      createRaindrop: vi.fn(),
      updateRaindrop: vi.fn(),
      batchMoveToCollection: vi.fn(),
      batchAddTag: vi.fn(),
      batchDeleteRaindrops,
    }),
  )
  act(() => store.dispatch(setSelectedRaindropIds(['1', '2'])))
  const { props, rerender } = renderMainContent({
    viewMode: 'table',
    onBatchDelete: result.current.handleBatchDelete,
    selectedRaindropIds: new Set(['1', '2']),
  })

  // Act — hold the request open, then acknowledge only the first source collection.
  await user.click(screen.getByRole('button', { name: 'Delete' }))
  expect(store.getState().ui.selectedRaindropIds).toEqual(['1', '2'])
  expect(screen.getByText('2 selected')).toBeVisible()
  await act(async () =>
    failFirst(
      new PartialBookmarkBatchError(['1'], ['2'], new Error('Offline')),
    ),
  )

  // Assert — parent semantics own the partial selection; the view only reports the error.
  await waitFor(() =>
    expect(errorToast).toHaveBeenCalledWith(
      'Completed 1 bookmarks. 1 remain; retry to finish the selection.',
    ),
  )
  expect(store.getState().ui.selectedRaindropIds).toEqual(['2'])
  expect(props.onSelectedRaindropIdsChange).not.toHaveBeenCalled()
  rerender(
    <DndContext>
      <MainContent {...props} selectedRaindropIds={new Set(['2'])} />
    </DndContext>,
  )
  expect(screen.getByText('1 selected')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Delete' }))
  expect(batchDeleteRaindrops).toHaveBeenNthCalledWith(2, ['2'])
  expect(store.getState().ui.selectedRaindropIds).toEqual(['2'])
  await act(async () => finishRetry())
  await waitFor(() =>
    expect(store.getState().ui.selectedRaindropIds).toEqual([]),
  )
})
