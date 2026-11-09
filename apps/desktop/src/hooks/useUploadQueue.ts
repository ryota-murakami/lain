import { useCallback, useEffect, useRef, useState } from 'react'

import {
  fetchUploadQuota,
  uploadFile,
  validateUpload,
  type UploadEntry,
  type UploadMetadata,
  type UploadQuota,
} from '@/lib/file-upload'
import { raindropApi } from '@/store/api/raindropApi'
import { useAppDispatch } from '@/store/hooks'

import { usePendingWork } from './usePendingWork'

/**
 * Own the upload queue for one open dialog, deduplicating picker/drop entries and retaining failed metadata IDs.
 * Transfers run sequentially to respect account quotas and Raindrop's shared request budget.
 * @example const queue = useUploadQueue(); queue.addFiles(files)
 */
export function useUploadQueue(initialFiles: File[] = []) {
  const dispatch = useAppDispatch()
  const [entries, setEntries] = useState<UploadEntry[]>(() =>
    appendUploadEntries([], initialFiles),
  )
  const [quota, setQuota] = useState<UploadQuota>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const active = useRef<AbortController | null>(null)
  const initialQuotaRequest = useRef<AbortController | null>(null)
  usePendingWork(busy)
  useEffect(() => {
    const controller = new AbortController()
    initialQuotaRequest.current = controller
    void fetchUploadQuota(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setQuota(value)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            'Could not load your upload quota. It will be checked again before uploading.',
          )
      })
    return (): void => {
      controller.abort()
      active.current?.abort()
    }
  }, [])

  const patch = useCallback(
    (key: string, change: Partial<UploadEntry>): void =>
      setEntries((items) =>
        items.map((item) => (item.key === key ? { ...item, ...change } : item)),
      ),
    [],
  )
  const addFiles = useCallback(
    (files: File[]): void =>
      setEntries((items) => appendUploadEntries(items, files)),
    [],
  )
  const run = useCallback(
    async (
      metadata: Omit<UploadMetadata, 'title'>,
      retryKey?: string,
    ): Promise<void> => {
      if (active.current) return
      // A late initial quota response must not overwrite the transfer's newer quota or error.
      initialQuotaRequest.current?.abort()
      const controller = new AbortController()
      active.current = controller
      setBusy(true)
      setError('')
      try {
        const freshQuota = await fetchUploadQuota(controller.signal)
        setQuota(freshQuota)
        const selected = entries.filter((entry) =>
          retryKey ? entry.key === retryKey : entry.phase === 'queued',
        )
        for (const entry of selected) {
          if (controller.signal.aborted) break
          await processUploadEntry(
            entry,
            metadata,
            freshQuota,
            controller.signal,
            patch,
          )
        }
        setQuota({ ...freshQuota })
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : 'The upload queue could not start. Please retry.',
          )
      } finally {
        active.current = null
        setBusy(false)
        dispatch(
          raindropApi.util.invalidateTags([
            'raindrops',
            'collections',
            'tags',
            'filters',
            'user',
          ]),
        )
      }
    },
    [dispatch, entries, patch],
  )
  const cancel = useCallback((): void => {
    active.current?.abort()
  }, [])
  const remove = useCallback(
    (key: string): void =>
      setEntries((items) => items.filter((item) => item.key !== key)),
    [],
  )
  return { entries, quota, error, busy, addFiles, patch, run, cancel, remove }
}

/** Validate and process one queue item without blocking later valid files after a local validation failure. */
async function processUploadEntry(
  entry: UploadEntry,
  metadata: Omit<UploadMetadata, 'title'>,
  quota: UploadQuota,
  signal: AbortSignal,
  patch: (key: string, change: Partial<UploadEntry>) => void,
): Promise<void> {
  const validation = entry.bookmarkId
    ? undefined
    : validateUpload(entry.file, quota)
  if (validation) {
    patch(entry.key, { phase: 'error', error: validation })
    return
  }
  await uploadFile(
    entry,
    { ...metadata, title: entry.title },
    signal,
    (change) => patch(entry.key, change),
  )
  // Conservatively reserve quota even when a response was interrupted after server acceptance.
  if (!entry.bookmarkId) quota.used += entry.file.size
}

/** Merge picker/drop files into a queue without adding the same local file twice. */
function appendUploadEntries(
  items: UploadEntry[],
  files: File[],
): UploadEntry[] {
  const next = [...items]
  for (const file of files) {
    const key = `${file.name}:${file.size}:${file.lastModified}`
    if (!next.some((item) => item.key === key))
      next.push({ key, file, title: file.name, phase: 'queued', progress: 0 })
  }
  return next
}
