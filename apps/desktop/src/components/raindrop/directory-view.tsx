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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Raindrop, Collection, ContentType } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Map content type to its corresponding Lucide icon component and label.
 * @param type - Content type
 * @returns Object with icon component and display label
 * @example getTypeInfo("video") // => { icon: Video, label: "video" }
 */
function getTypeInfo(type: ContentType) {
  const map: Record<ContentType, { icon: typeof Globe; label: string }> = {
    link: { icon: Globe, label: 'link' },
    article: { icon: FileText, label: 'article' },
    image: { icon: Image, label: 'image' },
    video: { icon: Video, label: 'video' },
    document: { icon: File, label: 'document' },
    audio: { icon: Music, label: 'audio' },
  }
  return map[type] || map.link
}

/** Empty array constant to avoid re-creating on every render. */
const EMPTY_PREFIXES: string[] = []

/**
 * Wrapper for child CollectionTreeNode to memoize the childPrefixes array.
 */
const ChildTreeNode = React.memo(function ChildTreeNode({
  collection,
  raindropsByCollection,
  selectedRaindropId,
  onSelectRaindrop,
  onOpenUrl,
  onSelectCollection,
  depth,
  isLast,
  parentPrefixes,
  childPrefix,
}: {
  collection: Collection
  raindropsByCollection: Record<string, Raindrop[]>
  selectedRaindropId?: string
  onSelectRaindrop?: (raindrop: Raindrop) => void
  onOpenUrl?: (url: string) => void
  onSelectCollection?: (collection: Collection) => void
  depth: number
  isLast: boolean
  parentPrefixes: string[]
  childPrefix: string
}) {
  const childPrefixes = useMemo(
    () => [...parentPrefixes, childPrefix],
    [parentPrefixes, childPrefix],
  )
  return (
    <CollectionTreeNode
      collection={collection}
      raindropsByCollection={raindropsByCollection}
      selectedRaindropId={selectedRaindropId}
      onSelectRaindrop={onSelectRaindrop}
      onOpenUrl={onOpenUrl}
      onSelectCollection={onSelectCollection}
      depth={depth}
      isLast={isLast}
      parentPrefixes={childPrefixes}
    />
  )
})

/**
 * Props for the DirectoryView component.
 */
interface DirectoryViewProps {
  /** Collections to display in the tree hierarchy */
  collections: Collection[]
  /** Raindrops keyed by collection ID */
  raindropsByCollection: Record<string, Raindrop[]>
  /** Currently selected raindrop ID */
  selectedRaindropId?: string
  /** Callback when a raindrop is selected */
  onSelectRaindrop?: (raindrop: Raindrop) => void
  /** Callback when a raindrop URL is opened */
  onOpenUrl?: (url: string) => void
  /** Callback when a collection is clicked */
  onSelectCollection?: (collection: Collection) => void
}

/**
 * Recursive tree node for a collection and its contents.
 */
