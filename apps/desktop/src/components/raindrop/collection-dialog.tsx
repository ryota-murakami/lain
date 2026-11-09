import { zodResolver } from '@hookform/resolvers/zod'
import React, {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { CollectionSelector } from '@/components/raindrop/collection-selector'
import { ColorPicker } from '@/components/raindrop/color-picker'
import { IconPicker } from '@/components/raindrop/icon-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { usePendingWork } from '@/hooks/usePendingWork'
import type { Collection, Group } from '@/lib/types'
import { findCollectionInTree } from '@/utils/find-collection-in-tree'

import { FormDialogActions } from './form-dialog-actions'

const collectionSchema = z.object({
  name: z.string().min(1, 'Collection name is required'),
  icon: z.string(),
  color: z.string(),
  groupId: z.string().min(1, 'Group is required'),
  parentId: z.string().optional(),
  viewMode: z.enum(['list', 'grid', 'table', 'directory']),
  isPublic: z.boolean(),
})

export type CollectionFormValues = z.infer<typeof collectionSchema>

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
  /** Real group from the creation entry point; ignored when editing. */
  initialGroupId?: string
  /** Persisted Lain view preference supplied by the dialog owner. */
  defaultViewMode?: CollectionFormValues['viewMode']
  /** Callback when user saves the collection */
  onSave: (data: CollectionFormValues & { id?: string }) => Promise<void> | void
}

/**
 * Select a real group for a new collection without persisting a synthetic destination.
 * {@link useCollectionEditor} and {@link useCollectionFormReset} capture this at form creation.
 * @param initialGroupId - Optional group supplied by the sidebar's Add Collection action.
 * @returns The requested real group, the first real group, or an empty selection.
 * @example
 * resolveInitialCollectionGroupId(groups, 'work')
 */
function resolveInitialCollectionGroupId(
  groups: Group[],
  initialGroupId?: string,
): string {
  const realGroups = groups.filter((group) => group.id !== 'ungrouped')
  return (
    realGroups.find((group) => group.id === initialGroupId)?.id ??
    realGroups[0]?.id ??
    ''
  )
}

/**
 * Initialize a new collection editing session without reacting to background group refreshes.
 * {@link CollectionDialog} calls this on open or edited-ID changes.
 * @param defaultViewMode - Existing local preference captured at the session boundary.
 * @example
 * useCollectionFormReset(open, collection, groups, reset, defaultViewMode)
 */
function useCollectionFormReset(
  open: boolean,
  collection: Collection | undefined,
  groups: Group[],
  reset: (values: CollectionFormValues) => void,
  defaultViewMode: CollectionFormValues['viewMode'],
  initialGroupId?: string,
): void {
  const onSessionStart = useEffectEvent(() => {
    // Capture current defaults at a session boundary without reacting to background refreshes.
    if (collection) {
      reset({
        name: collection.name,
        icon: collection.icon || 'Folder',
        color: collection.color || '#8b5cf6',
        groupId: collection.groupId,
        parentId: collection.parentId || undefined,
        viewMode: defaultViewMode,
        isPublic: collection.isPublic ?? false,
      })
    } else {
      reset({
        name: '',
        icon: 'Folder',
        color: '#8b5cf6',
        groupId: resolveInitialCollectionGroupId(groups, initialGroupId),
        parentId: undefined,
        viewMode: defaultViewMode,
        isPublic: false,
      })
    }
  })

  useEffect(() => {
    if (open) onSessionStart()
  }, [open, collection?.id, reset])
}

/**
 * Preserve an already-created ID when a later organization operation fails.
 * {@link CollectionDialog} uses this to retry without creating a duplicate, then resets it on reopening.
 * @param id - Existing collection ID when editing rather than creating.
 * @returns The retry ID and its setter for a partial-success error.
 * @example
 * const [createdId, setCreatedId] = useRetainedCollectionId(open, collection?.id)
 */
