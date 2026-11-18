import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useCallback, useMemo, useState } from 'react'

import type {
  LeftSidebarProps,
  CollectionTreeProps,
} from '@/components/raindrop/left-sidebar.types'

import { useSidebarDrag } from './useSidebarDrag'
import { useSidebarExpansion } from './useSidebarExpansion'
import { useSidebarOrganization } from './useSidebarOrganization'

/**
 * Compose sidebar search, expansion, mutation, and drag domains into one presentation contract.
 * Called by LeftSidebar; each domain remains independently testable and owns its own state.
 * @example
 * const sidebar = useSidebarController(props)
 */
export function useSidebarController({
  groups,
  selectedCollectionId,
  onSelectCollection,
  onPersistGroups,
  onDeleteCollection,
  onRenameCollection,
  onChangeCollectionColor,
  onEditCollection,
}: LeftSidebarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const {
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
  } = useSidebarOrganization({
    groups,
    onPersistGroups,
    onDeleteCollection,
    onRenameCollection,
    onChangeCollectionColor,
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleOpenSearch = useCallback(() => {
    setIsSearchOpen(true)
  }, [])

  const handleCloseSearch = useCallback(() => {
    setIsSearchOpen(false)
  }, [])

  const handleSearchSelect = useCallback(
    (collectionId: string) => {
      onSelectCollection(collectionId)
      setIsSearchOpen(false)
    },
    [onSelectCollection],
  )

  const {
    expandedCollections,
    isUngroupedExpanded,
    toggleGroup,
    toggleCollection,
    sidebarMenuButtonStyles,
  } = useSidebarExpansion({ groups, onPersistGroups })

  const {
    activeDragCollection,
    dropIndicator,
    isRaindropDragActive,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useSidebarDrag({
    displayedGroups,
    handlePersistGroups,
    onDragEditingCancel: handleCancelInlineRename,
  })

  const treeProps = useMemo<CollectionTreeProps>(
    () => ({
      selectedCollectionId: selectedCollectionId,
      expandedCollections: expandedCollections,
      onSelectCollection: onSelectCollection,
      onToggleCollection: toggleCollection,
      onDeleteCollection: handleDeleteWithOptimistic,
      onMoveCollectionToGroup: handleMoveCollectionToGroup,
      onChangeCollectionColor: handleChangeColor,
      onEditCollection: onEditCollection,
      onStartInlineRename: handleStartInlineRename,
      onSubmitInlineRename: handleSubmitInlineRename,
      onCancelInlineRename: handleCancelInlineRename,
      editingCollectionId: editingCollectionId,
      editingName: editingName,
      onEditingNameChange: handleEditingNameChange,
      sidebarMenuButtonStyles: sidebarMenuButtonStyles,
      groups: displayedGroups,
      isRaindropDragActive: isRaindropDragActive,
    }),
    [
      selectedCollectionId,
      expandedCollections,
      onSelectCollection,
      toggleCollection,
      handleDeleteWithOptimistic,
      handleMoveCollectionToGroup,
      handleChangeColor,
      onEditCollection,
      handleStartInlineRename,
      handleSubmitInlineRename,
      handleCancelInlineRename,
      editingCollectionId,
      editingName,
      handleEditingNameChange,
      sidebarMenuButtonStyles,
      displayedGroups,
      isRaindropDragActive,
    ],
  )

  return {
    isSearchOpen,
    displayedGroups,
    sensors,
    handleOpenSearch,
    handleCloseSearch,
    handleSearchSelect,
    isUngroupedExpanded,
    toggleGroup,
    activeDragCollection,
    dropIndicator,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    treeProps,
  }
}
