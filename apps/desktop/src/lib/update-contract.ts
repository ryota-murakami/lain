/** Stable update state shared by Electron, preload and the Settings UI. */
export interface UpdateState {
  phase:
    | 'idle'
    | 'checking'
    | 'current'
    | 'available'
    | 'downloading'
    | 'ready'
    | 'installing'
    | 'error'
    | 'unavailable'
  mode: 'in-app' | 'manual' | 'development'
  currentVersion: string
  availableVersion: string | null
  progress: { percent: number; transferred: number; total: number } | null
  checkedAt: string | null
  error: string | null
}

/** The preload exposes only deliberate update operations, never arbitrary feeds or paths. */
export interface UpdateApi {
  getState: () => Promise<UpdateState>
  check: () => Promise<UpdateState>
  download: () => Promise<UpdateState>
  install: () => Promise<UpdateState>
  onStateChanged: (listener: (state: UpdateState) => void) => () => void
}

export const UPDATE_CHANNELS = {
  state: 'updates:state',
  getState: 'updates:get-state',
  check: 'updates:check',
  download: 'updates:download',
  install: 'updates:install',
} as const
