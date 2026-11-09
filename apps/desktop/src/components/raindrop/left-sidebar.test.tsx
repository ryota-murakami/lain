import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

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
function renderSidebar() {
  const props = {
    groups: GROUPS,
    systemCollections: [],
    selectedCollectionId: 'all',
    onSelectCollection: vi.fn(),
    onAddBookmark: vi.fn(),
    onAddCollection: vi.fn(),
    onAddGroup: vi.fn(),
    onManageTags: vi.fn(),
    onDeleteCollection: vi.fn(async () => {}),
    onEmptyTrash: vi.fn(async () => {}),
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

describe('collection sidebar', () => {
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