function useRetainedCollectionId(open: boolean, id?: string) {
  const [createdId, setCreatedId] = useState(id)
  const [session, setSession] = useState({ open, id })
  // Reset the retry ID at the dialog boundary before rendering a new form session.
  if (session.open !== open || session.id !== id) {
    setSession({ open, id })
    if (open) setCreatedId(id)
  }
  return [createdId, setCreatedId] as const
}

/**
 * Remove an edited collection's whole branch from potential parent choices.
 * {@link CollectionDialog} uses this for every group to prevent self/descendant cycles.
 * @param excludedId - The collection being edited; undefined leaves all choices available.
 * @returns A copied tree that omits the forbidden branch at any nesting depth.
 * @example
 * excludeCollectionBranch(group.collections, editingCollection.id)
 */
function excludeCollectionBranch(
  collections: Collection[],
  excludedId?: string,
): Collection[] {
  // Removing the branch root also removes every descendant from the searchable tree.
  return collections
    .filter((item) => item.id !== excludedId)
    .map((item) => ({
      ...item,
      children: item.children
        ? excludeCollectionBranch(item.children, excludedId)
        : undefined,
    }))
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
 * Mark custom collection controls dirty and keep a nested collection in its parent's group.
 * Called by {@link useCollectionEditor} for the shared color/icon/parent selectors.
 * @example
 * const fields = useCollectionFieldActions(setValue, groups)
 */
function useCollectionFieldActions(
  setValue: ReturnType<typeof useForm<CollectionFormValues>>['setValue'],
  groups: Group[],
) {
  const handleGroupChange = useCallback(
    (val: string) => setValue('groupId', val, { shouldDirty: true }),
    [setValue],
  )
  const handleParentChange = useCallback(
    (id: string) => {
      setValue('parentId', id || undefined, { shouldDirty: true })
      const group = groups.find((item) =>
        findCollectionInTree(item.collections, id),
      )
      if (group) setValue('groupId', group.id, { shouldDirty: true })
    },
    [groups, setValue],
  )
  const handleColorChange = useCallback(
    (color: string) => setValue('color', color, { shouldDirty: true }),
    [setValue],
  )
  const handleIconChange = useCallback(
    (icon: string) => setValue('icon', icon, { shouldDirty: true }),
    [setValue],
  )
  const handleViewModeChange = useCallback(
    (val: string) =>
      setValue('viewMode', val as CollectionFormValues['viewMode'], {
        shouldDirty: true,
      }),
    [setValue],
  )
  const handlePublicChange = useCallback(
    (checked: boolean) => setValue('isPublic', checked, { shouldDirty: true }),
    [setValue],
  )
  return {
    handleGroupChange,
    handleParentChange,
    handleColorChange,
    handleIconChange,
    handleViewModeChange,
    handlePublicChange,
  }
}

/**
 * Own one collection form session, including dirty tracking and safe retry after partial creation.
 * Called by {@link CollectionDialog}; background group refreshes never reset a user's input.
 * @example
 * const editor = useCollectionEditor(props)
 */
function useCollectionEditor({
  open,
  onOpenChange,
  groups,
  collection,
  initialGroupId,
  defaultViewMode = 'list',
  onSave,
}: CollectionDialogProps) {
  const isEditing = !!collection

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    setError,
    clearErrors,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      name: '',
      icon: 'Folder',
      color: '#8b5cf6',
      groupId: resolveInitialCollectionGroupId(groups, initialGroupId),
      parentId: undefined,
      viewMode: defaultViewMode,
      isPublic: false,
    },
  })

  // Subscribe to related controlled fields as one typed tuple.
  const [
    selectedColor,
    selectedIcon,
    selectedGroupId,
    isPublic,
    selectedParentId,
    selectedViewMode,
  ] = useWatch({
    control,
    name: [
      'color',
      'icon',
      'groupId',
      'isPublic',
      'parentId',
      'viewMode',
    ] as const,
  })
  const parentGroup = groups.find((group) =>
    findCollectionInTree(group.collections, selectedParentId ?? ''),
  )
  const parentChoices = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        collections: excludeCollectionBranch(group.collections, collection?.id),
      })),
    [groups, collection?.id],
  )

  usePendingWork(open && (isDirty || isSubmitting))

  useCollectionFormReset(
    open,
    collection,
    groups,
    reset,
    defaultViewMode,
    initialGroupId,
  )

  const {
    handleGroupChange,
    handleParentChange,
    handleColorChange,
    handleIconChange,
    handleViewModeChange,
    handlePublicChange,
  } = useCollectionFieldActions(setValue, groups)

  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange])

  const [createdId, setCreatedId] = useRetainedCollectionId(
    open,
    collection?.id,
  )
  const onSubmit = async (data: CollectionFormValues): Promise<void> => {
    clearErrors('root.server')
    try {
      await onSave({
        ...data,
        groupId: parentGroup?.id ?? data.groupId,
        id: createdId,
      })
      onOpenChange(false)
    } catch (error) {
      // Retain a created ID when the subsequent organization step needs a retry.
      if (
        error instanceof Error &&
        'collectionId' in error &&
        typeof error.collectionId === 'string'
      )
        setCreatedId(error.collectionId)
      setError('root.server', {
        message:
          'Could not finish saving the collection. Your input is preserved; try again.',
      })
    }
  }

  const handleDialogOpenChange = useCallback(
    (next: boolean): void => {
      if (!isSubmitting) onOpenChange(next)
    },
    [isSubmitting, onOpenChange],
  )

  return {
    isEditing,
    register,
    handleSubmit,
    errors,
    isSubmitting,
    selectedColor,
    selectedIcon,
    selectedGroupId,
    isPublic,
    selectedParentId,
    selectedViewMode,
    parentGroup,
    parentChoices,
    handleGroupChange,
    handleParentChange,
    handleColorChange,
    handleIconChange,
    handleViewModeChange,
    handlePublicChange,
    handleCancel,
    onSubmit,
    handleDialogOpenChange,
  }
}

