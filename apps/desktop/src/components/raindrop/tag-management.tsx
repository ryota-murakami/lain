import {
  Tag,
  Search,
  ArrowUpDown,
  Pencil,
  Merge,
  Trash2,
  Check,
  X,
} from 'lucide-react'
import React, { useState, useMemo, useCallback } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

/**
 * A tag entry with its name and usage count across all raindrops.
 */
interface TagEntry {
  name: string
  count: number
}

/**
 * Props for the TagManagement component.
 */
interface TagManagementProps {
  /** List of all tags with usage counts */
  tags: TagEntry[]
  /** Whether the management panel is open */
  open: boolean
  /** Callback to toggle panel visibility */
  onOpenChange: (open: boolean) => void
  /** Callback when a tag is renamed */
  onRename?: (oldName: string, newName: string) => void
  /** Callback when tags are merged */
  onMerge?: (sourceNames: string[], targetName: string) => void
  /** Callback when a tag is deleted */
  onDelete?: (tagName: string) => void
}

type SortMode = 'name' | 'count'

/**
 * Tag management panel for viewing, renaming, merging, and deleting tags.
 * Accessible from the sidebar or toolbar. Shows all tags with usage counts
 * and provides bulk operations.
 *
 * @param tags - Array of tag entries with name and count
 * @param open - Whether the dialog is open
 * @param onOpenChange - Callback when open state changes
 * @param onRename - Callback when a tag is renamed
 * @param onMerge - Callback when tags are merged
 * @param onDelete - Callback when a tag is deleted
 *
 * @example
 *   <TagManagement
 *     tags={[{ name: "react", count: 15 }, { name: "typescript", count: 8 }]}
 *     open={isOpen}
 *     onOpenChange={setIsOpen}
 *     onRename={(old, next) => renameTag(old, next)}
 *     onDelete={(name) => deleteTag(name)}
 *   />
 */
/**
 * A single tag row inside the tag list .map() loop.
 * Extracted as a component to allow useCallback for event handlers.
 */
const TagRowItem = React.memo(function TagRowItem({
  tag,
  isSelected,
  isEditing,
  editValue,
  onToggleTag,
  onEditValueChange,
  onConfirmRename,
  onCancelRename,
  onStartRename,
  onSetDeleteTarget,
}: {
  tag: TagEntry
  isSelected: boolean
  isEditing: boolean
  editValue: string
  onToggleTag: (tagName: string) => void
  onEditValueChange: (value: string) => void
  onConfirmRename: () => void
  onCancelRename: () => void
  onStartRename: (tagName: string) => void
  onSetDeleteTarget: (tagName: string) => void
}) {
  const handleCheckedChange = useCallback(
    () => onToggleTag(tag.name),
    [onToggleTag, tag.name],
  )
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onEditValueChange(e.target.value),
    [onEditValueChange],
  )
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') onConfirmRename()
      if (e.key === 'Escape') onCancelRename()
    },
    [onConfirmRename, onCancelRename],
  )
  const handleStartRename = useCallback(
    () => onStartRename(tag.name),
    [onStartRename, tag.name],
  )
  const handleSetDelete = useCallback(
    () => onSetDeleteTarget(tag.name),
    [onSetDeleteTarget, tag.name],
  )

  return (
    <div
      className={cn(
        'group hover:bg-accent flex items-center gap-3 rounded-md px-2 py-1.5',
        isSelected && 'bg-accent/50',
      )}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={handleCheckedChange}
        aria-label={`Select tag ${tag.name}`}
      />

      {isEditing ? (
        <div className="flex flex-1 items-center gap-1">
          <Input
            value={editValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="h-7 text-sm"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onConfirmRename}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCancelRename}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <>
          <Badge variant="secondary" className="text-xs">
            {tag.name}
          </Badge>
          <span className="text-muted-foreground ml-auto text-xs">
            {tag.count}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleStartRename}
              title="Rename tag"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive h-7 w-7"
              onClick={handleSetDelete}
              title="Delete tag"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
})

