import path from 'path'
import { fileURLToPath } from 'url'

import { app, BrowserWindow, ipcMain, shell } from 'electron'

import type { AuthState } from '../src/lib/types.ts'

import { RaindropAuth } from './raindrop-auth.ts'
import { startAutoUpdater } from './updater.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isTestMode = process.env.LAIN_TEST_MODE === '1'
// E2E runs headless by default; LAIN_E2E_HEADED=1 shows the window for debugging.
const isHeadless = isTestMode && process.env.LAIN_E2E_HEADED !== '1'

const clientId = process.env.VITE_RAINDROP_CLIENT_ID ?? ''
const clientSecret = process.env.RAINDROP_CLIENT_SECRET ?? ''
const auth = isTestMode ? null : new RaindropAuth(clientId, clientSecret)

// E2E isolation: each Playwright launch gets its own userData so persisted Redux
// state (localStorage: selected collection, view mode, ...) never leaks between
// tests or from the developer's real profile. Must run before app 'ready'.
if (isTestMode && process.env.LAIN_USER_DATA_DIR) {
  app.setPath('userData', process.env.LAIN_USER_DATA_DIR)
  app.setPath('sessionData', process.env.LAIN_USER_DATA_DIR)
}

let mainWindow: BrowserWindow | null = null

/**
 * Create the main application window with secure webPreferences.
 * Loads Vite dev server in development, built files in production.
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Lain',
    // Headless E2E: never show the window (Playwright drives it over CDP)
    show: !isHeadless,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Hidden windows must keep timers/rAF running, otherwise Playwright's
      // actionability checks (animations settled) never resolve.
      backgroundThrottling: !isHeadless,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

/**
 * Register IPC handlers for auth operations.
 * All handlers validate the sender before processing.
 *
 * @param auth - Initialized RaindropAuth instance
 */
function registerAuthIPC(auth: RaindropAuth): void {
  ipcMain.handle('auth:login', async (event) => {
    validateSender(event)
    await auth.login()
    const user = await auth.getUser()
    const state: AuthState = { isAuthenticated: true, user }
    mainWindow?.webContents.send('auth:state-changed', state)
  })

  ipcMain.handle('auth:logout', async (event) => {
    validateSender(event)
    await auth.logout()
    const state: AuthState = { isAuthenticated: false, user: null }
    mainWindow?.webContents.send('auth:state-changed', state)
  })

  ipcMain.handle('auth:get-user', async (event) => {
    validateSender(event)
    return auth.getUser()
  })

  ipcMain.handle('auth:get-state', async (event) => {
    validateSender(event)
    if (!auth.isAuthenticated()) {
      return { isAuthenticated: false, user: null } satisfies AuthState
    }
    const user = await auth.getUser()
    return { isAuthenticated: !!user, user } satisfies AuthState
  })

  ipcMain.handle('auth:get-token', async (event) => {
    validateSender(event)
    return auth.getValidToken()
  })
}

/**
 * Validate that the IPC message comes from a known BrowserWindow.
 * @param event - IPC invoke event
 * @throws If sender is not from a recognized window
 */
function validateSender(event: Electron.IpcMainInvokeEvent): void {
  const sender = BrowserWindow.fromWebContents(event.sender)
  if (!sender) {
    throw new Error('Unauthorized IPC sender')
  }
}

// --- App Lifecycle ---

/**
 * Open a URL in the user's default system browser.
 * Validates the URL protocol to prevent arbitrary command execution.
 */
function registerShellIPC(): void {
  ipcMain.handle('shell:open-external', async (event, url: string) => {
    validateSender(event)
    if (url.startsWith('https://') || url.startsWith('http://')) {
      await shell.openExternal(url)
    }
  })
}

// Enable remote debugging for Electron MCP integration (dev only)
if (!isTestMode) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

app.whenReady().then(async () => {
  if (isTestMode) {
    // Headless E2E: no Dock icon, no focus stealing, no browser opened for links
    if (isHeadless) app.dock?.hide()
    const { registerTestAuthIPC, registerTestShellIPC } =
      await import('./test-auth.ts')
    registerTestAuthIPC(() => mainWindow)
    registerTestShellIPC()
  } else {
    if (!auth) throw new Error('auth must be initialized in non-test mode')
    registerShellIPC()
    registerAuthIPC(auth)
    // Release builds update themselves from GitHub Releases (see electron-builder.yml)
    if (app.isPackaged) startAutoUpdater()
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
