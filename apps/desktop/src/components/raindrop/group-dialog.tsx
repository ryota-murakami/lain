import { zodResolver } from '@hookform/resolvers/zod'
import React, { useEffect, useCallback } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

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
import { Switch } from '@/components/ui/switch'
import { usePendingWork } from '@/hooks/usePendingWork'
import type { Group } from '@/lib/types'

const groupSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
  collapsed: z.boolean(),
})

export type GroupFormValues = z.infer<typeof groupSchema>

/**
 * Props for GroupDialog component.
 */
interface GroupDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback to change open state */
  onOpenChange: (open: boolean) => void
  /** Existing group to edit (undefined for create mode) */
  group?: Group
  /** Callback when user saves the group */
  onSave: (data: GroupFormValues & { id?: string }) => Promise<void> | void
}

/**
 * Dialog for creating or editing a group.
 * Groups are top-level organizational containers for collections.
 *
 * @param open - Controls dialog visibility
 * @param onOpenChange - Callback when dialog open state changes
 * @param group - If provided, dialog enters edit mode with pre-filled values
 * @param onSave - Callback with form data on save
 *
 * @example
 *   <GroupDialog
 *     open={isOpen}
 *     onOpenChange={setIsOpen}
 *     group={editingGroup}
 *     onSave={(data) => console.log("Save group:", data)}
 *   />
 */
/**
 * Reset form state when the dialog opens or the group changes.
 * @param open - Whether dialog is open
 * @param group - Group to edit (if any)
 * @param reset - react-hook-form reset function
 */
function useGroupFormReset(
  open: boolean,
  group: Group | undefined,
  reset: (values: GroupFormValues) => void,
): void {
  useEffect(() => {
    if (open) {
      if (group) {
        reset({
          name: group.name,
          collapsed: group.hidden ?? false,
        })
      } else {
        reset({
          name: '',
          collapsed: false,
        })
      }
    }
  }, [open, group, reset])
}

const GroupDialog = React.memo(function GroupDialog({
  open,
  onOpenChange,
  group,
  onSave,
}: GroupDialogProps) {
  const isEditing = !!group

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    setError,
    clearErrors,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: '',
      collapsed: false,
    },
  })

  // useWatch (not watch()) keeps the component eligible for React Compiler memoization
  const collapsed = useWatch({ control, name: 'collapsed' })

  usePendingWork(open && (isDirty || isSubmitting))

  useGroupFormReset(open, group, reset)

  const handleCollapsedChange = useCallback(
    (checked: boolean) => setValue('collapsed', checked),
    [setValue],
  )
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange])

  const onSubmit = async (data: GroupFormValues): Promise<void> => {
    clearErrors('root.server')
    try {
      await onSave({ ...data, id: group?.id })
      onOpenChange(false)
    } catch {
      setError('root.server', {
        message:
          'Could not save the group. Your input is preserved; try again.',
      })
    }
  }

  const handleDialogOpenChange = useCallback(
    (next: boolean): void => {
      if (!isSubmitting) onOpenChange(next)
    },
    [isSubmitting, onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Group' : 'Create Group'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the group name and settings.'
                : 'Create a new group to organize your collections.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                placeholder="e.g., Work, Personal, Research..."
                {...register('name')}
                autoFocus
              />
              {errors.name && (
                <p className="text-destructive text-sm">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="grid gap-1">
                <Label htmlFor="group-collapsed">Collapsed by default</Label>
                <p className="text-muted-foreground text-xs">
                  Group will start collapsed in the sidebar
                </p>
              </div>
              <Switch
                id="group-collapsed"
                checked={collapsed}
                onCheckedChange={handleCollapsedChange}
              />
            </div>
          </div>

          {errors.root?.server && (
            <p role="alert" className="text-destructive text-sm">
              {errors.root.server.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEditing ? 'Save Changes' : 'Create Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
})
export { GroupDialog }
