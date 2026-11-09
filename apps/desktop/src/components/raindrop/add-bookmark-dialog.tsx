import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, Link, Loader2, Plus, Sparkles } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { CollectionSelector } from '@/components/raindrop/collection-selector'
import { TagInput } from '@/components/raindrop/tag-input'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { usePendingWork } from '@/hooks/usePendingWork'
import { useUrlSuggest } from '@/hooks/useUrlSuggest'
import { bookmarkContentSchema } from '@/lib/bookmark-form-schema'
import type { ContentType, Group } from '@/lib/types'
import { resolveIcon } from '@/utils/favicon'

import { ContentTypeSelect } from './content-type-select'
import { FormDialogActions } from './form-dialog-actions'

const bookmarkSchema = bookmarkContentSchema.extend({
  title: z.string().optional(),
  collectionId: z.string().optional(),
})

type BookmarkFormValues = z.infer<typeof bookmarkSchema>

/**
 * Debounce interval for URL parsing and icon resolution.
 */
const URL_PARSE_DEBOUNCE_MS = 500

/**
 * Props for AddBookmarkDialog component.
 */
interface AddBookmarkDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback to change open state */
  onOpenChange: (open: boolean) => void
  /** Available groups with their collections */
  groups: Group[]
  /** List of existing tag names for autocomplete */
  existingTags: string[]
  /** Default collection ID to pre-select */
  defaultCollectionId?: string
  /** Callback when user saves the bookmark */
  onSave: (data: BookmarkFormValues) => Promise<void> | void
}

/**
 * Reset bookmark fields and parsing state when a new creation session opens.
 * {@link AddBookmarkDialog} calls this so prior manual-edit history cannot leak into a new bookmark.
 * @param open - Whether dialog is open
 * @param defaultCollectionId - Default collection to pre-select
 * @param reset - react-hook-form reset function
 * @param callbacks - Reset preview and metadata-request state together with form values.
 * @example
 * useBookmarkFormReset(open, defaultCollectionId, reset, callbacks)
 */
