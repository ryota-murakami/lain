import { useMemo, useSyncExternalStore } from 'react'

import type { UpdateApi, UpdateState } from '@/lib/update-contract'

const unavailable: UpdateState = {
  phase: 'unavailable',
  mode: 'development',
  currentVersion: 'Development',
  availableVersion: null,
  progress: null,
  checkedAt: null,
  error: null,
}

/**
 * Bridge native updater events to React with one listener per preload API.
 * Called by {@link useAppUpdates}; subscriptions refresh state after an unmount/remount.
 * @returns A synchronous snapshot store that ignores stale initial IPC reads.
 * @example
 * const store = createUpdateStore(window.updates)
 */
function createUpdateStore(api?: UpdateApi) {
  let snapshot = unavailable
  let revision = 0
  let unsubscribe: (() => void) | undefined
  const listeners = new Set<() => void>()
  const publish = (state: UpdateState): void => {
    revision += 1
    snapshot = state
    for (const listener of listeners) listener()
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      if (api && listeners.size === 1) {
        unsubscribe = api.onStateChanged(publish)
        const initialRevision = revision
        void api
          .getState()
          .then((state) => {
            // An event that arrived while IPC was pending has a newer snapshot.
            if (revision === initialRevision && listeners.size) publish(state)
          })
          .catch(() => {
            if (revision === initialRevision && listeners.size)
              publish({
                ...snapshot,
                phase: 'error',
                error: 'Update status is unavailable. Try again.',
              })
          })
      }
      return (): void => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          revision += 1
          unsubscribe?.()
          unsubscribe = undefined
        }
      }
    },
  }
}

const stores = new WeakMap<UpdateApi, ReturnType<typeof createUpdateStore>>()
const fallback = createUpdateStore()

/**
 * Observe the main process update state without polling or duplicate React state.
 * Settings calls this for the preload API; tests may provide an isolated API.
 * @returns Current immutable update snapshot.
 * @example
 * const state = useAppUpdates(window.updates)
 */
export function useAppUpdates(api?: UpdateApi): UpdateState {
  const store = useMemo(() => {
    if (!api) return fallback
    let current = stores.get(api)
    if (!current) {
      current = createUpdateStore(api)
      stores.set(api, current)
    }
    return current
  }, [api])
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => unavailable,
  )
}
