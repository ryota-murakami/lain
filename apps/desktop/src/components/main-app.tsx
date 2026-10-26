import React, { useCallback, useMemo, useRef, useState } from 'react'

import { AddBookmarkDialog } from '@/components/raindrop/add-bookmark-dialog'
import { CollectionDialog } from '@/components/raindrop/collection-dialog'
import { GlobalSearchCommand } from '@/components/raindrop/global-search-command'
import { GroupDialog } from '@/components/raindrop/group-dialog'
import { LeftSidebar } from '@/components/raindrop/left-sidebar'
import { MainContent } from '@/components/raindrop/main-content'
import { MergeDialog } from '@/components/raindrop/merge-dialog'
import { RightDetailPanel } from '@/components/raindrop/right-detail-panel'
import { SettingsDialog } from '@/components/raindrop/settings-dialog'
import { TagManagement } from '@/components/raindrop/tag-management'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { useCollectionsCrud } from '@/hooks/useCollectionsCrud'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useRaindropsCrud } from '@/hooks/useRaindropsCrud'
import { useSidebarData } from '@/hooks/useSidebarData'
import { useTagsCrud } from '@/hooks/useTagsCrud'
import { mapSortOptionToApi } from '@/lib/api-mappers'
import { buildSearchQuery } from '@/lib/search'
import type {
  Collection,
  Group,
  Raindrop,
  SearchMode,
  SearchScope,
  SortOption,
  ViewMode,
} from '@/lib/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  closeAddBookmark,
  closeCollectionDialog,
  closeGroupDialog,
  closeMergeDialog,
  closeSettings,
  closeTagManagement,
  openAddBookmark,
  openCollectionDialog,
  openGroupDialog,
  openMergeDialog,
  openSettings,
  openTagManagement,
} from '@/store/slices/dialogSlice'
import {
  setSearchMode,
  setSearchOpen,
  setSearchQuery,
  setSearchScope,
} from '@/store/slices/searchSlice'
import {
  clearSelection,
  clearCollectionViewMode,
  getEffectiveViewMode,
  getHasCollectionViewModeOverride,
  selectAllRaindrops,
  setCollectionViewMode,
  setDetailPanelOpen,
  setSelectedCollectionId,
  setSelectedRaindropIds,
  setViewMode,
} from '@/store/slices/uiSlice'

/**
 * Main authenticated app view — 3-panel layout with sidebar, content, and detail.
 * Connects all UI components to the Raindrop.io API via RTK Query hooks and
 * Redux slices. Orchestrates all CRUD operations through callback props.
 *
 * @example
 *   // Used in App.tsx after auth check
 *   if (isAuthenticated) return <MainApp />
 */
