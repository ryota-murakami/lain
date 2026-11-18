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
   * @throws When the server rejects the mutation; the caller must preserve editor input.
   * @example await renameTag('all', 'react', 'frontend')
   */
  const renameTag = useCallback(
    async (collectionId: string, oldName: string, newName: string) => {
      const result = await putTags({
        collectionId: collectionIdToApi(collectionId),
        tagsMergeRequest: { replace: newName, tags: [oldName] },
      }).unwrap()
      if (result.result === true) {
        toast.success(`Tag renamed to "${newName}"`)
      } else {
        throw new Error('Failed to rename tag. Please retry.')
      }
    },
    [putTags],
  )

  /**
   * Delete tags from a collection scope.
   * @param collectionId - UI collection ID ('all' for global, or numeric string)
   * @param tagNames - Array of tag names to delete
   * @throws When deletion fails; confirmation dialogs must remain open.
   * @example await deleteTag('all', ['obsolete'])
   */
  const deleteTag = useCallback(
    async (collectionId: string, tagNames: string[]) => {
      const result = await deleteTags({
        collectionId: collectionIdToApi(collectionId),
        tagsRemoveRequest: { tags: tagNames },
      }).unwrap()
      if (result.result === true) {
        toast.success(
          tagNames.length === 1
            ? `Tag "${tagNames[0]}" deleted`
            : `${tagNames.length} tags deleted`,
        )
      } else {
        throw new Error('Failed to delete tag. Please retry.')
      }
    },
    [deleteTags],
  )

  /**
   * Merge selected tags in one API request instead of partially applying a rename loop.
   * Called by Tag Management through MainApp; the replacement tag need not already exist.
   * @param collectionId - UI scope; Tag Management supplies all for the global tag list.
   * @param sourceNames - Existing tag names; duplicates and the target itself are omitted.
   * @param targetName - Destination tag name.
   * @throws When the request fails or the server does not confirm success.
   * @example await mergeTags('all', ['react', 'frontend'], 'web')
   */
  const mergeTags = useCallback(
    async (
      collectionId: string,
      sourceNames: string[],
      targetName: string,
    ): Promise<void> => {
      const target = targetName.trim()
      const sources = [...new Set(sourceNames)].filter(
        (name) => name !== target,
      )
      if (!target || sources.length === 0)
        throw new Error('Choose source tags and a destination name.')
      const result = await putTags({
        collectionId: collectionIdToApi(collectionId),
        tagsMergeRequest: { replace: target, tags: sources },
      }).unwrap()
      if (result.result !== true)
        throw new Error('Failed to merge tags. Please retry.')
      toast.success(`Tags merged into "${target}"`)
    },
    [putTags],
  )

  return { tags, isLoading, isError, renameTag, deleteTag, mergeTags }
}

/** UI-friendly tag representation */
interface Tag {
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
  /** Merge tags in one request; rejects on failure so the caller retains input. */
  mergeTags: (
    collectionId: string,
    sourceNames: string[],
    targetName: string,
  ) => Promise<void>
  /** Delete one or more tags (scoped by collection) */
  deleteTag: (collectionId: string, tagNames: string[]) => Promise<void>
}
