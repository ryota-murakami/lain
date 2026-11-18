import { DragOverlay } from '@dnd-kit/core'
import React, { useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { DragPreview } from '@/components/raindrop/drag-preview'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useBookmarkDialogs } from '@/hooks/useBookmarkDialogs'
import { useBookmarkDrag } from '@/hooks/useBookmarkDrag'
import { useBookmarkInteraction } from '@/hooks/useBookmarkInteraction'
import { useBookmarkToolbar } from '@/hooks/useBookmarkToolbar'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { PartialBookmarkBatchError } from '@/hooks/useRaindropBatchActions'
import { filterByScope } from '@/lib/search'
import { buildDirectoryTree } from '@/utils/build-directory-tree'

import { BookmarkContent } from './bookmark-content'
import { BookmarkLoadError, BookmarkLoadMore } from './bookmark-loading-state'
import { BookmarkOperationDialogs } from './bookmark-operation-dialogs'
import {
  BookmarkBulkBar,
  BookmarkHeader,
  BookmarkSearchControls,
} from './main-content-toolbar'
import type { MainContentProps } from './main-content.types'

/**
 * Main content area displaying the raindrop list with toolbar controls.
 * Supports multiple view modes (list, grid, table, directory),
 * search with configurable scope, sorting, and multi-select.
 *
 * @param breadcrumbs - Path segments for the breadcrumb navigation
 * @param raindrops - Bookmarks to display in the chosen view mode
 * @param onSelectRaindrop - Fires when a single raindrop is clicked
 * @param onFocusRaindrop - Fires when ↑/↓ moves keyboard focus to a raindrop
 * @param onTogglePreview - Fires when Space toggles the detail panel of the focused raindrop
 * @param selectedRaindropId - Currently focused raindrop for detail panel
 * @param selectedRaindropIds - Set of IDs for multi-selection
 * @param onSelectedRaindropIdsChange - Updates multi-selection state
 * @param groups - Groups used for move-to actions
 * @param collections - Flat collection list for move-to actions
 * @param onAddBookmark - Opens the add bookmark dialog
 *
 * @example
 *   <MainContent
 *     breadcrumbs={["Work", "Development"]}
 *     raindrops={filteredRaindrops}
 *     onSelectRaindrop={handleSelect}
 *     selectedRaindropId={selected?.id}
 *     selectedRaindropIds={selectedIds}
 *     onSelectedRaindropIdsChange={setSelectedIds}
 *     groups={groups}
 *     collections={allCollections}
 *     onAddBookmark={() => setIsAddOpen(true)}
 *   />
 */

