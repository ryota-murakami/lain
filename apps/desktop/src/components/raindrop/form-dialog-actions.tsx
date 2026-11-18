import { memo } from 'react'

import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'

/**
 * Disable dismissal and duplicate submission while an editor saves its form.
 * Bookmark and collection dialogs render this inside their submitting form.
 * @example
 * <FormDialogActions pending={isSubmitting} onCancel={close} submitLabel="Save Changes" />
 */
export const FormDialogActions = memo(function FormDialogActions({
  pending,
  onCancel,
  submitLabel,
}: {
  pending: boolean
  onCancel: () => void
  submitLabel: string
}) {
  return (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={pending}
      >
        Cancel
      </Button>
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </DialogFooter>
  )
})
