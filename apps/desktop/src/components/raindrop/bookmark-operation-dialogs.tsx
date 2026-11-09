import React from 'react'

import { BulkActionDialog, type BulkAction } from './bulk-action-dialog'
import { ExportDialog } from './export-dialog'
import type { MainContentProps } from './main-content.types'
import { UploadDialog } from './upload-dialog'

/**
 * Mount import/export and bulk-operation dialogs only while their corresponding action is active.
 * Called by MainContent so each dialog receives the selection captured at the user's click.
 * @example
 * <BookmarkOperationDialogs {...props} />
 */
export const BookmarkOperationDialogs = React.memo(
  function BookmarkOperationDialogs({
    exportOpen,
    uploadFiles,
    bulkAction,
    selectedCollectionId,
    currentCollectionName,
    groups,
    closeExport,
    closeUpload,
    closeBulkAction,
    onBatchMove,
    onBatchAddTag,
  }: Pick<
    MainContentProps,
    'selectedCollectionId' | 'groups' | 'onBatchMove' | 'onBatchAddTag'
  > & {
    exportOpen: boolean
    uploadFiles: File[] | null
    bulkAction: BulkAction | null
    currentCollectionName: string
    closeExport: () => void
    closeUpload: () => void
    closeBulkAction: () => void
  }) {
    return (
      <>
        {' '}
        {exportOpen && (
          <ExportDialog
            collectionId={selectedCollectionId}
            collectionName={currentCollectionName}
            onClose={closeExport}
          />
        )}
        {uploadFiles && (
          <UploadDialog
            groups={groups}
            collectionId={selectedCollectionId}
            initialFiles={uploadFiles}
            onClose={closeUpload}
          />
        )}
        {bulkAction && (
          <BulkActionDialog
            action={bulkAction}
            groups={groups}
            onClose={closeBulkAction}
            onMove={onBatchMove}
            onTag={onBatchAddTag}
          />
        )}
      </>
    )
  },
)
