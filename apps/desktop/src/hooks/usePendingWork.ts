import { useEffect, useId, useSyncExternalStore } from 'react'

const pending = new Set<string>()
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return (): void => {
    listeners.delete(listener)
  }
}
const getSnapshot = () => pending.size > 0

/**
 * Register unsaved edits or an active transfer so update installation cannot interrupt it.
 * Forms and transfer dialogs call this with their current dirty/busy state; unmount clears their registration.
 * @example usePendingWork(isDirty || isSubmitting)
 */
export function usePendingWork(active: boolean): void {
  const id = useId()
  useEffect(() => {
    if (!active) return
    pending.add(id)
    listeners.forEach((listener) => listener())
    return (): void => {
      pending.delete(id)
      listeners.forEach((listener) => listener())
    }
  }, [active, id])
}

/** Subscribe Settings and window lifecycle protection to the shared dirty/transfer registry. */
export function useHasPendingWork(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
