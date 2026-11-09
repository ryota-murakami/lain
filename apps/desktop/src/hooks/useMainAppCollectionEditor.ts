import { useCallback, useState } from 'react'

import type { CollectionFormValues } from '@/components/raindrop/collection-dialog'
import type { Collection, Group } from '@/lib/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  closeCollectionDialog,
  closeMergeDialog,
  openCollectionDialog,
} from '@/store/slices/dialogSlice'
import {
  setCollectionIcon,
  setCollectionViewMode,
} from '@/store/slices/uiSlice'

import type { useCollectionsCrud } from './useCollectionsCrud'

/**
 * Assign a saved root to a real group before persisting the user's group list.
 * The collection editor calls this after the collection write succeeds; orphan-only accounts
 * receive a real Collections group instead of persisting the synthetic visibility container.
 * @example assignCollectionGroup(groups, collection, 'group-0')
 */
function assignCollectionGroup(
  groups: Group[],
  entry: Collection,
  preferredId: string,
): Group[] {
  const savedGroups = groups.filter((group) => group.id !== 'ungrouped')
  if (!savedGroups.length)
    savedGroups.push({
      id: 'new-collections',
      name: 'Collections',
      collections: [],
    })
  const target =
    savedGroups.find((group) => group.id === preferredId) ?? savedGroups[0]
  return savedGroups.map((group) => ({
    ...group,
    collections: [
      ...group.collections.filter((item) => item.id !== entry.id),
      ...(group.id === target.id ? [{ ...entry, groupId: target.id }] : []),
    ],
  }))
}

/**
 * Coordinate collection creation/editing with group membership and local display preferences.
 * MainApp uses this editor; an error after creation retains the confirmed collection ID for retry.
 * @example const editor = useMainAppCollectionEditor(groups, collectionOperations)
 */
export function useMainAppCollectionEditor(
  groups: Group[],
  {
    createCollection: saveCollection,
    updateCollection,
    updateUserGroups,
    merge,
  }: Pick<
    ReturnType<typeof useCollectionsCrud>,
    'createCollection' | 'updateCollection' | 'updateUserGroups' | 'merge'
  >,
) {
  const dispatch = useAppDispatch()
  const [initialCollectionGroupId, setInitialCollectionGroupId] = useState<
    string | undefined
  >()
  const [editingCollection, setEditingCollection] = useState<
    Collection | undefined
  >()
  const isCollectionDialogOpen = useAppSelector(
    (state) => state.dialog.collectionDialog.open,
  )
  const collectionViewModes = useAppSelector(
    (state) => state.ui.collectionViewModes,
  )
  const defaultViewMode = useAppSelector(
    (state) => state.settings.defaultViewMode,
  )
  const handleSaveCollection = useCallback(
    async (data: CollectionFormValues & { id?: string }) => {
      const id =
        data.id ??
        (await saveCollection({
          title: data.name,
          parentId: data.parentId,
          isPublic: data.isPublic,
        }))
      try {
        await updateCollection(id, {
          title: data.name,
          color: data.color,
          isPublic: data.isPublic,
          parentId: data.parentId,
        })
        // Groups are remote; icons, colors and Lain-only view modes belong to this account's local preferences.
        if (!data.parentId) {
          const entry: Collection = {
            id,
            name: data.name,
            count: 0,
            icon: data.icon,
            groupId: data.groupId,
            color: data.color,
          }
          await updateUserGroups(
            assignCollectionGroup(groups, entry, data.groupId),
          )
        }
        dispatch(
          setCollectionViewMode({ collectionId: id, viewMode: data.viewMode }),
        )
        dispatch(setCollectionIcon({ id, icon: data.icon }))
        dispatch(closeCollectionDialog())
      } catch (error) {
        throw Object.assign(
          new Error(
            error instanceof Error ? error.message : 'Collection save failed',
          ),
          { collectionId: id },
        )
      }
    },
    [saveCollection, updateCollection, updateUserGroups, groups, dispatch],
  )

  const handleAddCollection = useCallback(
    (initialGroupId?: string) => {
      setEditingCollection(undefined)
      setInitialCollectionGroupId(initialGroupId)
      dispatch(openCollectionDialog())
    },
    [dispatch],
  )

  const handleCollectionDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        dispatch(closeCollectionDialog())
        setEditingCollection(undefined)
        setInitialCollectionGroupId(undefined)
      }
    },
    [dispatch],
  )

  const handleMergeCollections = useCallback(
    async (sourceId: string, targetId: string) => {
      await merge(targetId, [sourceId])
      dispatch(closeMergeDialog())
    },
    [merge, dispatch],
  )

  const handleEditCollection = useCallback(
    (collection: Collection): void => {
      setEditingCollection(collection)
      setInitialCollectionGroupId(undefined)
      dispatch(openCollectionDialog())
    },
    [dispatch],
  )
  const collectionDefaultViewMode = editingCollection
    ? (collectionViewModes[editingCollection.id] ?? defaultViewMode)
    : defaultViewMode
  return {
    editingCollection,
    initialCollectionGroupId,
    isCollectionDialogOpen,
    collectionDefaultViewMode,
    handleSaveCollection,
    handleAddCollection,
    handleCollectionDialogOpenChange,
    handleEditCollection,
    handleMergeCollections,
  }
}
