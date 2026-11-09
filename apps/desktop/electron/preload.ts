import { contextBridge, ipcRenderer } from 'electron'

import type { DesktopApi } from '../src/lib/desktop-contract.ts'
import type { AuthState } from '../src/lib/types.ts'
import {
  UPDATE_CHANNELS,
  type UpdateApi,
  type UpdateState,
} from '../src/lib/update-contract.ts'

/**
 * Preload script that bridges main process auth operations to the renderer.
 * Exposes a minimal, typed API via contextBridge — never raw ipcRenderer.
 *
 * @example
 *   // In renderer process:
 *   await window.auth.login()
 *   const user = await window.auth.getUser()
 *   const cleanup = window.auth.onAuthStateChanged((state) => {
 *     console.log(state.isAuthenticated)
 *   })
 *   // Later: cleanup() to remove listener
 */
contextBridge.exposeInMainWorld('shell', {
  /** Open a URL in the user's default browser. */
  openExternal: async (url: string): Promise<void> =>
    ipcRenderer.invoke('shell:open-external', url),
})

contextBridge.exposeInMainWorld('auth', {
  /** Initiate OAuth login flow (opens Raindrop.io auth window). */
  login: async (): Promise<void> => ipcRenderer.invoke('auth:login'),

  /** Clear stored tokens and sign out. */
  logout: async (): Promise<void> => ipcRenderer.invoke('auth:logout'),

  /** Fetch the authenticated user's Raindrop.io profile. */
  getUser: async () => ipcRenderer.invoke('auth:get-user'),

  /** Get current authentication state (isAuthenticated + user). */
  getState: async () => ipcRenderer.invoke('auth:get-state'),

  /** Get a valid access token, auto-refreshing if expired. */
  getToken: async (): Promise<string> => ipcRenderer.invoke('auth:get-token'),

  /**
   * Subscribe to auth state changes pushed from the main process.
   * @param callback - Called when auth state changes (login/logout)
   * @returns Cleanup function to unsubscribe
   */
  onAuthStateChanged: (callback: (state: AuthState) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      state: AuthState,
    ): void => callback(state)
    ipcRenderer.on('auth:state-changed', handler)
    return (): void => {
      ipcRenderer.removeListener('auth:state-changed', handler)
    }
  },
})

contextBridge.exposeInMainWorld('desktop', {
  getCapabilities: async () => ipcRenderer.invoke('desktop:capabilities'),
  saveExport: async (data) => ipcRenderer.invoke('desktop:save-export', data),
  selectIcon: async (id) => ipcRenderer.invoke('desktop:select-icon', id),
} satisfies DesktopApi)

contextBridge.exposeInMainWorld('updates', {
  getState: async () => ipcRenderer.invoke(UPDATE_CHANNELS.getState),
  check: async () => ipcRenderer.invoke(UPDATE_CHANNELS.check),
  download: async () => ipcRenderer.invoke(UPDATE_CHANNELS.download),
  install: async () => ipcRenderer.invoke(UPDATE_CHANNELS.install),
  onStateChanged: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      state: UpdateState,
    ): void => listener(state)
    ipcRenderer.on(UPDATE_CHANNELS.state, handler)
    return () => ipcRenderer.removeListener(UPDATE_CHANNELS.state, handler)
  },
} satisfies UpdateApi)
