import type { CSSProperties } from 'react'
import type React from 'react'

import type { Collection, Group, SystemCollection } from '@/lib/types'

/**
 * Props for LeftSidebar.
 */
export interface LeftSidebarProps {
  systemCollections: SystemCollection[]
  groups: Group[]
  selectedCollectionId: string
  onSelectCollection: (id: string) => void
  onAddBookmark: () => void
  onAddCollection: (initialGroupId?: string) => void
  onAddGroup: () => void
  onEditGroup?: (group: Group) => void
  onDeleteGroup?: (id: string) => Promise<void>
  onManageTags: () => void
  onDeleteCollection: (collectionId: string) => Promise<void>
  onEmptyTrash: () => Promise<void>
  onMergeCollections: () => void
  onPersistGroups: (groups: Group[]) => Promise<void>
  onEditCollection?: (collection: Collection) => void
  onRenameCollection: (collectionId: string, title: string) => Promise<void>
  onChangeCollectionColor: (
    collectionId: string,
    color: string,
  ) => Promise<void>
  /**
   * Content rendered inside the sidebar's DndContext (main content, detail panel) so
   * bookmarks dragged out of the list can be dropped on the collections here.
   */
  children?: React.ReactNode
}

export interface CollectionTreeProps {
  selectedCollectionId: string
  expandedCollections: Set<string>
  onSelectCollection: (id: string) => void
  onToggleCollection: (id: string) => void
  onDeleteCollection: (collectionId: string) => Promise<void>
  onMoveCollectionToGroup: (
    collectionId: string,
    targetGroupId: string,
  ) => Promise<void>
  onChangeCollectionColor: (
    collectionId: string,
    color: string,
  ) => Promise<void>
  onEditCollection?: (collection: Collection) => void
  onStartInlineRename: (collection: Collection) => void
  onSubmitInlineRename: (
    collectionId: string,
    nextName: string,
  ) => Promise<void>
  onCancelInlineRename: () => void
  editingCollectionId: string | null
  editingName: string
  onEditingNameChange: (nextName: string) => void
  groups: Group[]
  sidebarMenuButtonStyles: Record<number, CSSProperties>
  /** A bookmark drag is in progress — this collection may become its drop target */
  isRaindropDragActive: boolean
}
