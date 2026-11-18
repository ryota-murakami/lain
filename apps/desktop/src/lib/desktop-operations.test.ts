import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { BrowserWindow } from 'electron'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import {
  applySelectedIcon,
  registerDesktopOperations,
} from '../../electron/desktop-operations'
import { rememberRendererLocation } from '../../electron/renderer-security'

type Handler = (event: unknown, payload?: unknown) => unknown
const mocks = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  selectedIcon: null as string | null,
  emptyImage: false,
  packaged: false,
  saveDialog: vi.fn(),
  dockIcon: vi.fn(),
  windowIcon: vi.fn(),
  image: vi.fn(),
  storageMode: vi.fn(() => 'encrypted'),
}))
vi.mock('electron', () => ({
  app: {
    getAppPath: () => '/synthetic/lain',
    get isPackaged() {
      return mocks.packaged
    },
    dock: { setIcon: mocks.dockIcon },
  },
  dialog: { showSaveDialog: mocks.saveDialog },
  ipcMain: {
    handle: (name: string, handler: Handler) =>
      mocks.handlers.set(name, handler),
  },
  nativeImage: { createFromPath: mocks.image },
}))
vi.mock('../../electron/secure-store', () => ({
  credentialStorageMode: mocks.storageMode,
}))
vi.mock('electron-store', () => ({
  default: class {
    get() {
      return mocks.selectedIcon
    }
    set(_key: string, value: string | null): void {
      mocks.selectedIcon = value
    }
  },
}))

const mainFrame = { url: 'file:///synthetic/lain/index.html' }
const webContents = { mainFrame }
const window = {
  webContents,
  setIcon: mocks.windowIcon,
} as unknown as BrowserWindow
const event = { sender: webContents, senderFrame: mainFrame }
const originalPlatform = process.platform
let directory = ''

beforeEach(async () => {
  vi.clearAllMocks()
  mocks.selectedIcon = null
  mocks.emptyImage = false
  mocks.packaged = false
  mocks.image.mockImplementation(() => ({ isEmpty: () => mocks.emptyImage }))
  mocks.handlers.clear()
  directory = await mkdtemp(
    path.join(os.tmpdir(), 'lain-native-operations-test-'),
  )
  rememberRendererLocation(
    window.webContents,
    'file:///synthetic/lain/index.html',
  )
  registerDesktopOperations(() => window)
})
afterEach(async () => {
  Object.defineProperty(process, 'platform', { value: originalPlatform })
  await rm(directory, { recursive: true, force: true })
})

test('native export atomically replaces the chosen file with complete Unicode content', async () => {
  // Arrange
  const destination = path.join(directory, 'bookmarks.json')
  await writeFile(destination, 'old export')
  mocks.saveDialog.mockResolvedValue({ canceled: false, filePath: destination })
  // Act
  const result = await mocks.handlers.get('desktop:save-export')!(event, {
    format: 'json',
    content: '{"title":"日本語 <&>"}',
  })
  // Assert
  expect(result).toEqual({ canceled: false, filename: 'bookmarks.json' })
  expect(await readFile(destination, 'utf8')).toBe('{"title":"日本語 <&>"}')
  expect((await stat(destination)).mode & 0o777).toBe(0o600)
  expect(await readdir(directory)).toEqual(['bookmarks.json'])
})

test('canceling the native save dialog leaves the existing export untouched', async () => {
  // Arrange
  const destination = path.join(directory, 'bookmarks.csv')
  await writeFile(destination, 'existing export')
  mocks.saveDialog.mockResolvedValue({ canceled: true })
  // Act
  const result = await mocks.handlers.get('desktop:save-export')!(event, {
    format: 'csv',
    content: 'replacement',
  })
  // Assert
  expect(result).toEqual({ canceled: true })
  expect(await readFile(destination, 'utf8')).toBe('existing export')
  expect(await readdir(directory)).toEqual(['bookmarks.csv'])
})

