import {
  Copy,
  ExternalLink,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Star,
  Tag,
  Trash2,
} from 'lucide-react'
import React, { useCallback } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Raindrop } from '@/lib/types'

import type { MainContentProps } from './main-content.types'

export type BookmarkItemActions = Pick<
  MainContentProps,
  'onSelectRaindrop' | 'onBatchDelete' | 'onToggleImportant'
> & {
  onMove: (ids: string[]) => void
  onTag: (ids: string[]) => void
}

/** Keep row selection independent of controls nested within a bookmark. */
function stopBookmarkPropagation(event: React.MouseEvent): void {
  event.stopPropagation()
}

/**
 * Execute the same bookmark actions from card and list context menus.
 * Called by the two row renderers; actions capture this bookmark's ID rather than the bulk selection.
 * @example
 * <BookmarkItemMenu raindrop={bookmark} actions={actions} variant="grid" />
 */
export const BookmarkItemMenu = React.memo(function BookmarkItemMenu({
  raindrop,
  actions,
  variant,
}: {
  raindrop: Raindrop
  actions: BookmarkItemActions
  variant: 'grid' | 'list'
}) {
  const openUrl = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      void window.shell.openExternal(raindrop.url)
    },
    [raindrop.url],
  )
  const edit = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      actions.onSelectRaindrop(raindrop)
    },
    [actions, raindrop],
  )
  const move = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      actions.onMove([raindrop.id])
    },
    [actions, raindrop.id],
  )
  const tag = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      actions.onTag([raindrop.id])
    },
    [actions, raindrop.id],
  )
  const copy = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      void navigator.clipboard
        .writeText(raindrop.url)
        .catch(() =>
          toast.error('Could not copy the bookmark URL. Please try again.'),
        )
    },
    [raindrop.url],
  )
  const toggleImportant = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      actions.onToggleImportant?.(raindrop.id)
    },
    [actions, raindrop.id],
  )
  const remove = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      void actions
        .onBatchDelete?.([raindrop.id])
        .catch(() =>
          toast.error(
            'Bookmark could not be moved to Trash. Please try again.',
          ),
        )
    },
    [actions, raindrop.id],
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant === 'grid' ? 'secondary' : 'ghost'}
          size="icon"
          className={
            variant === 'grid'
              ? 'bg-background/80 h-6 w-6 backdrop-blur-sm'
              : 'h-7 w-7'
          }
          aria-label={`Actions for ${raindrop.title}`}
          onClick={stopBookmarkPropagation}
          onPointerDown={stopBookmarkPropagation}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        onPointerDown={stopBookmarkPropagation}
        align="end"
        className="w-48"
      >
        <DropdownMenuItem onClick={openUrl}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Open URL
        </DropdownMenuItem>
        <DropdownMenuItem onClick={edit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={move}>
          <FolderInput className="mr-2 h-4 w-4" />
          Move to Collection...
        </DropdownMenuItem>
        <DropdownMenuItem onClick={tag}>
          <Tag className="mr-2 h-4 w-4" />
          Add Tags...
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copy}>
          <Copy className="mr-2 h-4 w-4" />
          Copy URL
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={toggleImportant}
          disabled={!actions.onToggleImportant}
        >
          <Star className="mr-2 h-4 w-4" />
          {raindrop.isImportant ? 'Remove Important' : 'Mark as Important'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={remove}
          disabled={!actions.onBatchDelete}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Move to Trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
