import { useCallback, useState } from 'react'

import type { BulkAction } from '@/components/raindrop/bulk-action-dialog'

/**
 * Capture dialog targets when a bookmark action is invoked, independent of later selection changes.
 * Called by MainContent for export, dropped files, and move/tag operations.
 * @example
 * const dialogs = useBookmarkDialogs(selectedRaindropIds)
 */
export function useBookmarkDialogs(selectedRaindropIds: Set<string>) {
  const [exportOpen, setExportOpen] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[] | null>(null)
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null)
  const openExport = useCallback((): void => setExportOpen(true), [])
  const closeExport = useCallback((): void => setExportOpen(false), [])
  const openUpload = useCallback((): void => setUploadFiles([]), [])
  const closeUpload = useCallback((): void => setUploadFiles(null), [])
  const closeBulkAction = useCallback((): void => setBulkAction(null), [])
  const moveSelection = useCallback(
    (): void => setBulkAction({ kind: 'move', ids: [...selectedRaindropIds] }),
    [selectedRaindropIds],
  )
  const tagSelection = useCallback(
    (): void => setBulkAction({ kind: 'tag', ids: [...selectedRaindropIds] }),
    [selectedRaindropIds],
  )
  const moveRows = useCallback(
    (ids: string[]): void => setBulkAction({ kind: 'move', ids }),
    [],
  )
  const tagRows = useCallback(
    (ids: string[]): void => setBulkAction({ kind: 'tag', ids }),
    [],
  )

  return {
    exportOpen,
    uploadFiles,
    bulkAction,
    setUploadFiles,
    openExport,
    closeExport,
    openUpload,
    closeUpload,
    closeBulkAction,
    moveSelection,
    tagSelection,
    moveRows,
    tagRows,
  }
}