const TagManagement = React.memo(function TagManagement({
  tags,
  open,
  onOpenChange,
  onRename,
  onMerge,
  onDelete,
}: TagManagementProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('count')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [mergeTargetName, setMergeTargetName] = useState('')

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value),
    [],
  )

  const filteredAndSortedTags = useMemo(() => {
    let filtered = tags
    if (searchQuery) {
      const lower = searchQuery.toLowerCase()
      filtered = tags.filter((t) => t.name.toLowerCase().includes(lower))
    }
    return [...filtered].sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name)
      return b.count - a.count
    })
  }, [tags, searchQuery, sortMode])

  const toggleTag = useCallback((tagName: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tagName)) {
        next.delete(tagName)
      } else {
        next.add(tagName)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (selectedTags.size === filteredAndSortedTags.length) {
      setSelectedTags(new Set())
    } else {
      setSelectedTags(new Set(filteredAndSortedTags.map((t) => t.name)))
    }
  }, [selectedTags.size, filteredAndSortedTags])

  const startRename = useCallback((tagName: string) => {
    setEditingTag(tagName)
    setEditValue(tagName)
  }, [])

  const confirmRename = useCallback(() => {
    if (editingTag && editValue.trim() && editValue.trim() !== editingTag) {
      onRename?.(editingTag, editValue.trim())
    }
    setEditingTag(null)
    setEditValue('')
  }, [editingTag, editValue, onRename])

  const cancelRename = useCallback(() => {
    setEditingTag(null)
    setEditValue('')
  }, [])

  const handleMerge = useCallback(() => {
    if (selectedTags.size >= 2 && mergeTargetName.trim()) {
      onMerge?.(Array.from(selectedTags), mergeTargetName.trim())
      setSelectedTags(new Set())
      setMergeDialogOpen(false)
      setMergeTargetName('')
    }
  }, [selectedTags, mergeTargetName, onMerge])

  const handleDelete = useCallback(() => {
    if (deleteTarget) {
      onDelete?.(deleteTarget)
      selectedTags.delete(deleteTarget)
      setSelectedTags(new Set(selectedTags))
      setDeleteTarget(null)
    }
  }, [deleteTarget, onDelete, selectedTags])

  const handleSortByName = useCallback(() => setSortMode('name'), [])
  const handleSortByCount = useCallback(() => setSortMode('count'), [])
  const handleOpenMergeDialog = useCallback(() => {
    setMergeTargetName('')
    setMergeDialogOpen(true)
  }, [])
  const handleBulkDelete = useCallback(() => {
    for (const name of selectedTags) {
      onDelete?.(name)
    }
    setSelectedTags(new Set())
  }, [selectedTags, onDelete])
  const handleCloseDialog = useCallback(
    () => onOpenChange(false),
    [onOpenChange],
  )
  const handleCloseMergeDialog = useCallback(
    () => setMergeDialogOpen(false),
    [],
  )
  const handleMergeTargetChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setMergeTargetName(e.target.value),
    [],
  )
  const handleMergeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleMerge()
    },
    [handleMerge],
  )
  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setDeleteTarget(null)
  }, [])
  const handleEditValueChange = useCallback(
    (value: string) => setEditValue(value),
    [],
  )
  const handleSetDeleteTarget = useCallback(
    (tagName: string) => setDeleteTarget(tagName),
    [],
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Tag Management
            </DialogTitle>
            <DialogDescription>
              View, rename, merge, and delete tags across all bookmarks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search and sort controls */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search tags..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="h-8 pl-8"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    {sortMode === 'name' ? 'Name' : 'Count'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSortByName}>
                    Sort by name
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSortByCount}>
                    Sort by count
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Bulk actions */}
            {selectedTags.size > 0 && (
              <div className="bg-muted flex items-center gap-2 rounded-md px-3 py-2">
                <span className="text-muted-foreground text-xs">
                  {selectedTags.size} selected
                </span>
                <Separator orientation="vertical" className="h-4" />
                {selectedTags.size >= 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={handleOpenMergeDialog}
                  >
                    <Merge className="h-3.5 w-3.5" />
                    Merge
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive h-7 gap-1 text-xs"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            )}

            {/* Tag list */}
            <ScrollArea className="h-[320px]">
              <div className="space-y-0.5">
                {/* Select all header */}
                <div className="flex items-center gap-3 px-2 py-1.5">
                  <Checkbox
                    checked={
                      filteredAndSortedTags.length > 0 &&
                      selectedTags.size === filteredAndSortedTags.length
                    }
                    onCheckedChange={toggleAll}
                    aria-label="Select all tags"
                  />
                  <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    {filteredAndSortedTags.length} tags
                  </span>
                </div>
                <Separator />

                {filteredAndSortedTags.map((tag) => (
                  <TagRowItem
                    key={tag.name}
                    tag={tag}
                    isSelected={selectedTags.has(tag.name)}
                    isEditing={editingTag === tag.name}
                    editValue={editValue}
                    onToggleTag={toggleTag}
                    onEditValueChange={handleEditValueChange}
                    onConfirmRename={confirmRename}
                    onCancelRename={cancelRename}
                    onStartRename={startRename}
                    onSetDeleteTarget={handleSetDeleteTarget}
                  />
                ))}

                {filteredAndSortedTags.length === 0 && (
                  <div className="text-muted-foreground py-8 text-center text-sm">
                    {searchQuery ? 'No tags match your search' : 'No tags yet'}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Merge Tags</DialogTitle>
            <DialogDescription>
              Merge {selectedTags.size} selected tags into one. All bookmarks
              will be updated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {Array.from(selectedTags).map((name) => (
                <Badge key={name} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
            <Input
              placeholder="New tag name..."
              value={mergeTargetName}
              onChange={handleMergeTargetChange}
              onKeyDown={handleMergeKeyDown}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseMergeDialog}>
              Cancel
            </Button>
            <Button onClick={handleMerge} disabled={!mergeTargetName.trim()}>
              Merge Tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete tag &ldquo;{deleteTarget}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This tag will be removed from all bookmarks that use it. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
})
export { TagManagement }
export default TagManagement