export const MainApp = React.memo(function MainApp() {
  const dispatch = useAppDispatch()

  // --- Redux State ---
  const selectedCollectionId = useAppSelector((s) => s.ui.selectedCollectionId)
  const isDetailPanelOpen = useAppSelector((s) => s.ui.isDetailPanelOpen)
  const selectedRaindropIds = useAppSelector((s) => s.ui.selectedRaindropIds)
  const isSearchOpen = useAppSelector((s) => s.search.isSearchOpen)
  const searchQuery = useAppSelector((s) => s.search.query)
  const searchScope = useAppSelector((s) => s.search.scope)
  const searchMode = useAppSelector((s) => s.search.mode)
  const isAddBookmarkOpen = useAppSelector((s) => s.dialog.addBookmark.open)
  const isCollectionDialogOpen = useAppSelector(
    (s) => s.dialog.collectionDialog.open,
  )
  const isGroupDialogOpen = useAppSelector((s) => s.dialog.groupDialog.open)
  const isTagManagementOpen = useAppSelector((s) => s.dialog.tagManagement.open)
  const isMergeDialogOpen = useAppSelector((s) => s.dialog.mergeDialog.open)
  const isSettingsOpen = useAppSelector((s) => s.dialog.settings.open)
  const settingsTab = useAppSelector((s) => s.dialog.settings.tab)
  const effectiveViewMode = useAppSelector(getEffectiveViewMode)
  const hasCollectionViewModeOverride = useAppSelector(
    getHasCollectionViewModeOverride,
  )

  // --- Refs ---
  const searchInputRef = useRef<HTMLInputElement>(null)

  // --- Local State ---
  const [selectedRaindrop, setSelectedRaindrop] = useState<
    Raindrop | undefined
  >()
  const [sortOption, setSortOption] = useState<SortOption>('newest')
  const [editingCollection, setEditingCollection] = useState<
    Collection | undefined
  >()

  // --- Data Hooks ---
  const {
    groups,
    systemCollections,
    isLoading: isSidebarLoading,
  } = useSidebarData()

  const apiSort = mapSortOptionToApi(sortOption)
  const normalizedSearchQuery = useMemo(() => searchQuery.trim(), [searchQuery])
  const shouldSearchGlobally =
    normalizedSearchQuery.length > 0 &&
    searchMode === 'global' &&
    selectedCollectionId !== 'all'
  const effectiveSearchCollectionId = shouldSearchGlobally
    ? 'all'
    : selectedCollectionId
  const apiSearchQuery = useMemo(() => {
    if (normalizedSearchQuery.length === 0) return undefined
    return buildSearchQuery(normalizedSearchQuery, searchScope)
  }, [normalizedSearchQuery, searchScope])

  // Manual reorder only makes sense inside one collection, sorted manually, unfiltered
  const canReorderRaindrops =
    sortOption === 'manual' &&
    normalizedSearchQuery.length === 0 &&
    selectedCollectionId !== 'all'

  const {
    raindrops,
    isLoading: isRaindropsLoading,
    isFetching: isRaindropsFetching,
    hasMore,
    loadMore,
    createRaindrop,
    updateRaindrop,
    deleteRaindrop,
    batchMoveToCollection,
    batchAddTag,
    batchDeleteRaindrops,
    reorderRaindrop,
  } = useRaindropsCrud({
    collectionId: effectiveSearchCollectionId,
    sort: apiSort,
    search: apiSearchQuery,
  })

  const { tags: allTags, renameTag, deleteTag } = useTagsCrud()
  const {
    createCollection: saveCollection,
    updateCollection,
    deleteCollection,
    merge,
    emptyTrash,
    updateUserGroups,
    renameCollection,
    recolorCollection,
  } = useCollectionsCrud()

  // Bridge: string[] (Redux) → Set<string> (MainContent expects Set)
  const selectedRaindropIdsSet = useMemo(
    () => new Set(selectedRaindropIds),
    [selectedRaindropIds],
  )

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(() => {
    if (selectedCollectionId === 'all') return ['All Bookmarks']
    if (selectedCollectionId === 'unsorted') return ['Unsorted']
    if (selectedCollectionId === 'trash') return ['Trash']

    const findCollectionPath = (
      collections: Collection[],
      targetId: string,
      path: string[] = [],
    ): string[] | null => {
      for (const collection of collections) {
        const currentPath = [...path, collection.name]
        if (collection.id === targetId) return currentPath
        if (collection.children) {
          const childPath = findCollectionPath(
            collection.children,
            targetId,
            currentPath,
          )
          if (childPath) return childPath
        }
      }
      return null
    }

    for (const group of groups) {
      const collectionPath = findCollectionPath(
        group.collections,
        selectedCollectionId,
      )
      if (collectionPath) return [group.name, ...collectionPath]
    }

    return ['Unknown']
  }, [selectedCollectionId, groups])

  // --- Event Handlers ---
  const handleSelectCollection = useCallback(
    (id: string) => dispatch(setSelectedCollectionId(id)),
    [dispatch],
  )

  const handleSelectRaindrop = useCallback(
    (raindrop: Raindrop) => {
      setSelectedRaindrop(raindrop)
      dispatch(setDetailPanelOpen(true))
    },
    [dispatch],
  )

  // ↑/↓ only highlight (and feed an already-open detail panel); Space decides the panel
  const handleFocusRaindrop = useCallback(
    (raindrop: Raindrop) => setSelectedRaindrop(raindrop),
    [],
  )

  const handleTogglePreview = useCallback(
    (raindrop: Raindrop) => {
      setSelectedRaindrop(raindrop)
      dispatch(setDetailPanelOpen(!isDetailPanelOpen))
    },
    [dispatch, isDetailPanelOpen],
  )

  const handleSelectedIdsChange = useCallback(
    (ids: Set<string>) => dispatch(setSelectedRaindropIds([...ids])),
    [dispatch],
  )

  const handleCloseDetailPanel = useCallback(
    () => dispatch(setDetailPanelOpen(false)),
    [dispatch],
  )

  const handleSearchOpenChange = useCallback(
    (open: boolean) => dispatch(setSearchOpen(open)),
    [dispatch],
  )
  const handleSearchQueryChange = useCallback(
    (query: string) => dispatch(setSearchQuery(query)),
    [dispatch],
  )
  const handleSearchScopeChange = useCallback(
    (scope: SearchScope) => dispatch(setSearchScope(scope)),
    [dispatch],
  )
  const handleSearchModeChange = useCallback(
    (mode: SearchMode) => dispatch(setSearchMode(mode)),
    [dispatch],
  )

  const handleSortChange = useCallback((sort: SortOption) => {
    setSortOption(sort)
  }, [])

  // --- CRUD Handlers ---
  const handleSaveBookmark = useCallback(
    (bookmark: unknown) => {
      const data = bookmark as {
        url?: string
        title?: string
        description?: string
        tags?: string[]
        collectionId?: string
      }
      if (data.url) {
        createRaindrop({
          url: data.url,
          title: data.title,
          description: data.description,
          tags: data.tags,
          collectionId: data.collectionId,
        })
      }
    },
    [createRaindrop],
  )

  const handleSaveRaindrop = useCallback(
    async (raindrop: Raindrop) => updateRaindrop(raindrop.id, raindrop),
    [updateRaindrop],
  )

  const handleDeleteRaindrop = useCallback(
    (raindropId: string) => {
      deleteRaindrop(raindropId)
      dispatch(setDetailPanelOpen(false))
    },
    [deleteRaindrop, dispatch],
  )

  // --- Collection CRUD Handlers ---
  const handleSaveCollection = useCallback(
    async (collection: unknown) => {
      const data = collection as {
        id?: string
        title?: string
        name?: string
        view?: string
        parentId?: string
      }
      const title = data.title ?? data.name
      if (!title) return
      if (data.id) {
        await updateCollection(data.id, { title, view: data.view })
      } else {
        await saveCollection({ title, parentId: data.parentId })
      }
      dispatch(closeCollectionDialog())
    },
    [saveCollection, updateCollection, dispatch],
  )

  const handleDeleteCollection = useCallback(
    async (collectionId: string) => {
      await deleteCollection(collectionId)
    },
    [deleteCollection],
  )

  /**
   * Persist sidebar group ordering and membership updates.
   * @param nextGroups - Updated group structure from sidebar interactions
   */
  const handlePersistGroups = useCallback(
    async (nextGroups: Group[]) => {
      await updateUserGroups(nextGroups)
    },
    [updateUserGroups],
  )

  /**
   * Rename a collection from inline sidebar editing.
   * @param collectionId - Collection ID
   * @param title - New collection title
   */
  const handleRenameCollection = useCallback(
    async (collectionId: string, title: string) => {
      await renameCollection(collectionId, title)
    },
    [renameCollection],
  )

  /**
   * Update collection color from sidebar context menu.
   * @param collectionId - Collection ID
   * @param color - Selected color
   */
  const handleChangeCollectionColor = useCallback(
    async (collectionId: string, color: string) => {
      await recolorCollection(collectionId, color)
    },
    [recolorCollection],
  )

  const handleEmptyTrash = useCallback(async () => {
    await emptyTrash()
  }, [emptyTrash])

  const handleSaveGroup = useCallback(
    (_group: unknown) => {
      dispatch(closeGroupDialog())
    },
    [dispatch],
  )

  // --- Merge ---
  const handleMergeCollections = useCallback(
    async (sourceId: string, targetId: string) => {
      await merge(targetId, [sourceId])
      dispatch(closeMergeDialog())
    },
    [merge, dispatch],
  )

  // --- Tags ---
  const handleRenameTag = useCallback(
    async (oldName: string, newName: string) =>
      renameTag(selectedCollectionId, oldName, newName),
    [renameTag, selectedCollectionId],
  )

  const handleDeleteTag = useCallback(
    async (tagName: string) => deleteTag(selectedCollectionId, [tagName]),
    [deleteTag, selectedCollectionId],
  )

  const handleMergeTags = useCallback(
    async (sourceTags: string[], targetTag: string) => {
      for (const sourceTag of sourceTags) {
        await renameTag(selectedCollectionId, sourceTag, targetTag)
      }
    },
    [renameTag, selectedCollectionId],
  )

  // --- Batch Operations ---
  const handleBatchMove = useCallback(
    async (ids: string[], targetCollectionId: string) => {
      await batchMoveToCollection(ids, targetCollectionId)
      dispatch(clearSelection())
    },
    [batchMoveToCollection, dispatch],
  )

  const handleBatchAddTag = useCallback(
    async (ids: string[], tags: string[]) => {
      await batchAddTag(ids, tags)
      dispatch(clearSelection())
    },
    [batchAddTag, dispatch],
  )

  const handleBatchDelete = useCallback(
    async (ids: string[]) => {
      await batchDeleteRaindrops(ids)
      dispatch(clearSelection())
    },
    [batchDeleteRaindrops, dispatch],
  )

  // --- Dialog Openers ---
  const handleAddBookmark = useCallback(
    () =>
      dispatch(
        openAddBookmark(
          selectedCollectionId !== 'all'
            ? { defaultCollectionId: selectedCollectionId }
            : undefined,
        ),
      ),
    [dispatch, selectedCollectionId],
  )

  const handleAddCollection = useCallback(() => {
    setEditingCollection(undefined)
    dispatch(openCollectionDialog())
  }, [dispatch])

  const handleAddGroup = useCallback(
    () => dispatch(openGroupDialog()),
    [dispatch],
  )

  const handleManageTags = useCallback(
    () => dispatch(openTagManagement()),
    [dispatch],
  )

  const handleOpenMerge = useCallback(
    () => dispatch(openMergeDialog()),
    [dispatch],
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
        dispatch(setViewMode(mode))
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

  const handleToggleImportant = useCallback(
    (raindropId: string) => {
      const target = raindrops.find((r) => r.id === raindropId)
      if (target) {
        updateRaindrop(raindropId, { isImportant: !target.isImportant })
      }
    },
    [raindrops, updateRaindrop],
  )

  // --- Settings Dialog ---
  const handleSettingsOpenChange = useCallback(
    (open: boolean) => {
      if (!open) dispatch(closeSettings())
    },
    [dispatch],
  )

  // --- Keyboard Shortcuts ---
  useKeyboardShortcuts(
    useMemo(
      () => ({
        search: () => dispatch(setSearchOpen(!isSearchOpen)),
        newBookmark: handleAddBookmark,
        newCollection: handleAddCollection,
        viewGrid: () => handleViewModeChange('grid'),
        viewList: () => handleViewModeChange('list'),
        viewTable: () => handleViewModeChange('table'),
        viewDirectory: () => handleViewModeChange('directory'),
        settings: () => dispatch(openSettings()),
        editShortcuts: () => dispatch(openSettings({ tab: 'shortcuts' })),
        delete: () => {
          const ids =
            selectedRaindropIds.length > 0
              ? selectedRaindropIds
              : selectedRaindrop
                ? [selectedRaindrop.id]
                : []
          if (ids.length > 0) batchDeleteRaindrops(ids)
        },
        selectAll: () => {
          const allIds = raindrops.map((r) => r.id)
          dispatch(selectAllRaindrops(allIds))
        },
        searchInView: () => searchInputRef.current?.focus(),
        searchGlobal: () => {
          dispatch(setSearchMode('global'))
          dispatch(setSearchOpen(true))
        },
        toggleImportant: () => {
          const targetId =
            selectedRaindropIds.length === 1
              ? selectedRaindropIds[0]
              : selectedRaindrop?.id
          if (targetId) handleToggleImportant(targetId)
        },
        manageTags: handleManageTags,
      }),
      [
        dispatch,
        isSearchOpen,
        handleAddBookmark,
        handleAddCollection,
        selectedRaindropIds,
        selectedRaindrop,
        batchDeleteRaindrops,
        raindrops,
        handleToggleImportant,
        handleViewModeChange,
        handleManageTags,
      ],
    ),
  )

  // --- Dialog Close Handlers ---
  const handleAddBookmarkOpenChange = useCallback(
    (open: boolean) => {
      if (!open) dispatch(closeAddBookmark())
    },
    [dispatch],
  )

  const handleCollectionDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        dispatch(closeCollectionDialog())
        setEditingCollection(undefined)
      }
    },
    [dispatch],
  )

  const handleGroupDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) dispatch(closeGroupDialog())
    },
    [dispatch],
  )

  const handleTagManagementOpenChange = useCallback(
    (open: boolean) => {
      if (!open) dispatch(closeTagManagement())
    },
    [dispatch],
  )

  const handleMergeDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) dispatch(closeMergeDialog())
    },
    [dispatch],
  )

  // Loading skeleton while sidebar data loads
  if (isSidebarLoading) {
    return (
      <SidebarProvider defaultOpen>
        <div className="flex h-screen w-screen items-center justify-center">
          <div className="text-muted-foreground animate-pulse">Loading...</div>
        </div>
        <Toaster />
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-screen w-screen overflow-hidden">
        <LeftSidebar
          systemCollections={systemCollections}
          groups={groups}
          selectedCollectionId={selectedCollectionId}
          onSelectCollection={handleSelectCollection}
          onAddBookmark={handleAddBookmark}
          onAddCollection={handleAddCollection}
          onAddGroup={handleAddGroup}
          onManageTags={handleManageTags}
          onDeleteCollection={handleDeleteCollection}
          onEmptyTrash={handleEmptyTrash}
          onMergeCollections={handleOpenMerge}
          onPersistGroups={handlePersistGroups}
          onRenameCollection={handleRenameCollection}
          onChangeCollectionColor={handleChangeCollectionColor}
        >
          <SidebarInset className="min-w-0 flex-1">
            <MainContent
              breadcrumbs={breadcrumbs}
              selectedCollectionId={selectedCollectionId}
              raindrops={raindrops}
              isLoading={isRaindropsLoading}
              isFetching={isRaindropsFetching}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onSelectRaindrop={handleSelectRaindrop}
              onFocusRaindrop={handleFocusRaindrop}
              onTogglePreview={handleTogglePreview}
              selectedRaindropId={selectedRaindrop?.id}
              selectedRaindropIds={selectedRaindropIdsSet}
              onSelectedRaindropIdsChange={handleSelectedIdsChange}
              groups={groups}
              collections={groups.flatMap((g) => g.collections)}
              onAddBookmark={handleAddBookmark}
              sortOption={sortOption}
              onSortChange={handleSortChange}
              searchQuery={searchQuery}
              searchScope={searchScope}
              searchMode={searchMode}
              onSearchQueryChange={handleSearchQueryChange}
              onSearchScopeChange={handleSearchScopeChange}
              onSearchModeChange={handleSearchModeChange}
              onBatchMove={handleBatchMove}
              onBatchAddTag={handleBatchAddTag}
              onBatchDelete={handleBatchDelete}
              viewMode={effectiveViewMode}
              onViewModeChange={handleViewModeChange}
              hasCollectionViewModeOverride={hasCollectionViewModeOverride}
              onCollectionViewModeOverrideChange={
                handleCollectionViewModeOverrideChange
              }
              onToggleImportant={handleToggleImportant}
              canReorderRaindrops={canReorderRaindrops}
              onReorderRaindrop={reorderRaindrop}
              searchInputRef={searchInputRef}
            />
          </SidebarInset>

          <RightDetailPanel
            raindrop={selectedRaindrop}
            isOpen={isDetailPanelOpen}
            onClose={handleCloseDetailPanel}
            groups={groups}
            existingTags={allTags.map((t) => t.name)}
            onSave={handleSaveRaindrop}
            onDelete={handleDeleteRaindrop}
          />
        </LeftSidebar>

        <GlobalSearchCommand
          open={isSearchOpen}
          onOpenChange={handleSearchOpenChange}
          raindrops={raindrops}
          onSelectRaindrop={handleSelectRaindrop}
          onSelectCollection={handleSelectCollection}
          groups={groups}
          collections={groups.flatMap((g) => g.collections)}
          currentCollectionId={selectedCollectionId}
        />

        <AddBookmarkDialog
          open={isAddBookmarkOpen}
          onOpenChange={handleAddBookmarkOpenChange}
          groups={groups}
          existingTags={allTags.map((t) => t.name)}
          defaultCollectionId={
            selectedCollectionId !== 'all' ? selectedCollectionId : undefined
          }
          onSave={handleSaveBookmark}
        />

        <CollectionDialog
          open={isCollectionDialogOpen}
          onOpenChange={handleCollectionDialogOpenChange}
          groups={groups}
          collection={editingCollection}
          onSave={handleSaveCollection}
        />

        <GroupDialog
          open={isGroupDialogOpen}
          onOpenChange={handleGroupDialogOpenChange}
          group={undefined}
          onSave={handleSaveGroup}
        />

        <TagManagement
          open={isTagManagementOpen}
          onOpenChange={handleTagManagementOpenChange}
          tags={allTags}
          onRename={handleRenameTag}
          onDelete={handleDeleteTag}
          onMerge={handleMergeTags}
        />

        <MergeDialog
          open={isMergeDialogOpen}
          onOpenChange={handleMergeDialogOpenChange}
          collections={groups.flatMap((g) => g.collections)}
          onConfirm={handleMergeCollections}
        />

        <SettingsDialog
          open={isSettingsOpen}
          onOpenChange={handleSettingsOpenChange}
          defaultTab={settingsTab}
        />
      </div>
      <Toaster />
    </SidebarProvider>
  )
})
