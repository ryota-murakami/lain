import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'
import type { Group } from '@/lib/types'
import { renderWithProviders } from '@test/render-with-providers'

import { LeftSidebar } from './left-sidebar'

const GROUPS: Group[] = [
  {
    id: 'work',
    name: 'Work',
    collections: [
      {
        id: '100',
        name: 'Reading',
        icon: 'Folder',
        count: 2,
        groupId: 'work',
        children: [
          {
            id: '200',
            name: 'Nested collection',
            icon: 'Code',
            count: 1,
            groupId: 'work',
            parentId: '100',
          },
        ],
      },
    ],
  },
  {
    id: 'ungrouped',
    name: 'Other collections',
    collections: [
      {
        id: '300',
        name: 'Unassigned collection',
        icon: 'Folder',
        count: 1,
        groupId: 'ungrouped',
      },
    ],
  },
]

/** Render real sidebar primitives with independent callbacks and a small nested collection tree. */
function renderSidebar(onEmptyTrash = vi.fn(async () => {})) {
  const props = {
    groups: GROUPS,
    systemCollections: [
      { id: 'trash', name: 'Trash', icon: 'Trash2', count: 2 },
    ],
    selectedCollectionId: 'all',
    onSelectCollection: vi.fn(),
    onAddBookmark: vi.fn(),
    onAddCollection: vi.fn(),
    onAddGroup: vi.fn(),
    onManageTags: vi.fn(),
    onDeleteCollection: vi.fn(async () => {}),
    onEmptyTrash,
    onMergeCollections: vi.fn(),
    onPersistGroups: vi.fn(async () => {}),
    onRenameCollection: vi.fn(async () => {}),
    onChangeCollectionColor: vi.fn(async () => {}),
    onEditCollection: vi.fn(),
    onEditGroup: vi.fn(),
    onDeleteGroup: vi.fn(async () => {}),
  }
  return {
    props,
    ...renderWithProviders(
      <SidebarProvider>
        <LeftSidebar {...props} />
      </SidebarProvider>,
    ),
  }
}

afterEach(() => vi.restoreAllMocks())

describe('Empty Trash feedback', () => {
  test.each([200, 503])(
    'a rejected menu click reports HTTP %s failure once and keeps Trash available for retry',
    async (status) => {
      // Arrange — transport failures already have feedback from the Axios interceptor.
      const user = userEvent.setup()
      const errorToast = vi
        .spyOn(toast, 'error')
        .mockReturnValue('empty-trash-error')
      const onEmptyTrash = vi.fn(async () => {
        if (status === 503) toast.error('Server error. Please try again later.')
        throw { status, message: 'Controlled refusal' }
      })
      renderSidebar(onEmptyTrash)
      const trash = screen.getByRole('button', { name: 'Trash 2' })

      // Act — use the actual dropdown and click boundary, not the callback directly.
      await user.click(within(trash).getByRole('button'))
      await user.click(screen.getByRole('menuitem', { name: 'Empty Trash' }))

      // Assert — an uncaught click rejection also fails the Vitest run as an unhandled error.
      expect(onEmptyTrash).toHaveBeenCalledOnce()
      expect(errorToast).toHaveBeenCalledExactlyOnceWith(
        status === 200
          ? 'Could not empty Trash. Please retry.'
          : 'Server error. Please try again later.',
      )
      expect(trash).toBeVisible()
      await user.click(within(trash).getByRole('button'))
      expect(
        screen.getByRole('menuitem', { name: 'Empty Trash' }),
      ).toBeVisible()
    },
  )

  test('a successful menu click leaves success feedback to the mutation without adding an error', async () => {
    // Arrange
    const user = userEvent.setup()
    const errorToast = vi
      .spyOn(toast, 'error')
      .mockReturnValue('unexpected-error')
    const { props } = renderSidebar()
    const trash = screen.getByRole('button', { name: 'Trash 2' })

    // Act
    await user.click(within(trash).getByRole('button'))
    await user.click(screen.getByRole('menuitem', { name: 'Empty Trash' }))

    // Assert
    expect(props.onEmptyTrash).toHaveBeenCalledOnce()
    expect(errorToast).not.toHaveBeenCalled()
  })
})

