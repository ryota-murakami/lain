import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import { collectionIdToApi } from '@/lib/api-mappers'
import {
  useDeleteTagsByCollectionIdMutation,
  useGetTagsQuery,
  usePutTagsByCollectionIdMutation,
} from '@/store/api/raindropApi'

/**
 * Tag listing + mutation operations with UI-to-API mapping.
 *
 * Fetches all tags via `GET /tags` and provides rename/delete mutations
 * scoped by collection. Use `collectionId: 'all'` (→ API `0`) for
 * global operations across all collections.
 *
 * @returns Tag list, loading state, and mutation functions
 * @example
 *   const { tags, renameTag, deleteTag } = useTagsCrud()
 *   await renameTag('all', 'react', 'reactjs')
 *   await deleteTag('all', ['deprecated-tag'])
 */
export function useTagsCrud(): UseTagsCrudReturn {
  const { data, isLoading, isError } = useGetTagsQuery()

  const tags: Tag[] = useMemo(
    () =>
      (data?.items ?? []).map((t) => ({
        name: t._id ?? '',
        count: t.count ?? 0,
      })),
    [data],
  )

  const [putTags] = usePutTagsByCollectionIdMutation()
  const [deleteTags] = useDeleteTagsByCollectionIdMutation()

  /**
   * Rename a tag within a collection scope.
   * @param collectionId - UI collection ID ('all' for global, or numeric string)
   * @param oldName - Current tag name to rename
   * @param newName - New tag name
   */
  const renameTag = useCallback(
    async (collectionId: string, oldName: string, newName: string) => {
      const result = await putTags({
        collectionId: collectionIdToApi(collectionId),
        tagsMergeRequest: { replace: newName, tags: [oldName] },
      })
      if ('data' in result) {
        toast.success(`Tag renamed to "${newName}"`)
      } else {
        toast.error('Failed to rename tag')
      }
    },
    [putTags],
  )

  /**
   * Delete tags from a collection scope.
   * @param collectionId - UI collection ID ('all' for global, or numeric string)
   * @param tagNames - Array of tag names to delete
   */
  const deleteTag = useCallback(
    async (collectionId: string, tagNames: string[]) => {
      const result = await deleteTags({
        collectionId: collectionIdToApi(collectionId),
        tagsRemoveRequest: { tags: tagNames },
      })
      if ('data' in result) {
        toast.success(
          tagNames.length === 1
            ? `Tag "${tagNames[0]}" deleted`
            : `${tagNames.length} tags deleted`,
        )
      } else {
        toast.error('Failed to delete tag')
      }
    },
    [deleteTags],
  )

  return { tags, isLoading, isError, renameTag, deleteTag }
}

/** UI-friendly tag representation */
export interface Tag {
  name: string
  count: number
}

interface UseTagsCrudReturn {
  /** All tags with usage counts */
  tags: Tag[]
  /** True while tags are loading */
  isLoading: boolean
  /** True if tag fetch failed */
  isError: boolean
  /** Rename a tag (scoped by collection) */
  renameTag: (
    collectionId: string,
    oldName: string,
    newName: string,
  ) => Promise<void>
  /** Delete one or more tags (scoped by collection) */
  deleteTag: (collectionId: string, tagNames: string[]) => Promise<void>
}
