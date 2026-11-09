import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import React, { useCallback } from 'react'

import { getRaindropDndId } from '@/lib/raindrop-organization'
import type { Raindrop, SearchScope } from '@/lib/types'
import { cn } from '@/lib/utils'

import type { BookmarkItemActions } from './bookmark-item-menu'
import type { MainContentProps } from './main-content.types'
import { RaindropCard } from './raindrop-card'
import { RaindropListItem } from './raindrop-list-item'

/**
 * Drag source around one bookmark row/card. Pointer drags start anywhere on the row;
 * the row inside keeps its own click and keyboard behaviour. Other rows only become
 * drop targets (with sort animation) while reordering is allowed.
 */
const DraggableRaindrop = React.memo(function DraggableRaindrop({
  raindropId,
  canReorder,
  children,
}: {
  raindropId: string
  canReorder: boolean
  children: React.ReactNode
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: getRaindropDndId(raindropId),
    disabled: { draggable: false, droppable: !canReorder },
  })

  return (
    <div
      // The wrapper is both sortable node and keyboard activator, so Enter/Space
      // bubbling up from the focused row inside never start a keyboard drag
      ref={(node) => {
        setNodeRef(node)
        setActivatorNodeRef(node)
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid={`raindrop-drag-${raindropId}`}
      className={cn(isDragging && 'opacity-40')}
      {...listeners}
    >
      {children}
    </div>
  )
})

/**
 * Bind a bookmark to stable handlers shared by grid and list renderers.
 * Used by MainContent for each loaded item after scope filtering.
 * @example
 * <BookmarkItem {...props} mode="list" />
 */
const BookmarkItem = React.memo(function BookmarkItem({
  actions,
  mode,
  raindrop,
  isSelected,
  onRaindropClick,
  onToggleSelect,
  onRaindropDoubleClick,
  searchQuery,
  searchScope,
}: {
  actions: BookmarkItemActions
  mode: 'grid' | 'list'
  raindrop: Raindrop
  isSelected: boolean
  onRaindropClick: (raindrop: Raindrop, event: React.MouseEvent) => void
  onToggleSelect: (raindropId: string) => void
  onRaindropDoubleClick: (raindrop: Raindrop) => void
  searchQuery?: string
  searchScope?: SearchScope
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => onRaindropClick(raindrop, e),
    [onRaindropClick, raindrop],
  )
  const handleToggleSelect = useCallback(
    () => onToggleSelect(raindrop.id),
    [onToggleSelect, raindrop.id],
  )
  const handleDoubleClick = useCallback(
    () => onRaindropDoubleClick(raindrop),
    [onRaindropDoubleClick, raindrop],
  )
  if (mode === 'grid') {
    return (
      <RaindropCard
        actions={actions}
        onToggleSelect={handleToggleSelect}
        raindrop={raindrop}
        isSelected={isSelected}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        searchQuery={searchQuery}
        searchScope={searchScope}
      />
    )
  }
  return (
    <RaindropListItem
      actions={actions}
      raindrop={raindrop}
      isSelected={isSelected}
      onClick={handleClick}
      onToggleSelect={handleToggleSelect}
      onDoubleClick={handleDoubleClick}
      searchQuery={searchQuery}
      searchScope={searchScope}
    />
  )
})

/**
 * Render one sortable sequence for grid and list layouts using identical selection semantics.
 * Called by MainContent after filtering; layout only changes the sorting geometry and item renderer.
 * @example
 * <BookmarkGridList {...props} mode="grid" />
 */
export const BookmarkGridList = React.memo(function BookmarkGridList({
  actions,
  mode,
  filteredRaindrops,
  selectedRaindropId,
  selectedRaindropIds,
  canReorderRaindrops,
  handleRaindropClick,
  handleToggleSelect,
  handleRaindropDoubleClick,
  searchQuery,
  searchScope,
  sortableIds,
  setListDropZoneRef,
}: Pick<
  MainContentProps,
  'selectedRaindropId' | 'selectedRaindropIds' | 'searchQuery' | 'searchScope'
> & {
  actions: BookmarkItemActions
  mode: 'grid' | 'list'
  filteredRaindrops: Raindrop[]
  canReorderRaindrops: boolean
  handleRaindropClick: (raindrop: Raindrop, event: React.MouseEvent) => void
  handleToggleSelect: (id: string) => void
  handleRaindropDoubleClick: (raindrop: Raindrop) => void
  sortableIds: string[]
  setListDropZoneRef: (node: HTMLElement | null) => void
}) {
  return (
    <div
      ref={setListDropZoneRef}
      data-testid={`${mode}-view`}
      className={
        mode === 'grid'
          ? 'grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-4'
          : 'divide-y'
      }
    >
      <SortableContext
        items={sortableIds}
        strategy={
          mode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy
        }
      >
        {filteredRaindrops.map((raindrop) => (
          <DraggableRaindrop
            key={raindrop.id}
            raindropId={raindrop.id}
            canReorder={canReorderRaindrops}
          >
            <BookmarkItem
              actions={actions}
              mode={mode}
              onToggleSelect={handleToggleSelect}
              raindrop={raindrop}
              isSelected={
                selectedRaindropId === raindrop.id ||
                selectedRaindropIds.has(raindrop.id)
              }
              onRaindropClick={handleRaindropClick}
              onRaindropDoubleClick={handleRaindropDoubleClick}
              searchQuery={searchQuery}
              searchScope={searchScope}
            />
          </DraggableRaindrop>
        ))}
      </SortableContext>
    </div>
  )
})
