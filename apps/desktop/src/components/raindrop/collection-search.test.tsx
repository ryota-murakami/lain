import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Group } from '@/lib/types'

import { CollectionSearch } from './collection-search'
import { CollectionSelector } from './collection-selector'

const GROUPS: Group[] = [
  {
    id: 'work',
    name: 'Work',
    collections: [
      {
        id: '100',
        name: 'Reading',
        icon: '',
        count: 2,
        groupId: 'work',
        children: [
          {
            id: '101',
            name: 'TypeScript',
            icon: '',
            count: 1,
            groupId: 'work',
            color: '#ff0000',
          },
        ],
      },
      { id: '200', name: 'Travel', icon: '', count: 3, groupId: 'work' },
    ],
  },
]
const EMPTY_GROUPS: Group[] = []

describe('sidebar collection search', () => {
  it('navigates nested collections with arrow keys, clamps at both ends and selects with Enter', () => {
    // Arrange
    const onSelect = vi.fn()
    render(
      <CollectionSearch
        groups={GROUPS}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )
    const input = screen.getByPlaceholderText('Find collection...')
    // Act
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    // Assert
    expect(onSelect.mock.calls).toEqual([['100'], ['101'], ['200']])
    expect(
      screen.getByRole('button', { name: /TypeSc.*ipt/ }),
    ).toHaveTextContent('WorkReading')
  })

  it('uses fuzzy names, highlights their matched text and resets keyboard selection on query changes', () => {
    // Arrange
    const onSelect = vi.fn()
    render(
      <CollectionSearch
        groups={GROUPS}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )
    const input = screen.getByPlaceholderText('Find collection...')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    // Act
    fireEvent.change(input, { target: { value: 'TypeScipt' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // Assert
    const result = screen.getByRole('button', { name: /TypeSc.*ipt/ })
    expect(result).toBeVisible()
    expect(result.querySelector('strong')).not.toBeNull()
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('101')
    expect(screen.queryByRole('button', { name: /Travel/ })).toBeNull()
  })

  it('uses a hovered result for Enter and supports direct mouse selection', () => {
    // Arrange
    const onSelect = vi.fn()
    render(
      <CollectionSearch
        groups={GROUPS}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )
    // Act
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Travel/ }))
    fireEvent.keyDown(screen.getByPlaceholderText('Find collection...'), {
      key: 'Enter',
    })
    fireEvent.click(screen.getByRole('button', { name: /TypeSc.*ipt/ }))
    // Assert
    expect(onSelect.mock.calls).toEqual([['200'], ['101']])
  })

  it('shows an unmatched query without selecting a stale result and supports both dismiss controls', () => {
    // Arrange
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(
      <CollectionSearch
        groups={GROUPS}
        onSelect={onSelect}
        onClose={onClose}
      />,
    )
    const input = screen.getByPlaceholderText('Find collection...')
    // Act
    fireEvent.change(input, { target: { value: 'zzzzzzzz' } })
    for (const key of ['ArrowUp', 'ArrowDown', 'Enter', 'Tab'])
      fireEvent.keyDown(input, { key })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Close collection search' }),
    )
    // Assert
    expect(screen.getByText('No collections matching "zzzzzzzz"')).toBeVisible()
    expect(onSelect).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('distinguishes an empty account from an unmatched search', () => {
    // Arrange / Act
    render(
      <CollectionSearch
        groups={EMPTY_GROUPS}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    // Assert
    expect(screen.getByText('No collections available')).toBeVisible()
  })
})

describe('collection picker', () => {
  it('shows a nested selected collection and selects another tree row without submitting a form', async () => {
    // Arrange
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <CollectionSelector groups={GROUPS} value="101" onChange={onChange} />
      </form>,
    )
    const trigger = screen.getByRole('combobox', { name: 'Collection' })
    expect(trigger).toHaveTextContent('TypeScript')
    // Act
    await user.click(trigger)
    expect(
      screen.getByRole('button', { name: 'TypeScript 1' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Travel 3' }))
    // Assert
    expect(onChange).toHaveBeenCalledExactlyOnceWith('200')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('finds a misspelled nested name, keeps its breadcrumb and clears the query after selection', async () => {
    // Arrange
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CollectionSelector groups={GROUPS} value="101" onChange={onChange} />,
    )
    // Act
    await user.click(screen.getByRole('combobox', { name: 'Collection' }))
    await user.type(
      screen.getByPlaceholderText('Search collections...'),
      'TypeScipt',
    )
    const result = screen.getByRole('button', { name: /TypeSc.*ipt/ })
    // Assert
    expect(within(result).getByText('Reading')).toBeVisible()
    expect(within(result).getByText('Work')).toBeVisible()
    expect(result.querySelector('strong')).not.toBeNull()
    expect(result).toHaveAttribute('aria-pressed', 'true')
    // Act
    await user.click(result)
    await user.click(screen.getByRole('combobox', { name: 'Collection' }))
    // Assert
    expect(onChange).toHaveBeenCalledExactlyOnceWith('101')
    expect(screen.getByPlaceholderText('Search collections...')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Travel 3' })).toBeVisible()
  })

  it('selects root level and does not leave an old search behind', async () => {
    // Arrange
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CollectionSelector
        groups={GROUPS}
        allowNone
        onChange={onChange}
        placeholder="Choose parent"
      />,
    )
    const trigger = screen.getByRole('combobox', { name: 'Parent Collection' })
    expect(trigger).toHaveTextContent('Choose parent')
    // Act
    await user.click(trigger)
    await user.type(
      screen.getByPlaceholderText('Search collections...'),
      'Travel',
    )
    expect(screen.getByRole('button', { name: /Travel/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await user.click(screen.getByRole('button', { name: 'None (root level)' }))
    await user.click(trigger)
    // Assert
    expect(onChange).toHaveBeenCalledExactlyOnceWith('')
    expect(screen.getByPlaceholderText('Search collections...')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Reading 2' })).toBeVisible()
  })

  it('shows an empty fuzzy result without changing the selected collection', async () => {
    // Arrange
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CollectionSelector groups={GROUPS} value="100" onChange={onChange} />,
    )
    // Act
    await user.click(screen.getByRole('combobox', { name: 'Collection' }))
    await user.type(
      screen.getByPlaceholderText('Search collections...'),
      'zzzzzzzz',
    )
    // Assert
    expect(screen.getByText('No collections matching "zzzzzzzz"')).toBeVisible()
    expect(onChange).not.toHaveBeenCalled()
  })
})
