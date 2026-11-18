import type { UpdateState } from './update-contract'

interface UpdateBackend {
  check: () => Promise<void>
  download: () => Promise<void>
  install: () => Promise<boolean>
}

type UpdateEvent =
  | { type: 'available'; version: string }
  | { type: 'current' }
  | { type: 'progress'; percent: number; transferred: number; total: number }
  | { type: 'ready'; version: string }
  | { type: 'error' }

/**
 * Keep invalid native progress values from reaching accessibility and progress UI.
 * Called when the native updater emits a download-progress event.
 * @returns A finite non-negative value bounded by the requested maximum.
 * @example
 * normalizeProgress(Number.NaN, 100) // 0
 */
function normalizeProgress(
  value: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(0, value)) : 0
}

/**
 * Own one update operation and its state, independent of Electron for regression tests.
 * Created once by the main process; native events and IPC actions share this instance.
 * @param options - Installed version, distribution capabilities, native operations and state publisher.
 * @returns Snapshot, event receiver and deduplicated check/download/install operations.
 * @example
 * const updates = createUpdateController({ version: '0.1.1', mode: 'in-app', backend, publish })
 * await updates.check()
 */
export function createUpdateController(options: {
  version: string
  mode: UpdateState['mode']
  backend: UpdateBackend
  publish: (state: UpdateState) => void
}) {
  let state: UpdateState = {
    phase: options.mode === 'development' ? 'unavailable' : 'idle',
    mode: options.mode,
    currentVersion: options.version,
    availableVersion: null,
    progress: null,
    checkedAt: null,
    error: null,
  }
  let pending: Promise<UpdateState> | null = null

  /** Publish immutable snapshots so React's external store can compare by identity. @example patch({ phase: 'checking' }) */
  function patch(change: Partial<UpdateState>): UpdateState {
    state = { ...state, ...change }
    options.publish(state)
    return state
  }

  /** Preserve an already verified download when a later event fails. @example fail() */
  function fail(): UpdateState {
    return patch({
      phase:
        state.phase === 'ready' || state.phase === 'installing'
          ? 'ready'
          : 'error',
      error:
        'The update could not finish. Check your connection and try again.',
    })
  }

  /** Translate native updater events without clearing a ready download during a late check. @example receive({ type: 'available', version: '0.2.0' }) */
  function receive(event: UpdateEvent): void {
    if (event.type === 'error') {
      fail()
      return
    }
    if (state.phase === 'ready' || state.phase === 'installing') return
    switch (event.type) {
      case 'available':
        patch({
          phase: 'available',
          availableVersion: event.version,
          error: null,
          checkedAt: new Date().toISOString(),
        })
        break
      case 'current':
        patch({
          phase: 'current',
          availableVersion: null,
          checkedAt: new Date().toISOString(),
          error: null,
        })
        break
      case 'progress':
        patch({
          phase: 'downloading',
          progress: {
            percent: normalizeProgress(event.percent, 100),
            transferred: normalizeProgress(event.transferred),
            total: normalizeProgress(event.total),
          },
        })
        break
      case 'ready':
        patch({
          phase: 'ready',
          availableVersion: event.version,
          progress: null,
          error: null,
        })
        break
    }
  }

  /** Serialize user and timer operations; errors become retryable state. @example run(async () => backend.check()) */
  async function run(operation: () => Promise<void>): Promise<UpdateState> {
    if (pending) return pending
    pending = operation()
      .then(() => state)
      .catch(fail)
      .finally(() => {
        pending = null
      })
    return pending
  }

  /** Check on request or periodic wake without replacing an active or ready download. @example await check() */
  async function check(): Promise<UpdateState> {
    if (pending) return pending
    if (
      state.mode === 'development' ||
      state.phase === 'ready' ||
      state.phase === 'installing'
    )
      return Promise.resolve(state)
    return run(async () => {
      patch({ phase: 'checking', error: null, progress: null })
      await options.backend.check()
      if (state.phase === 'checking') receive({ type: 'current' })
    })
  }

  /** Download only after explicit consent; manual distributions open their package page. @example await download() */
  async function download(): Promise<UpdateState> {
    if (pending) return pending
    if (
      (!state.availableVersion && state.mode !== 'manual') ||
      state.phase === 'ready' ||
      state.mode === 'development'
    )
      return Promise.resolve(state)
    return run(async () => {
      patch({
        phase: state.mode === 'manual' ? 'available' : 'downloading',
        error: null,
      })
      await options.backend.download()
    })
  }

  /** Install a ready package only after the native confirmation accepts a restart. @example await install() */
  async function install(): Promise<UpdateState> {
    if (pending) return pending
    if (state.phase !== 'ready' || state.mode !== 'in-app')
      return Promise.resolve(state)
    return run(async () => {
      patch({ phase: 'installing', error: null })
      if (!(await options.backend.install())) patch({ phase: 'ready' })
    })
  }

  return { getState: () => state, receive, check, download, install }
}
