import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { UpdateState } from './update-contract'

const native = vi.hoisted(() => {
  const ipc = new Map<
    string,
    (event: { sender: object; senderFrame?: object }) => unknown
  >()
  const events = new Map<string, (payload?: unknown) => void>()
  const window = {
    isDestroyed: () => false,
    webContents: {
      send: vi.fn(),
      mainFrame: { url: 'file:///synthetic/lain/index.html' },
    },
  }
  return {
    ipc,
    events,
    window,
    app: { isPackaged: true, getVersion: () => '0.1.1' },
    updater: {
      autoDownload: true,
      autoInstallOnAppQuit: true,
      checkForUpdates: vi.fn(),
      downloadUpdate: vi.fn(),
      quitAndInstall: vi.fn(),
      on: vi.fn((event: string, listener: (payload?: unknown) => void) =>
        events.set(event, listener),
      ),
    },
    showMessageBox: vi.fn(),
    openExternal: vi.fn(),
  }
})

vi.mock('electron', () => ({
  app: native.app,
  BrowserWindow: { getAllWindows: () => [native.window] },
  ipcMain: {
    handle: (
      name: string,
      listener: (event: { sender: object; senderFrame?: object }) => unknown,
    ) => native.ipc.set(name, listener),
  },
  dialog: { showMessageBox: native.showMessageBox },
  shell: { openExternal: native.openExternal },
}))
vi.mock('electron-updater', () => ({ autoUpdater: native.updater }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.stubEnv('LAIN_TEST_MODE', '')
  vi.stubEnv('APPIMAGE', '/tmp/lain-updater-fixture.AppImage')
  native.app.isPackaged = true
  native.ipc.clear()
  native.events.clear()
  native.updater.checkForUpdates.mockResolvedValue({
    updateInfo: { version: '0.1.1' },
  })
  native.updater.downloadUpdate.mockResolvedValue([])
  native.showMessageBox.mockResolvedValue({ response: 1 })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

/** Exercise the preload contract with the same sender check as the real main window. @example await invoke('check') */
async function invoke(action: string): Promise<UpdateState> {
  return (await native.ipc.get(`updates:${action}`)?.({
    sender: native.window.webContents,
    senderFrame: native.window.webContents.mainFrame,
  })) as UpdateState
}

/** Register a fresh updater through its public main-process integration. @example await register() */
async function register() {
  const module = await import('../../electron/updater')
  const { rememberRendererLocation } =
    await import('../../electron/renderer-security')
  rememberRendererLocation(
    native.window.webContents as never,
    'file:///synthetic/lain/index.html',
  )
  module.registerUpdateIPC(() => native.window as never)
  return module
}

test('startup checks once and repeated setup cannot create another periodic request', async () => {
  // Arrange
  const module = await register()
  // Act
  const stop = module.startAutoUpdater()
  module.startAutoUpdater()
  await vi.advanceTimersByTimeAsync(0)
  // Assert
  expect(native.updater.autoDownload).toBe(false)
  expect(native.updater.autoInstallOnAppQuit).toBe(false)
  expect(native.updater.checkForUpdates).toHaveBeenCalledTimes(1)
  expect(native.updater.downloadUpdate).not.toHaveBeenCalled()
  // Act
  await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000)
  stop()
  await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000)
  // Assert
  expect(native.updater.checkForUpdates).toHaveBeenCalledTimes(2)
})

test('native updater refuses unsupported feed checks instead of claiming the app is current', async () => {
  // Arrange
  await register()
  native.updater.checkForUpdates.mockResolvedValue(null)
  // Act
  const state = await invoke('check')
  // Assert
  expect(state.phase).toBe('error')
  expect(state.error).toBe(
    'The update could not finish. Check your connection and try again.',
  )
})

test('restart requires downloaded bytes and affirmative native confirmation', async () => {
  // Arrange
  await register()
  // Act
  await invoke('install')
  native.events.get('update-available')?.({ version: '0.2.0' })
  await invoke('download')
  native.events.get('download-progress')?.({
    percent: 50,
    transferred: 20,
    total: 40,
  })
  native.events.get('update-downloaded')?.({ version: '0.2.0' })
  await invoke('install')
  // Assert
  expect(native.showMessageBox).toHaveBeenCalledTimes(1)
  expect(native.updater.quitAndInstall).not.toHaveBeenCalled()
  expect((await invoke('get-state')).phase).toBe('ready')
  // Act
  native.showMessageBox.mockResolvedValue({ response: 0 })
  await invoke('install')
  await vi.advanceTimersByTimeAsync(0)
  // Assert
  expect(native.updater.quitAndInstall).toHaveBeenCalledExactlyOnceWith(
    false,
    true,
  )
})

test('test profiles never contact the release feed even when packaged', async () => {
  // Arrange
  vi.stubEnv('LAIN_TEST_MODE', '1')
  await register()
  // Act
  const state = await invoke('check')
  // Assert
  expect(state.mode).toBe('development')
  expect(state.phase).toBe('unavailable')
  expect(native.updater.checkForUpdates).not.toHaveBeenCalled()
})

test('an unrelated renderer cannot invoke native updater operations', async () => {
  // Arrange
  await register()
  // Act / Assert
  expect(() => native.ipc.get('updates:get-state')?.({ sender: {} })).toThrow(
    'Unauthorized IPC sender',
  )
  expect(native.updater.checkForUpdates).not.toHaveBeenCalled()
})

test('a child frame cannot invoke the native updater through the main renderer', async () => {
  // Arrange
  await register()
  // Act / Assert
  expect(() =>
    native.ipc.get('updates:get-state')?.({
      sender: native.window.webContents,
      senderFrame: {},
    }),
  ).toThrow('Unauthorized IPC sender')
})
