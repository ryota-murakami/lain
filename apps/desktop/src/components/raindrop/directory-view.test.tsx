import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

import type { Collection, Raindrop } from '@/lib/types'
import { renderWithProviders } from '@test/render-with-providers'

import { DirectoryView } from './directory-view'

const deepBookmark: Raindrop = {
  id: 'deep',
  title: 'Deep bookmark',
  url: 'https://example.com/deep',
  type: 'link',
  tags: [],
  createdAt: '2026-11-01',
  updatedAt: '2026-11-01',
  collectionId: '4',
}
const rootBookmark: Raindrop = {
  ...deepBookmark,
  id: 'root-bookmark',
  title: 'Root bookmark',
  collectionId: '1',
}
const roots: Collection[] = [
  {
    id: '1',
    name: 'Root',
    count: 2,
    icon: 'Folder',
    groupId: 'group',
    children: [
      {
        id: '2',
        name: 'Child',
        count: 1,
        icon: 'Folder',
        groupId: 'group',
        children: [
          {
            id: '3',
            name: 'Grandchild',
            count: 1,
            icon: 'Folder',
            groupId: 'group',
            children: [
              {
                id: '4',
                name: 'Deep',
                count: 1,
                icon: 'Folder',
                groupId: 'group',
              },
            ],
          },
        ],
      },
    ],
  },
]
const grouped = { '1': [rootBookmark], '4': [deepBookmark] }
const selected = new Set(['root-bookmark'])

test('Collapse All hides every level and Expand All opens descendants beyond the initial preview', () => {
  // Arrange
  renderWithProviders(
    <DirectoryView collections={roots} raindropsByCollection={grouped} />,
  )
  expect(screen.getByRole('button', { name: 'Root bookmark' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Deep bookmark' })).toBeNull()
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Collapse All' }))
  // Assert
  expect(
    screen.getByRole('button', { name: 'Root collection' }),
  ).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: 'Child collection' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Root bookmark' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Expand All' }))
  expect(screen.getByRole('button', { name: 'Deep bookmark' })).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Grandchild collection' }),
  ).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('2 loaded')).toBeVisible()
})

test('individual descendant collapse survives closing its ancestor until Expand All resets it', () => {
  // Arrange
  renderWithProviders(
    <DirectoryView collections={roots} raindropsByCollection={grouped} />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Collapse All' }))
  fireEvent.click(screen.getByRole('button', { name: 'Expand All' }))
  fireEvent.click(screen.getByRole('button', { name: 'Grandchild collection' }))
  // Act
  fireEvent.click(screen.getByRole('button', { name: 'Root collection' }))
  fireEvent.click(screen.getByRole('button', { name: 'Root collection' }))
  // Assert
  expect(
    screen.getByRole('button', { name: 'Grandchild collection' }),
  ).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: 'Deep bookmark' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Collapse All' }))
  fireEvent.click(screen.getByRole('button', { name: 'Expand All' }))
  expect(screen.getByRole('button', { name: 'Deep bookmark' })).toBeVisible()
})

test('Directory renders bulk selection separately from the bookmark open in detail', () => {
  // Arrange / Act
  renderWithProviders(
    <DirectoryView
      collections={roots}
      raindropsByCollection={grouped}
      selectedIds={selected}
      selectedRaindropId="deep"
      onToggleSelection={vi.fn()}
    />,
  )
  // Assert
  expect(
    screen.getByRole('checkbox', { name: 'Select Root bookmark' }),
  ).toBeChecked()
  expect(
    screen
      .getByRole('button', { name: 'Root bookmark' })
      .closest('[data-selected]'),
  ).toHaveAttribute('data-selected', 'true')
  expect(
    screen.getByRole('button', { name: 'Root bookmark' }),
  ).not.toHaveAttribute('aria-current')
  expect(screen.getByText('2 loaded · 1 selected')).toBeVisible()
})

test('Directory checkbox and command/control clicks toggle selection without opening detail', () => {
  // Arrange
  const onToggleSelection = vi.fn()
  const onSelectRaindrop = vi.fn()
  renderWithProviders(
    <DirectoryView
      collections={roots}
      raindropsByCollection={grouped}
      onToggleSelection={onToggleSelection}
      onSelectRaindrop={onSelectRaindrop}
    />,
  )
  // Act
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Select Root bookmark' }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Root bookmark' }), {
    metaKey: true,
  })
  fireEvent.click(screen.getByRole('button', { name: 'Root bookmark' }), {
    ctrlKey: true,
  })
  // Assert
  expect(onToggleSelection.mock.calls).toEqual([
    ['root-bookmark'],
    ['root-bookmark'],
    ['root-bookmark'],
  ])
  expect(onSelectRaindrop).not.toHaveBeenCalled()
})

test('Directory keeps native Enter and Space detail activation and double-click URL opening', async () => {
  // Arrange
  const onSelectRaindrop = vi.fn()
  const onOpenUrl = vi.fn()
  renderWithProviders(
    <DirectoryView
      collections={roots}
      raindropsByCollection={grouped}
      onSelectRaindrop={onSelectRaindrop}
      onOpenUrl={onOpenUrl}
    />,
  )
  const user = userEvent.setup()
  const row = screen.getByRole('button', { name: 'Root bookmark' })
  // Act
  row.focus()
  await user.keyboard('{Enter}')
  await user.keyboard(' ')
  fireEvent.doubleClick(row)
  // Assert
  expect(onSelectRaindrop).toHaveBeenCalledTimes(2)
  expect(onSelectRaindrop).toHaveBeenLastCalledWith(rootBookmark)
  expect(onOpenUrl).toHaveBeenCalledWith('https://example.com/deep')
  expect(row).toHaveAttribute('data-raindrop-id', 'root-bookmark')
})
