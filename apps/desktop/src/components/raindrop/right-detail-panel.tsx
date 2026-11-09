import { zodResolver } from '@hookform/resolvers/zod'
import {
  Calendar,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Highlighter,
  Link,
  PanelRightClose,
  PanelRightOpen,
  Star,
  Trash2,
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { TagInput } from '@/components/raindrop/tag-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { usePendingWork } from '@/hooks/usePendingWork'
import { bookmarkContentSchema } from '@/lib/bookmark-form-schema'
import type { ContentType, Group, Raindrop } from '@/lib/types'
import { cn } from '@/lib/utils'
import { extractDomain } from '@/utils/favicon'
import { findCollectionInTree } from '@/utils/find-collection-in-tree'

import { ContentTypeIcon } from './content-type-icon'
import { ContentTypeSelect } from './content-type-select'
import { FaviconIcon } from './favicon-icon'

const raindropSchema = bookmarkContentSchema.extend({
  title: z.string().min(1, 'Title is required'),
})

type RaindropFormValues = z.infer<typeof raindropSchema>

/**
 * Props for RightDetailPanel component.
 */
interface RightDetailPanelProps {
  /** Reopen the retained selection when the navigation owner permits it. */
  onOpen?: () => void
  /** The currently selected raindrop to display/edit */
  raindrop?: Raindrop
  /** Whether the panel is open */
  isOpen: boolean
  /** Callback to close the panel */
  onClose: () => void
  /** Available groups for collection display */
  groups: Group[]
  /** Existing tag names for autocomplete */
  existingTags: string[]
  /** Callback when user saves changes to the raindrop */
  onSave: (raindrop: Raindrop) => Promise<void> | void
  /** Callback when user deletes the raindrop */
  onDelete: (raindropId: string) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
}

/**
 * Synchronize remote bookmark data without discarding local edits.
 * {@link RightDetailPanel} calls this on selection/refetch; explicit reload resolves a conflict.
 * @param raindrop - Selected raindrop data
 * @param reset - react-hook-form reset function
 * @param isDirty - Whether a remote update must wait for the user's save/discard decision.
 * @returns Conflict state, reload action, and a successful-save acknowledgment.
 * @example
 * const { conflict, reload, acknowledgeSave } = useRaindropFormSync(raindrop, reset, isDirty)
 */
function useRaindropFormSync(
  raindrop: Raindrop | undefined,
  reset: (values: RaindropFormValues) => void,
  isDirty: boolean,
) {
  const observed = useRef('')
  const previousId = useRef<string | undefined>(undefined)
  const [conflict, setConflict] = useState(false)
  const acknowledgeSave = useCallback(() => setConflict(false), [])
  const reload = useCallback(() => {
    if (!raindrop) return
    reset({
      title: raindrop.title,
      url: raindrop.url,
      description: raindrop.description ?? '',
      type: raindrop.type,
      notes: raindrop.notes ?? '',
      isImportant: raindrop.isImportant ?? false,
      tags: raindrop.tags ?? [],
    })
    setConflict(false)
  }, [raindrop, reset])
  useEffect(() => {
    const signature = JSON.stringify(raindrop)
    if (observed.current === signature) return
    observed.current = signature
    const sameBookmark = previousId.current === raindrop?.id
    previousId.current = raindrop?.id
    // Keep local input when another client changes the same bookmark.
    if (sameBookmark && isDirty) {
      setConflict(true)
      return
    }
    reload()
  }, [raindrop, isDirty, reload])
  return { conflict, reload, acknowledgeSave }
}

/**
 * Notify navigation guards when detail edits or active writes require a discard decision.
 * {@link RightDetailPanel} calls this whenever its visible dirty/busy state changes.
 * @example
 * useDetailDirtyNotification(isOpen && (isDirty || isSubmitting), onDirtyChange)
 */
function useDetailDirtyNotification(
  dirty: boolean,
  notify?: (dirty: boolean) => void,
): void {
  useEffect(() => {
    notify?.(dirty)
  }, [dirty, notify])
}

/**
 * Right-side detail panel showing selected raindrop information and edit form.
 * Displays cover image, metadata, tags, highlights, and action buttons.
 * Slides in/out from the right edge of the layout.
 *
 * @param raindrop - Selected raindrop data to display
 * @param isOpen - Controls panel visibility
 * @param onClose - Callback to close the panel
 * @param groups - Available groups for context
 * @param existingTags - Existing tags for autocomplete
 * @param onSave - Callback with updated raindrop on save
 * @param onDelete - Callback with raindrop ID on delete
 *
 * @example
 *   <RightDetailPanel
 *     raindrop={selectedRaindrop}
 *     isOpen={isDetailOpen}
 *     onClose={() => setIsDetailOpen(false)}
 *     groups={groups}
 *     existingTags={["react", "typescript"]}
 *     onSave={handleSave}
 *     onDelete={handleDelete}
 *   />
 */
/**
 * Own detail drafts and remote-conflict reconciliation without coupling them to panel presentation.
 * Called by {@link RightDetailPanel}; successful saves advance defaults while preserving newer input.
 * @example
 * const editor = useDetailEditor(props)
 */
function useDetailEditor({
  raindrop,
  isOpen,
  onSave,
  onDelete,
  onDirtyChange,
}: RightDetailPanelProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    resetDefaultValues,
    setValue,
    control,
    setError,
    clearErrors,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<RaindropFormValues>({
    resolver: zodResolver(raindropSchema),
    defaultValues: {
      title: '',
      url: '',
      description: '',
      type: 'link',
      notes: '',
      isImportant: false,
      tags: [],
    },
  })

  const [selectedType, isImportant, currentUrl, tags] = useWatch({
    control,
    name: ['type', 'isImportant', 'url', 'tags'] as const,
  })
  const handleTagsChange = useCallback(
    (values: string[]): void => setValue('tags', values, { shouldDirty: true }),
    [setValue],
  )
  const { conflict, reload, acknowledgeSave } = useRaindropFormSync(
    raindrop,
    reset,
    isDirty,
  )
  const pendingWork = isOpen && (isDirty || isSubmitting || isDeleting)
  usePendingWork(pendingWork)
  useDetailDirtyNotification(pendingWork, onDirtyChange)

  const handleTypeChange = useCallback(
    (val: string) =>
      setValue('type', val as ContentType, { shouldDirty: true }),
    [setValue],
  )
  const handleImportantChange = useCallback(
    (checked: boolean) =>
      setValue('isImportant', checked, { shouldDirty: true }),
    [setValue],
  )
  const handleDelete = useCallback(async () => {
    if (!raindrop || isDeleting || isSubmitting) return
    clearErrors('root.server')
    setIsDeleting(true)
    try {
      // The navigation owner closes only after the server confirms deletion.
      await onDelete(raindrop.id)
    } catch {
      setError('root.server', {
        message:
          'Could not move this bookmark to Trash. Your input is preserved; try again.',
      })
    } finally {
      setIsDeleting(false)
    }
  }, [raindrop, isDeleting, isSubmitting, clearErrors, onDelete, setError])
  const onSubmit = async (data: RaindropFormValues): Promise<void> => {
    if (!raindrop) return
    clearErrors('root.server')
    try {
      await onSave({ ...raindrop, ...data })
      // Advance the saved baseline while preserving any edits typed during the request.
      resetDefaultValues(data)
      acknowledgeSave()
    } catch {
      setError('root.server', {
        message: 'Could not save changes. Your input is preserved; try again.',
      })
    }
  }

  return {
    register,
    handleSubmit,
    errors,
    isDirty,
    isSubmitting,
    isDeleting,
    selectedType,
    isImportant,
    currentUrl,
    tags,
    handleTagsChange,
    conflict,
    reload,
    handleTypeChange,
    handleImportantChange,
    handleDelete,
    onSubmit,
  }
}

/**
 * Open or copy the URL currently being edited, with visible clipboard confirmation.
 * @example
 * <DetailUrlActions currentUrl="https://example.com" />
 */
const DetailUrlActions = React.memo(function DetailUrlActions({
  currentUrl,
}: {
  currentUrl: string
}) {
  const [copied, setCopied] = useState(false)
  const handleCopyUrl = useCallback(async () => {
    if (!currentUrl) return
    try {
      await navigator.clipboard.writeText(currentUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may not be available in all contexts
    }
  }, [currentUrl])

  const handleOpenUrl = useCallback(() => {
    if (!currentUrl) return
    window.shell.openExternal(currentUrl)
  }, [currentUrl])

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              onClick={handleOpenUrl}
              aria-label="Open in browser"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open in browser</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              onClick={handleCopyUrl}
              aria-label={copied ? 'Copied URL' : 'Copy URL'}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? 'Copied!' : 'Copy URL'}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  )
})

