import { useCallback, useState } from 'react'

import type { GroupFormValues } from '@/components/raindrop/group-dialog'
import type { Group } from '@/lib/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { closeGroupDialog, openGroupDialog } from '@/store/slices/dialogSlice'

import type { useCollectionsCrud } from './useCollectionsCrud'

/**
 * Own group dialog state and preserve collections when a group is removed.
 * MainApp and its sidebar call these operations; close occurs only after remote confirmation.
 * @example const editor = useMainAppGroupEditor(groups, updateUserGroups)
 */
export function useMainAppGroupEditor(
  groups: Group[],
  updateUserGroups: ReturnType<typeof useCollectionsCrud>['updateUserGroups'],
) {
  const dispatch = useAppDispatch()
  const [editingGroup, setEditingGroup] = useState<Group | undefined>()
  const isGroupDialogOpen = useAppSelector(
    (state) => state.dialog.groupDialog.open,
  )
  const handleSaveGroup = useCallback(
    async (data: GroupFormValues & { id?: string }) => {
      // Synthetic containers are local visibility fallbacks, never remote group records.
      if (data.id === 'ungrouped')
        throw new Error('Choose a saved group to edit.')
      const savedGroups = groups.filter((group) => group.id !== 'ungrouped')
      const next = data.id
        ? savedGroups.map((group) =>
            group.id === data.id
              ? { ...group, name: data.name, hidden: data.collapsed }
              : group,
          )
        : [
            ...savedGroups,
            {
              id: `new-${Date.now()}`,
              name: data.name,
              hidden: data.collapsed,
              collections: [],
            },
          ]
      await updateUserGroups(next)
      dispatch(closeGroupDialog())
      setEditingGroup(undefined)
    },
    [groups, updateUserGroups, dispatch],
  )

  const handleEditGroup = useCallback(
    (group: Group) => {
      if (group.id === 'ungrouped') return
      setEditingGroup(group)
      dispatch(openGroupDialog())
    },
    [dispatch],
  )

  const handleDeleteGroup = useCallback(
    async (id: string) => {
      if (id === 'ungrouped') return
      const source = groups.find((group) => group.id === id)
      if (!source) return
      // Removing a group only moves its roots to another group; bookmarks and collections survive.
      const remaining = groups.filter(
        (group) => group.id !== id && group.id !== 'ungrouped',
      )
      if (!remaining.length)
        remaining.push({
          id: 'new-recovered',
          name: 'Collections',
          collections: [],
        })
      remaining[0] = {
        ...remaining[0],
        collections: [...remaining[0].collections, ...source.collections],
      }
      await updateUserGroups(remaining)
    },
    [groups, updateUserGroups],
  )

  const handleAddGroup = useCallback(() => {
    setEditingGroup(undefined)
    dispatch(openGroupDialog())
  }, [dispatch])

  const handleGroupDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) dispatch(closeGroupDialog())
    },
    [dispatch],
  )

  return {
    editingGroup,
    isGroupDialogOpen,
    handleSaveGroup,
    handleEditGroup,
    handleDeleteGroup,
    handleAddGroup,
    handleGroupDialogOpenChange,
  }
}
