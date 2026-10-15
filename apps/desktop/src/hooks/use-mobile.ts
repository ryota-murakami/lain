import { useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 768

/**
 * Subscribe to viewport width changes via matchMedia.
 * @param callback - Invoked when viewport crosses the mobile breakpoint
 * @returns Cleanup function to remove the listener
 */
function subscribeMobileQuery(callback: () => void): () => void {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

/**
 * Get the current mobile state from the viewport width.
 * @returns true if viewport is below the mobile breakpoint
 */
function getMobileSnapshot(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT
}

/**
 * Server-side fallback — assume desktop.
 * @returns false (non-mobile default for SSR)
 */
function getMobileServerSnapshot(): boolean {
  return false
}

/**
 * Detect whether the viewport is below the mobile breakpoint (768px).
 * Uses useSyncExternalStore for tear-free concurrent mode support.
 *
 * @returns true if the viewport width is below 768px
 * @example
 *   const isMobile = useIsMobile()
 *   if (isMobile) return <MobileLayout />
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMobileQuery,
    getMobileSnapshot,
    getMobileServerSnapshot,
  )
}
