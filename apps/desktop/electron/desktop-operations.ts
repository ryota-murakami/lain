import { randomUUID } from 'node:crypto'
import { writeFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { BrowserWindow } from 'electron'
import { app, dialog, ipcMain, nativeImage } from 'electron'
import Store from 'electron-store'

import type { DesktopCapabilities } from '../src/lib/desktop-contract.ts'

import { assertTrustedRenderer } from './renderer-security.ts'
import { credentialStorageMode } from './secure-store.ts'

let preferences: Store<{ selectedIcon: string | null }> | undefined

/** Resolve preferences after userData isolation is configured by the main process. */
function getPreferences() {
  return (preferences ??= new Store<{ selectedIcon: string | null }>({
    name: 'lain-appearance',
    defaults: { selectedIcon: null },
  }))
}

/**
 * Apply the user-selected candidate to the Dock/window without changing the signed bundle.
 * Called on window creation and by the appearance IPC handler.
 * @throws When the selected candidate is unavailable or invalid.
 * @example applySelectedIcon(window)
 */
export function applySelectedIcon(window: BrowserWindow): void {
  const id = getPreferences().get('selectedIcon')
  // Launching the built main file directly makes Electron's app path point at dist-electron.
  const root = app.isPackaged
    ? app.getAppPath()
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const filename = id
    ? path.join(
        root,
        app.isPackaged ? 'dist' : 'public',
        'icon-candidates',
        `${id}.png`,
      )
    : path.join(root, 'build', 'icons', 'icon.png')
  const image = nativeImage.createFromPath(filename)
  if (image.isEmpty()) {
    if (id)
      throw new Error(
        'The icon candidate is unavailable. Please restore the default.',
      )
    return
  }
  if (process.platform === 'darwin') app.dock?.setIcon(image)
  else window.setIcon(image)
}

/**
 * Register bounded export/appearance operations once after app readiness.
 * Only the application's current main frame may invoke them.
 * @example registerDesktopOperations(() => mainWindow)
 */
export function registerDesktopOperations(
  getWindow: () => BrowserWindow | null,
): void {
  const validate = (event: Electron.IpcMainInvokeEvent): BrowserWindow =>
    assertTrustedRenderer(event, getWindow())
  ipcMain.handle('desktop:capabilities', (event): DesktopCapabilities => {
    validate(event)
    return {
      platform: process.platform,
      credentialStorage: credentialStorageMode(),
      selectedIcon: getPreferences().get('selectedIcon'),
      iconTarget: process.platform === 'darwin' ? 'Dock' : 'window',
    }
  })
  ipcMain.handle('desktop:select-icon', (event, id: unknown) => {
    const window = validate(event)
    if (
      id !== null &&
      (typeof id !== 'string' || !/^I(0[1-9]|[1-5][0-9]|6[0-4])$/.test(id))
    )
      throw new Error('Invalid icon candidate')
    const previous = getPreferences().get('selectedIcon')
    getPreferences().set('selectedIcon', id)
    try {
      applySelectedIcon(window)
    } catch (error) {
      getPreferences().set('selectedIcon', previous)
      throw error
    }
  })
  ipcMain.handle('desktop:save-export', async (event, data: unknown) => {
    const window = validate(event)
    if (
      !data ||
      typeof data !== 'object' ||
      !('format' in data) ||
      !('content' in data) ||
      typeof data.content !== 'string' ||
      typeof data.format !== 'string' ||
      !['html', 'csv', 'json'].includes(data.format)
    )
      throw new Error('Invalid export')
    const result = await dialog.showSaveDialog(window, {
      title: 'Export bookmarks',
      defaultPath: `lain-bookmarks-${new Date().toISOString().slice(0, 10)}.${data.format}`,
      filters: [{ name: data.format.toUpperCase(), extensions: [data.format] }],
      properties: ['showOverwriteConfirmation', 'createDirectory'],
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    // Atomic replacement keeps a failed write from corrupting an existing export.
    const temporary = `${result.filePath}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, data.content, {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx',
      })
      await rename(temporary, result.filePath)
    } finally {
      await rm(temporary, { force: true })
    }
    return { canceled: false, filename: path.basename(result.filePath) }
  })
}
