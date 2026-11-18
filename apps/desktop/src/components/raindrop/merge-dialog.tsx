import { AlertTriangle, ArrowRight, FolderInput } from 'lucide-react'
import React, { useCallback, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePendingWork } from '@/hooks/usePendingWork'
import { flattenSearchableCollections } from '@/lib/searchable-collections'
import type { Collection } from '@/lib/types'
import { findCollectionInTree } from '@/utils/find-collection-in-tree'

/**
 * Props for MergeDialog component.
 */
interface MergeDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback to change open state */
  onOpenChange: (open: boolean) => void
  /** All available collections for selection */
  collections: Collection[]
  /** Callback when user confirms the merge */
  onConfirm: (sourceId: string, targetId: string) => Promise<void>
}

/**
 * Prevent deleting a merge target by choosing it or one of its ancestors as the source.
 * {@link MergeDialog} disables unsafe choices and {@link useCollectionMerge} rechecks before submission.
 * @returns Whether the target is the source itself or lies anywhere below it.
 * @example isUnsafeCollectionMerge(collections, sourceId, targetId)
 */
function isUnsafeCollectionMerge(
  collections: Collection[],
  sourceId: string,
  targetId: string,
): boolean {
  const source = findCollectionInTree(collections, sourceId)
  return Boolean(source && findCollectionInTree([source], targetId))
}

/**
 * Keep merge selection and retry state until the API confirms success.
 * The dialog uses this controller to guard double submission and closing during a pending merge.
 * @example const merge = useCollectionMerge({ collections, onConfirm, onOpenChange })
 */
function useCollectionMerge({
  collections,
  onConfirm,
  onOpenChange,
}: Omit<MergeDialogProps, 'open'>) {
  const [sourceId, setSourceId] = useState<string>('')
  const [targetId, setTargetId] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pendingRef = useRef(false)
  usePendingWork(busy)

  const sourceCollection = findCollectionInTree(collections, sourceId)
  const targetCollection = findCollectionInTree(collections, targetId)

  const canConfirm = Boolean(
    sourceCollection &&
    targetCollection &&
    !isUnsafeCollectionMerge(collections, sourceId, targetId),
  )

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (pendingRef.current) return
      if (!nextOpen) {
        setError('')
        setSourceId('')
        setTargetId('')
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange],
  )

  const handleCancel = useCallback(
    () => handleOpenChange(false),
    [handleOpenChange],
  )

  const handleConfirm = useCallback(async (): Promise<void> => {
    if (!canConfirm || pendingRef.current) return
    pendingRef.current = true
    setBusy(true)
    setError('')
    try {
      await onConfirm(sourceId, targetId)
      // Close only after the service confirms the merge; failures retain both selections.
      pendingRef.current = false
      handleOpenChange(false)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not merge collections. Your selection is preserved; try again.',
      )
    } finally {
      pendingRef.current = false
      setBusy(false)
    }
  }, [canConfirm, sourceId, targetId, onConfirm, handleOpenChange])

  return {
    sourceId,
    setSourceId,
    targetId,
    setTargetId,
    busy,
    error,
    sourceCollection,
    targetCollection,
    canConfirm,
    handleOpenChange,
    handleCancel,
    handleConfirm,
  }
}

/**
 * Dialog for merging two collections. User selects a source collection
 * (to be deleted) and a target collection (receives bookmarks).
 *
 * @param open - Controls dialog visibility
 * @param onOpenChange - Callback when dialog open state changes
 * @param collections - All available collections for source/target selection
 * @param onConfirm - Callback with source and target IDs on confirmation
 *
 * @example
 *   <MergeDialog
 *     open={isMerging}
 *     onOpenChange={setIsMerging}
 *     collections={allCollections}
 *     onConfirm={(srcId, tgtId) => mergeCollections(srcId, tgtId)}
 *   />
 */
const MergeDialog = React.memo(function MergeDialog({
  open,
  onOpenChange,
  collections,
  onConfirm,
}: MergeDialogProps) {
  const choices = useMemo(
    () =>
      flattenSearchableCollections([{ id: 'merge', name: '', collections }]),
    [collections],
  )
  const {
    sourceId,
    setSourceId,
    targetId,
    setTargetId,
    busy,
    error,
    sourceCollection,
    targetCollection,
    canConfirm,
    handleOpenChange,
    handleCancel,
    handleConfirm,
  } = useCollectionMerge({ collections, onConfirm, onOpenChange })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="text-primary h-5 w-5" />
            Merge Collections
          </DialogTitle>
          <DialogDescription>
            Move all bookmarks from the source into the target, then delete the
            source. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Collection selectors */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="merge-source" className="text-sm font-medium">
                Source (will be deleted)
              </label>
              <Select
                value={sourceId}
                onValueChange={setSourceId}
                disabled={busy}
              >
                <SelectTrigger id="merge-source" className="w-full">
                  <SelectValue placeholder="Select source collection" />
                </SelectTrigger>
                <SelectContent>
                  {choices.map((c) => (
                    <SelectItem
                      key={c.id}
                      value={c.id}
                      disabled={isUnsafeCollectionMerge(
                        collections,
                        c.id,
                        targetId,
                      )}
                    >
                      {c.path.join(' / ')} ({c.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="text-muted-foreground h-5 w-5" />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="merge-target" className="text-sm font-medium">
                Target (receives bookmarks)
              </label>
              <Select
                value={targetId}
                onValueChange={setTargetId}
                disabled={busy}
              >
                <SelectTrigger id="merge-target" className="w-full">
                  <SelectValue placeholder="Select target collection" />
                </SelectTrigger>
                <SelectContent>
                  {choices.map((c) => (
                    <SelectItem
                      key={c.id}
                      value={c.id}
                      disabled={isUnsafeCollectionMerge(
                        collections,
                        sourceId,
                        c.id,
                      )}
                    >
                      {c.path.join(' / ')} ({c.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            The target must be outside the source collection and its
            descendants. Unavailable choices are disabled.
          </p>

          {/* Preview when both selected */}
          {sourceCollection && targetCollection && (
            <>
              {/* Visual merge representation */}
              <div className="bg-muted/30 flex items-center gap-3 rounded-lg border p-4">
                <div className="flex-1 text-center">
                  <div
                    className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium text-white"
                    style={{
                      backgroundColor: sourceCollection.color || '#8b5cf6',
                    }}
                  >
                    {sourceCollection.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="truncate text-sm font-medium">
                    {sourceCollection.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {sourceCollection.count} bookmarks
                  </p>
                </div>

                <ArrowRight className="text-muted-foreground h-5 w-5 flex-shrink-0" />

                <div className="flex-1 text-center">
                  <div
                    className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium text-white"
                    style={{
                      backgroundColor: targetCollection.color || '#8b5cf6',
                    }}
                  >
                    {targetCollection.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="truncate text-sm font-medium">
                    {targetCollection.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {targetCollection.count} bookmarks
                  </p>
                </div>
              </div>

              {/* Warning notice */}
              <div className="flex gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">What will happen:</p>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    <li>
                      &bull; {sourceCollection.count} bookmarks will be moved to{' '}
                      <span className="text-foreground font-medium">
                        {targetCollection.name}
                      </span>
                    </li>
                    <li>
                      &bull;{' '}
                      <span className="text-foreground font-medium">
                        {sourceCollection.name}
                      </span>{' '}
                      collection will be deleted
                    </li>
                    <li>&bull; Duplicate bookmarks will be kept as-is</li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={busy || !canConfirm}
          >
            {busy ? 'Merging…' : error ? 'Retry Merge' : 'Confirm Merge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
export { MergeDialog }