const CollectionDialog = React.memo(function CollectionDialog({
  open,
  onOpenChange,
  groups,
  collection,
  initialGroupId,
  defaultViewMode = 'list',
  onSave,
}: CollectionDialogProps) {
  const {
    isEditing,
    register,
    handleSubmit,
    errors,
    isSubmitting,
    selectedColor,
    selectedIcon,
    selectedGroupId,
    isPublic,
    selectedParentId,
    selectedViewMode,
    parentGroup,
    parentChoices,
    handleGroupChange,
    handleParentChange,
    handleColorChange,
    handleIconChange,
    handleViewModeChange,
    handlePublicChange,
    handleCancel,
    onSubmit,
    handleDialogOpenChange,
  } = useCollectionEditor({
    open,
    onOpenChange,
    groups,
    collection,
    initialGroupId,
    defaultViewMode,
    onSave,
  })

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
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
              <Select
                value={parentGroup?.id ?? selectedGroupId}
                onValueChange={handleGroupChange}
                disabled={Boolean(selectedParentId)}
              >
                <SelectTrigger id="collection-group">
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups
                    .filter((group) => group.id !== 'ungrouped')
                    .map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedParentId && (
                <p className="text-muted-foreground text-xs">
                  Nested collections use their parent’s group. Choose None below
                  to move this collection to a root group.
                </p>
              )}
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
                groups={parentChoices}
                value={selectedParentId}
                onChange={handleParentChange}
                placeholder="None (root level)"
                allowNone
              />
            </div>

            <ColorPicker
              value={selectedColor}
              onChange={handleColorChange}
              label="Color (this Lain account on this device)"
              disabled={isSubmitting}
            />
            <IconPicker
              value={selectedIcon}
              onChange={handleIconChange}
              label="Icon (this Lain account on this device)"
              disabled={isSubmitting}
            />

            {/* View Preference */}
            <div className="grid gap-2">
              <Label htmlFor="collection-view">Default View (Lain only)</Label>
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

          {errors.root?.server && (
            <p role="alert" className="text-destructive text-sm">
              {errors.root.server.message}
            </p>
          )}
          <FormDialogActions
            pending={isSubmitting}
            onCancel={handleCancel}
            submitLabel={isEditing ? 'Save Changes' : 'Create Collection'}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
})
export { CollectionDialog }
