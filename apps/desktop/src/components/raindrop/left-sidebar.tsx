import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  useDroppable,
  type CollisionDetection,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DroppableContainer,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronDown,
  ChevronRight,
  FileQuestion,
  FolderPlus,
  Inbox,
  Layers,
  Merge,
  MoreHorizontal,
  Plus,
  Search,
  Tag,
  Trash2,
} from 'lucide-react'
import React, { useCallback, useMemo, type CSSProperties } from 'react'
import { toast } from 'sonner'

import { CollectionSearch } from '@/components/raindrop/collection-search'
import { DragPreview } from '@/components/raindrop/drag-preview'
import { DropIndicator } from '@/components/raindrop/drop-indicator'
import { ThemeToggle } from '@/components/raindrop/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSidebarController } from '@/hooks/useSidebarController'
import { collectionIcons } from '@/lib/collection-icons'
import {
  getCollectionDndId,
  getGroupDndId,
  parseCollectionDndId,
  parseGroupDndId,
} from '@/lib/collection-organization'
import {
  RAINDROP_LIST_DND_ID,
  parseRaindropDndId,
} from '@/lib/raindrop-organization'
import type { Collection, Group, SystemCollection } from '@/lib/types'
import { cn } from '@/lib/utils'

import type {
  LeftSidebarProps,
  CollectionTreeProps,
} from './left-sidebar.types'

/**
 * Preset colors shown in collection context-menu.
 */
const COLLECTION_COLOR_OPTIONS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
] as const

/**
 * Stable click handler that stops propagation.
 * @param event - Mouse event from nested actions
 */
function stopPropagation(event: React.MouseEvent): void {
  event.stopPropagation()
}

/** Highlight for the collection row a dragged bookmark would land on. */
const RAINDROP_DROP_TARGET_CLASS =
  'ring-primary/60 rounded-md ring-2 ring-inset'

/**
 * Targets that take part in collection sorting: group zones and root collection rows
 * (root rows carry their group in `data`; bookmark-only targets and bookmark rows do not).
 * @param container - Registered droppable
 * @returns true for a group zone or a root collection row
 * @example
 *   droppableContainers.filter(isCollectionSortTarget)
 */
function isCollectionSortTarget(container: DroppableContainer): boolean {
  return (
    parseGroupDndId(container.id) !== null ||
    container.data.current?.groupId !== undefined
  )
}

/**
 * Collision rules for the shared DnD context: collections keep centre-based sorting
 * among group zones and root rows; a dragged bookmark lands on the collection under
 * the pointer, or — only while the pointer is inside the bookmark list — on the
 * closest bookmark row (manual reorder).
 * @param args - dnd-kit collision arguments
 * @returns Collisions for the active drag, empty when nothing valid is under it
 * @example
 *   <DndContext collisionDetection={organizationCollisionDetection}>
 */
const organizationCollisionDetection: CollisionDetection = (args) => {
  if (parseRaindropDndId(args.active.id) === null) {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        isCollectionSortTarget,
      ),
    })
  }

  const collectionTargets = args.droppableContainers.filter(
    (container) => parseCollectionDndId(container.id) !== null,
  )
  const overCollection = pointerWithin({
    ...args,
    droppableContainers: collectionTargets,
  })
  if (overCollection.length > 0) return overCollection

  const listContainers = args.droppableContainers.filter(
    (container) => container.id === RAINDROP_LIST_DND_ID,
  )
  const isPointerInList =
    pointerWithin({ ...args, droppableContainers: listContainers }).length > 0
  if (!isPointerInList) return []

  const raindropTargets = args.droppableContainers.filter(
    (container) => parseRaindropDndId(container.id) !== null,
  )
  return closestCenter({ ...args, droppableContainers: raindropTargets })
}

/**
 * Static map of system collection icon names to lucide components.
 */
const SYSTEM_ICON_MAP: Record<string, typeof Inbox> = {
  Inbox,
  FileQuestion,
  Trash2,
}