/**
 * Display the saved cover and current URL identity without retaining stale favicon failure state.
 * Called by the detail form; {@link FaviconIcon} owns URL-specific fallback behavior.
 * @example
 * <DetailBookmarkPreview {...props} />
 */
const DetailBookmarkPreview = React.memo(function DetailBookmarkPreview({
  raindrop,
  url,
  groups,
  isImportant,
}: {
  raindrop: Raindrop
  url: string
  groups: Group[]
  isImportant: boolean
}) {
  const domain = extractDomain(url)
  const collectionName =
    groups
      .map((group) =>
        findCollectionInTree(group.collections, raindrop.collectionId),
      )
      .find(Boolean)?.name ?? 'Unknown'
  return (
    <>
      {raindrop.coverImage && (
        <div className="bg-muted relative aspect-video overflow-hidden rounded-lg">
          <img
            src={raindrop.coverImage}
            alt={raindrop.title}
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
          <Badge
            variant="secondary"
            className="absolute top-2 right-2 capitalize"
          >
            {raindrop.type}
          </Badge>
        </div>
      )}
      <div className="flex items-center gap-3">
        <FaviconIcon url={url} type={raindrop.type} size={32} />
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground truncate text-sm">{domain}</p>
          <p className="text-muted-foreground text-xs">in {collectionName}</p>
        </div>
        {isImportant && (
          <Star
            aria-label="Important"
            className="h-4 w-4 shrink-0 fill-yellow-500 text-yellow-500"
          />
        )}
      </div>
    </>
  )
})

