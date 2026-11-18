import React, { useMemo, useRef } from 'react'

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
import { useMainAppBookmarkActions } from '@/hooks/useMainAppBookmarkActions'
import { useMainAppDetail } from '@/hooks/useMainAppDetail'
import { useMainAppDialogs } from '@/hooks/useMainAppDialogs'
import { useMainAppOrganization } from '@/hooks/useMainAppOrganization'
import { useMainAppSearch } from '@/hooks/useMainAppSearch'
import { useMainAppShortcuts } from '@/hooks/useMainAppShortcuts'
import { useMainAppView } from '@/hooks/useMainAppView'
import { useRaindropsCrud } from '@/hooks/useRaindropsCrud'
import { useSidebarData } from '@/hooks/useSidebarData'
import { mapSortOptionToApi } from '@/lib/api-mappers'

/** Render synchronization feedback independently of the main view's editing and navigation flows. */
const MainSyncStatus = React.memo(function MainSyncStatus({
  online,
  syncError,
  isSyncing,
  lastSynced,
  refresh,
}: Pick<
  ReturnType<typeof useSidebarData>,
  'online' | 'syncError' | 'isSyncing' | 'lastSynced' | 'refresh'
>) {
  let label = 'Connecting...'
  if (!online) label = 'Offline'
  else if (syncError) label = 'Sync failed · retry available'
  else if (isSyncing) label = 'Syncing...'
  else if (lastSynced)
    label = `Synced ${new Date(lastSynced).toLocaleTimeString()}`
  return (
    <div
      className="text-muted-foreground flex items-center justify-end gap-2 px-4 py-1 text-xs"
      role="status"
    >
      <span>{label}</span>
      <button
        type="button"
        className="hover:text-foreground underline"
        onClick={refresh}
        disabled={!online || isSyncing}
      >
        Refresh
      </button>
    </div>
  )
})

/**
 * Compose the authenticated sidebar, active bookmark view, editors and application dialogs.
 * Domain hooks own navigation, drafts and async actions while this component wires their public props.
 * @example <MainApp />
 */
