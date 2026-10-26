import { ipcMain, type BrowserWindow } from 'electron'

import type { AuthState, RaindropUser } from '../src/lib/types.ts'

/**
 * Mock user returned by all auth handlers in test mode.
 * Uses _id: 99999 to be clearly distinguishable from real users.
 */
const MOCK_USER: RaindropUser = {
  _id: 99999,
  fullName: 'Test User',
  email: 'test@lain.app',
  avatar: '',
  pro: false,
}

const MOCK_AUTH_STATE: AuthState = {
  isAuthenticated: true,
  user: MOCK_USER,
}

const MOCK_TOKEN = 'test-token-for-e2e'

/**
 * Register mock IPC auth handlers that always return authenticated state.
 * Replaces the real registerAuthIPC() when LAIN_TEST_MODE=1.
 *
 * @param getMainWindow - Getter for the main window (for state-changed events)
 * @example
 *   // In main.ts (test mode branch)
 *   registerTestAuthIPC(() => mainWindow)
 */
export function registerTestAuthIPC(
  getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle('auth:login', async () => {
    const win = getMainWindow()
    win?.webContents.send('auth:state-changed', MOCK_AUTH_STATE)
  })

  ipcMain.handle('auth:logout', async () => {
    const state: AuthState = { isAuthenticated: false, user: null }
    const win = getMainWindow()
    win?.webContents.send('auth:state-changed', state)
  })

  ipcMain.handle('auth:get-user', async () => MOCK_USER)

  ipcMain.handle('auth:get-state', async () => MOCK_AUTH_STATE)

  ipcMain.handle('auth:get-token', async () => MOCK_TOKEN)
}

/** Global key under which test mode exposes recorded external URLs (read via app.evaluate in E2E). */
const OPENED_EXTERNAL_URLS_GLOBAL_KEY = '__LAIN_OPENED_EXTERNAL_URLS__'

/**
 * Replace the real `shell:open-external` handler in test mode: record the URL on
 * `globalThis` instead of opening the user's browser, so E2E tests (KB.13 Enter)
 * can assert what would have opened without windows popping up.
 * @example
 *   // In main.ts (test mode branch)
 *   registerTestShellIPC()
 *   // In an E2E test
 *   await app.evaluate(() => Reflect.get(globalThis, '__LAIN_OPENED_EXTERNAL_URLS__')) // => ['https://react.dev']
 */
export function registerTestShellIPC(): void {
  const openedExternalUrls: string[] = []
  Reflect.set(globalThis, OPENED_EXTERNAL_URLS_GLOBAL_KEY, openedExternalUrls)

  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    openedExternalUrls.push(url)
  })
}