/**
 * Render a system icon from a system collection icon key.
 */
const SystemIcon = React.memo(function SystemIcon({
  iconName,
  className,
}: {
  iconName: string
  className?: string
}) {
  const Icon = SYSTEM_ICON_MAP[iconName] || Inbox
  return <Icon className={className} />
})

/**
 * System collection row in the sidebar.
 */
const SystemCollectionItem = React.memo(function SystemCollectionItem({
  collection,
  isSelected,
  isRaindropDragActive,
  onSelectCollection,
  onEmptyTrash,
}: {
  collection: SystemCollection
  isSelected: boolean
  /** A bookmark drag is in progress — Unsorted becomes a drop target */
  isRaindropDragActive: boolean
  onSelectCollection: (id: string) => void
  onEmptyTrash: () => Promise<void>
}) {
  const handleClick = useCallback(() => {
    onSelectCollection(collection.id)
  }, [collection.id, onSelectCollection])
  const handleEmptyTrash = useCallback((): void => {
    void onEmptyTrash().catch((error: unknown) => {
      // Axios already reports transport failures; HTTP 200 rejection bodies need feedback here.
      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status !== 200
      ) {
        return
      }
      toast.error('Could not empty Trash. Please retry.')
    })
  }, [onEmptyTrash])

  // Only Unsorted can receive bookmarks (All is virtual, Trash would mean delete)
  const { setNodeRef, isOver } = useDroppable({
    id: getCollectionDndId(collection.id),
    disabled: collection.id !== 'unsorted',
  })
  const isRaindropDropTarget = isRaindropDragActive && isOver

  return (
    <SidebarMenuItem
      ref={setNodeRef}
      data-drop-target={isRaindropDropTarget || undefined}
      className={cn(isRaindropDropTarget && RAINDROP_DROP_TARGET_CLASS)}
    >
      <SidebarMenuButton
        isActive={isSelected}
        onClick={handleClick}
        className="group/syscol h-8"
        tooltip={collection.name}
      >
        <SystemIcon iconName={collection.icon} className="h-4 w-4" />
        <span className="flex-1 truncate">{collection.name}</span>
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-muted-foreground text-xs tabular-nums">
            {collection.count}
          </span>
          {collection.id === 'trash' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover/syscol:opacity-100"
                  onClick={stopPropagation}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleEmptyTrash}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Empty Trash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
})

/**
 * Single collection row renderer (supports inline rename and context menu).
 */
interface CollectionRowProps extends CollectionTreeProps {
  collection: Collection
  depth: number
  isRoot: boolean
  sortable?: {
    setNodeRef: (node: HTMLElement | null) => void
    attributes: DraggableAttributes
    listeners?: DraggableSyntheticListeners
    style: CSSProperties
    isDragging: boolean
    isOver: boolean
  }
}

/**
 * Keep collection actions available at every tree depth independently of drag rendering.
 * Used by CollectionRow; moving between groups is limited to roots.
 * @example
 * <CollectionRowMenu {...props}>{row}</CollectionRowMenu>
 */