export const MainApp = React.memo(function MainApp() {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const {
    groups,
    systemCollections,
    isLoading: isSidebarLoading,
    refresh,
    online,
    isSyncing,
    lastSynced,
    syncError,
  } = useSidebarData()
  const {
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
  } = useMainAppView(groups)
  const {
    searchQuery,
    searchScope,
    searchMode,
    isSearchOpen,
    normalizedSearchQuery,
    apiSearchQuery,
    effectiveSearchCollectionId,
    handleSearchOpenChange,
    handleSearchQueryChange,
    handleSearchScopeChange,
    handleSearchModeChange,
  } = useMainAppSearch(selectedCollectionId)
  const operations = useRaindropsCrud({
    collectionId: effectiveSearchCollectionId,
    sort: mapSortOptionToApi(sortOption),
    search: apiSearchQuery,
    nested: effectiveViewMode === 'directory',
  })
  const {
    raindrops,
    totalCount,
    isLoading: isRaindropsLoading,
    isFetching: isRaindropsFetching,
    isError: isRaindropsError,
    retry: retryRaindrops,
    hasMore,
    loadMore,
    batchMarkImportant,
    reorderRaindrop,
  } = operations
  const {
    selectedRaindrop,
    detailRevision,
    setDetailDirty,
    isDetailPanelOpen,
    handleSelectRaindrop,
    handleFocusRaindrop,
    handleTogglePreview,
    handleCloseDetailPanel,
    handleOpenDetailPanel,
    handleSaveRaindrop,
    handleDeleteRaindrop,
  } = useMainAppDetail(operations)
  const {
    deleteCollection: handleDeleteCollection,
    updateUserGroups: handlePersistGroups,
    renameCollection: handleRenameCollection,
    recolorCollection: handleChangeCollectionColor,
    emptyTrash: handleEmptyTrash,
    editingCollection,
    initialCollectionGroupId,
    isCollectionDialogOpen,
    collectionDefaultViewMode,
    handleSaveCollection,
    handleAddCollection,
    handleCollectionDialogOpenChange,
    handleEditCollection,
    handleMergeCollections,
    editingGroup,
    isGroupDialogOpen,
    handleSaveGroup,
    handleEditGroup,
    handleDeleteGroup,
    handleAddGroup,
    handleGroupDialogOpenChange,
  } = useMainAppOrganization(groups)
  const {
    defaultCollectionId,
    isAddBookmarkOpen,
    isTagManagementOpen,
    isMergeDialogOpen,
    isSettingsOpen,
    settingsTab,
    handleAddBookmark,
    handleManageTags,
    handleOpenMerge,
    handleAddBookmarkOpenChange,
    handleTagManagementOpenChange,
    handleMergeDialogOpenChange,
    handleSettingsOpenChange,
  } = useMainAppDialogs(selectedCollectionId)
  const {
    allTags,
    existingTags,
    handleSaveBookmark,
    handleBatchMove,
    handleBatchAddTag,
    handleBatchDelete,
    handleRenameTag,
    handleDeleteTag,
    handleMergeTags,
    handleToggleImportant,
  } = useMainAppBookmarkActions(operations)
  const selectedRaindropId = selectedRaindrop?.id
  const detailKey = `${selectedRaindropId ?? 'empty'}-${detailRevision}`
  const currentDetailRaindrop =
    raindrops.find((item) => item.id === selectedRaindropId) ?? selectedRaindrop
  const canReorderRaindrops =
    sortOption === 'manual' &&
    normalizedSearchQuery.length === 0 &&
    selectedCollectionId !== 'all'
  const collections = useMemo(
    () => groups.flatMap((group) => group.collections),
    [groups],
  )
  useMainAppShortcuts({
    isSearchOpen,
    selectedRaindropIds,
    selectedRaindrop,
    searchInputRef,
    handleAddBookmark,
    handleAddCollection,
    handleManageTags,
    handleViewModeChange,
    handleToggleImportant,
    handleBatchDelete,
  })

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
          onEditGroup={handleEditGroup}
          onDeleteGroup={handleDeleteGroup}
          onManageTags={handleManageTags}
          onDeleteCollection={handleDeleteCollection}
          onEmptyTrash={handleEmptyTrash}
          onMergeCollections={handleOpenMerge}
          onPersistGroups={handlePersistGroups}
          onEditCollection={handleEditCollection}
          onRenameCollection={handleRenameCollection}
          onChangeCollectionColor={handleChangeCollectionColor}
        >
          <SidebarInset className="min-w-0 flex-1">
            <MainSyncStatus
              online={online}
              syncError={syncError}
              isSyncing={isSyncing}
              lastSynced={lastSynced}
              refresh={refresh}
            />
            <MainContent
              breadcrumbs={breadcrumbs}
              selectedCollectionId={selectedCollectionId}
              raindrops={raindrops}
              totalCount={totalCount}
              isLoading={isRaindropsLoading}
              isFetching={isRaindropsFetching}
              isError={isRaindropsError}
              onRetry={retryRaindrops}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onSelectRaindrop={handleSelectRaindrop}
              onFocusRaindrop={handleFocusRaindrop}
              onTogglePreview={handleTogglePreview}
              selectedRaindropId={selectedRaindropId}
              selectedRaindropIds={selectedRaindropIdsSet}
              onSelectedRaindropIdsChange={handleSelectedIdsChange}
              groups={groups}
              collections={collections}
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
              onMarkImportant={batchMarkImportant}
              canReorderRaindrops={canReorderRaindrops}
              onReorderRaindrop={reorderRaindrop}
              searchInputRef={searchInputRef}
            />
          </SidebarInset>

          <RightDetailPanel
            key={detailKey}
            raindrop={currentDetailRaindrop}
            onDirtyChange={setDetailDirty}
            isOpen={isDetailPanelOpen}
            onClose={handleCloseDetailPanel}
            onOpen={handleOpenDetailPanel}
            groups={groups}
            existingTags={existingTags}
            onSave={handleSaveRaindrop}
            onDelete={handleDeleteRaindrop}
          />
        </LeftSidebar>

        <GlobalSearchCommand
          open={isSearchOpen}
          onOpenChange={handleSearchOpenChange}
          raindrops={raindrops}
          onSelectRaindrop={handleSelectRaindrop}
          totalCount={totalCount}
          hasMore={hasMore}
          isFetching={isRaindropsFetching}
          onLoadMore={loadMore}
          collections={collections}
          currentCollectionId={selectedCollectionId}
        />

        <AddBookmarkDialog
          open={isAddBookmarkOpen}
          onOpenChange={handleAddBookmarkOpenChange}
          groups={groups}
          existingTags={existingTags}
          defaultCollectionId={defaultCollectionId}
          onSave={handleSaveBookmark}
        />

        <CollectionDialog
          open={isCollectionDialogOpen}
          onOpenChange={handleCollectionDialogOpenChange}
          groups={groups}
          collection={editingCollection}
          initialGroupId={initialCollectionGroupId}
          defaultViewMode={collectionDefaultViewMode}
          onSave={handleSaveCollection}
        />

        <GroupDialog
          open={isGroupDialogOpen}
          onOpenChange={handleGroupDialogOpenChange}
          group={editingGroup}
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
          collections={collections}
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
