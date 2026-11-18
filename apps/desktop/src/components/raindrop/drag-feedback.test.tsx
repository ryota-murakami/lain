import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Collection, Raindrop } from '@/lib/types'

import { DragPreview } from './drag-preview'
import { DropIndicator } from './drop-indicator'

const collection: Collection = {
  id: '100',
  name: 'Reading',
  icon: '',
  count: 2,
  groupId: 'g1',
}
const collectionVariants = [collection, { ...collection, color: '#ff0000' }]
const bookmark: Raindrop = {
  id: '1',
  title: 'React documentation',
  url: 'https://react.dev',
  type: 'link',
  tags: [],
  createdAt: '',
  updatedAt: '',
  collectionId: '100',
}

describe('drag feedback', () => {
  it('shows the dragged bookmark and selection count without confusing it with the destination collection', () => {
    // Arrange / Act
    render(
      <DragPreview collection={collection} raindrop={bookmark} count={3} />,
    )
    // Assert
    expect(screen.getByText('React documentation')).toBeVisible()
    expect(screen.getByTestId('drag-preview-count')).toHaveTextContent('3')
    expect(screen.queryByText('Reading')).toBeNull()
  })

  it('does not show a multi-selection badge for a single bookmark', () => {
    // Arrange / Act
    render(<DragPreview raindrop={bookmark} />)
    // Assert
    expect(screen.getByText('React documentation')).toBeVisible()
    expect(screen.queryByTestId('drag-preview-count')).toBeNull()
  })

  it.each(collectionVariants)(
    'keeps the collection name visible with a default or custom color',
    (coloredCollection) => {
      // Arrange / Act
      render(<DragPreview collection={coloredCollection} />)
      // Assert
      expect(screen.getByText('Reading')).toBeVisible()
      expect(screen.queryByTestId('drag-preview-count')).toBeNull()
    },
  )

  it('removes drag feedback when no drag is active', () => {
    // Arrange / Act
    render(
      <>
        <DragPreview />
        <DropIndicator data-testid="drop-marker" />
      </>,
    )
    // Assert
    expect(screen.queryByTestId('drag-preview')).toBeNull()
    expect(screen.queryByTestId('drop-marker')).toBeNull()
  })

  it.each(['before', 'after', 'inside'] as const)(
    'shows an insertion marker for an active %s drop',
    (position) => {
      // Arrange / Act
      render(
        <DropIndicator
          position={position}
          isActive
          data-testid="drop-marker"
        />,
      )
      // Assert
      expect(screen.getByTestId('drop-marker')).toBeVisible()
      expect(screen.getByTestId('drop-marker')).toHaveAttribute(
        'aria-hidden',
        'true',
      )
    },
  )
})
