import { useCallback } from 'react'
import { toast } from 'sonner'

import { collectionIdToApi } from '@/lib/api-mappers'
import { toUserGroupPayload } from '@/lib/collection-organization'
import type { Group } from '@/lib/types'
import {
  useDeleteCollection99Mutation,
  useDeleteCollectionByIdMutation,
  usePostCollectionMutation,
  usePutCollectionByIdMutation,
  usePutCollectionsMergeMutation,
  usePutUserMutation,
} from '@/store/api/raindropApi'
import type {
  CollectionCreate,
  CollectionUpdate,
} from '@/store/api/raindropApi'

/**
 * Collection CRUD operations with UI-to-API type mapping.
 *
 * Wraps RTK Query mutations for collections. Converts UI string IDs
 * to API numeric IDs and maps form data to API shapes.
 *
 * @returns Collection mutation functions
 * @example
 *   const { createCollection, updateCollection, deleteCollection } = useCollectionsCrud()
 *   await createCollection({ title: 'My Collection', parentId: '100' })
 */
export function useCollectionsCrud(): UseCollectionsCrudReturn {
  const [postCollection] = usePostCollectionMutation()
  const [putCollection] = usePutCollectionByIdMutation()
  const [deleteCollectionMutation] = useDeleteCollectionByIdMutation()
  const [mergeCollections] = usePutCollectionsMergeMutation()
  const [deleteCollection99] = useDeleteCollection99Mutation()
  const [putUser] = usePutUserMutation()

  const createCollection = useCallback(
    async (data: CreateCollectionFormData) => {
      const apiData: CollectionCreate = {
        title: data.title,
        view: data.view,
        parent: data.parentId
          ? { $id: collectionIdToApi(data.parentId) }
          : undefined,
      }
      const result = await postCollection({ collectionCreate: apiData })
      if ('data' in result) {
        toast.success('Collection created')
      } else {
        toast.error('Failed to create collection')
      }
    },
    [postCollection],
  )

  const updateCollection = useCallback(
    async (id: string, data: UpdateCollectionFormData) => {
      const apiData: CollectionUpdate = {
        title: data.title,
        view: data.view,
        expanded: data.expanded,
        parent: data.parentId
          ? { $id: collectionIdToApi(data.parentId) }
          : undefined,
      }
      const result = await putCollection({
        id: collectionIdToApi(id),
        collectionUpdate: apiData,
      })
      if ('data' in result) {
        toast.success('Collection updated')
      } else {
        toast.error('Failed to update collection')
      }
    },
    [putCollection],
  )

  const deleteCollection = useCallback(
    async (id: string) => {
      const result = await deleteCollectionMutation({
        id: collectionIdToApi(id),
      })
      if ('data' in result) {
        toast.success('Collection deleted')
      } else {
        toast.error('Failed to delete collection')
      }
    },
    [deleteCollectionMutation],
  )

  const merge = useCallback(
    async (targetId: string, sourceIds: string[]) => {
      const result = await mergeCollections({
        collectionsMergeRequest: {
          to: collectionIdToApi(targetId),
          ids: sourceIds.map((id) => collectionIdToApi(id)),
        },
      })
      if ('data' in result) {
        toast.success('Collections merged')
      } else {
        toast.error('Failed to merge collections')
      }
    },
    [mergeCollections],
  )

  const emptyTrash = useCallback(async () => {
    const result = await deleteCollection99()
    if ('data' in result) {
      toast.success('Trash emptied')
    } else {
      toast.error('Failed to empty trash')
    }
  }, [deleteCollection99])

  /**
   * Persist group ordering and group-to-collection mapping through `PUT /user`.
   * @param groups - Current sidebar groups with ordered root collections
   */
  const updateUserGroups = useCallback(
    async (groups: Group[]) => {
      const result = await putUser({
        userUpdate: {
          groups: toUserGroupPayload(groups),
        },
      })
      if (!('data' in result)) {
        toast.error('Failed to save collection organization')
        throw new Error('Failed to save collection organization')
      }
    },
    [putUser],
  )

  /**
   * Rename a collection by ID.
   * @param id - Collection ID in UI format
   * @param title - New collection title
   */
  const renameCollection = useCallback(
    async (id: string, title: string) => {
      await updateCollection(id, { title })
    },
    [updateCollection],
  )

  /**
   * Update collection color by ID.
   * @param id - Collection ID in UI format
   * @param color - Hex color string
   */
  const recolorCollection = useCallback(
    async (id: string, color: string) => {
      const result = await putCollection({
        id: collectionIdToApi(id),
        collectionUpdate: { color },
      })
      if ('data' in result) {
        toast.success('Collection color updated')
      } else {
        toast.error('Failed to update collection color')
      }
    },
    [putCollection],
  )

  return {
    createCollection,
    updateCollection,
    deleteCollection,
    merge,
    emptyTrash,
    updateUserGroups,
    renameCollection,
    recolorCollection,
  }
}

/**
 * Form data for creating a new collection.
 */
export interface CreateCollectionFormData {
  /** Collection title (required) */
  title: string
  /** Parent collection ID (UI string). Omit for root-level. */
  parentId?: string
  /** View mode preference for this collection */
  view?: string
}

/**
 * Form data for updating an existing collection.
 * Only defined fields are sent to the API.
 */
export interface UpdateCollectionFormData {
  title?: string
  parentId?: string
  view?: string
  expanded?: boolean
}

interface UseCollectionsCrudReturn {
  createCollection: (data: CreateCollectionFormData) => Promise<void>
  updateCollection: (
    id: string,
    data: UpdateCollectionFormData,
  ) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  /** Merge source collections into a target collection */
  merge: (targetId: string, sourceIds: string[]) => Promise<void>
  /** Empty the trash (DELETE /collection/-99) */
  emptyTrash: () => Promise<void>
  /** Persist current group ordering/membership using PUT /user */
  updateUserGroups: (groups: Group[]) => Promise<void>
  /** Rename collection title */
  renameCollection: (id: string, title: string) => Promise<void>
  /** Update collection color */
  recolorCollection: (id: string, color: string) => Promise<void>
}