function useBookmarkFormReset(
  open: boolean,
  defaultCollectionId: string | undefined,
  reset: (values: BookmarkFormValues) => void,
  callbacks: {
    setParsedFavicon: (favicon: string) => void
    setIsNotesOpen: (open: boolean) => void
    setAutoIcon: (auto: boolean) => void
    resetMetadata: () => void
  },
): void {
  useEffect(() => {
    if (open) {
      reset({
        url: '',
        title: '',
        description: '',
        collectionId: defaultCollectionId || '',
        type: 'link',
        notes: '',
        isImportant: false,
        tags: [],
      })
      callbacks.setParsedFavicon('')
      callbacks.setIsNotesOpen(false)
      callbacks.setAutoIcon(true)
      callbacks.resetMetadata()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCollectionId, reset])
}

/**
 * Schedule metadata parsing after the URL stops changing.
 * {@link AddBookmarkDialog} calls this for its URL field; cleanup cancels an obsolete scheduled parse.
 * @param url - The URL value to parse
 * @param parseUrl - URL parsing callback.
 * @example
 * useDebouncedUrlParsing(url, parseUrl)
 */
function useDebouncedUrlParsing(
  url: string,
  parseUrl: (url: string) => Promise<void>,
): void {
  useEffect(() => {
    if (!url) return
    const debounce = setTimeout(
      () => void parseUrl(url).catch(() => undefined),
      URL_PARSE_DEBOUNCE_MS,
    )
    return (): void => clearTimeout(debounce)
  }, [url, parseUrl])
}

/**
 * Clear parsed favicon when auto icon mode is disabled.
 * @param autoIcon - Auto icon flag
 * @param url - Current URL input value
 * @param setParsedFavicon - Parsed favicon setter
 * @param parseUrl - Existing parse-and-resolve callback
 */
function useParsedFaviconReset(
  autoIcon: boolean,
  url: string,
  setParsedFavicon: React.Dispatch<React.SetStateAction<string>>,
  parseUrl: (url: string) => Promise<void>,
): void {
  const previousAutoIconRef = useRef(autoIcon)

  useEffect(() => {
    const wasAutoIcon = previousAutoIconRef.current
    previousAutoIconRef.current = autoIcon

    if (!autoIcon) {
      setParsedFavicon('')
      return
    }

    if (!wasAutoIcon && autoIcon && url) {
      void parseUrl(url)
    }
  }, [autoIcon, parseUrl, setParsedFavicon, url])
}

/**
 * Dialog for adding a new bookmark (raindrop).
 * Supports URL auto-parsing, tag input with autocomplete,
 * collection selection, type detection, and optional notes.
 *
 * @param open - Controls dialog visibility
 * @param onOpenChange - Callback when dialog open state changes
 * @param groups - Available groups for collection selection
 * @param existingTags - Existing tags for autocomplete suggestions
 * @param defaultCollectionId - Pre-selected collection ID
 * @param onSave - Callback with form data and tags on save
 *
 * @example
 *   <AddBookmarkDialog
 *     open={isOpen}
 *     onOpenChange={setIsOpen}
 *     groups={groups}
 *     existingTags={["react", "typescript"]}
 *     defaultCollectionId="dev"
 *     onSave={(data) => console.log("Save:", data)}
 *   />
 */
/**
 * Debounce URL metadata while rejecting stale responses and preserving every manually edited field.
 * Used by {@link useNewBookmarkEditor}; reopening invalidates the previous metadata generation.
 * @example
 * const metadata = useBookmarkMetadata({ setValue, getValues, getFieldState, url })
 */
function useBookmarkMetadata({
  setValue,
  getValues,
  getFieldState,
  url,
}: Pick<
  ReturnType<typeof useForm<BookmarkFormValues>>,
  'setValue' | 'getValues' | 'getFieldState'
> & { url: string }) {
  const [isParsing, setIsParsing] = useState(false)
  const [parsedFavicon, setParsedFavicon] = useState('')
  const [autoIcon, setAutoIcon] = useState(true)
  const parseRequestIdRef = useRef(0)
  const manuallyEditedMetadata = useRef(
    new Set<'title' | 'description' | 'type'>(),
  )
  const resetMetadata = useCallback(() => {
    manuallyEditedMetadata.current.clear()
    parseRequestIdRef.current += 1
    setIsParsing(false)
  }, [])
  const handleTitleInput = useCallback(() => {
    manuallyEditedMetadata.current.add('title')
  }, [])
  const handleDescriptionInput = useCallback(() => {
    manuallyEditedMetadata.current.add('description')
  }, [])
  const { fetchSuggestion } = useUrlSuggest()

  // Auto-parse URL metadata and icon.
  const parseUrl = useCallback(
    async (urlValue: string) => {
      if (!urlValue) return
      try {
        new URL(urlValue)
      } catch {
        return
      }

      const requestId = parseRequestIdRef.current + 1
      parseRequestIdRef.current = requestId
      setIsParsing(true)
      try {
        const [metadata, icon] = await Promise.all([
          fetchSuggestion(urlValue),
          autoIcon
            ? resolveIcon(urlValue).catch(() => null)
            : Promise.resolve(null),
        ])
        // Retain manual-edit intent even when the user clears a field back to its default value.
        // An old URL response must never overwrite a newer URL or manual edits.
        if (
          parseRequestIdRef.current !== requestId ||
          getValues('url') !== urlValue
        )
          return
        const mayPrefill = (
          field: 'title' | 'description' | 'type',
        ): boolean => {
          if (
            manuallyEditedMetadata.current.has(field) ||
            getFieldState(field).isDirty
          )
            return false
          return field === 'type' || !getValues(field)
        }
        if (metadata?.title && mayPrefill('title'))
          setValue('title', metadata.title)
        if (metadata?.excerpt && mayPrefill('description'))
          setValue('description', metadata.excerpt)
        if (metadata?.type && mayPrefill('type'))
          setValue('type', metadata.type)
        setParsedFavicon(icon ?? '')
      } finally {
        if (parseRequestIdRef.current === requestId) setIsParsing(false)
      }
    },
    [autoIcon, fetchSuggestion, getFieldState, getValues, setValue],
  )

  useParsedFaviconReset(autoIcon, url, setParsedFavicon, parseUrl)

  useDebouncedUrlParsing(url, parseUrl)

  const handleTypeChange = useCallback(
    (val: string) => {
      manuallyEditedMetadata.current.add('type')
      setValue('type', val as ContentType, { shouldDirty: true })
    },
    [setValue],
  )
  return {
    isParsing,
    parsedFavicon,
    setParsedFavicon,
    autoIcon,
    setAutoIcon,
    resetMetadata,
    handleTitleInput,
    handleDescriptionInput,
    handleTypeChange,
  }
}

/**
 * Own one bookmark creation session and preserve its inputs when the server rejects a save.
 * Called by {@link AddBookmarkDialog}; metadata and text editing remain separate concerns.
 * @example
 * const editor = useNewBookmarkEditor(props)
 */
function useNewBookmarkEditor({
  open,
  onOpenChange,
  defaultCollectionId,
  onSave,
}: AddBookmarkDialogProps) {
  const [isNotesOpen, setIsNotesOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    getFieldState,
    setError,
    clearErrors,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<BookmarkFormValues>({
    resolver: zodResolver(bookmarkSchema),
    defaultValues: {
      url: '',
      title: '',
      description: '',
      collectionId: defaultCollectionId || '',
      type: 'link',
      notes: '',
      isImportant: false,
      tags: [],
    },
  })

  const [tags, selectedCollection, url, selectedType, isImportant] = useWatch({
    control,
    name: ['tags', 'collectionId', 'url', 'type', 'isImportant'] as const,
  })
  const handleTagsChange = useCallback(
    (values: string[]) => setValue('tags', values, { shouldDirty: true }),
    [setValue],
  )

  const {
    isParsing,
    parsedFavicon,
    setParsedFavicon,
    autoIcon,
    setAutoIcon,
    resetMetadata,
    handleTitleInput,
    handleDescriptionInput,
    handleTypeChange,
  } = useBookmarkMetadata({ setValue, getValues, getFieldState, url })

  usePendingWork(open && (isDirty || isSubmitting))

  useBookmarkFormReset(open, defaultCollectionId, reset, {
    setParsedFavicon,
    setIsNotesOpen,
    setAutoIcon,
    resetMetadata,
  })

  const handleCollectionChange = useCallback(
    (id: string) => setValue('collectionId', id, { shouldDirty: true }),
    [setValue],
  )
  const handleImportantChange = useCallback(
    (checked: boolean) =>
      setValue('isImportant', checked, { shouldDirty: true }),
    [setValue],
  )
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange])

  const onSubmit = async (data: BookmarkFormValues): Promise<void> => {
    clearErrors('root.server')
    try {
      await onSave(data)
      onOpenChange(false)
    } catch {
      setError('root.server', {
        message:
          'Could not save the bookmark. Your input is preserved; try again.',
      })
    }
  }

  const handleDialogOpenChange = useCallback(
    (next: boolean): void => {
      if (!isSubmitting) onOpenChange(next)
    },
    [isSubmitting, onOpenChange],
  )

  return {
    isNotesOpen,
    setIsNotesOpen,
    register,
    handleSubmit,
    errors,
    isSubmitting,
    tags,
    selectedCollection,
    selectedType,
    isImportant,
    handleTagsChange,
    isParsing,
    parsedFavicon,
    autoIcon,
    setAutoIcon,
    handleTitleInput,
    handleDescriptionInput,
    handleTypeChange,
    handleCollectionChange,
    handleImportantChange,
    handleCancel,
    onSubmit,
    handleDialogOpenChange,
  }
}