/** Format a stored timestamp for the detail metadata section, preserving invalid source text. */
function formatDetailDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

/**
 * Show saved highlights and timestamps independently from the mutable form draft.
 * @example
 * <DetailBookmarkMetadata raindrop={bookmark} />
 */
const DetailBookmarkMetadata = React.memo(function DetailBookmarkMetadata({
  raindrop,
}: {
  raindrop: Raindrop
}) {
  return (
    <>
      {' '}
      {/* Highlights */}
      {raindrop.highlights && raindrop.highlights.length > 0 && (
        <div className="grid gap-2">
          <Label className="flex items-center gap-1.5">
            <Highlighter className="h-3.5 w-3.5" />
            Highlights
          </Label>
          <div className="space-y-2">
            {raindrop.highlights.map((highlight, index) => (
              <div
                key={index}
                className="border-primary bg-primary/5 rounded-md border-l-2 px-3 py-2"
              >
                <p className="text-foreground/80 text-sm italic">
                  &ldquo;{highlight}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      <Separator />
      {/* Metadata */}
      <div className="text-muted-foreground space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5" />
          <span>Created: {formatDetailDate(raindrop.createdAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          <span>Updated: {formatDetailDate(raindrop.updatedAt)}</span>
        </div>
      </div>
      <Separator />
    </>
  )
})

/**
 * Render editable fields from the detail session while saved metadata stays read-only.
 * @example
 * <DetailBookmarkForm {...props} />
 */
const DetailBookmarkForm = React.memo(function DetailBookmarkForm({
  editor,
  raindrop,
  groups,
  existingTags,
}: {
  editor: ReturnType<typeof useDetailEditor>
  raindrop: Raindrop
  groups: Group[]
  existingTags: string[]
}) {
  const {
    register,
    handleSubmit,
    errors,
    isDirty,
    isSubmitting,
    isDeleting,
    selectedType,
    isImportant,
    currentUrl,
    tags,
    handleTagsChange,
    conflict,
    reload,
    handleTypeChange,
    handleImportantChange,
    handleDelete,
    onSubmit,
  } = editor
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      {conflict && (
        <div
          role="alert"
          className="rounded-md border border-amber-500 p-3 text-sm"
        >
          <p>
            This bookmark changed on another device. Your edits are preserved.
            Saving will replace those fields with your edits.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={reload}>
            Discard edits and load latest
          </Button>
        </div>
      )}
      <DetailBookmarkPreview
        raindrop={raindrop}
        url={currentUrl}
        groups={groups}
        isImportant={isImportant}
      />
      <Separator />

      {/* Title */}
      <div className="grid gap-2">
        <Label htmlFor="detail-title">Title</Label>
        <Input id="detail-title" {...register('title')} />
        {errors.title && (
          <p className="text-destructive text-sm">{errors.title.message}</p>
        )}
      </div>

      {/* URL */}
      <div className="grid gap-2">
        <Label htmlFor="detail-url">URL</Label>
        <div className="flex gap-1">
          <div className="relative flex-1">
            <Link className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              id="detail-url"
              className="pl-8 text-xs"
              {...register('url')}
            />
          </div>
          <DetailUrlActions currentUrl={currentUrl} />
        </div>
        {errors.url && (
          <p className="text-destructive text-sm">{errors.url.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="grid gap-2">
        <Label htmlFor="detail-description">Description</Label>
        <Textarea
          id="detail-description"
          className="resize-none text-sm"
          rows={3}
          placeholder="Add a description..."
          {...register('description')}
        />
      </div>

      {/* Type */}
      <div className="grid gap-2">
        <Label htmlFor="detail-type">Type</Label>
        <ContentTypeSelect
          id="detail-type"
          value={selectedType}
          onValueChange={handleTypeChange}
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

      {/* Important toggle */}
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="detail-important" className="flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5" />
          Important
        </Label>
        <Switch
          id="detail-important"
          checked={isImportant}
          onCheckedChange={handleImportantChange}
        />
      </div>

      {/* Notes */}
      <div className="grid gap-2">
        <Label htmlFor="detail-notes">Notes</Label>
        <Textarea
          id="detail-notes"
          className="resize-none text-sm"
          rows={4}
          placeholder="Personal notes..."
          {...register('notes')}
        />
      </div>

      <DetailBookmarkMetadata raindrop={raindrop} />

      {errors.root?.server && (
        <p role="alert" className="text-destructive text-sm">
          {errors.root.server.message}
        </p>
      )}
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          type="submit"
          className="flex-1"
          disabled={isSubmitting || isDeleting || !isDirty}
        >
          {isSubmitting
            ? 'Saving...'
            : conflict
              ? 'Save my edits'
              : 'Save Changes'}
        </Button>
      </div>

      <Button
        type="button"
        variant="destructive"
        className="w-full"
        onClick={handleDelete}
        disabled={isSubmitting || isDeleting}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {isDeleting ? 'Moving to Trash…' : 'Move to Trash'}
      </Button>
    </form>
  )
})

/**
 * Present the selected bookmark editor and expose explicit close/reopen navigation controls.
 * @example
 * <RightDetailPanel {...props} />
 */
const RightDetailPanel = React.memo(function RightDetailPanel(
  props: RightDetailPanelProps,
) {
  const { raindrop, isOpen, onClose, onOpen, groups, existingTags } = props
  const editor = useDetailEditor(props)
  return (
    <div
      data-testid="detail-panel"
      className={cn(
        'bg-background flex h-screen flex-col border-l transition-all duration-200 ease-in-out',
        isOpen
          ? 'w-[360px] min-w-[360px]'
          : 'w-0 min-w-0 overflow-hidden border-l-0',
      )}
    >
      {isOpen && raindrop && (
        <>
          <div className="flex shrink-0 items-center justify-between border-b p-3">
            <div className="flex items-center gap-2">
              <ContentTypeIcon
                type={editor.selectedType}
                className="text-muted-foreground h-4 w-4"
              />
              <span className="max-w-[200px] truncate text-sm font-medium">
                Details
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              aria-label="Close detail panel"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <DetailBookmarkForm
              editor={editor}
              raindrop={raindrop}
              groups={groups}
              existingTags={existingTags}
            />
          </ScrollArea>
        </>
      )}
      {!isOpen && onOpen && (
        <div className="fixed top-1/2 right-0 z-10 -translate-y-1/2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-l-md rounded-r-none border-r-0"
            onClick={onOpen}
            aria-label="Open detail panel"
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
})
export { RightDetailPanel }
