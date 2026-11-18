import { useState, useMemo, useCallback, memo } from 'react'
import type { ChangeEvent } from 'react'

import { Button } from '@/components/ui/button'
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
import type { Group } from '@/lib/types'

import { CollectionSelector } from './collection-selector'

export type BulkAction = { kind: 'move' | 'tag'; ids: string[] }

interface BulkActionDialogProps {
  action: BulkAction
  groups: Group[]
  onClose: () => void
  onMove?: (ids: string[], destination: string) => Promise<void>
  onTag?: (ids: string[], tags: string[]) => Promise<void>
}

const SYSTEM_DESTINATIONS: Group = {
  id: 'system-destinations',
  name: 'System',
  collections: [
    {
      id: 'unsorted',
      name: 'Unsorted',
      groupId: 'system-destinations',
      icon: 'Folder',
      count: 0,
    },
  ],
}

/**
 * Preserve the bulk selection and draft while its request runs or fails.
 * {@link BulkActionDialog} invokes this controller for one captured selection.
 * @returns Input bindings, pending/error state, and guarded save/dismiss actions.
 * @example
 * const editor = useBulkActionEditor(props)
 */
function useBulkActionEditor({
  action,
  onClose,
  onMove,
  onTag,
}: Omit<BulkActionDialogProps, 'groups'>) {
  const [destination, setDestination] = useState('unsorted')
  const [tags, setTags] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const normalizedTags = useMemo(
    () => [
      ...new Set(
        tags
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
      ),
    ],
    [tags],
  )
  const submit = useCallback(async (): Promise<void> => {
    // Prevent concurrent writes before a caller can dismiss this captured selection.
    if (pending) return
    setPending(true)
    setError('')
    try {
      // Each dialog opens for exactly one operation and preserves its original IDs.
      if (action.kind === 'move') await onMove?.(action.ids, destination)
      else await onTag?.(action.ids, normalizedTags)
      onClose()
    } catch {
      setError(
        'The operation could not be completed. Your selection is preserved; try again.',
      )
    } finally {
      setPending(false)
    }
  }, [action, destination, normalizedTags, onClose, onMove, onTag, pending])
  const handleOpenChange = useCallback(
    (open: boolean) => {
      // Escape and backdrop dismissal must wait for the server's result.
      if (!open && !pending) onClose()
    },
    [onClose, pending],
  )
  const handleTagsChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setTags(event.target.value),
    [],
  )
  const canApply =
    action.kind === 'tag'
      ? Boolean(onTag) && normalizedTags.length > 0
      : Boolean(onMove)
  return {
    destination,
    setDestination,
    tags,
    handleTagsChange,
    pending,
    error,
    submit,
    handleOpenChange,
    canApply,
  }
}

/**
 * Collect a destination or tags for the selection opened by {@link MainContent}.
 * Keeps the selection and input available after an API failure.
 * @example
 * <BulkActionDialog action={action} groups={groups} onClose={close} onMove={move} onTag={tag} />
 */
export const BulkActionDialog = memo(function BulkActionDialog(
  props: BulkActionDialogProps,
) {
  const { action, groups, onClose } = props
  const {
    destination,
    setDestination,
    tags,
    handleTagsChange,
    pending,
    error,
    submit,
    handleOpenChange,
    canApply,
  } = useBulkActionEditor(props)
  const destinations = useMemo(() => [SYSTEM_DESTINATIONS, ...groups], [groups])
  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action.kind === 'move' ? 'Move bookmarks' : 'Add tags'}
          </DialogTitle>
          <DialogDescription>
            {action.ids.length} selected bookmarks.{' '}
            {action.kind === 'tag'
              ? 'Existing tags are kept. Separate new tags with commas.'
              : 'Choose their new collection.'}
          </DialogDescription>
        </DialogHeader>
        {action.kind === 'move' ? (
          <CollectionSelector
            groups={destinations}
            value={destination}
            onChange={setDestination}
          />
        ) : (
          <div className="space-y-2">
            <Label htmlFor="bulk-tags">Tags</Label>
            <Input
              id="bulk-tags"
              value={tags}
              onChange={handleTagsChange}
              placeholder="research, read-later"
            />
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || !canApply} onClick={submit}>
            {pending ? 'Saving...' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
