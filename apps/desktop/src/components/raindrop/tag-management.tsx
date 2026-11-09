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
import React, { useCallback } from 'react'

import {
  AlertDialog,
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
import { useTagManagement } from '@/hooks/useTagManagement'
import { cn } from '@/lib/utils'

import type { TagEntry, TagManagementProps } from './tag-management.types'

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
/** Render the active tag rename draft with keyboard confirmation and cancel controls. */
const TagRenameInput = React.memo(function TagRenameInput({
  tagName,
  editValue,
  busy,
  onEditValueChange,
  onConfirmRename,
  onCancelRename,
}: {
  tagName: string
  editValue: string
  busy: boolean
  onEditValueChange: (value: string) => void
  onConfirmRename: () => void
  onCancelRename: () => void
}) {
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
  return (
    <div className="flex flex-1 items-center gap-1">
      <Input
        aria-label={`New name for ${tagName}`}
        disabled={busy}
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
        aria-label={`Save name for ${tagName}`}
        disabled={busy || !editValue.trim() || editValue.trim() === tagName}
        onClick={onConfirmRename}
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label={`Cancel rename of ${tagName}`}
        disabled={busy}
        onClick={onCancelRename}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
})

const TagRowItem = React.memo(function TagRowItem({
  tag,
  controller,
  canRename,
  canDelete,
}: {
  tag: TagEntry
  controller: ReturnType<typeof useTagManagement>
  canRename: boolean
  canDelete: boolean
}) {
  const {
    selectedTags,
    editingTag,
    editValue,
    busy,
    toggleTag: onToggleTag,
    handleEditValueChange: onEditValueChange,
    confirmRename: onConfirmRename,
    cancelRename: onCancelRename,
    startRename: onStartRename,
    handleSetDeleteTarget: onSetDeleteTarget,
  } = controller
  const isSelected = selectedTags.has(tag.name)
  const isEditing = editingTag === tag.name
  const handleCheckedChange = useCallback(
    () => onToggleTag(tag.name),
    [onToggleTag, tag.name],
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
        disabled={busy}
        checked={isSelected}
        onCheckedChange={handleCheckedChange}
        aria-label={`Select tag ${tag.name}`}
      />

      {isEditing ? (
        <TagRenameInput
          tagName={tag.name}
          editValue={editValue}
          busy={busy}
          onEditValueChange={onEditValueChange}
          onConfirmRename={onConfirmRename}
          onCancelRename={onCancelRename}
        />
      ) : (
        <>
          <Badge variant="secondary" className="text-xs">
            {tag.name}
          </Badge>
          <span className="text-muted-foreground ml-auto text-xs">
            {tag.count}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleStartRename}
              disabled={busy || !canRename}
              aria-label={`Rename tag ${tag.name}`}
              title="Rename tag"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive h-7 w-7"
              onClick={handleSetDelete}
              disabled={busy || !canDelete}
              aria-label={`Delete tag ${tag.name}`}
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

/** Render merge and delete confirmations using the management controller's retained drafts and errors. */
const TagMutationDialogs = React.memo(function TagMutationDialogs({
  controller,
  canMerge,
  canDelete,
}: {
  controller: ReturnType<typeof useTagManagement>
  canMerge: boolean
  canDelete: boolean
}) {
  const {
    mergeDialogOpen,
    handleMergeOpenChange,
    busy,
    selectedTags,
    mergeTargetName,
    handleMergeTargetChange,
    handleMergeKeyDown,
    error,
    handleCloseMergeDialog,
    handleMerge,
    deleteTarget,
    handleDeleteDialogOpenChange,
    handleDelete,
  } = controller
  return (
    <>
      {/* Merge dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={handleMergeOpenChange}>
        <DialogContent className="max-w-sm" showCloseButton={!busy}>
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
              aria-label="Merged tag name"
              disabled={busy}
              placeholder="New tag name..."
              value={mergeTargetName}
              onChange={handleMergeTargetChange}
              onKeyDown={handleMergeKeyDown}
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={handleCloseMergeDialog}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMerge}
              disabled={
                busy ||
                !canMerge ||
                selectedTags.size < 2 ||
                !mergeTargetName.trim()
              }
            >
              {busy ? 'Merging…' : 'Merge Tags'}
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
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              disabled={busy || !canDelete}
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  const controller = useTagManagement({
    tags,
    open,
    onOpenChange,
    onRename,
    onMerge,
    onDelete,
  })
  const {
    searchQuery,
    sortMode,
    selectedTags,
    deleteTarget,
    mergeDialogOpen,
    busy,
    error,
    handleSearchChange,
    filteredAndSortedTags,
    allVisibleSelected,
    toggleAll,
    handleSortByName,
    handleSortByCount,
    handleOpenMergeDialog,
    handleBulkDelete,
    handlePanelOpenChange,
    handleCloseDialog,
  } = controller

  return (
    <>
      <Dialog open={open} onOpenChange={handlePanelOpenChange}>
        <DialogContent className="max-w-lg" showCloseButton={!busy}>
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
                  disabled={busy}
                  aria-label="Search tags"
                  placeholder="Search tags..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="h-8 pl-8"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    disabled={busy}
                  >
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
                    disabled={busy || !onMerge}
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
                  disabled={busy || !onDelete}
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
                    disabled={busy}
                    checked={allVisibleSelected}
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
                    controller={controller}
                    canRename={Boolean(onRename)}
                    canDelete={Boolean(onDelete)}
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

          {error && !mergeDialogOpen && !deleteTarget && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          {busy && !mergeDialogOpen && !deleteTarget && (
            <p role="status" className="text-muted-foreground text-sm">
              Saving tag changes…
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={handleCloseDialog}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TagMutationDialogs
        controller={controller}
        canMerge={Boolean(onMerge)}
        canDelete={Boolean(onDelete)}
      />
    </>
  )
})
export { TagManagement }
