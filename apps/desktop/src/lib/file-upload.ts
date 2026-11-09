import axios from 'axios'

import { lainAxios } from './axios'

export const UPLOAD_EXTENSIONS = [
  'jpeg',
  'jpg',
  'gif',
  'png',
  'webp',
  'heic',
  'mp4',
  'mov',
  'wmv',
  'webm',
  'mp3',
  'wav',
  'aiff',
  'flac',
  'epub',
  'pdf',
  'md',
  'txt',
]
export interface UploadQuota {
  pro: boolean
  used: number
  total: number
  maxFileSize: number
}
export interface UploadMetadata {
  collectionId: string
  title: string
  tags: string[]
  note: string
  important: boolean
}
export type UploadPhase =
  | 'queued'
  | 'uploading'
  | 'saving'
  | 'done'
  | 'error'
  | 'uncertain'
  | 'canceled'
export interface UploadEntry {
  key: string
  file: File
  title: string
  phase: UploadPhase
  progress: number
  bookmarkId?: number
  error?: string
}

/** Fetch the account's current quota before the upload queue starts; the server remains authoritative. */
export async function fetchUploadQuota(
  signal?: AbortSignal,
): Promise<UploadQuota> {
  const { data } = await lainAxios.get<{
    result: boolean
    user: { pro: boolean; files: { used: number; size: number } }
  }>('/user', { signal, errorFeedback: 'inline' })
  if (!data.result || !Number.isFinite(data.user.files?.size))
    throw new Error('Upload quota could not be read. Please retry.')
  return {
    pro: data.user.pro,
    used: data.user.files.used,
    total: data.user.files.size,
    maxFileSize: (data.user.pro ? 300 : 100) * 1_000_000,
  }
}

/** Validate documented format and plan limits before sending a file from {@link UploadDialog}. */
export function validateUpload(
  file: Pick<File, 'name' | 'size'>,
  quota: UploadQuota,
): string | undefined {
  if (
    !UPLOAD_EXTENSIONS.includes(
      file.name.split('.').at(-1)?.toLowerCase() ?? '',
    )
  )
    return 'Unsupported format. Choose a supported document, image, audio or video file.'
  if (file.size === 0) return 'Empty files cannot be uploaded.'
  if (file.size > quota.maxFileSize)
    return `This file exceeds your ${quota.maxFileSize / 1_000_000} MB per-file limit.`
  if (file.size > quota.total - quota.used)
    return 'Your remaining monthly upload quota is too small for this file.'
  return undefined
}

/**
 * Upload a file once, then save metadata against its returned bookmark ID.
 * A metadata retry uses the existing ID and never creates a duplicate file bookmark.
 * @param update - Persist progress and the returned ID immediately, before the metadata request.
 * @example await uploadFile(entry, metadata, signal, patch => updateEntry(entry.key, patch))
 */
export async function uploadFile(
  entry: UploadEntry,
  metadata: UploadMetadata,
  signal: AbortSignal,
  update: (patch: Partial<UploadEntry>) => void,
): Promise<void> {
  let id = entry.bookmarkId
  try {
    if (!id) {
      id = await uploadBinary(entry.file, metadata.collectionId, signal, update)
      if (!id) return
      update({ bookmarkId: id, progress: 100 })
    }
    update({ phase: 'saving' })
    const { data } = await lainAxios.put<{ result: boolean }>(
      `/raindrop/${id}`,
      {
        title: metadata.title || entry.file.name,
        tags: metadata.tags,
        note: metadata.note,
        important: metadata.important,
        collection: {
          $id:
            metadata.collectionId === 'unsorted'
              ? -1
              : Number(metadata.collectionId),
        },
      },
      { signal, errorFeedback: 'inline' },
    )
    if (!data.result) throw new Error('Metadata could not be saved.')
    update({ phase: 'done', error: undefined })
  } catch (cause) {
    update(uploadFailure(cause, id))
  }
}

/** Send the creation request once; {@link uploadFile} stores its ID before attempting metadata. */
async function uploadBinary(
  file: File,
  collectionId: string,
  signal: AbortSignal,
  update: (patch: Partial<UploadEntry>) => void,
): Promise<number | undefined> {
  update({ phase: 'uploading', progress: 0, error: undefined })
  const body = new FormData()
  // Raindrop processes the file stream before later multipart fields; send its destination first.
  body.append('collectionId', collectionId === 'unsorted' ? '-1' : collectionId)
  body.append('file', file)
  const { data } = await lainAxios.put<{
    result: boolean
    item?: { _id: number }
    errorMessage?: string
  }>('/raindrop/file', body, {
    signal,
    errorFeedback: 'inline',
    timeout: 300_000,
    headers: { 'Content-Type': undefined },
    onUploadProgress: (event) =>
      update({
        progress: Math.min(99, Math.round((event.progress ?? 0) * 100)),
      }),
  })
  if (!data.result || !data.item?._id) {
    update({
      phase: 'error',
      error: data.errorMessage ?? 'The service rejected this file.',
    })
    return undefined
  }
  return data.item._id
}

/** Keep ambiguous creations separate from safe metadata retries after {@link uploadFile} fails. */
function uploadFailure(
  cause: unknown,
  bookmarkId?: number,
): Partial<UploadEntry> {
  const response = axios.isAxiosError(cause) ? cause.response : undefined
  // A lost response can hide a committed upload; never replay that creation automatically.
  if (!bookmarkId && (!response || response.status >= 500)) {
    return {
      phase: 'uncertain',
      error:
        'The upload response was interrupted. Check the destination collection and Unsorted before explicitly retrying; the file may already exist.',
    }
  }
  const data = response?.data as { errorMessage?: string } | undefined
  return {
    phase: 'error',
    error: bookmarkId
      ? 'File uploaded; metadata is not saved yet. Retry to finish the same bookmark.'
      : (data?.errorMessage ??
        'Upload failed. Check your connection and quota, then retry.'),
  }
}
