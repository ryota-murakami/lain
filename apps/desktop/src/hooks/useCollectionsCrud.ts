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
import { useAppDispatch } from '@/store/hooks'
import { setCollectionColor } from '@/store/slices/uiSlice'

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
  const dispatch = useAppDispatch()
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
        public: data.isPublic,
        parent: data.parentId
          ? { $id: collectionIdToApi(data.parentId) }
          : undefined,
      }
      const result = await postCollection({
        collectionCreate: apiData,
      }).unwrap()
      if (!result.item?._id)
        throw new Error('The service did not return a collection ID')
      return String(result.item._id)
    },
    [postCollection],
  )

  const updateCollection = useCallback(
    async (id: string, data: UpdateCollectionFormData) => {
      const apiData: CollectionUpdate = {
        title: data.title,
        view: data.view,
        expanded: data.expanded,
        public: data.isPublic,
        parent: data.parentId
          ? { $id: collectionIdToApi(data.parentId) }
          : 'parentId' in data
            ? {}
            : undefined,
      }
      await putCollection({
        id: collectionIdToApi(id),
        collectionUpdate: apiData,
      }).unwrap()
      // The API exposes cover-derived color but does not accept color writes; preserve the user's local choice.
      if (data.color !== undefined)
        dispatch(setCollectionColor({ id, color: data.color }))
    },
    [dispatch, putCollection],
  )

  const deleteCollection = useCallback(
    async (id: string) => {
      await deleteCollectionMutation({ id: collectionIdToApi(id) }).unwrap()
      toast.success('Collection deleted')
    },
    [deleteCollectionMutation],
  )

  const merge = useCallback(
    async (targetId: string, sourceIds: string[]) => {
      await mergeCollections({
        collectionsMergeRequest: {
          to: collectionIdToApi(targetId),
          ids: sourceIds.map((id) => collectionIdToApi(id)),
        },
      }).unwrap()
      toast.success('Collections merged')
    },
    [mergeCollections],
  )

  const emptyTrash = useCallback(async () => {
    await deleteCollection99().unwrap()
    toast.success('Trash emptied')
  }, [deleteCollection99])

  /**
   * Persist group ordering and group-to-collection mapping through `PUT /user`.
   * @param groups - Current sidebar groups with ordered root collections
   */
  const updateUserGroups = useCallback(
    async (groups: Group[]) => {
      await putUser({
        userUpdate: {
          // Synthetic visibility groups do not exist in the remote user profile.
          groups: toUserGroupPayload(
            groups.filter((group) => group.id !== 'ungrouped'),
          ),
        },
      }).unwrap()
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
   * Persist an account-local collection color after a sidebar color-menu action.
   * @param id - Collection ID in UI format
   * @param color - Hex color string
   */
  const recolorCollection = useCallback(
    async (id: string, color: string): Promise<void> => {
      dispatch(setCollectionColor({ id, color }))
      toast.success('Collection color saved on this device')
      return Promise.resolve()
    },
    [dispatch],
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
interface CreateCollectionFormData {
  isPublic?: boolean
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
interface UpdateCollectionFormData {
  isPublic?: boolean
  color?: string
  title?: string
  parentId?: string
  view?: string
  expanded?: boolean
}

interface UseCollectionsCrudReturn {
  createCollection: (data: CreateCollectionFormData) => Promise<string>
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
  /** Save collection color in this account's local display preferences */
  recolorCollection: (id: string, color: string) => Promise<void>
}
