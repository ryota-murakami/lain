import React from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useBookmarkExport } from '@/hooks/useBookmarkExport'
import type { ExportFormat } from '@/lib/bookmark-export'

/**
 * Export all active bookmarks or the selected collection through the native save dialog.
 * The toolbar mounts this on demand; verified pages are required before any file can be written.
 * @example <ExportDialog collectionId="123" collectionName="Research" onClose={close} />
 */
export const ExportDialog = React.memo(function ExportDialog({
  collectionId,
  collectionName,
  onClose,
}: {
  collectionId: string
  collectionName: string
  onClose: () => void
}) {
  const {
    scope,
    setScope,
    format,
    setFormat,
    phase,
    progress,
    status,
    error,
    hasCurrentScope,
    busy,
    startSave,
    changeOpen,
    cancelOrClose,
  } = useBookmarkExport(collectionId, onClose)

  return (
    <Dialog open onOpenChange={changeOpen}>
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Export bookmarks</DialogTitle>
          <DialogDescription>
            Downloads every bookmark in the chosen scope, including pages that
            are not currently loaded. Trash is excluded.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="export-scope">Scope</Label>
          <select
            id="export-scope"
            className="border-input bg-background w-full rounded-md border p-2"
            disabled={busy}
            value={scope}
            onChange={(event) => setScope(event.target.value)}
          >
            <option value="all">All bookmarks</option>
            {hasCurrentScope && (
              <option value="collection">
                {collectionName}
                {collectionId === 'unsorted'
                  ? ''
                  : ' (including subcollections)'}
              </option>
            )}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="export-format">Format</Label>
          <select
            id="export-format"
            className="border-input bg-background w-full rounded-md border p-2"
            disabled={busy}
            value={format}
            onChange={(event) => setFormat(event.target.value as ExportFormat)}
          >
            <option value="html">HTML — browser bookmarks</option>
            <option value="csv">CSV — spreadsheet</option>
            <option value="json">JSON — metadata snapshot</option>
          </select>
        </div>
        <p className="text-muted-foreground text-xs">
          Exports include links and metadata. Uploaded file contents and web
          archive copies are not included. Use JSON to retain full API metadata;
          browser and spreadsheet importers may omit notes, groups or other
          fields.
        </p>
        {status && (
          <p role="status" className="text-sm">
            {status}
          </p>
        )}
        {phase === 'reading' && progress && (
          <progress
            className="w-full"
            aria-label="Bookmarks downloaded"
            max={Math.max(1, progress.total)}
            value={progress.loaded}
          />
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={phase === 'saving'}
            onClick={cancelOrClose}
          >
            {phase === 'saving'
              ? 'Save dialog open…'
              : busy
                ? 'Cancel export'
                : 'Close'}
          </Button>
          <Button disabled={busy} onClick={startSave}>
            {busy ? 'Exporting…' : error ? 'Retry export' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