const AddBookmarkDialog = React.memo(function AddBookmarkDialog({
  open,
  onOpenChange,
  groups,
  existingTags,
  defaultCollectionId,
  onSave,
}: AddBookmarkDialogProps) {
  const {
    isNotesOpen,
    setIsNotesOpen,
    register,
    handleSubmit,
    errors,
    isSubmitting,
    tags,
    selectedCollection,
    selectedType,
    isImportant,
    handleTagsChange,
    isParsing,
    parsedFavicon,
    autoIcon,
    setAutoIcon,
    handleTitleInput,
    handleDescriptionInput,
    handleTypeChange,
    handleCollectionChange,
    handleImportantChange,
    handleCancel,
    onSubmit,
    handleDialogOpenChange,
  } = useNewBookmarkEditor({
    open,
    onOpenChange,
    defaultCollectionId,
    onSave,
    groups,
    existingTags,
  })

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-135">
        <form
          className="flex min-h-0 flex-col"
          onSubmit={handleSubmit(onSubmit)}
        >
          <DialogHeader className="shrink-0 pr-6">
            <DialogTitle className="flex items-center gap-2">
              <Plus className="text-primary h-5 w-5" />
              Add Bookmark
            </DialogTitle>
            <DialogDescription>
              Paste a URL to quickly add a new bookmark.
            </DialogDescription>
          </DialogHeader>

          {/* Keep the title and actions reachable while long forms scroll within the viewport. */}
          <div className="-mx-1 grid min-h-0 gap-4 overflow-y-auto overscroll-contain px-1 py-4">
            {/* URL Input */}
            <div className="grid gap-2">
              <Label htmlFor="bookmark-url">URL</Label>
              <div className="relative">
                <Link className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="bookmark-url"
                  placeholder="https://..."
                  className="pl-9"
                  {...register('url')}
                  autoFocus
                />
                {isParsing && (
                  <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
                )}
              </div>
              {errors.url && (
                <p className="text-destructive text-sm">{errors.url.message}</p>
              )}
            </div>

            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="bookmark-title">Title</Label>
              <div className="flex items-center gap-2">
                {parsedFavicon && (
                  <img
                    data-testid="bookmark-favicon-preview"
                    src={parsedFavicon}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-sm"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                )}
                <Input
                  id="bookmark-title"
                  placeholder="Bookmark title"
                  className="flex-1"
                  {...register('title')}
                  onInput={handleTitleInput}
                />
              </div>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="bookmark-description">Description</Label>
              <Textarea
                id="bookmark-description"
                placeholder="Brief description..."
                className="resize-none"
                rows={2}
                {...register('description')}
                onInput={handleDescriptionInput}
              />
            </div>

            {/* Collection Selector */}
            <div className="grid gap-2">
              <Label>Collection</Label>
              <CollectionSelector
                groups={groups}
                value={selectedCollection}
                onChange={handleCollectionChange}
                placeholder="Select collection..."
              />
            </div>

            <TagInput
              value={tags}
              onChange={handleTagsChange}
              suggestions={existingTags}
              label="Tags"
              placeholder="Add tags..."
              disabled={isSubmitting}
            />

            {/* Type & Important row */}
            <div className="flex items-end gap-4">
              <div className="grid flex-1 gap-2">
                <Label htmlFor="bookmark-type">Type</Label>
                <ContentTypeSelect
                  id="bookmark-type"
                  value={selectedType}
                  onValueChange={handleTypeChange}
                />
              </div>

              <div className="flex items-center gap-2">
                <Sparkles className="text-muted-foreground h-4 w-4" />
                <Label
                  htmlFor="auto-icon"
                  className="text-muted-foreground text-sm whitespace-nowrap"
                >
                  Auto Icon
                </Label>
                <Switch
                  id="auto-icon"
                  checked={autoIcon}
                  onCheckedChange={setAutoIcon}
                />
              </div>
            </div>

            {/* Important toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="grid gap-1">
                <Label htmlFor="bookmark-important">Mark as Important</Label>
                <p className="text-muted-foreground text-xs">
                  Bookmark will be highlighted with a star indicator
                </p>
              </div>
              <Switch
                id="bookmark-important"
                checked={isImportant}
                onCheckedChange={handleImportantChange}
              />
            </div>

            {/* Notes (collapsible) */}
            <Collapsible open={isNotesOpen} onOpenChange={setIsNotesOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between"
                >
                  <span className="text-muted-foreground text-sm">
                    Add notes (optional)
                  </span>
                  <ChevronDown
                    className={`text-muted-foreground h-4 w-4 transition-transform ${
                      isNotesOpen ? 'rotate-180' : ''
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Textarea
                  placeholder="Personal notes about this bookmark..."
                  className="mt-2 resize-none"
                  rows={3}
                  {...register('notes')}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="shrink-0">
            {errors.root?.server && (
              <p role="alert" className="text-destructive mb-3 text-sm">
                {errors.root.server.message}
              </p>
            )}
            <FormDialogActions
              pending={isSubmitting}
              onCancel={handleCancel}
              submitLabel={isSubmitting ? 'Saving...' : 'Save Bookmark'}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
})
export { AddBookmarkDialog }