const CollectionRowMenu = React.memo(function CollectionRowMenu({
  collection,
  isRoot,
  groups,
  onEditCollection,
  onStartInlineRename,
  onDeleteCollection,
  onMoveCollectionToGroup,
  onChangeCollectionColor,
  children,
}: Pick<
  CollectionTreeProps,
  | 'groups'
  | 'onEditCollection'
  | 'onStartInlineRename'
  | 'onDeleteCollection'
  | 'onMoveCollectionToGroup'
  | 'onChangeCollectionColor'
> & { collection: Collection; isRoot: boolean; children: React.ReactNode }) {
  const handleContextSettings = useCallback(
    (): void => onEditCollection?.(collection),
    [collection, onEditCollection],
  )

  const handleContextRename = useCallback(() => {
    onStartInlineRename(collection)
  }, [collection, onStartInlineRename])

  const handleContextDelete = useCallback(() => {
    void onDeleteCollection(collection.id)
  }, [collection.id, onDeleteCollection])

  const moveToGroupHandlers = useMemo(() => {
    return new Map(
      groups.map((group) => {
        const handler = (): void => {
          void onMoveCollectionToGroup(collection.id, group.id)
        }
        return [group.id, handler]
      }),
    )
  }, [collection.id, groups, onMoveCollectionToGroup])

  const colorHandlers = useMemo(() => {
    return new Map(
      COLLECTION_COLOR_OPTIONS.map(({ value }) => {
        const handler = (): void => {
          void onChangeCollectionColor(collection.id, value)
        }
        return [value, handler]
      }),
    )
  }, [collection.id, onChangeCollectionColor])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleContextSettings}>
          Collection Settings
        </ContextMenuItem>
        <ContextMenuItem onClick={handleContextRename}>Rename</ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={handleContextDelete}>
          Delete
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger disabled={!isRoot}>
            Move to Group
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {groups
              .filter((group) => group.id !== 'ungrouped')
              .map((group) => (
                <ContextMenuItem
                  key={group.id}
                  disabled={group.id === collection.groupId}
                  onClick={moveToGroupHandlers.get(group.id)}
                >
                  {group.name}
                </ContextMenuItem>
              ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Change Color</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-40">
            {COLLECTION_COLOR_OPTIONS.map((color) => (
              <ContextMenuItem
                key={color.value}
                onClick={colorHandlers.get(color.value)}
              >
                <span
                  className="mr-2 inline-block h-3 w-3 rounded-sm border"
                  style={{ backgroundColor: color.value }}
                />
                {color.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  )
})

/**
 * Preserve inline rename keyboard and blur behavior without coupling it to row dragging.
 * Rendered by CollectionRow; Escape cancels while Enter and blur submit the draft.
 * @example
 * <CollectionRowName {...props} />
 */
const CollectionRowName = React.memo(function CollectionRowName({
  collection,
  isEditing,
  editingName,
  onEditingNameChange,
  onCancelInlineRename,
  onSubmitInlineRename,
  onStartInlineRename,
  isRoot,
}: Pick<
  CollectionTreeProps,
  | 'editingName'
  | 'onEditingNameChange'
  | 'onCancelInlineRename'
  | 'onSubmitInlineRename'
  | 'onStartInlineRename'
> & { collection: Collection; isEditing: boolean; isRoot: boolean }) {
  function handleDoubleClick(event: React.MouseEvent): void {
    if (!isRoot) return
    event.stopPropagation()
    onStartInlineRename(collection)
  }
  const handleSubmitRename = async (): Promise<void> =>
    onSubmitInlineRename(collection.id, editingName)
  return (
    <>
      {' '}
      {isEditing ? (
        <input
          aria-label={`Rename collection ${collection.name}`}
          value={editingName}
          onChange={(event) => onEditingNameChange(event.target.value)}
          onClick={stopPropagation}
          onBlur={() => {
            void handleSubmitRename()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleSubmitRename()
            }
            if (event.key === 'Escape') {
              onCancelInlineRename()
            }
          }}
          autoFocus
          className="bg-background h-6 min-w-0 flex-1 rounded border px-1.5 text-sm outline-none"
        />
      ) : (
        <span
          className="truncate text-sm"
          onDoubleClick={handleDoubleClick}
          title={collection.name}
        >
          {collection.name}
        </span>
      )}
    </>
  )
})

/**
 * Render a collection's keyboard-selectable label, disclosure, icon, and inline editor.
 * Called by {@link CollectionRow}; dragging and recursive children remain in the outer row.
 * @example
 * <CollectionRowButton {...props} />
 */
/**
 * Render the pointer disclosure while the parent row owns keyboard expansion.
 * @example
 * <CollectionDisclosure {...props} />
 */
const CollectionDisclosure = React.memo(function CollectionDisclosure({
  collectionName,
  hasChildren,
  isExpanded,
  onToggle,
}: {
  collectionName: string
  hasChildren: boolean
  isExpanded: boolean
  onToggle: (event: React.MouseEvent) => void
}) {
  return (
    <>
      {' '}
      {hasChildren ? (
        <span
          aria-hidden="true"
          title={`${isExpanded ? 'Collapse' : 'Expand'} ${collectionName}`}
          onClick={onToggle}
          className="hover:bg-accent/50 shrink-0 rounded p-0.5"
        >
          {isExpanded ? (
            <ChevronDown className="text-muted-foreground h-3 w-3" />
          ) : (
            <ChevronRight className="text-muted-foreground h-3 w-3" />
          )}
        </span>
      ) : (
        <span className="w-4" />
      )}
    </>
  )
})

/**
 * Recognize directional folder commands without consuming unrelated sortable keyboard keys.
 * @example
 * isFolderToggleKey('ArrowRight', false) // true
 */
function isFolderToggleKey(key: string, expanded: boolean): boolean {
  if (key === 'ArrowRight') return !expanded
  if (key === 'ArrowLeft') return expanded
  return false
}

const CollectionRowButton = React.memo(function CollectionRowButton({
  collection,
  depth,
  sortable,
  isRoot,
  treeProps,
}: Pick<CollectionRowProps, 'collection' | 'depth' | 'sortable' | 'isRoot'> & {
  treeProps: CollectionTreeProps
}) {
  const {
    onSelectCollection,
    onToggleCollection,
    sidebarMenuButtonStyles,
    editingName,
    onEditingNameChange,
    onCancelInlineRename,
    onSubmitInlineRename,
    onStartInlineRename,
  } = treeProps
  const isSelected = treeProps.selectedCollectionId === collection.id
  const isEditing = treeProps.editingCollectionId === collection.id
  const hasChildren = Boolean(collection.children?.length)
  const isExpanded = treeProps.expandedCollections.has(collection.id)
  const CollectionIcon =
    collectionIcons[collection.icon] ?? collectionIcons.Folder
  const handleSelect = useCallback(() => {
    onSelectCollection(collection.id)
  }, [collection.id, onSelectCollection])

  const handleToggle = useCallback(
    (event: React.MouseEvent): void => {
      event.stopPropagation()
      onToggleCollection(collection.id)
    },
    [onToggleCollection, collection.id],
  )

  const iconStyle = useMemo(
    () => ({ color: collection.color || '#8b5cf6' }),
    [collection.color],
  )
  const handleFolderKeyDown = useCallback(
    (event: React.KeyboardEvent): void => {
      // Folder navigation takes precedence over sortable's keyboard activator.
      if (hasChildren && isFolderToggleKey(event.key, isExpanded)) {
        event.preventDefault()
        event.stopPropagation()
        onToggleCollection(collection.id)
        return
      }
      sortable?.listeners?.onKeyDown?.(event)
    },
    [
      hasChildren,
      isExpanded,
      onToggleCollection,
      collection.id,
      sortable?.listeners,
    ],
  )

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isSelected}
        aria-label={collection.name}
        aria-expanded={hasChildren ? isExpanded : undefined}
        onClick={handleSelect}
        className="group/collection h-8 w-full"
        style={
          sidebarMenuButtonStyles[depth] || {
            paddingLeft: `${12 + depth * 16}px`,
          }
        }
        {...(sortable?.attributes ?? {})}
        {...(sortable?.listeners ?? {})}
        onKeyDown={handleFolderKeyDown}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CollectionDisclosure
            collectionName={collection.name}
            hasChildren={hasChildren}
            isExpanded={isExpanded}
            onToggle={handleToggle}
          />

          <CollectionIcon
            data-testid={`collection-color-${collection.id}`}
            className="h-4 w-4 shrink-0"
            style={iconStyle}
          />

          <CollectionRowName
            collection={collection}
            isEditing={isEditing}
            editingName={editingName}
            onEditingNameChange={onEditingNameChange}
            onCancelInlineRename={onCancelInlineRename}
            onSubmitInlineRename={onSubmitInlineRename}
            onStartInlineRename={onStartInlineRename}
            isRoot={isRoot}
          />
        </div>

        <span className="text-muted-foreground text-xs tabular-nums opacity-0 transition-opacity group-hover/collection:opacity-100">
          {collection.count}
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
})

const CollectionRow = React.memo(function CollectionRow({
  collection,
  depth,
  sortable,
  isRoot,
  ...treeProps
}: CollectionRowProps) {
  const {
    expandedCollections,
    onDeleteCollection,
    onMoveCollectionToGroup,
    onChangeCollectionColor,
    onEditCollection,
    onStartInlineRename,
    groups,
    isRaindropDragActive,
  } = treeProps

  const hasChildren = (collection.children?.length ?? 0) > 0
  const isExpanded = expandedCollections.has(collection.id)

  // Root rows are already droppable through useSortable; nested rows register here
  const droppable = useDroppable({
    id: getCollectionDndId(collection.id),
    disabled: isRoot,
  })
  const isOver = isRoot ? (sortable?.isOver ?? false) : droppable.isOver
  const isRaindropDropTarget = isRaindropDragActive && isOver

  const row = (
    <div
      ref={isRoot ? sortable?.setNodeRef : droppable.setNodeRef}
      style={sortable?.style}
      data-testid={isRoot ? `sidebar-collection-${collection.id}` : undefined}
      data-drop-target={isRaindropDropTarget || undefined}
      className={cn(
        sortable?.isDragging && 'opacity-50',
        isRaindropDropTarget && RAINDROP_DROP_TARGET_CLASS,
      )}
    >
      <CollectionRowButton
        collection={collection}
        depth={depth}
        sortable={sortable}
        isRoot={isRoot}
        treeProps={treeProps}
      />
    </div>
  )

  return (
    <div>
      <CollectionRowMenu
        collection={collection}
        isRoot={isRoot}
        groups={groups}
        onEditCollection={onEditCollection}
        onStartInlineRename={onStartInlineRename}
        onDeleteCollection={onDeleteCollection}
        onMoveCollectionToGroup={onMoveCollectionToGroup}
        onChangeCollectionColor={onChangeCollectionColor}
      >
        {row}
      </CollectionRowMenu>
      {hasChildren && isExpanded && (
        <div>
          {collection.children?.map((childCollection) => (
            <CollectionRow
              key={childCollection.id}
              collection={childCollection}
              depth={depth + 1}
              {...treeProps}
              isRoot={false}
            />
          ))}
        </div>
      )}
    </div>
  )
})

/**
 * Sortable root collection row wrapper.
 */
const SortableRootCollectionRow = React.memo(
  function SortableRootCollectionRow({
    collection,
    ...treeProps
  }: CollectionTreeProps & { collection: Collection }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
      isOver,
    } = useSortable({
      id: getCollectionDndId(collection.id),
      data: { collectionId: collection.id, groupId: collection.groupId },
      disabled: { droppable: collection.groupId === 'ungrouped' },
    })

    const style = useMemo<CSSProperties>(() => {
      return {
        transform: CSS.Transform.toString(transform),
        transition,
      }
    }, [transform, transition])

    const sortableProps = useMemo(
      () => ({
        setNodeRef,
        attributes,
        listeners: listeners ?? undefined,
        style,
        isDragging,
        isOver,
      }),
      [attributes, isDragging, isOver, listeners, setNodeRef, style],
    )

    return (
      <CollectionRow
        collection={collection}
        depth={0}
        {...treeProps}
        isRoot
        sortable={sortableProps}
      />
    )
  },
)

/**
 * One group section with sortable root collections.
 */
const GroupSection = React.memo(function GroupSection({
  group,
  onEditGroup,
  onDeleteGroup,
  isExpanded,
  onToggleGroup,
  onAddCollection,
  dropIndicator,
  ...treeProps
}: CollectionTreeProps & {
  group: Group
  onEditGroup?: (group: Group) => void
  onDeleteGroup?: (id: string) => Promise<void>
  isExpanded: boolean
  onToggleGroup: (groupId: string) => void
  onAddCollection: (initialGroupId?: string) => void
  dropIndicator: { groupId: string; index: number } | null
}) {
  const handleAddCollection = useCallback(
    (): void => onAddCollection(group.id),
    [group.id, onAddCollection],
  )
  const handleEditGroup = useCallback(
    (): void => onEditGroup?.(group),
    [group, onEditGroup],
  )
  const handleDeleteGroup = useCallback((): void => {
    if (
      window.confirm(
        'Delete this group? Its collections and bookmarks will be kept in another group.',
      )
    ) {
      void onDeleteGroup?.(group.id).catch(() =>
        toast.error('Could not delete the group. Please retry.'),
      )
    }
  }, [group.id, onDeleteGroup])

  const handleOpenChange = useCallback(() => {
    onToggleGroup(group.id)
  }, [group.id, onToggleGroup])

  const sortableIds = useMemo(() => {
    return group.collections.map((collection) =>
      getCollectionDndId(collection.id),
    )
  }, [group.collections])

  const { setNodeRef } = useDroppable({
    id: getGroupDndId(group.id),
    data: { groupId: group.id },
    disabled: group.id === 'ungrouped',
  })

  return (
    <Collapsible open={isExpanded} onOpenChange={handleOpenChange}>
      <SidebarGroup data-testid={`sidebar-group-${group.id}`}>
        <div className="group/groupheader flex items-center">
          <CollapsibleTrigger asChild>
            <SidebarGroupLabel className="text-muted-foreground hover:text-foreground flex-1 cursor-pointer px-3 text-xs font-medium tracking-wider uppercase transition-colors">
              <span className="flex items-center gap-1">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {group.name}
              </span>
            </SidebarGroupLabel>
          </CollapsibleTrigger>

          {group.id !== 'ungrouped' && (
            <div className="flex items-center gap-0.5 pr-2 opacity-0 transition-opacity group-hover/groupheader:opacity-100 group-data-[collapsible=icon]:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    aria-label={`Group actions for ${group.name}`}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleAddCollection}>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    Add Collection
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleEditGroup}>
                    Edit Group
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={handleDeleteGroup}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Group
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <CollapsibleContent>
          <div ref={setNodeRef}>
            <SidebarGroupContent>
              <SortableContext
                items={sortableIds}
                strategy={verticalListSortingStrategy}
              >
                <SidebarMenu>
                  {group.collections.map((collection, index) => (
                    <React.Fragment key={collection.id}>
                      {dropIndicator?.groupId === group.id &&
                        dropIndicator.index === index && (
                          <DropIndicator
                            isActive
                            position="before"
                            data-testid={`drop-indicator-${group.id}-${index}`}
                          />
                        )}
                      <SortableRootCollectionRow
                        collection={collection}
                        {...treeProps}
                      />
                    </React.Fragment>
                  ))}
                  {dropIndicator?.groupId === group.id &&
                    dropIndicator.index === group.collections.length && (
                      <DropIndicator
                        isActive
                        position="after"
                        data-testid={`drop-indicator-${group.id}-end`}
                      />
                    )}
                </SidebarMenu>
              </SortableContext>
            </SidebarGroupContent>
          </div>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
})

/**
 * Render the scrollable system-library and collection-tree sections without sidebar chrome.
 * Called by {@link LeftSidebar}; synthetic groups keep local expansion and expose no group actions.
 * @example
 * <SidebarLibrary {...props} />
 */
const SidebarLibrary = React.memo(function SidebarLibrary({
  systemCollections,
  activeDragCollection,
  displayedGroups,
  onEmptyTrash,
  isUngroupedExpanded,
  onEditGroup,
  onDeleteGroup,
  toggleGroup,
  onAddCollection,
  dropIndicator,
  treeProps,
}: Pick<
  LeftSidebarProps,
  | 'systemCollections'
  | 'onEmptyTrash'
  | 'onEditGroup'
  | 'onDeleteGroup'
  | 'onAddCollection'
> & {
  activeDragCollection?: Collection
  displayedGroups: Group[]
  isUngroupedExpanded: boolean
  toggleGroup: (id: string) => void
  dropIndicator: { groupId: string; index: number } | null
  treeProps: CollectionTreeProps
}) {
  return (
    <ScrollArea className="flex-1">
      <SidebarGroup>
        <SidebarGroupLabel className="text-muted-foreground px-3 text-xs font-medium tracking-wider uppercase">
          Library
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {systemCollections.map((collection) => (
              <SystemCollectionItem
                key={collection.id}
                collection={collection}
                isSelected={treeProps.selectedCollectionId === collection.id}
                onSelectCollection={treeProps.onSelectCollection}
                onEmptyTrash={onEmptyTrash}
                isRaindropDragActive={treeProps.isRaindropDragActive}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <Separator className="mx-3 my-1" />

      {displayedGroups.map((group) => (
        <GroupSection
          key={group.id}
          group={group}
          isExpanded={
            group.id === 'ungrouped' ? isUngroupedExpanded : !group.hidden
          }
          onEditGroup={onEditGroup}
          onDeleteGroup={onDeleteGroup}
          {...treeProps}
          onToggleGroup={toggleGroup}
          onAddCollection={onAddCollection}
          dropIndicator={dropIndicator}
        />
      ))}
      <DragOverlay>
        <DragPreview collection={activeDragCollection} />
      </DragOverlay>
    </ScrollArea>
  )
})

/**
 * Left sidebar navigation with system collections, grouped collections, and DnD.
 * Owns the single DndContext shared with its children: collection reordering here,
 * bookmark moves/reorders observed by MainContent through useDndMonitor.
 */
const LeftSidebar = React.memo(function LeftSidebar(props: LeftSidebarProps) {
  const {
    systemCollections,
    onAddBookmark,
    onAddCollection,
    onAddGroup,
    onEditGroup,
    onDeleteGroup,
    onManageTags,
    onEmptyTrash,
    onMergeCollections,
    children,
  } = props
  const {
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
  } = useSidebarController(props)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={organizationCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <div className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-lg">
                <Layers className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold tracking-tight">Lain</span>
            </div>
            <SidebarTrigger className="h-7 w-7" />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="px-3 py-1 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 text-xs"
                    onClick={onAddBookmark}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add Bookmark
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Add a new bookmark
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={handleOpenSearch}
                    aria-label="Search collections"
                  >
                    <Search className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Search collections
                </TooltipContent>
              </Tooltip>
            </div>
          </SidebarGroup>

          {isSearchOpen && (
            <div className="px-3 pb-1 group-data-[collapsible=icon]:hidden">
              <CollectionSearch
                groups={displayedGroups}
                onSelect={handleSearchSelect}
                onClose={handleCloseSearch}
              />
            </div>
          )}

          <SidebarLibrary
            activeDragCollection={activeDragCollection}
            systemCollections={systemCollections}
            displayedGroups={displayedGroups}
            onEmptyTrash={onEmptyTrash}
            isUngroupedExpanded={isUngroupedExpanded}
            onEditGroup={onEditGroup}
            onDeleteGroup={onDeleteGroup}
            toggleGroup={toggleGroup}
            onAddCollection={onAddCollection}
            dropIndicator={dropIndicator}
            treeProps={treeProps}
          />
        </SidebarContent>

        <SidebarFooter className="border-t p-2 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="New Group"
                    onClick={onAddGroup}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">New Group</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Manage Tags"
                    onClick={onManageTags}
                  >
                    <Tag className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Manage Tags</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Merge Collections"
                    onClick={onMergeCollections}
                  >
                    <Merge className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Merge Collections</TooltipContent>
              </Tooltip>
            </div>

            <ThemeToggle />
          </div>
        </SidebarFooter>
      </Sidebar>
      {children}
    </DndContext>
  )
})

export { LeftSidebar }
