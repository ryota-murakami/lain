import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { autoUpdater } from 'electron-updater'

import { UPDATE_CHANNELS } from '../src/lib/update-contract'
import type { UpdateState } from '../src/lib/update-contract'
import { createUpdateController } from '../src/lib/update-controller'

import { assertTrustedRenderer } from './renderer-security'
import { readUpdateQAFixture } from './update-qa'

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
const RELEASES_URL = 'https://github.com/ryota-murakami/lain/releases/latest'
let controller: ReturnType<typeof createUpdateController> | undefined
let timer: ReturnType<typeof setInterval> | undefined
let registered = false

/** Broadcast update snapshots to current windows without exposing native error details. @example publish(state) */
function publish(state: UpdateState): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed())
      window.webContents.send(UPDATE_CHANNELS.state, state)
  }
}

/** Ask once before quitting; returning false preserves the ready download for later. @example await confirmInstall() */
async function confirmInstall(): Promise<boolean> {
  const answer = await dialog.showMessageBox({
    type: 'question',
    title: 'Restart Lain to update?',
    message: 'Restart Lain and install the downloaded update?',
    detail:
      'Save your changes and finish file uploads before restarting. Your account and settings will be kept.',
    buttons: ['Restart and install', 'Later'],
    defaultId: 1,
    cancelId: 1,
  })
  if (answer.response !== 0) return false
  // Let IPC return before Electron quits; no automatic install happens on normal quit.
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return true
}

/**
 * Initialize the existing updater once with explicit download/install consent.
 * Called lazily by update IPC and the startup scheduler after Electron is ready.
 * @returns Shared controller for every window and background check.
 * @example
 * await getController().check()
 */
function getController() {
  if (controller) return controller
  const fixture =
    process.env.LAIN_UPDATE_QA === '1'
      ? readUpdateQAFixture(process.env, {
          packaged: app.isPackaged,
          version: app.getVersion(),
          appPath: app.getAppPath(),
        })
      : undefined
  if (fixture && app.getPath('userData') !== fixture.profile)
    throw new Error('Update QA userData isolation was not applied.')
  const mode: UpdateState['mode'] = fixture
    ? 'in-app'
    : !app.isPackaged || process.env.LAIN_TEST_MODE === '1'
      ? 'development'
      : process.platform === 'linux' && !process.env.APPIMAGE
        ? 'manual'
        : 'in-app'
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  if (fixture) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: fixture.feed,
      channel: 'qa',
    })
    autoUpdater.allowPrerelease = true
    autoUpdater.allowDowngrade = false
    // The fixture runner relaunches the replaced app with the same isolated profile.
    autoUpdater.autoRunAppAfterInstall = false
  }
  controller = createUpdateController({
    version: app.getVersion(),
    mode,
    publish,
    backend: {
      check: async () => {
        const result = await autoUpdater.checkForUpdates()
        if (!result)
          throw new Error('This distribution cannot check its update feed.')
      },
      download: async () => {
        if (mode === 'manual') await shell.openExternal(RELEASES_URL)
        else await autoUpdater.downloadUpdate()
      },
      install: confirmInstall,
    },
  })
  const active = controller
  autoUpdater.on('update-available', (info) =>
    active.receive({ type: 'available', version: info.version }),
  )
  autoUpdater.on('update-not-available', () =>
    active.receive({ type: 'current' }),
  )
  autoUpdater.on('download-progress', (progress) =>
    active.receive({ type: 'progress', ...progress }),
  )
  autoUpdater.on('update-downloaded', (info) =>
    active.receive({ type: 'ready', version: info.version }),
  )
  autoUpdater.on('error', () => active.receive({ type: 'error' }))
  return controller
}

/**
 * Register the narrow updater IPC contract for the application's own window.
 * The main process calls this once after readiness; renderer input cannot select feeds or paths.
 * @param getWindow - Current main window, including a replacement after macOS reactivation.
 * @example
 * registerUpdateIPC(() => mainWindow)
 */
export function registerUpdateIPC(getWindow: () => BrowserWindow | null): void {
  if (registered) return
  registered = true
  const ownWindow = (event: IpcMainInvokeEvent) => {
    assertTrustedRenderer(event, getWindow())
    return getController()
  }
  ipcMain.handle(UPDATE_CHANNELS.getState, (event) =>
    ownWindow(event).getState(),
  )
  ipcMain.handle(UPDATE_CHANNELS.check, async (event) =>
    ownWindow(event).check(),
  )
  ipcMain.handle(UPDATE_CHANNELS.download, async (event) =>
    ownWindow(event).download(),
  )
  ipcMain.handle(UPDATE_CHANNELS.install, async (event) =>
    ownWindow(event).install(),
  )
}

/**
 * Check at startup and every four hours using the same controller as Settings.
 * Packaged non-test startup calls this; repeated calls never create another interval.
 * @returns Stop function for app shutdown cleanup.
 * @example
 * const stop = startAutoUpdater()
 */
export function startAutoUpdater(): () => void {
  if (!timer) {
    void getController().check()
    timer = setInterval(() => {
      void getController().check()
    }, UPDATE_CHECK_INTERVAL_MS)
  }
  return (): void => {
    clearInterval(timer)
    timer = undefined
  }
}
