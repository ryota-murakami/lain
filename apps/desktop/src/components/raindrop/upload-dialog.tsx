import React, { useCallback, useMemo, useState } from 'react'

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
import { Textarea } from '@/components/ui/textarea'
import { useUploadQueue } from '@/hooks/useUploadQueue'
import {
  UPLOAD_EXTENSIONS,
  type UploadEntry,
  type UploadQuota,
} from '@/lib/file-upload'
import type { Group } from '@/lib/types'

import { CollectionSelector } from './collection-selector'

const ACCEPT_FILES = UPLOAD_EXTENSIONS.map((extension) => `.${extension}`).join(
  ',',
)

/** Describe the queue state independently of its progress presentation in {@link UploadFileRow}. */
function uploadStatus(entry: UploadEntry): string {
  if (entry.phase === 'done') return 'Uploaded and saved'
  if (entry.phase === 'saving') return 'Saving bookmark details…'
  if (entry.phase === 'uploading') return `Uploading ${entry.progress}%`
  return entry.phase
}

/** Require a destination check before a queue row repeats an ambiguous creation request. */
const UploadRetryActions = React.memo(function UploadRetryActions({
  entry,
  busy,
  onRetry,
  onRemove,
}: {
  entry: UploadEntry
  busy: boolean
  onRetry: (key: string) => void
  onRemove: (key: string) => void
}) {
  const [confirmed, setConfirmed] = useState(false)
  const retry = useCallback((): void => {
    setConfirmed(false)
    onRetry(entry.key)
  }, [entry.key, onRetry])
  const remove = useCallback(
    (): void => onRemove(entry.key),
    [entry.key, onRemove],
  )
  const needsConfirmation = entry.phase === 'uncertain'
  const canRetry = ['error', 'uncertain'].includes(entry.phase)
  if (entry.phase === 'done') return null
  return (
    <>
      {needsConfirmation && (
        <label className="flex gap-2 text-xs">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          I checked the destination and Unsorted; this file is missing.
        </label>
      )}
      <div className="flex gap-2">
        {canRetry && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || (needsConfirmation && !confirmed)}
            onClick={retry}
          >
            {entry.bookmarkId ? 'Retry metadata' : 'Retry upload'}
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={busy} onClick={remove}>
          Remove from queue
        </Button>
      </div>
    </>
  )
})

/** Render one queue outcome with an explicit acknowledgement before retrying an uncertain upload. */
const UploadFileRow = React.memo(function UploadFileRow({
  entry,
  busy,
  onPatch,
  onRetry,
  onRemove,
}: {
  entry: UploadEntry
  busy: boolean
  onPatch: (key: string, patch: Partial<UploadEntry>) => void
  onRetry: (key: string) => void
  onRemove: (key: string) => void
}) {
  const changeTitle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void =>
      onPatch(entry.key, { title: event.target.value }),
    [entry.key, onPatch],
  )
  return (
    <li className="space-y-2 rounded-md border p-3">
      <Label htmlFor={`title-${entry.key}`}>
        {entry.file.name} · {(entry.file.size / 1_000_000).toFixed(2)} MB
      </Label>
      <Input
        id={`title-${entry.key}`}
        aria-label={`Title for ${entry.file.name}`}
        value={entry.title}
        disabled={busy || entry.phase === 'done'}
        onChange={changeTitle}
      />
      <p role="status" className="text-sm">
        {uploadStatus(entry)}
      </p>
      {entry.phase === 'uploading' && (
        <progress
          className="w-full"
          aria-label={`Upload progress for ${entry.file.name}`}
          max={100}
          value={entry.progress}
        />
      )}
      {entry.error && (
        <p role="alert" className="text-destructive text-xs">
          {entry.error}
        </p>
      )}
      <UploadRetryActions
        entry={entry}
        busy={busy}
        onRetry={onRetry}
        onRemove={onRemove}
      />
    </li>
  )
})

/** Explain plan limits using the latest server quota loaded by the upload dialog. */
const UploadQuotaNotice = React.memo(function UploadQuotaNotice({
  quota,
}: {
  quota?: UploadQuota
}) {
  if (!quota) return null
  const remaining = Math.max(
    0,
    (quota.total - quota.used) / 1_000_000,
  ).toLocaleString(undefined, { maximumFractionDigits: 1 })
  return (
    <p className="text-muted-foreground text-xs">
      {quota.pro ? 'Pro' : 'Free'} plan · {quota.maxFileSize / 1_000_000} MB per
      file · {remaining} MB remaining this month. The service checks the final
      quota.
    </p>
  )
})