const MainContent = React.memo(function MainContent(props: MainContentProps) {
  const {
    breadcrumbs,
    selectedCollectionId,
    raindrops,
    totalCount,
    isError,
    onRetry,
    isFetching,
    hasMore,
    onLoadMore,
    onSelectRaindrop,
    onFocusRaindrop,
    onTogglePreview,
    selectedRaindropId,
    selectedRaindropIds,
    onSelectedRaindropIdsChange,
    groups: _groups,
    collections,
    onAddBookmark,
    sortOption,
    searchQuery,
    searchScope,
    onSearchScopeChange,
    onBatchMove,
    onBatchAddTag,
    onBatchDelete,
    viewMode,
    hasCollectionViewModeOverride,
    onCollectionViewModeOverrideChange,
    canReorderRaindrops = false,
    onReorderRaindrop,
    searchInputRef,
  } = props
  const {
    exportOpen,
    uploadFiles,
    bulkAction,
    setUploadFiles,
    openExport,
    closeExport,
    openUpload,
    closeUpload,
    closeBulkAction,
    moveSelection,
    tagSelection,
    moveRows,
    tagRows,
  } = useBookmarkDialogs(selectedRaindropIds)

  const {
    isAdvancedSearchOpen,
    currentCollectionName,
    canToggleGlobalSearch,
    isScopedSearch,
    handleSearchQueryChange,
    handleAdvancedSearchToggle,
    handleViewModeChange,
    handleSortChange,
    handleDeselectAll,
    handleSetSearchScope,
    handleToggleSearchMode,
    handleSearchGlobally,
    clearSearch,
  } = useBookmarkToolbar(props)

  const filteredRaindrops = useMemo(() => {
    return filterByScope(raindrops, searchQuery, searchScope)
  }, [raindrops, searchQuery, searchScope])

  // Directory view hangs the loaded raindrops off the collection tree of the current scope
  const directoryTree = useMemo(
    () =>
      buildDirectoryTree({
        collections,
        raindrops: filteredRaindrops,
        selectedCollectionId,
        currentCollectionName,
      }),
    [
      collections,
      filteredRaindrops,
      selectedCollectionId,
      currentCollectionName,
    ],
  )

  // Both bulk toolbars and Table row menus share this boundary; the parent owns selection reconciliation.
  const handleDeleteRaindrops = useCallback(
    async (ids: string[]): Promise<void> => {
      try {
        await onBatchDelete?.(ids)
      } catch (cause) {
        // Preserve the parent's confirmed partial progress and make the remaining retry explicit.
        toast.error(
          cause instanceof PartialBookmarkBatchError
            ? cause.message
            : 'Could not delete the selection. Please retry.',
        )
      }
    },
    [onBatchDelete],
  )
  const handleBatchDelete = useCallback(
    async () => handleDeleteRaindrops([...selectedRaindropIds]),
    [handleDeleteRaindrops, selectedRaindropIds],
  )

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const interaction = useBookmarkInteraction({
    selectedRaindropIds,
    selectedRaindropId,
    onSelectedRaindropIdsChange,
    onSelectRaindrop,
    onFocusRaindrop,
    onTogglePreview,
    filteredRaindrops,
    scrollAreaRef,
  })

  // Observe the same scroll viewport used by keyboard navigation.
  const sentinelRef = useInfiniteScroll({
    isError,
    hasMore: hasMore ?? false,
    isFetching: isFetching ?? false,
    onLoadMore,
    scrollContainerRef: scrollAreaRef,
  })

  const { sortableIds, setListDropZoneRef, activeDragRaindrop, draggedCount } =
    useBookmarkDrag({
      selectedCollectionId,
      selectedRaindropIds,
      canReorderRaindrops,
      onBatchMove,
      onReorderRaindrop,
      filteredRaindrops,
    })

  const viewControls = useMemo(
    () => ({
      viewMode,
      hasCollectionViewModeOverride,
      onCollectionViewModeOverrideChange,
      sortOption,
      handleViewModeChange,
      handleSortChange,
    }),
    [
      viewMode,
      hasCollectionViewModeOverride,
      onCollectionViewModeOverrideChange,
      sortOption,
      handleViewModeChange,
      handleSortChange,
    ],
  )

  const collectionScope = useMemo(
    () => ({ canToggleGlobalSearch, isScopedSearch, currentCollectionName }),
    [canToggleGlobalSearch, isScopedSearch, currentCollectionName],
  )

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault()
      }}
      onDrop={(event) => {
        if (event.dataTransfer.files.length) {
          event.preventDefault()
          setUploadFiles([...event.dataTransfer.files])
        }
      }}
    >
      <BookmarkLoadError isError={isError} onRetry={onRetry} />
      {/* Toolbar */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 flex-shrink-0 border-b backdrop-blur">
        <BookmarkHeader
          breadcrumbs={breadcrumbs}
          totalCount={totalCount}
          onAddBookmark={onAddBookmark}
          shownCount={filteredRaindrops.length}
          loadedCount={raindrops.length}
          openExport={openExport}
          openUpload={openUpload}
        />
        <BookmarkSearchControls
          collectionScope={collectionScope}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          searchScope={searchScope}
          onSearchScopeChange={onSearchScopeChange}
          isAdvancedSearchOpen={isAdvancedSearchOpen}
          handleSearchQueryChange={handleSearchQueryChange}
          handleSearchInputClear={clearSearch}
          handleToggleSearchMode={handleToggleSearchMode}
          handleAdvancedSearchToggle={handleAdvancedSearchToggle}
          handleSetSearchScope={handleSetSearchScope}
          viewControls={viewControls}
        />
        <BookmarkBulkBar
          selectedCount={selectedRaindropIds.size}
          viewMode={viewMode}
          onBatchMove={onBatchMove}
          onBatchAddTag={onBatchAddTag}
          onBatchDelete={onBatchDelete}
          handleDeselectAll={handleDeselectAll}
          moveSelection={moveSelection}
          tagSelection={tagSelection}
          handleBatchDelete={handleBatchDelete}
        />
      </div>

      {/* Content Area */}
      <ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1">
        <BookmarkContent
          source={props}
          interaction={interaction}
          filteredRaindrops={filteredRaindrops}
          directoryTree={directoryTree}
          isScopedSearch={isScopedSearch}
          currentCollectionName={currentCollectionName}
          handleSearchGlobally={handleSearchGlobally}
          clearSearch={clearSearch}
          setListDropZoneRef={setListDropZoneRef}
          sortableIds={sortableIds}
          moveRows={moveRows}
          tagRows={tagRows}
          handleDeleteRaindrops={handleDeleteRaindrops}
        />

        <BookmarkLoadMore
          hasMore={hasMore}
          isFetching={isFetching}
          onLoadMore={onLoadMore}
          sentinelRef={sentinelRef}
        />
      </ScrollArea>

      <DragOverlay dropAnimation={null}>
        {activeDragRaindrop && (
          <DragPreview raindrop={activeDragRaindrop} count={draggedCount} />
        )}
      </DragOverlay>
      <BookmarkOperationDialogs
        exportOpen={exportOpen}
        uploadFiles={uploadFiles}
        bulkAction={bulkAction}
        selectedCollectionId={selectedCollectionId}
        currentCollectionName={currentCollectionName}
        groups={_groups}
        closeExport={closeExport}
        closeUpload={closeUpload}
        closeBulkAction={closeBulkAction}
        onBatchMove={onBatchMove}
        onBatchAddTag={onBatchAddTag}
      />
    </div>
  )
})
export { MainContent }
