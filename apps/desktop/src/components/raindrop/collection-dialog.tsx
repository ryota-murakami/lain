import { zodResolver } from '@hookform/resolvers/zod'
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { CollectionSelector } from '@/components/raindrop/collection-selector'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { Group, Collection } from '@/lib/types'

const PRESET_COLORS = [
  '#8b5cf6',
  '#6366f1',
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#22c55e',
  '#eab308',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#a855f7',
]

const ICON_OPTIONS = [
  'Folder',
  'FolderOpen',
  'Star',
  'Heart',
  'Bookmark',
  'Code2',
  'Palette',
  'Brain',
  'BookOpen',
  'CookingPot',
  'Plane',
  'Music',
  'Camera',
  'GamepadIcon',
  'Briefcase',
  'GraduationCap',
  'Wrench',
  'Shield',
  'Globe',
  'Zap',
  'Sparkles',
  'Component',
  'Layout',
  'FileText',
  'Image',
  'Video',
  'Home',
  'ShoppingBag',
  'Coffee',
  'Dumbbell',
]

const collectionSchema = z.object({
  name: z.string().min(1, 'Collection name is required'),
  icon: z.string(),
  color: z.string(),
  groupId: z.string().min(1, 'Group is required'),
  parentId: z.string().optional(),
  viewMode: z.enum(['list', 'grid', 'table', 'directory']),
  isPublic: z.boolean(),
})

type CollectionFormValues = z.infer<typeof collectionSchema>

/**
 * Props for CollectionDialog component.
 */
interface CollectionDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback to change open state */
  onOpenChange: (open: boolean) => void
  /** Available groups for the group selector */
  groups: Group[]
  /** Existing collection to edit (undefined for create mode) */
  collection?: Collection
  /** Callback when user saves the collection */
  onSave: (data: CollectionFormValues & { id?: string }) => void
}

/**
 * Dialog for creating or editing a collection.
 * Supports icon selection, color picking, parent collection nesting,
 * group assignment, view mode preference, and public toggle.
 *
 * @param open - Controls dialog visibility
 * @param onOpenChange - Callback when dialog open state changes
 * @param groups - Available groups for organizing collections
 * @param collection - If provided, enters edit mode with pre-filled values
 * @param onSave - Callback with form data on save
 *
 * @example
 *   <CollectionDialog
 *     open={isOpen}
 *     onOpenChange={setIsOpen}
 *     groups={groups}
 *     collection={editingCollection}
 *     onSave={(data) => console.log("Save:", data)}
 *   />
 */
/**
 * Reset collection form when the dialog opens or the collection changes.
 */
function useCollectionFormReset(
  open: boolean,
  collection: Collection | undefined,
  groups: Group[],
  reset: (values: CollectionFormValues) => void,
  setIconSearch: (search: string) => void,
) {
  useEffect(() => {
    if (open) {
      if (collection) {
        reset({
          name: collection.name,
          icon: collection.icon || 'Folder',
          color: collection.color || '#8b5cf6',
          groupId: collection.groupId,
          parentId: collection.parentId || undefined,
          viewMode: 'list',
          isPublic: false,
        })
      } else {
        reset({
          name: '',
          icon: 'Folder',
          color: '#8b5cf6',
          groupId: groups[0]?.id || '',
          parentId: undefined,
          viewMode: 'list',
          isPublic: false,
        })
      }
      setIconSearch('')
    }
  }, [open, collection, groups, reset, setIconSearch])
}

