import { z } from 'zod'

/** Shared editable content validation for the creation dialog and detail editor. */
export const bookmarkContentSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
  description: z.string().optional(),
  type: z.enum(['link', 'article', 'image', 'video', 'document', 'audio']),
  notes: z.string().optional(),
  isImportant: z.boolean(),
  tags: z.array(z.string()),
})
