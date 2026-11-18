import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { LeftSidebarProps } from '@/components/raindrop/left-sidebar.types'
import {
  moveRootCollection,
  updateRootCollection,
} from '@/lib/collection-organization'
import {
  removeRootCollection,
  serializeRootStructure,
} from '@/lib/sidebar-organization'
import type { Group, Collection } from '@/lib/types'

type SidebarOrganizationOptions = Pick<
  LeftSidebarProps,
  | 'groups'
  | 'onPersistGroups'
  | 'onDeleteCollection'
  | 'onRenameCollection'
  | 'onChangeCollectionColor'
>

/**
 * Keep collection mutations optimistic and recover the prior tree when persistence fails.
 * Called by the sidebar; rename failures also preserve the user's draft for retry.
 * @returns Controlled tree/editor state and the callbacks used by collection rows.
 * @example
 * const organization = useSidebarOrganization(props)
 */
export function useSidebarOrganization({
  groups,
  onPersistGroups,
  onDeleteCollection,
  onRenameCollection,
  onChangeCollectionColor,
}: SidebarOrganizationOptions) {
  const [optimisticGroups, setOptimisticGroups] = useState<Group[] | null>(null)
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(
    null,
  )
  const [editingName, setEditingName] = useState('')
  const inlineRenameCancelledRef = useRef(false)

  const displayedGroups = optimisticGroups ?? groups

  const runOptimisticWrite = useCallback(
    async (
      nextGroups: Group[],
      previousGroups: Group[],
      write: () => Promise<void>,
    ) => {
      setOptimisticGroups(nextGroups)
      try {
        await write()
        setOptimisticGroups(null)
      } catch {
        setOptimisticGroups(previousGroups)
        toast.error('Collection changes could not be saved. Please retry.')
      }
    },
    [],
  )
  const handlePersistGroups = useCallback(
    async (nextGroups: Group[], previousGroups: Group[]) =>
      runOptimisticWrite(nextGroups, previousGroups, async () =>
        onPersistGroups(nextGroups),
      ),
    [runOptimisticWrite, onPersistGroups],
  )

  const handleMoveCollectionToGroup = useCallback(
    async (collectionId: string, targetGroupId: string) => {
      // API-less fallback groups can provide a drag source, but cannot receive a persisted move.
      if (targetGroupId === 'ungrouped') return
      const previousGroups = displayedGroups
      const targetGroup = previousGroups.find(
        (group) => group.id === targetGroupId,
      )
      if (!targetGroup) return

      const nextGroups = moveRootCollection(
        previousGroups,
        collectionId,
        targetGroupId,
        targetGroup.collections.length,
      )
      if (
        serializeRootStructure(previousGroups) ===
        serializeRootStructure(nextGroups)
      ) {
        return
      }
      await handlePersistGroups(nextGroups, previousGroups)
    },
    [displayedGroups, handlePersistGroups],
  )

  const handleDeleteWithOptimistic = useCallback(
    async (collectionId: string) => {
      const previousGroups = displayedGroups
      const nextGroups = removeRootCollection(previousGroups, collectionId)
      await runOptimisticWrite(nextGroups, previousGroups, async () =>
        onDeleteCollection(collectionId),
      )
    },
    [displayedGroups, onDeleteCollection, runOptimisticWrite],
  )

  const handleStartInlineRename = useCallback((collection: Collection) => {
    inlineRenameCancelledRef.current = false
    setEditingCollectionId(collection.id)
    setEditingName(collection.name)
  }, [])

  const handleEditingNameChange = useCallback((nextName: string) => {
    setEditingName(nextName)
  }, [])

  const handleCancelInlineRename = useCallback(() => {
    inlineRenameCancelledRef.current = true
    setEditingCollectionId(null)
    setEditingName('')
  }, [])

  const handleSubmitInlineRename = useCallback(
    async (collectionId: string, nextName: string) => {
      if (inlineRenameCancelledRef.current) {
        inlineRenameCancelledRef.current = false
        return
      }

      const trimmedName = nextName.trim()
      if (!trimmedName) {
        handleCancelInlineRename()
        return
      }

      const previousGroups = displayedGroups
      const nextGroups = updateRootCollection(
        previousGroups,
        collectionId,
        (item) => ({
          ...item,
          name: trimmedName,
        }),
      )

      setOptimisticGroups(nextGroups)
      setEditingCollectionId(null)
      setEditingName('')

      try {
        await onRenameCollection(collectionId, trimmedName)
        inlineRenameCancelledRef.current = false
        setOptimisticGroups(null)
      } catch {
        setOptimisticGroups(previousGroups)
        setEditingCollectionId(collectionId)
        setEditingName(nextName)
        toast.error(
          'Collection name could not be saved. Your draft is preserved.',
        )
      }
    },
    [displayedGroups, handleCancelInlineRename, onRenameCollection],
  )

  const handleChangeColor = useCallback(
    async (collectionId: string, color: string) => {
      const previousGroups = displayedGroups
      const nextGroups = updateRootCollection(
        previousGroups,
        collectionId,
        (item) => ({
          ...item,
          color,
        }),
      )
      await runOptimisticWrite(nextGroups, previousGroups, async () =>
        onChangeCollectionColor(collectionId, color),
      )
    },
    [displayedGroups, onChangeCollectionColor, runOptimisticWrite],
  )

  return {
    displayedGroups,
    editingCollectionId,
    editingName,
    handlePersistGroups,
    handleMoveCollectionToGroup,
    handleDeleteWithOptimistic,
    handleStartInlineRename,
    handleEditingNameChange,
    handleCancelInlineRename,
    handleSubmitInlineRename,
    handleChangeColor,
  }
}