const CollectionTreeNode = React.memo(function CollectionTreeNode({
  collection,
  raindropsByCollection,
  selectedRaindropId,
  onSelectRaindrop,
  onOpenUrl,
  onSelectCollection,
  depth,
  isLast,
  parentPrefixes,
}: {
  collection: Collection
  raindropsByCollection: Record<string, Raindrop[]>
  selectedRaindropId?: string
  onSelectRaindrop?: (raindrop: Raindrop) => void
  onOpenUrl?: (url: string) => void
  onSelectCollection?: (collection: Collection) => void
  depth: number
  isLast: boolean
  parentPrefixes: string[]
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 2)

  const raindrops = raindropsByCollection[collection.id] || []
  const children = collection.children || []
  const hasContent = raindrops.length > 0 || children.length > 0

  const folderColorStyle = useMemo(
    () => ({ color: collection.color || '#8b5cf6' }),
    [collection.color],
  )

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
    onSelectCollection?.(collection)
  }

  const prefix = parentPrefixes.join('')
  const connector = isLast ? '\u2514\u2500\u2500 ' : '\u251C\u2500\u2500 '
  const childPrefix = isLast ? '    ' : '\u2502   '

  return (
    <div className="select-none">
      {/* Collection folder row */}
      <button
        type="button"
        className={cn(
          'hover:bg-accent flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-sm transition-colors',
        )}
        onClick={toggleExpand}
      >
        <span className="text-muted-foreground flex-shrink-0 font-mono text-xs whitespace-pre">
          {depth > 0 ? prefix + connector : ''}
        </span>
        {hasContent ? (
          isExpanded ? (
            <ChevronDown className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
          )
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        {isExpanded ? (
          <FolderOpen
            className="h-4 w-4 flex-shrink-0"
            style={folderColorStyle}
          />
        ) : (
          <Folder className="h-4 w-4 flex-shrink-0" style={folderColorStyle} />
        )}
        <span className="truncate font-medium">{collection.name}/</span>
        <span className="text-muted-foreground flex-shrink-0 text-xs">
          ({collection.count})
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div>
          {/* Child collections */}
          {children.map((child, index) => (
            <ChildTreeNode
              key={child.id}
              collection={child}
              raindropsByCollection={raindropsByCollection}
              selectedRaindropId={selectedRaindropId}
              onSelectRaindrop={onSelectRaindrop}
              onOpenUrl={onOpenUrl}
              onSelectCollection={onSelectCollection}
              depth={depth + 1}
              isLast={index === children.length - 1 && raindrops.length === 0}
              parentPrefixes={parentPrefixes}
              childPrefix={childPrefix}
            />
          ))}

          {/* Raindrops within collection */}
          {raindrops.map((raindrop, index) => {
            const typeInfo = getTypeInfo(raindrop.type)
            const TypeIcon = typeInfo.icon
            const isLastItem = index === raindrops.length - 1
            const itemConnector = isLastItem
              ? '\u2514\u2500\u2500 '
              : '\u251C\u2500\u2500 '
            const itemPrefix = [...parentPrefixes, childPrefix].join('')

            return (
              <Tooltip key={raindrop.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-raindrop-id={raindrop.id}
                    className={cn(
                      'hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
                      selectedRaindropId === raindrop.id && 'bg-accent',
                    )}
                    onClick={() => onSelectRaindrop?.(raindrop)}
                    onDoubleClick={() => onOpenUrl?.(raindrop.url)}
                  >
                    <span className="text-muted-foreground flex-shrink-0 font-mono text-xs whitespace-pre">
                      {itemPrefix + itemConnector}
                    </span>
                    <TypeIcon className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{raindrop.title}</span>
                    {raindrop.type !== 'link' && (
                      <span className="text-muted-foreground flex-shrink-0 text-xs">
                        ({typeInfo.label})
                      </span>
                    )}
                    {raindrop.isImportant && (
                      <Star className="h-3 w-3 flex-shrink-0 fill-amber-500 text-amber-500" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{raindrop.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {raindrop.url}
                    </p>
                    {raindrop.description && (
                      <p className="text-xs">{raindrop.description}</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      )}
    </div>
  )
})

/**
 * Unix filesystem-style tree view of collections and their contained raindrops.
 * Displays a hierarchical structure using tree-line characters (pipe, tee, elbow)
 * inspired by the Unix `tree` command.
 *
 * @param collections - Array of root-level collections to display
 * @param raindropsByCollection - Raindrops grouped by collection ID
 * @param selectedRaindropId - Currently selected raindrop for highlighting
 * @param onSelectRaindrop - Callback when a raindrop row is clicked
 * @param onOpenUrl - Callback when a raindrop is double-clicked to open
 * @param onSelectCollection - Callback when a collection folder is clicked
 *
 * @example
 *   <DirectoryView
 *     collections={collections}
 *     raindropsByCollection={grouped}
 *     selectedRaindropId={selectedId}
 *     onSelectRaindrop={(rd) => openDetail(rd)}
 *     onOpenUrl={(url) => window.shell.openExternal(url)}
 *   />
 */
const DirectoryView = React.memo(function DirectoryView({
  collections,
  raindropsByCollection,
  selectedRaindropId,
  onSelectRaindrop,
  onOpenUrl,
  onSelectCollection,
}: DirectoryViewProps) {
  const [allExpanded, setAllExpanded] = useState(true)

  const handleExpandCollapseAll = useCallback(() => {
    setAllExpanded(!allExpanded)
    // Force re-render by toggling the key
  }, [allExpanded])

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-end border-b px-4 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={handleExpandCollapseAll}
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </Button>
      </div>

      {/* Tree content */}
      <ScrollArea className="flex-1">
        <div className="p-4 font-mono text-sm" key={String(allExpanded)}>
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
                selectedRaindropId={selectedRaindropId}
                onSelectRaindrop={onSelectRaindrop}
                onOpenUrl={onOpenUrl}
                onSelectCollection={onSelectCollection}
                depth={0}
                isLast={index === collections.length - 1}
                parentPrefixes={EMPTY_PREFIXES}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
})
export { DirectoryView }
export default DirectoryView
