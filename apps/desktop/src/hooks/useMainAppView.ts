import { useCallback, useMemo, useState } from 'react'

import type { Group, SortOption, ViewMode } from '@/lib/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { setDefaultViewMode } from '@/store/slices/settingsSlice'
import {
  clearCollectionViewMode,
  getEffectiveViewMode,
  getHasCollectionViewModeOverride,
  setCollectionViewMode,
  setSelectedCollectionId,
  setSelectedRaindropIds,
} from '@/store/slices/uiSlice'

/**
 * Resolve the current collection breadcrumb without recursing through malformed cycles.
 * Called when MainApp's view hook receives new sidebar groups or a new selection.
 * @example collectionBreadcrumbs(groups, '100')
 */
function collectionBreadcrumbs(groups: Group[], id: string): string[] {
  const systemNames = new Map([
    ['all', 'All Bookmarks'],
    ['unsorted', 'Unsorted'],
    ['trash', 'Trash'],
  ])
  const systemName = systemNames.get(id)
  if (systemName) return [systemName]
  const visited = new Set<string>()
  const pending = groups
    .flatMap((group) =>
      group.collections.map((collection) => ({
        collection,
        path: [group.name, collection.name],
      })),
    )
    .reverse()
  while (pending.length) {
    const { collection, path } = pending.pop()!
    if (visited.has(collection.id)) continue
    visited.add(collection.id)
    if (collection.id === id) return path
    for (const child of [...(collection.children ?? [])].reverse())
      pending.push({ collection: child, path: [...path, child.name] })
  }
  return ['Unknown']
}

/**
 * Own collection navigation, bulk selection and collection-specific view preferences.
 * MainApp consumes these values; remembered collection modes do not alter the global default.
 * @example const view = useMainAppView(groups)
 */
export function useMainAppView(groups: Group[]) {
  const dispatch = useAppDispatch()
  const selectedCollectionId = useAppSelector(
    (state) => state.ui.selectedCollectionId,
  )
  const selectedRaindropIds = useAppSelector(
    (state) => state.ui.selectedRaindropIds,
  )
  const effectiveViewMode = useAppSelector(getEffectiveViewMode)
  const hasCollectionViewModeOverride = useAppSelector(
    getHasCollectionViewModeOverride,
  )
  const [sortOption, setSortOption] = useState<SortOption>('newest')
  const selectedRaindropIdsSet = useMemo(
    () => new Set(selectedRaindropIds),
    [selectedRaindropIds],
  )
  const breadcrumbs = useMemo(
    () => collectionBreadcrumbs(groups, selectedCollectionId),
    [groups, selectedCollectionId],
  )
  const handleSelectCollection = useCallback(
    (id: string) => dispatch(setSelectedCollectionId(id)),
    [dispatch],
  )
  const handleSelectedIdsChange = useCallback(
    (ids: Set<string>) => dispatch(setSelectedRaindropIds([...ids])),
    [dispatch],
  )
  const handleSortChange = useCallback(
    (sort: SortOption) => setSortOption(sort),
    [],
  )
  // --- View Mode ---
  // A remembered collection keeps its own mode; the global default stays untouched (F3.3)
  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      if (hasCollectionViewModeOverride) {
        dispatch(
          setCollectionViewMode({
            collectionId: selectedCollectionId,
            viewMode: mode,
          }),
        )
      } else {
        dispatch(setDefaultViewMode(mode))
      }
    },
    [dispatch, hasCollectionViewModeOverride, selectedCollectionId],
  )

  const handleCollectionViewModeOverrideChange = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        dispatch(
          setCollectionViewMode({
            collectionId: selectedCollectionId,
            viewMode: effectiveViewMode,
          }),
        )
      } else {
        dispatch(clearCollectionViewMode(selectedCollectionId))
      }
    },
    [dispatch, effectiveViewMode, selectedCollectionId],
  )

  return {
    selectedCollectionId,
    selectedRaindropIds,
    selectedRaindropIdsSet,
    effectiveViewMode,
    hasCollectionViewModeOverride,
    sortOption,
    breadcrumbs,
    handleSelectCollection,
    handleSelectedIdsChange,
    handleSortChange,
    handleViewModeChange,
    handleCollectionViewModeOverrideChange,
  }
}
