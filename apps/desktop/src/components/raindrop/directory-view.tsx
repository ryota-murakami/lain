import {
  Folder,
  FolderOpen,
  Globe,
  FileText,
  Image,
  Video,
  File,
  Music,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  Star,
} from 'lucide-react'
import React, { useState, useCallback, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Raindrop, Collection, ContentType } from '@/lib/types'
import { cn } from '@/lib/utils'

const TYPE_ICONS: Record<ContentType, typeof Globe> = {
  link: Globe,
  article: FileText,
  image: Image,
  video: Video,
  document: File,
  audio: Music,
}
const EMPTY_SELECTION = new Set<string>()

interface DirectoryViewProps {
  collections: Collection[]
  raindropsByCollection: Record<string, Raindrop[]>
  /** Bookmark open in the detail panel, independent of the bulk selection. */
  selectedRaindropId?: string
  /** IDs selected for bulk actions across every visible collection. */
  selectedIds?: Set<string>
  onToggleSelection?: (id: string) => void
  onSelectRaindrop?: (raindrop: Raindrop) => void
  onOpenUrl?: (url: string) => void
  onSelectCollection?: (collection: Collection) => void
}

type DirectoryInteractions = Pick<
  DirectoryViewProps,
  | 'selectedRaindropId'
  | 'selectedIds'
  | 'onToggleSelection'
  | 'onSelectRaindrop'
  | 'onOpenUrl'
  | 'onSelectCollection'
>
interface ExpansionState {
  /** Initial mode preserves the original two-level preview; toolbar commands cover every depth. */
  mode: 'initial' | 'expanded' | 'collapsed'
  exceptions: Set<string>
}

/**
 * Resolve one folder's expansion from the shared toolbar mode and local overrides.
 * Called by {@link CollectionTreeNode}; children remount without losing their open state.
 * @example collectionIsExpanded({ mode: 'expanded', exceptions: new Set() }, '100', 4)
 */
function collectionIsExpanded(
  expansion: ExpansionState,
  id: string,
  depth: number,
): boolean {
  const base =
    expansion.mode === 'expanded' || (expansion.mode === 'initial' && depth < 2)
  return expansion.exceptions.has(id) ? !base : base
}

/**
 * Render a keyboard-operable bookmark with an adjacent bulk-selection checkbox.
 * {@link CollectionTreeNode} supplies indentation; normal clicks still open detail.
 * @example <DirectoryBookmarkRow raindrop={bookmark} prefix="│  " onSelectRaindrop={openDetail} />
 */
