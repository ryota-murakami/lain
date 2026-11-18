import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

import { TagInput } from './tag-input'

const noTags: string[] = []
const selectedReact = ['React']
const duplicateSuggestions = ['React', 'react', 'React Router', 'react router']
const manySuggestions = [
  'tag1',
  'tag2',
  'tag3',
  'tag4',
  'tag5',
  'tag6',
  'tag7',
  'tag8',
  'tag9',
]
const selectedTags = ['react', 'typescript']

test('normalizes typed tags and prevents Enter from submitting the surrounding form', async () => {
  // Arrange
  const onChange = vi.fn()
  const onSubmit = vi.fn((event) => event.preventDefault())
  const user = userEvent.setup()
  render(
    <form onSubmit={onSubmit}>
      <TagInput value={noTags} onChange={onChange} label="Tags" />
      <button type="submit">Save</button>
    </form>,
  )
  // Act
  await user.type(
    screen.getByRole('combobox', { name: 'Tags' }),
    '  TypeScript  {Enter}',
  )
  // Assert
  expect(onChange).toHaveBeenCalledExactlyOnceWith(['typescript'])
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.getByRole('combobox', { name: 'Tags' })).toHaveValue('')
})

test('excludes existing tags regardless of case and adds a clicked suggestion once', async () => {
  // Arrange
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(
    <TagInput
      value={selectedReact}
      onChange={onChange}
      suggestions={duplicateSuggestions}
    />,
  )
  // Act
  await user.type(screen.getByRole('combobox', { name: 'Tags' }), 'react')
  // Assert
  expect(screen.getAllByRole('option')).toHaveLength(1)
  expect(screen.getByRole('option', { name: 'react router' })).toBeVisible()
  // Act
  await user.click(screen.getByRole('option', { name: 'react router' }))
  // Assert
  expect(onChange).toHaveBeenCalledExactlyOnceWith(['React', 'react router'])
  expect(screen.queryByRole('listbox')).toBeNull()
})

test('never selects a keyboard suggestion beyond the eight visible options', async () => {
  // Arrange
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(
    <TagInput
      value={noTags}
      onChange={onChange}
      suggestions={manySuggestions}
    />,
  )
  // Act
  await user.type(screen.getByRole('combobox', { name: 'Tags' }), 'tag')
  await user.keyboard('{ArrowDown>10/}{Enter}')
  // Assert
  expect(onChange).toHaveBeenCalledExactlyOnceWith(['tag8'])
})

test('does not create a tag while an IME composition is being confirmed', () => {
  // Arrange
  const onChange = vi.fn()
  render(<TagInput value={noTags} onChange={onChange} />)
  const input = screen.getByRole('combobox', { name: 'Tags' })
  // Act
  fireEvent.change(input, { target: { value: '検索' } })
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
  // Assert
  expect(onChange).not.toHaveBeenCalled()
  expect(input).toHaveValue('検索')
})

test('removes the final tag with Backspace and exposes named remove buttons', async () => {
  // Arrange
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<TagInput value={selectedTags} onChange={onChange} />)
  // Act
  await user.click(screen.getByRole('combobox', { name: 'Tags' }))
  await user.keyboard('{Backspace}')
  await user.click(screen.getByRole('button', { name: 'Remove react tag' }))
  // Assert
  expect(onChange).toHaveBeenNthCalledWith(1, ['react'])
  expect(onChange).toHaveBeenNthCalledWith(2, ['typescript'])
})
