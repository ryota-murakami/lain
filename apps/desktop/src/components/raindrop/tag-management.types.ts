/**
 * A tag entry with its name and usage count across all raindrops.
 */
export interface TagEntry {
  name: string
  count: number
}

/**
 * Props for the TagManagement component.
 */
export interface TagManagementProps {
  /** List of all tags with usage counts */
  tags: TagEntry[]
  /** Whether the management panel is open */
  open: boolean
  /** Callback to toggle panel visibility */
  onOpenChange: (open: boolean) => void
  /** Callback when a tag is renamed */
  onRename?: (oldName: string, newName: string) => Promise<void>
  /** Callback when tags are merged */
  onMerge?: (sourceNames: string[], targetName: string) => Promise<void>
  /** Callback when a tag is deleted */
  onDelete?: (tagName: string) => Promise<void>
}
