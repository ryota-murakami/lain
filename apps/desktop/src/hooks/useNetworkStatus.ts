import { useSyncExternalStore } from 'react'

/** Subscribe to browser connectivity changes for query polling and transfer controls. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return (): void => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/**
 * Read connectivity without duplicating state; used by {@link useSidebarData} to pause background polling.
 * @returns Whether the browser currently reports a network connection (not a server health guarantee).
 * @example const online = useNetworkStatus()
 */
export function useNetworkStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
}
