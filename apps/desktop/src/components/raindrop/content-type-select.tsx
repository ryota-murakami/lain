import { memo } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { bookmarkContentSchema } from '@/lib/bookmark-form-schema'
import type { ContentType } from '@/lib/types'

import { ContentTypeIcon } from './content-type-icon'

/**
 * Keep bookmark creation and detail editing on the same supported content types.
 * The editor supplies a label target and commits changes through its form controller.
 * @example
 * <ContentTypeSelect id="bookmark-type" value="link" onValueChange={changeType} />
 */
export const ContentTypeSelect = memo(function ContentTypeSelect({
  id,
  value,
  onValueChange,
}: {
  id: string
  value: ContentType
  onValueChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {bookmarkContentSchema.shape.type.options.map((type) => (
          <SelectItem key={type} value={type}>
            <div className="flex items-center gap-2">
              <ContentTypeIcon type={type} className="h-4 w-4" />
              <span className="capitalize">{type}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
})
