export const DND_TYPES = {
  RAINDROP: 'raindrop',
  COLLECTION: 'collection',
  GROUP: 'group',
} as const

export const DND_DELAYS = {
  DRAG_START: 150,
} as const

export interface DragItem {
  type: string
  id: string
  data: unknown
  count?: number
}

export interface DropResult {
  targetId: string
  targetType: string
  dropPosition?: 'before' | 'after' | 'inside'
}