const DirectoryBookmarkRow = React.memo(function DirectoryBookmarkRow({
  raindrop,
  prefix,
  selectedRaindropId,
  selectedIds = EMPTY_SELECTION,
  onSelectRaindrop,
  onToggleSelection,
  onOpenUrl,
}: DirectoryInteractions & { raindrop: Raindrop; prefix: string }) {
  const Icon = TYPE_ICONS[raindrop.type] ?? Globe
  const isSelected = selectedIds.has(raindrop.id)
  const select = (event: React.MouseEvent<HTMLButtonElement>): void => {
    if ((event.metaKey || event.ctrlKey) && onToggleSelection)
      onToggleSelection(raindrop.id)
    else onSelectRaindrop?.(raindrop)
  }
  const toggleSelection = useCallback(
    (): void => onToggleSelection?.(raindrop.id),
    [onToggleSelection, raindrop.id],
  )
  const open = (event: React.MouseEvent<HTMLButtonElement>): void => {
    if (!event.metaKey && !event.ctrlKey) onOpenUrl?.(raindrop.url)
  }
  return (
    <div
      data-selected={isSelected}
      className={cn(
        'flex items-center gap-1 rounded-sm',
        isSelected && 'bg-accent',
      )}
    >
      {onToggleSelection && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={toggleSelection}
          aria-label={`Select ${raindrop.title}`}
          className="ml-2"
        />
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-raindrop-id={raindrop.id}
            aria-current={
              selectedRaindropId === raindrop.id ? 'true' : undefined
            }
            className={cn(
              'hover:bg-accent focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-1.5 rounded-sm px-2 py-1 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
              selectedRaindropId === raindrop.id && 'bg-accent',
            )}
            onClick={select}
            onDoubleClick={open}
          >
            <span
              aria-hidden="true"
              className="text-muted-foreground shrink-0 font-mono text-xs whitespace-pre"
            >
              {prefix}
            </span>
            <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="truncate">{raindrop.title}</span>
            {raindrop.type !== 'link' && (
              <span className="text-muted-foreground shrink-0 text-xs">
                ({raindrop.type})
              </span>
            )}
            {raindrop.isImportant && (
              <Star
                aria-label="Important"
                className="h-3 w-3 shrink-0 fill-amber-500 text-amber-500"
              />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-1">
            <p className="text-sm font-medium">{raindrop.title}</p>
            <p className="text-muted-foreground text-xs">{raindrop.url}</p>
            {raindrop.description && (
              <p className="text-xs">{raindrop.description}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  )
})

/** Render a folder toggle independently from traversal, preserving its native keyboard and expansion semantics. */
const DirectoryFolderButton = React.memo(function DirectoryFolderButton({
  collection,
  hasContent,
  isExpanded,
  isLast,
  depth,
  prefix,
  interactions,
  onToggle,
}: {
  collection: Collection
  hasContent: boolean
  isExpanded: boolean
  isLast: boolean
  depth: number
  prefix: string
  interactions: DirectoryInteractions
  onToggle: (id: string) => void
}) {
  const folderStyle = useMemo(
    () => ({ color: collection.color || '#8b5cf6' }),
    [collection.color],
  )
  const toggleExpand = (): void => {
    onToggle(collection.id)
    interactions.onSelectCollection?.(collection)
  }
  const FolderIcon = isExpanded ? FolderOpen : Folder
  return (
    <button
      type="button"
      aria-expanded={hasContent ? isExpanded : undefined}
      aria-label={`${collection.name} collection`}
      className="hover:bg-accent flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-sm transition-colors"
      onClick={toggleExpand}
    >
      <span
        aria-hidden="true"
        className="text-muted-foreground shrink-0 font-mono text-xs whitespace-pre"
      >
        {depth > 0 ? prefix + (isLast ? '└── ' : '├── ') : ''}
      </span>
      {hasContent ? (
        isExpanded ? (
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        )
      ) : (
        <span className="w-3.5 shrink-0" />
      )}
      <FolderIcon className="h-4 w-4 shrink-0" style={folderStyle} />
      <span className="truncate font-medium">{collection.name}/</span>
      <span className="text-muted-foreground shrink-0 text-xs">
        ({collection.count})
      </span>
    </button>
  )
})

/**
 * Render a collection and its descendants using the Directory view's shared expansion state.
 * Individual toggles preserve descendant overrides; all-folder commands replace the shared mode.
 * @example <CollectionTreeNode collection={root} depth={0} prefix="" isLast {...treeProps} />
 */
const CollectionTreeNode = React.memo(function CollectionTreeNode({
  collection,
  raindropsByCollection,
  interactions,
  expansion,
  onToggle,
  depth,
  isLast,
  prefix,
}: {
  collection: Collection
  raindropsByCollection: DirectoryViewProps['raindropsByCollection']
  interactions: DirectoryInteractions
  expansion: ExpansionState
  onToggle: (id: string) => void
  depth: number
  isLast: boolean
  prefix: string
}) {
  const isExpanded = collectionIsExpanded(expansion, collection.id, depth)
  const raindrops = raindropsByCollection[collection.id] ?? []
  const children = collection.children ?? []
  const hasContent = raindrops.length > 0 || children.length > 0
  const childPrefix = prefix + (isLast ? '    ' : '│   ')
  return (
    <div className="select-none">
      <DirectoryFolderButton
        collection={collection}
        hasContent={hasContent}
        isExpanded={isExpanded}
        isLast={isLast}
        depth={depth}
        prefix={prefix}
        interactions={interactions}
        onToggle={onToggle}
      />
      {isExpanded && (
        <div>
          {children.map((child, index) => (
            <CollectionTreeNode
              key={child.id}
              collection={child}
              raindropsByCollection={raindropsByCollection}
              interactions={interactions}
              expansion={expansion}
              onToggle={onToggle}
              depth={depth + 1}
              isLast={index === children.length - 1 && raindrops.length === 0}
              prefix={childPrefix}
            />
          ))}
          {raindrops.map((raindrop, index) => (
            <DirectoryBookmarkRow
              key={raindrop.id}
              raindrop={raindrop}
              prefix={
                childPrefix + (index === raindrops.length - 1 ? '└── ' : '├── ')
              }
              {...interactions}
            />
          ))}
        </div>
      )}
    </div>
  )
})

/**
 * Display loaded bookmarks in their collection hierarchy with independent detail and bulk selection.
 * MainContent supplies scoped data; expansion commands affect descendants at every depth.
 * @example <DirectoryView collections={collections} raindropsByCollection={grouped} selectedIds={selected} onToggleSelection={toggleSelection} />
 */
const DirectoryView = React.memo(function DirectoryView({
  collections,
  raindropsByCollection,
  selectedRaindropId,
  selectedIds = EMPTY_SELECTION,
  onSelectRaindrop,
  onToggleSelection,
  onOpenUrl,
  onSelectCollection,
}: DirectoryViewProps) {
  const [expansion, setExpansion] = useState<ExpansionState>(() => ({
    mode: 'initial',
    exceptions: new Set(),
  }))
  const interactions = useMemo(
    () => ({
      selectedRaindropId,
      selectedIds,
      onSelectRaindrop,
      onToggleSelection,
      onOpenUrl,
      onSelectCollection,
    }),
    [
      selectedRaindropId,
      selectedIds,
      onSelectRaindrop,
      onToggleSelection,
      onOpenUrl,
      onSelectCollection,
    ],
  )
  const toggleCollection = useCallback(
    (id: string): void =>
      setExpansion((previous) => {
        const exceptions = new Set(previous.exceptions)
        if (exceptions.has(id)) exceptions.delete(id)
        else exceptions.add(id)
        return { ...previous, exceptions }
      }),
    [],
  )
  const toggleAll = useCallback(
    (): void =>
      setExpansion((previous) => ({
        mode: previous.mode === 'collapsed' ? 'expanded' : 'collapsed',
        exceptions: new Set(),
      })),
    [],
  )
  const loadedCount = Object.values(raindropsByCollection).reduce(
    (count, bookmarks) => count + bookmarks.length,
    0,
  )
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-1.5">
        <span className="text-muted-foreground text-xs">
          {loadedCount} loaded
          {selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={toggleAll}
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
          {expansion.mode === 'collapsed' ? 'Expand All' : 'Collapse All'}
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 font-mono text-sm">
          {collections.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
              <Folder className="mb-3 h-10 w-10 opacity-40" />
              <p className="font-sans text-sm">No collections to display</p>
            </div>
          ) : (
            collections.map((collection, index) => (
              <CollectionTreeNode
                key={collection.id}
                collection={collection}
                raindropsByCollection={raindropsByCollection}
                interactions={interactions}
                expansion={expansion}
                onToggle={toggleCollection}
                depth={0}
                isLast={index === collections.length - 1}
                prefix=""
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
})
export { DirectoryView }
