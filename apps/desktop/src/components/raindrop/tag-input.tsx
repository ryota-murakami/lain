import { X } from 'lucide-react'
import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useId,
  type KeyboardEvent,
} from 'react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Props for the TagInput component.
 */
interface TagInputProps {
  /** Current list of tags */
  value: string[]
  /** Callback when tags change */
  onChange: (tags: string[]) => void
  /** List of existing tags for autocomplete suggestions */
  suggestions?: string[]
  /** Placeholder text for the input */
  placeholder?: string
  /** Optional label text */
  label?: string
  /** Maximum number of tags allowed */
  maxTags?: number
  /** Whether the input is disabled */
  disabled?: boolean
}

/**
 * Multi-value tag input with autocomplete suggestions.
 * Tags can be added by pressing Enter or comma, removed by clicking X
 * or pressing Backspace on an empty input. Bookmark creation and detail editing
 * both call this component so normalization and keyboard behavior stay consistent.
 *
 * @param value - Current array of tag strings
 * @param onChange - Callback when the tag array changes
 * @param suggestions - Optional array of existing tags for autocomplete
 * @param placeholder - Input placeholder text
 * @param label - Optional label above the input
 * @param maxTags - Maximum number of tags allowed (default unlimited)
 * @param disabled - Whether input is disabled
 *
 * @example
 *   <TagInput
 *     value={["react", "typescript"]}
 *     onChange={setTags}
 *     suggestions={allTags}
 *     placeholder="Add tags..."
 *   />
 */
/**
 * Share tag normalization, suggestion focus, and keyboard behavior across creation and detail forms.
 * Called by {@link TagInput}; presentation stays controlled by the parent's tag array.
 * @example
 * const editor = useTagEditor(props)
 */
function useTagEditor({
  value,
  onChange,
  suggestions = [],
  maxTags,
  disabled = false,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const listId = `${inputId}-suggestions`

  const filteredSuggestions = useMemo(() => {
    const query = inputValue.trim().toLowerCase()
    if (!query) return []
    const selected = new Set(value.map((tag) => tag.trim().toLowerCase()))
    // Limit the keyboard list and visible list together; normalize duplicate suggestions once.
    return [...new Set(suggestions.map((tag) => tag.trim().toLowerCase()))]
      .filter((tag) => tag.includes(query) && !selected.has(tag))
      .slice(0, 8)
  }, [inputValue, suggestions, value])
  const suggestionsOpen =
    showSuggestions && filteredSuggestions.length > 0 && !disabled

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase()
      if (disabled || !trimmed) return
      if (value.some((existing) => existing.trim().toLowerCase() === trimmed))
        return
      if (maxTags !== undefined && value.length >= maxTags) return
      onChange([...value, trimmed])
      setInputValue('')
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    },
    [value, onChange, maxTags, disabled],
  )

  const removeTag = (tagToRemove: string): void => {
    onChange(value.filter((t) => t !== tagToRemove))
  }
  const handleSuggestionClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ): void => {
    addTag(event.currentTarget.value)
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // IME confirmation is text input, not a request to create a tag or submit the form.
      if (e.nativeEvent.isComposing || disabled) return
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault()
        if (
          suggestionsOpen &&
          selectedSuggestionIndex >= 0 &&
          selectedSuggestionIndex < filteredSuggestions.length
        ) {
          addTag(filteredSuggestions[selectedSuggestionIndex])
        } else {
          addTag(inputValue)
        }
      } else if (
        e.key === 'Backspace' &&
        inputValue === '' &&
        value.length > 0
      ) {
        onChange(value.filter((t) => t !== value[value.length - 1]))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setShowSuggestions(true)
        setSelectedSuggestionIndex((prev) =>
          Math.min(prev + 1, filteredSuggestions.length - 1),
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSuggestionIndex((prev) => Math.max(prev - 1, -1))
      } else if (e.key === 'Escape') {
        // Dismiss the autocomplete first instead of closing the surrounding dialog.
        if (suggestionsOpen) e.stopPropagation()
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
      }
    },
    [
      addTag,
      inputValue,
      selectedSuggestionIndex,
      filteredSuggestions,
      value,
      onChange,
      disabled,
      suggestionsOpen,
    ],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value)
      setShowSuggestions(true)
      setSelectedSuggestionIndex(-1)
    },
    [],
  )
  const handleInputFocus = useCallback(() => setShowSuggestions(true), [])
  const handleInputBlur = useCallback(() => setShowSuggestions(false), [])

  const isAtLimit = maxTags !== undefined && value.length >= maxTags
  return {
    inputValue,
    inputRef,
    inputId,
    listId,
    filteredSuggestions,
    suggestionsOpen,
    selectedSuggestionIndex,
    removeTag,
    handleSuggestionClick,
    handleKeyDown,
    handleInputChange,
    handleInputFocus,
    handleInputBlur,
    isAtLimit,
  }
}

const TagInput = React.memo(function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Add tag...',
  label,
  maxTags,
  disabled = false,
}: TagInputProps) {
  const {
    inputValue,
    inputRef,
    inputId,
    listId,
    filteredSuggestions,
    suggestionsOpen,
    selectedSuggestionIndex,
    removeTag,
    handleSuggestionClick,
    handleKeyDown,
    handleInputChange,
    handleInputFocus,
    handleInputBlur,
    isAtLimit,
  } = useTagEditor({ value, onChange, suggestions, maxTags, disabled })

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </Label>
      )}
      <div
        className={cn(
          'border-input bg-background ring-offset-background flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm',
          'focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="gap-1 px-2 py-0.5 text-xs"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                className="hover:bg-muted-foreground/20 ml-0.5 rounded-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(tag)
                }}
                aria-label={`Remove ${tag} tag`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        <Input
          id={inputId}
          ref={inputRef}
          role="combobox"
          aria-label={label || 'Tags'}
          aria-autocomplete="list"
          aria-expanded={suggestionsOpen}
          aria-controls={suggestionsOpen ? listId : undefined}
          aria-activedescendant={
            suggestionsOpen && selectedSuggestionIndex >= 0
              ? `${listId}-${selectedSuggestionIndex}`
              : undefined
          }
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled || isAtLimit}
          className="h-auto min-w-[80px] flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      {suggestionsOpen && (
        <div className="relative">
          <div
            id={listId}
            role="listbox"
            aria-label="Tag suggestions"
            className="bg-popover absolute z-50 mt-1 w-full rounded-md border p-1 shadow-md"
          >
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                value={suggestion}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === selectedSuggestionIndex}
                tabIndex={-1}
                className={cn(
                  'hover:bg-accent flex w-full items-center rounded-sm px-2 py-1.5 text-sm',
                  index === selectedSuggestionIndex && 'bg-accent',
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleSuggestionClick}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
      {maxTags !== undefined && (
        <p className="text-muted-foreground text-xs">
          {value.length}/{maxTags} tags
        </p>
      )}
    </div>
  )
})
export { TagInput }