/** Present per-file outcomes and enable starting only when queued work remains. */
const UploadQueueResults = React.memo(function UploadQueueResults({
  queue,
  onRetry,
  onClose,
  onStart,
}: {
  queue: ReturnType<typeof useUploadQueue>
  onRetry: (key: string) => void
  onClose: () => void
  onStart: () => void
}) {
  const { busy } = queue
  const canStart =
    !busy && queue.entries.some((entry) => entry.phase === 'queued')
  return (
    <>
      <UploadQuotaNotice quota={queue.quota} />
      <ul className="space-y-3">
        {queue.entries.map((entry) => (
          <UploadFileRow
            key={entry.key}
            entry={entry}
            busy={busy}
            onPatch={queue.patch}
            onRetry={onRetry}
            onRemove={queue.remove}
          />
        ))}
      </ul>
      {queue.error && (
        <p role="alert" className="text-destructive text-sm">
          {queue.error}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={busy ? queue.cancel : onClose}>
          {busy ? 'Cancel transfer' : 'Close'}
        </Button>
        <Button disabled={!canStart} onClick={onStart}>
          Upload queued files
        </Button>
      </DialogFooter>
    </>
  )
})

/**
 * Let the toolbar and desktop drop target upload multiple files with editable titles and shared metadata.
 * Each file retains its result and explicit retry control, including uncertain server outcomes.
 * @example <UploadDialog groups={groups} collectionId="unsorted" initialFiles={files} onClose={close} />
 */
export const UploadDialog = React.memo(function UploadDialog({
  groups,
  collectionId,
  initialFiles,
  onClose,
}: {
  groups: Group[]
  collectionId: string
  initialFiles: File[]
  onClose: () => void
}) {
  const queue = useUploadQueue(initialFiles)
  const [destination, setDestination] = useState(
    ['all', 'trash'].includes(collectionId) ? 'unsorted' : collectionId,
  )
  const [tags, setTags] = useState('')
  const [note, setNote] = useState('')
  const [important, setImportant] = useState(false)
  const destinations = useMemo<Group[]>(
    () => [
      {
        id: 'system',
        name: 'System',
        collections: [
          {
            id: 'unsorted',
            name: 'Unsorted',
            count: 0,
            icon: 'Folder',
            groupId: 'system',
          },
        ],
      },
      ...groups,
    ],
    [groups],
  )
  const metadata = useMemo(
    () => ({
      collectionId: destination,
      tags: [
        ...new Set(
          tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ],
      note,
      important,
    }),
    [destination, tags, note, important],
  )
  const { addFiles, busy, run } = queue
  const changeFiles = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      addFiles([...(event.target.files ?? [])])
      event.target.value = ''
    },
    [addFiles],
  )
  const changeTags = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void =>
      setTags(event.target.value),
    [],
  )
  const changeNote = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>): void =>
      setNote(event.target.value),
    [],
  )
  const changeOpen = useCallback(
    (open: boolean): void => {
      if (!open && !busy) onClose()
    },
    [busy, onClose],
  )
  const uploadQueued = useCallback((): void => {
    void run(metadata)
  }, [metadata, run])
  const retry = useCallback(
    (key: string): void => {
      void run(metadata, key)
    },
    [metadata, run],
  )
  const allowDrop = (event: React.DragEvent): void => {
    event.preventDefault()
  }
  const dropFiles = (event: React.DragEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    if (!busy) addFiles([...event.dataTransfer.files])
  }
  return (
    <Dialog open onOpenChange={changeOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>
            Choose a destination and upload documents, images, audio or video.
            Each file becomes a bookmark.
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy} className="space-y-3">
          <div
            onDragOver={allowDrop}
            onDrop={dropFiles}
            className="border-input rounded-lg border-2 border-dashed p-4"
          >
            <Label htmlFor="upload-files">Choose files or drop them here</Label>
            <Input
              id="upload-files"
              type="file"
              multiple
              accept={ACCEPT_FILES}
              onChange={changeFiles}
              className="mt-2"
            />
          </div>
          <CollectionSelector
            value={destination}
            onChange={setDestination}
            groups={destinations}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="upload-tags">Tags (comma separated)</Label>
              <Input id="upload-tags" value={tags} onChange={changeTags} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={important}
                onChange={(event) => setImportant(event.target.checked)}
              />
              Mark important
            </label>
          </div>
          <div>
            <Label htmlFor="upload-note">Note for these files</Label>
            <Textarea id="upload-note" value={note} onChange={changeNote} />
          </div>
        </fieldset>
        <UploadQueueResults
          queue={queue}
          onRetry={retry}
          onClose={onClose}
          onStart={uploadQueued}
        />
      </DialogContent>
    </Dialog>
  )
})
