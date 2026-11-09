import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { toast } from 'sonner'

import type { LeftSidebarProps } from '@/components/raindrop/left-sidebar.types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { setExpandedCollectionIds } from '@/store/slices/uiSlice'

/**
 * Keep collection expansion in account UI state and persist real group visibility.
 * Called by LeftSidebar; the API-less fallback group's visibility remains local.
 * @example
 * const expansion = useSidebarExpansion({ groups, onPersistGroups })
 */
export function useSidebarExpansion({
  groups,
  onPersistGroups,
}: Pick<LeftSidebarProps, 'groups' | 'onPersistGroups'>) {
  const dispatch = useAppDispatch()
  const expandedIds = useAppSelector((state) => state.ui.expandedCollectionIds)
  const expandedCollections = useMemo(
    () => new Set(expandedIds ?? []),
    [expandedIds],
  )
  const [isUngroupedExpanded, setIsUngroupedExpanded] = useState(true)
  const toggleGroup = useCallback(
    (groupId: string) => {
      // The fallback group has no API identity, so collapse is local to this sidebar.
      if (groupId === 'ungrouped') {
        setIsUngroupedExpanded((expanded) => !expanded)
        return
      }

      void onPersistGroups(
        groups.map((group) =>
          group.id === groupId ? { ...group, hidden: !group.hidden } : group,
        ),
      ).catch(() =>
        toast.error('Could not save group expansion. Please retry.'),
      )
    },
    [groups, onPersistGroups],
  )

  const toggleCollection = useCallback(
    (collectionId: string) => {
      const next = new Set(expandedCollections)
      if (next.has(collectionId)) next.delete(collectionId)
      else next.add(collectionId)
      dispatch(setExpandedCollectionIds([...next]))
    },
    [dispatch, expandedCollections],
  )

  const sidebarMenuButtonStyles = useMemo(() => {
    const styles: Record<number, CSSProperties> = {}
    for (let depth = 0; depth <= 5; depth += 1) {
      styles[depth] = { paddingLeft: `${12 + depth * 16}px` }
    }
    return styles
  }, [])

  return {
    expandedCollections,
    isUngroupedExpanded,
    toggleGroup,
    toggleCollection,
    sidebarMenuButtonStyles,
  }
}
