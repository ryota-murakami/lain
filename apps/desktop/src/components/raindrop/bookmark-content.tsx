import { Loader2 } from 'lucide-react'
import React, { useMemo } from 'react'
import { match } from 'ts-pattern'

import type { useBookmarkInteraction } from '@/hooks/useBookmarkInteraction'
import type { Raindrop } from '@/lib/types'
import type { buildDirectoryTree } from '@/utils/build-directory-tree'

import { BookmarkEmptyState } from './bookmark-empty-state'
import { BookmarkGridList } from './bookmark-grid-list'
import { DirectoryView } from './directory-view'
import type { MainContentProps } from './main-content.types'
import { TableView } from './table-view'

type BookmarkContentProps = {
  source: MainContentProps
  interaction: ReturnType<typeof useBookmarkInteraction>
  filteredRaindrops: Raindrop[]
  directoryTree: ReturnType<typeof buildDirectoryTree>
  isScopedSearch: boolean
  currentCollectionName: string
  handleSearchGlobally: () => void
  clearSearch: () => void
  setListDropZoneRef: (node: HTMLElement | null) => void
  sortableIds: string[]
  moveRows: (ids: string[]) => void
  tagRows: (ids: string[]) => void
  handleDeleteRaindrops: (ids: string[]) => void
}

/**
 * Choose loading, empty, or the selected bookmark presentation without owning mutations.
 * Called by MainContent inside its shared scrolling and keyboard-navigation viewport.
 * @example
 * <BookmarkContent {...props} />
 */
export const BookmarkContent = React.memo(function BookmarkContent({
  source,
  interaction,
  filteredRaindrops,
  directoryTree,
  isScopedSearch,
  currentCollectionName,
  handleSearchGlobally,
  clearSearch,
  setListDropZoneRef,
  sortableIds,
  moveRows,
  tagRows,
  handleDeleteRaindrops,
}: BookmarkContentProps) {
  const {
    isLoading,
    searchQuery,
    onAddBookmark,
    viewMode,
    selectedRaindropId,
    selectedRaindropIds,
    canReorderRaindrops = false,
    searchScope,
    onSelectedRaindropIdsChange,
    onSelectRaindrop,
    sortOption,
    onToggleImportant,
    onMarkImportant,
  } = source
  const {
    handleRaindropClick,
    handleToggleSelect,
    handleRaindropDoubleClick,
    handleOpenUrl,
  } = interaction
  const itemActions = useMemo(
    () => ({
      onSelectRaindrop,
      onBatchDelete: source.onBatchDelete,
      onToggleImportant,
      onMove: moveRows,
      onTag: tagRows,
    }),
    [
      onSelectRaindrop,
      source.onBatchDelete,
      onToggleImportant,
      moveRows,
      tagRows,
    ],
  )
  // Initial loading and a loaded empty scope are mutually exclusive presentations.
  if (isLoading)
    return (
      /* Loading skeleton */
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        <p className="text-muted-foreground mt-2 text-sm">
          Loading bookmarks...
        </p>
      </div>
    )
  if (filteredRaindrops.length === 0)
    return (
      <BookmarkEmptyState
        searchQuery={searchQuery}
        isScopedSearch={isScopedSearch}
        currentCollectionName={currentCollectionName}
        handleSearchGlobally={handleSearchGlobally}
        clearSearch={clearSearch}
        onAddBookmark={onAddBookmark}
      />
    )
  return match(viewMode)
    .with('grid', 'list', (mode) => (
      <BookmarkGridList
        actions={itemActions}
        mode={mode}
        filteredRaindrops={filteredRaindrops}
        selectedRaindropId={selectedRaindropId}
        selectedRaindropIds={selectedRaindropIds}
        canReorderRaindrops={canReorderRaindrops}
        handleRaindropClick={handleRaindropClick}
        handleToggleSelect={handleToggleSelect}
        handleRaindropDoubleClick={handleRaindropDoubleClick}
        searchQuery={searchQuery}
        searchScope={searchScope}
        sortableIds={sortableIds}
        setListDropZoneRef={setListDropZoneRef}
      />
    ))
    .with('table', () => (
      <div data-testid="table-view">
        <TableView
          raindrops={filteredRaindrops}
          selectedIds={selectedRaindropIds}
          onSelectionChange={onSelectedRaindropIdsChange}
          onSelect={onSelectRaindrop}
          onOpenUrl={handleOpenUrl}
          key={sortOption}
          onMoveToCollection={moveRows}
          onAddTags={tagRows}
          onDelete={handleDeleteRaindrops}
          onToggleImportant={onToggleImportant}
          onMarkImportant={onMarkImportant}
        />
      </div>
    ))
    .with('directory', () => (
      <div data-testid="directory-view">
        <DirectoryView
          collections={directoryTree.collections}
          raindropsByCollection={directoryTree.raindropsByCollection}
          selectedRaindropId={selectedRaindropId}
          selectedIds={selectedRaindropIds}
          onToggleSelection={handleToggleSelect}
          onSelectRaindrop={onSelectRaindrop}
          onOpenUrl={handleOpenUrl}
        />
      </div>
    ))
    .exhaustive()
})