describe('collection sidebar', () => {
  test('context rename receives focus after the menu closes and saves the complete name once on Enter', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderSidebar()

    // Act — closing the menu must finish before the inline editor owns focus.
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Reading' }))
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    const input = await screen.findByRole('textbox', {
      name: 'Rename collection Reading',
    })

    // Assert — typing is not an implicit save caused by menu focus restoration.
    expect(input).toHaveFocus()
    await user.clear(input)
    await user.keyboard('Complete context name')
    await user.keyboard('{ArrowLeft}{ArrowRight}')
    expect(input).toHaveFocus()
    expect(input).toHaveValue('Complete context name')
    expect(props.onSelectCollection).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('button', { name: 'Nested collection' }),
    ).toBeNull()
    expect(props.onRenameCollection).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(props.onRenameCollection).toHaveBeenCalledExactlyOnceWith(
      '100',
      'Complete context name',
    )
  })

  test('leaving a context rename input saves its full draft once', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderSidebar()
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Reading' }))
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const input = await screen.findByRole('textbox', {
      name: 'Rename collection Reading',
    })
    await waitFor(() => expect(input).toHaveFocus())

    // Act
    await user.clear(input)
    await user.keyboard('Saved on blur')
    await user.click(screen.getByRole('button', { name: 'Add Bookmark' }))

    // Assert
    expect(props.onRenameCollection).toHaveBeenCalledExactlyOnceWith(
      '100',
      'Saved on blur',
    )
  })

  test('Escape cancels a context rename without persisting its draft', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderSidebar()
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Reading' }))
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const input = await screen.findByRole('textbox', {
      name: 'Rename collection Reading',
    })
    await waitFor(() => expect(input).toHaveFocus())

    // Act
    await user.clear(input)
    await user.keyboard('Discard this draft')
    expect(props.onSelectCollection).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')

    // Assert
    expect(props.onRenameCollection).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).toBeNull()
    const row = screen.getByRole('button', { name: 'Reading' })
    expect(row).toBeVisible()
    row.focus()
    await user.keyboard('{ArrowRight}')
    expect(
      screen.getByRole('button', { name: 'Nested collection' }),
    ).toBeVisible()
  })

  test('double-click rename still focuses the editor and saves on Enter', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderSidebar()

    // Act
    await user.dblClick(screen.getByText('Reading', { exact: true }))
    const input = screen.getByRole('textbox', {
      name: 'Rename collection Reading',
    })
    expect(input).toHaveFocus()
    await user.clear(input)
    await user.keyboard('Double-click name')
    await user.keyboard('{Enter}')

    // Assert
    expect(props.onRenameCollection).toHaveBeenCalledExactlyOnceWith(
      '100',
      'Double-click name',
    )
  })

  test('creating from a group menu preserves that group as the initial destination', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderSidebar()

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Group actions for Work' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Add Collection' }))

    // Assert
    expect(props.onAddCollection).toHaveBeenCalledExactlyOnceWith('work')
  })

  test('named footer buttons invoke group, tag, and merge actions', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderSidebar()

    // Act
    await user.click(screen.getByRole('button', { name: 'New Group' }))
    await user.click(screen.getByRole('button', { name: 'Manage Tags' }))
    await user.click(screen.getByRole('button', { name: 'Merge Collections' }))

    // Assert
    expect(props.onAddGroup).toHaveBeenCalledTimes(1)
    expect(props.onManageTags).toHaveBeenCalledTimes(1)
    expect(props.onMergeCollections).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeVisible()
  })

  test('named controls open and close the collection search', async () => {
    // Arrange
    const user = userEvent.setup()
    renderSidebar()

    // Act
    await user.click(screen.getByRole('button', { name: 'Search collections' }))
    expect(
      screen.getByRole('button', { name: 'Close collection search' }),
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Close collection search' }),
    )

    // Assert
    expect(
      screen.queryByRole('button', { name: 'Close collection search' }),
    ).not.toBeInTheDocument()
  })

  test('keyboard expansion exposes nested collection settings', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderSidebar()

    // Act
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reading' }), {
      key: 'ArrowRight',
    })
    const child = screen.getByRole('button', { name: 'Nested collection' })
    fireEvent.contextMenu(child)
    await user.click(
      screen.getByRole('menuitem', { name: 'Collection Settings' }),
    )

    // Assert
    expect(props.onEditCollection).toHaveBeenCalledWith(
      expect.objectContaining({ id: '200', parentId: '100' }),
    )
    expect(screen.getByRole('button', { name: 'Reading' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  test('the synthetic group has no group menu and collapses without a server write', async () => {
    // Arrange
    const user = userEvent.setup()
    const { props } = renderSidebar()
    const synthetic = screen.getByTestId('sidebar-group-ungrouped')
    const real = screen.getByTestId('sidebar-group-work')
    expect(
      within(synthetic).queryByRole('button', {
        name: 'Group actions for Other collections',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(real).getByRole('button', { name: 'Group actions for Work' }),
    ).toBeVisible()

    // Act
    await user.click(within(synthetic).getByText('Other collections'))

    // Assert
    expect(props.onPersistGroups).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('button', { name: 'Unassigned collection' }),
    ).not.toBeInTheDocument()
  })
})