const CollectionDialog = React.memo(function CollectionDialog({
  open,
  onOpenChange,
  groups,
  collection,
  onSave,
}: CollectionDialogProps) {
  const isEditing = !!collection
  const [iconSearch, setIconSearch] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      name: '',
      icon: 'Folder',
      color: '#8b5cf6',
      groupId: groups[0]?.id || '',
      parentId: undefined,
      viewMode: 'list',
      isPublic: false,
    },
  })

  // useWatch (not watch()) keeps the component eligible for React Compiler memoization
  const selectedColor = useWatch({ control, name: 'color' })
  const selectedIcon = useWatch({ control, name: 'icon' })
  const selectedGroupId = useWatch({ control, name: 'groupId' })
  const isPublic = useWatch({ control, name: 'isPublic' })
  const selectedParentId = useWatch({ control, name: 'parentId' })
  const selectedViewMode = useWatch({ control, name: 'viewMode' })

  useCollectionFormReset(open, collection, groups, reset, setIconSearch)

  const handleGroupChange = useCallback(
    (val: string) => setValue('groupId', val),
    [setValue],
  )
  const handleParentChange = useCallback(
    (id: string) => setValue('parentId', id || undefined),
    [setValue],
  )
  const handleIconSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setIconSearch(e.target.value),
    [],
  )
  const handleViewModeChange = useCallback(
    (val: string) =>
      setValue('viewMode', val as 'list' | 'grid' | 'table' | 'directory'),
    [setValue],
  )
  const handlePublicChange = useCallback(
    (checked: boolean) => setValue('isPublic', checked),
    [setValue],
  )
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange])

  const filteredIcons = useMemo(() => {
    if (!iconSearch) return ICON_OPTIONS
    const lower = iconSearch.toLowerCase()
    return ICON_OPTIONS.filter((icon) => icon.toLowerCase().includes(lower))
  }, [iconSearch])

  const onSubmit = (data: CollectionFormValues) => {
    onSave({
      ...data,
      id: collection?.id,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Collection' : 'Create Collection'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update collection settings and appearance.'
                : 'Create a new collection to organize your bookmarks.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="collection-name">Name</Label>
              <Input
                id="collection-name"
                placeholder="e.g., Frontend Resources, Reading List..."
                {...register('name')}
                autoFocus
              />
              {errors.name && (
                <p className="text-destructive text-sm">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Group Selector */}
            <div className="grid gap-2">
              <Label htmlFor="collection-group">Group</Label>
              <Select value={selectedGroupId} onValueChange={handleGroupChange}>
                <SelectTrigger id="collection-group">
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.groupId && (
                <p className="text-destructive text-sm">
                  {errors.groupId.message}
                </p>
              )}
            </div>

            {/* Parent Collection */}
            <div className="grid gap-2">
              <Label>Parent Collection</Label>
              <CollectionSelector
                groups={groups}
                value={selectedParentId}
                onChange={handleParentChange}
                placeholder="None (root level)"
                allowNone
              />
            </div>

            {/* Color Picker */}
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="h-7 w-7 rounded-md border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor:
                        selectedColor === color
                          ? 'var(--color-foreground)'
                          : 'transparent',
                    }}
                    onClick={() => setValue('color', color)}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            {/* Icon Picker */}
            <div className="grid gap-2">
              <Label>Icon</Label>
              <Input
                placeholder="Search icons..."
                value={iconSearch}
                onChange={handleIconSearchChange}
                className="h-8"
              />
              <ScrollArea className="h-[120px]">
                <div className="grid grid-cols-6 gap-1">
                  {filteredIcons.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      className={`hover:bg-accent flex h-10 w-full items-center justify-center rounded-md text-xs transition-colors ${
                        selectedIcon === icon
                          ? 'bg-accent ring-primary ring-2'
                          : ''
                      }`}
                      onClick={() => setValue('icon', icon)}
                      title={icon}
                    >
                      <span className="truncate px-1 text-[10px]">{icon}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* View Preference */}
            <div className="grid gap-2">
              <Label htmlFor="collection-view">Default View</Label>
              <Select
                value={selectedViewMode}
                onValueChange={handleViewModeChange}
              >
                <SelectTrigger id="collection-view">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">List</SelectItem>
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="table">Table</SelectItem>
                  <SelectItem value="directory">Directory</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Public Toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="grid gap-1">
                <Label htmlFor="collection-public">Public</Label>
                <p className="text-muted-foreground text-xs">
                  Allow others to view this collection
                </p>
              </div>
              <Switch
                id="collection-public"
                checked={isPublic}
                onCheckedChange={handlePublicChange}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEditing ? 'Save Changes' : 'Create Collection'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
})
export { CollectionDialog }
export default CollectionDialog
