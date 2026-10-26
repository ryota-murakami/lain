import React from 'react'

import { cn } from '@/lib/utils'

/**
 * Props for the drop indicator line.
 */
interface DropIndicatorProps {
  /** Position relative to a sibling row. */
  position?: 'before' | 'after' | 'inside'
  /** Whether the indicator is active. */
  isActive?: boolean
  /** Optional test selector for E2E. */
  'data-testid'?: string
}

/**
 * Visual insertion marker shown while dragging collections.
 * @param position - Drop position around the row
 * @param isActive - Indicator visibility flag
 * @returns Indicator line when active, otherwise null
 * @example
 *   <DropIndicator position="before" isActive />
 */
const DropIndicator = React.memo(function DropIndicator({
  position = 'before',
  isActive = false,
  'data-testid': dataTestId,
}: DropIndicatorProps) {
  if (!isActive) return null

  return (
    <div
      data-testid={dataTestId}
      className={cn(
        'pointer-events-none relative h-2',
        position === 'before' && '-mt-1 mb-0.5',
        position === 'after' && 'mt-0.5 mb-0',
        position === 'inside' && 'my-0.5',
      )}
      aria-hidden
    >
      <span className="bg-primary absolute top-1/2 right-2 left-5 h-0.5 -translate-y-1/2 rounded-full" />
      <span className="bg-primary absolute top-1/2 left-3 h-1.5 w-1.5 -translate-y-1/2 rounded-full" />
    </div>
  )
})

export { DropIndicator }
export default DropIndicator
