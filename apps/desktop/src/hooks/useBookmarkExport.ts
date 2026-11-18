import { isCancel } from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

import {
  fetchBookmarkSnapshot,
  serializeBookmarkSnapshot,
  type ExportFormat,
} from '@/lib/bookmark-export'

import { usePendingWork } from './usePendingWork'

/**
 * Tie the active export request to the lifetime of the export dialog.
 * Unmounting during logout or navigation must prevent a late response opening a save dialog.
 * @returns The current operation's controller; the save handler owns creating and clearing it.
 * @example const controllerRef = useExportController()
 */
function useExportController(): RefObject<AbortController | null> {
  const controllerRef = useRef<AbortController | null>(null)
  useEffect(() => () => controllerRef.current?.abort(), [])
  return controllerRef
}

/**
 * Own the verified export lifecycle independently from the dialog's format and progress controls.
 * The dialog invokes these actions; cancellation or unmount prevents a late file-save request.
 * @example const exporter = useBookmarkExport(collectionId, onClose)
 */
export function useBookmarkExport(collectionId: string, onClose: () => void) {
  const [scope, setScope] = useState('all')
  const [format, setFormat] = useState<ExportFormat>('html')
  const [phase, setPhase] = useState<'idle' | 'reading' | 'saving'>('idle')
  const [progress, setProgress] = useState<{
    loaded: number
    total: number
  } | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const controllerRef = useExportController()
  const hasCurrentScope =
    collectionId === 'unsorted' ||
    (Number.isSafeInteger(Number(collectionId)) && Number(collectionId) > 0)
  const busy = phase !== 'idle'
  usePendingWork(busy)

  const save = useCallback(async (): Promise<void> => {
    // The ref also guards double clicks before React applies the disabled state.
    if (controllerRef.current) return
    const abort = new AbortController()
    controllerRef.current = abort
    setPhase('reading')
    setProgress(null)
    setError('')
    setStatus('Preparing a complete snapshot…')
    try {
      const id =
        scope === 'all'
          ? 0
          : collectionId === 'unsorted'
            ? -1
            : Number(collectionId)
      const snapshot = await fetchBookmarkSnapshot(
        id,
        abort.signal,
        (loaded, total) => {
          setProgress({ loaded, total })
          setStatus(
            loaded === total
              ? `Read ${loaded} bookmarks. Verifying the snapshot…`
              : `Reading bookmarks: ${loaded} / ${total}`,
          )
        },
      )
      if (abort.signal.aborted) {
        setStatus('Export canceled. No file was written.')
        return
      }
      // Native save IPC cannot be aborted; cancellation belongs to its own dialog.
      setPhase('saving')
      setStatus(
        'Choose where to save the export. To cancel, use the save dialog’s Cancel button.',
      )
      const result = await window.desktop.saveExport({
        format,
        content: serializeBookmarkSnapshot(snapshot, format),
      })
      setStatus(
        result.canceled
          ? 'Save canceled. No file was written.'
          : `Exported ${snapshot.bookmarks.length} bookmarks to ${result.filename ?? 'the selected location'}.`,
      )
    } catch (cause) {
      if (abort.signal.aborted || isCancel(cause))
        setStatus('Export canceled. No file was written.')
      else {
        setStatus('')
        setError(
          cause instanceof Error
            ? cause.message
            : 'Export failed. Please retry.',
        )
      }
    } finally {
      controllerRef.current = null
      setPhase('idle')
      setProgress(null)
    }
  }, [collectionId, controllerRef, format, scope])

  const startSave = useCallback((): void => {
    void save()
  }, [save])
  const changeOpen = useCallback(
    (open: boolean): void => {
      if (!open && !busy) onClose()
    },
    [busy, onClose],
  )
  const cancelOrClose = useCallback((): void => {
    if (phase === 'reading') {
      controllerRef.current?.abort()
      setStatus('Canceling export…')
    } else if (phase === 'idle') onClose()
  }, [controllerRef, onClose, phase])

  return {
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
  }
}