test('an unwritable destination reports failure and leaves no temporary export behind', async () => {
  // Arrange
  mocks.saveDialog.mockResolvedValue({ canceled: false, filePath: directory })
  // Act / Assert
  await expect(
    mocks.handlers.get('desktop:save-export')!(event, {
      format: 'html',
      content: '<html></html>',
    }),
  ).rejects.toThrow()
  expect(await readdir(directory)).toEqual([])
})

test('foreign frames cannot invoke export or appearance operations', async () => {
  // Arrange
  const foreignFrame = { sender: webContents, senderFrame: {} }
  // Act / Assert
  expect(() =>
    mocks.handlers.get('desktop:capabilities')!(foreignFrame),
  ).toThrow('Unauthorized IPC sender')
  expect(() =>
    mocks.handlers.get('desktop:select-icon')!(foreignFrame, 'I17'),
  ).toThrow('Unauthorized IPC sender')
  await expect(
    mocks.handlers.get('desktop:save-export')!(foreignFrame, {
      format: 'json',
      content: '{}',
    }),
  ).rejects.toThrow('Unauthorized IPC sender')
  expect(mocks.saveDialog).not.toHaveBeenCalled()
})

test('an invalid export format never opens a native save dialog', async () => {
  // Arrange / Act / Assert
  await expect(
    mocks.handlers.get('desktop:save-export')!(event, {
      format: '../executable',
      content: '{}',
    }),
  ).rejects.toThrow('Invalid export')
  expect(mocks.saveDialog).not.toHaveBeenCalled()
})

test('a missing icon candidate rolls back the persisted selection', () => {
  // Arrange
  mocks.selectedIcon = 'I01'
  mocks.emptyImage = true
  // Act / Assert
  expect(() =>
    mocks.handlers.get('desktop:select-icon')!(event, 'I17'),
  ).toThrow('The icon candidate is unavailable.')
  expect(mocks.selectedIcon).toBe('I01')
  expect(() =>
    mocks.handlers.get('desktop:select-icon')!(event, '../private'),
  ).toThrow('Invalid icon candidate')
})

test('Linux applies a candidate to the window and restores the default icon', () => {
  // Arrange
  Object.defineProperty(process, 'platform', { value: 'linux' })
  // Act
  mocks.handlers.get('desktop:select-icon')!(event, 'I17')
  const selected = mocks.handlers.get('desktop:capabilities')!(event)
  mocks.handlers.get('desktop:select-icon')!(event, null)
  // Assert
  expect(selected).toEqual({
    platform: 'linux',
    credentialStorage: 'encrypted',
    selectedIcon: 'I17',
    iconTarget: 'window',
  })
  expect(mocks.windowIcon).toHaveBeenCalledTimes(2)
  expect(mocks.dockIcon).not.toHaveBeenCalled()
  expect(mocks.image).toHaveBeenLastCalledWith(
    expect.stringMatching(/\/apps\/desktop\/build\/icons\/icon\.png$/),
  )
  expect(mocks.selectedIcon).toBe(null)
})

test('macOS restores the saved candidate to the Dock when creating a window', () => {
  // Arrange
  Object.defineProperty(process, 'platform', { value: 'darwin' })
  mocks.selectedIcon = 'I64'
  // Act
  applySelectedIcon(window)
  // Assert
  expect(mocks.image).toHaveBeenCalledWith(
    expect.stringMatching(
      /\/apps\/desktop\/public\/icon-candidates\/I64\.png$/,
    ),
  )
  expect(mocks.dockIcon).toHaveBeenCalledTimes(1)
  expect(mocks.windowIcon).not.toHaveBeenCalled()
})

test('packaged builds resolve candidates inside the application archive', () => {
  // Arrange
  mocks.packaged = true
  mocks.selectedIcon = 'I17'
  // Act
  applySelectedIcon(window)
  // Assert
  expect(mocks.image).toHaveBeenCalledWith(
    '/synthetic/lain/dist/icon-candidates/I17.png',
  )
})
