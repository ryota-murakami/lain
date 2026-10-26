import { zodResolver } from '@hookform/resolvers/zod'
import {
  Globe,
  FileText,
  Image as ImageIcon,
  Video,
  File,
  Music,
  ChevronDown,
  Loader2,
  Link,
  X,
  Plus,
  Sparkles,
} from 'lucide-react'
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { CollectionSelector } from '@/components/raindrop/collection-selector'
import { Badge } from '@/components/ui/badge'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { Group, ContentType } from '@/lib/types'
import { extractDomain, resolveIcon } from '@/utils/favicon'

const bookmarkSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
  title: z.string().optional(),
  description: z.string().optional(),
  collectionId: z.string().optional(),
  type: z.enum(['link', 'article', 'image', 'video', 'document', 'audio']),
  notes: z.string().optional(),
  isImportant: z.boolean(),
})

type BookmarkFormValues = z.infer<typeof bookmarkSchema>

/**
 * Debounce interval for URL parsing and icon resolution.
 */
const URL_PARSE_DEBOUNCE_MS = 500

/**
 * Type icon mapping for the content type selector.
 */
const TYPE_ICONS: Record<ContentType, typeof Globe> = {
  link: Globe,
  article: FileText,
  image: ImageIcon,
  video: Video,
  document: File,
  audio: Music,
}

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
  onSave: (data: BookmarkFormValues & { tags: string[] }) => void
}

/**
 * Reset bookmark form and tag state when the dialog opens.
 * @param open - Whether dialog is open
 * @param defaultCollectionId - Default collection to pre-select
 * @param reset - react-hook-form reset function
 * @param callbacks - State reset callbacks
 */
function useBookmarkFormReset(
  open: boolean,
  defaultCollectionId: string | undefined,
  reset: (values: BookmarkFormValues) => void,
  callbacks: {
    setTags: (tags: string[]) => void
    setTagInput: (input: string) => void
    setParsedFavicon: (favicon: string) => void
    setIsNotesOpen: (open: boolean) => void
    setAutoIcon: (auto: boolean) => void
  },
) {
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
      })
      callbacks.setTags([])
      callbacks.setTagInput('')
      callbacks.setParsedFavicon('')
      callbacks.setIsNotesOpen(false)
      callbacks.setAutoIcon(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCollectionId, reset])
}

/**
 * Debounced URL parsing effect.
 * @param url - The URL value to parse
 * @param parseUrl - URL parsing callback
 */
function useDebouncedUrlParsing(
  url: string,
  parseUrl: (url: string) => Promise<void>,
) {
  useEffect(() => {
    if (!url) return
    const debounce = setTimeout(
      () => void parseUrl(url).catch(() => undefined),
      URL_PARSE_DEBOUNCE_MS,
    )
    return () => clearTimeout(debounce)
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
) {
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
const AddBookmarkDialog = React.memo(function AddBookmarkDialog({
  open,
  onOpenChange,
  groups,
  existingTags,
  defaultCollectionId,
  onSave,
}: AddBookmarkDialogProps) {
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [parsedFavicon, setParsedFavicon] = useState('')
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [autoIcon, setAutoIcon] = useState(true)
  const parseRequestIdRef = useRef(0)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
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
    },
  })

  const url = watch('url')
  const selectedType = watch('type')
  const isImportant = watch('isImportant')

  useBookmarkFormReset(open, defaultCollectionId, reset, {
    setTags,
    setTagInput,
    setParsedFavicon,
    setIsNotesOpen,
    setAutoIcon,
  })

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
      const domain = extractDomain(urlValue)

      // Auto-detect type from URL.
      if (urlValue.match(/youtube\.com|vimeo\.com|dailymotion\.com|\.mp4$/i)) {
        setValue('type', 'video')
      } else if (urlValue.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
        setValue('type', 'image')
      } else if (urlValue.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i)) {
        setValue('type', 'document')
      } else if (urlValue.match(/\.(mp3|wav|ogg|flac|aac)$/i)) {
        setValue('type', 'audio')
      } else if (
        urlValue.match(
          /medium\.com|dev\.to|hashnode\.dev|substack\.com|blog\./i,
        )
      ) {
        setValue('type', 'article')
      }

      // Auto-fill title from domain if empty.
      const currentTitle = watch('title')
      if (!currentTitle) {
        setValue('title', domain ? `${domain} - Untitled` : '')
      }

      try {
        if (autoIcon) {
          const resolvedIcon = await resolveIcon(urlValue)
          if (parseRequestIdRef.current === requestId) {
            setParsedFavicon(resolvedIcon ?? '')
          }
        }
      } finally {
        if (parseRequestIdRef.current === requestId) {
          setIsParsing(false)
        }
      }
    },
    [autoIcon, setValue, watch],
  )

  useParsedFaviconReset(autoIcon, url, setParsedFavicon, parseUrl)

  useDebouncedUrlParsing(url, parseUrl)

  const tagSuggestions = useMemo(() => {
    if (!tagInput) return []
    const lower = tagInput.toLowerCase()
    return existingTags
      .filter((tag) => tag.toLowerCase().includes(lower) && !tags.includes(tag))
      .slice(0, 5)
  }, [tagInput, existingTags, tags])

  const handleCollectionChange = useCallback(
    (id: string) => setValue('collectionId', id),
    [setValue],
  )
  const handleTypeChange = useCallback(
    (val: string) => setValue('type', val as ContentType),
    [setValue],
  )
  const handleImportantChange = useCallback(
    (checked: boolean) => setValue('isImportant', checked),
    [setValue],
  )
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange])

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (tagSuggestions.length > 0) {
        addTag(tagSuggestions[0])
      } else if (tagInput.trim()) {
        addTag(tagInput)
      }
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  const onSubmit = (data: BookmarkFormValues) => {
    onSave({ ...data, tags })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-135">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="text-primary h-5 w-5" />
              Add Bookmark
            </DialogTitle>
            <DialogDescription>
              Paste a URL to quickly add a new bookmark.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
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
              />
            </div>

            {/* Collection Selector */}
            <div className="grid gap-2">
              <Label>Collection</Label>
              <CollectionSelector
                groups={groups}
                value={watch('collectionId')}
                onChange={handleCollectionChange}
                placeholder="Select collection..."
              />
            </div>

            {/* Tags */}
            <div className="grid gap-2">
              <Label>Tags</Label>
              <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border px-3 py-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:bg-muted-foreground/20 ml-0.5 rounded-sm p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder={tags.length === 0 ? 'Add tags...' : ''}
                  className="placeholder:text-muted-foreground min-w-20 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
              {tagSuggestions.length > 0 && (
                <div className="bg-popover rounded-md border p-1 shadow-md">
                  {tagSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="hover:bg-accent flex w-full items-center rounded-sm px-2 py-1.5 text-sm"
                      onClick={() => addTag(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Type & Important row */}
            <div className="flex items-end gap-4">
              <div className="grid flex-1 gap-2">
                <Label htmlFor="bookmark-type">Type</Label>
                <Select value={selectedType} onValueChange={handleTypeChange}>
                  <SelectTrigger id="bookmark-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(TYPE_ICONS) as [
                        ContentType,
                        typeof Globe,
                      ][]
                    ).map(([type, Icon]) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="capitalize">{type}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isParsing}>
              {isParsing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Parsing...
                </>
              ) : (
                'Save Bookmark'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
})
export { AddBookmarkDialog }
export default AddBookmarkDialog
