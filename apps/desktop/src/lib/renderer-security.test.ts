import { EventEmitter } from 'node:events'

import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  assertTrustedRenderer,
  isRendererLocation,
  protectRendererNavigation,
  rememberRendererLocation,
} from '../../electron/renderer-security'

const EXPECTED_URL =
  'file:///synthetic/Lain.app/Contents/Resources/app.asar/dist/index.html'

/** Build a native event surface without opening real windows or using any account credentials. */
function fixture() {
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: { url: EXPECTED_URL },
    stop: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    getURL: vi.fn(() => EXPECTED_URL),
  })
  const nativeWindow = {
    webContents: contents,
    isDestroyed: vi.fn(() => false),
    loadURL: vi.fn(async (_url: string) => undefined),
  }
  const window = nativeWindow as unknown as BrowserWindow
  const event = {
    sender: contents,
    senderFrame: contents.mainFrame,
  } as unknown as IpcMainInvokeEvent
  return { contents, window, event, nativeWindow }
}

afterEach(() => vi.restoreAllMocks())

describe('privileged renderer trust', () => {
  it('accepts only the registered main document while allowing its fragment navigation', () => {
    // Arrange
    const { contents, window, event } = fixture()
    rememberRendererLocation(window.webContents, EXPECTED_URL)
    contents.mainFrame.url = `${EXPECTED_URL}#bookmarks`
    // Act / Assert
    expect(assertTrustedRenderer(event, window)).toBe(window)
    expect(
      isRendererLocation('http://localhost:5173/', 'http://localhost:5173'),
    ).toBe(true)
  })

  it.each([
    'about:blank',
    'file:///synthetic/other.html',
    `${EXPECTED_URL}?privileged=1`,
    'https://example.invalid/',
    'not a URL',
  ])('refuses IPC after the main document changes to %s', (url) => {
    // Arrange
    const { contents, window, event } = fixture()
    rememberRendererLocation(window.webContents, EXPECTED_URL)
    contents.mainFrame.url = url
    // Act / Assert
    expect(() => assertTrustedRenderer(event, window)).toThrow(
      'Unauthorized IPC sender',
    )
  })

  it('does not trust another path on the same development origin or a deceptive host prefix', () => {
    // Arrange / Act / Assert
    expect(
      isRendererLocation(
        'http://localhost:5173/foreign',
        'http://localhost:5173/',
      ),
    ).toBe(false)
    expect(
      isRendererLocation(
        'http://localhost:5173@evil.invalid/',
        'http://localhost:5173/',
      ),
    ).toBe(false)
  })

  it('refuses unregistered windows, child frames and unrelated web contents', () => {
    // Arrange
    const { window, event } = fixture()
    // Act / Assert
    expect(() => assertTrustedRenderer(event, window)).toThrow(
      'Unauthorized IPC sender',
    )
    rememberRendererLocation(window.webContents, EXPECTED_URL)
    expect(() => assertTrustedRenderer(event, null)).toThrow(
      'Unauthorized IPC sender',
    )
    expect(() =>
      assertTrustedRenderer({ ...event, senderFrame: null }, window),
    ).toThrow('Unauthorized IPC sender')
    expect(() =>
      assertTrustedRenderer(
        { ...event, sender: {} } as IpcMainInvokeEvent,
        window,
      ),
    ).toThrow('Unauthorized IPC sender')
  })
})

describe('renderer navigation containment', () => {
  it('denies new windows and cancels normal main-frame and child-frame navigation', () => {
    // Arrange
    const { contents, window } = fixture()
    protectRendererNavigation(window, EXPECTED_URL)
    const preventDefault = vi.fn()
    // Act
    contents.emit('will-navigate', { preventDefault })
    contents.emit('will-frame-navigate', { preventDefault })
    // Assert
    expect(preventDefault).toHaveBeenCalledTimes(2)
    expect(contents.setWindowOpenHandler.mock.calls[0][0]()).toEqual({
      action: 'deny',
    })
  })

  it('does not stall an in-progress navigation before its cancellable or committed event', () => {
    // Arrange
    const { contents, window, nativeWindow } = fixture()
    protectRendererNavigation(window, EXPECTED_URL)
    // Act
    contents.emit('did-start-navigation', {
      url: 'about:blank',
      isMainFrame: true,
    })
    contents.emit('did-start-navigation', {
      url: EXPECTED_URL,
      isMainFrame: true,
    })
    contents.emit('did-start-navigation', {
      url: 'about:blank',
      isMainFrame: false,
    })
    contents.emit('dom-ready')
    // Assert
    expect(contents.stop).not.toHaveBeenCalled()
    expect(nativeWindow.loadURL).not.toHaveBeenCalled()
  })

  it('recovers a committed about:blank document once and denies its IPC during recovery', async () => {
    // Arrange
    const { contents, window, event, nativeWindow } = fixture()
    protectRendererNavigation(window, EXPECTED_URL)
    contents.mainFrame.url = 'about:blank'
    contents.getURL.mockReturnValue('about:blank')
    // Act
    contents.emit('did-navigate', {}, 'about:blank')
    contents.emit('dom-ready')
    // Assert — restoration must wait for the current navigation event to finish.
    expect(nativeWindow.loadURL).not.toHaveBeenCalled()
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(nativeWindow.loadURL).toHaveBeenCalledExactlyOnceWith(EXPECTED_URL)
    expect(() => assertTrustedRenderer(event, window)).toThrow(
      'Unauthorized IPC sender',
    )
  })

  it('ignores legitimate fragments and child history but recovers unexpected top-level history', async () => {
    // Arrange
    const { contents, window, nativeWindow } = fixture()
    protectRendererNavigation(window, EXPECTED_URL)
    // Act
    contents.emit('did-navigate-in-page', {}, `${EXPECTED_URL}#section`, true)
    contents.emit('did-navigate-in-page', {}, 'about:blank', false)
    expect(nativeWindow.loadURL).not.toHaveBeenCalled()
    contents.emit('did-navigate-in-page', {}, 'file:///other.html', true)
    // Assert — restoration must wait for the current navigation event to finish.
    expect(nativeWindow.loadURL).not.toHaveBeenCalled()
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(nativeWindow.loadURL).toHaveBeenCalledExactlyOnceWith(EXPECTED_URL)
  })

  it('does not reopen a window closed between navigation and deferred recovery', async () => {
    // Arrange
    const { contents, window, nativeWindow } = fixture()
    protectRendererNavigation(window, EXPECTED_URL)
    // Act
    contents.emit('did-navigate', {}, 'about:blank')
    nativeWindow.isDestroyed.mockReturnValue(true)
    await new Promise<void>((resolve) => setImmediate(resolve))
    // Assert
    expect(nativeWindow.loadURL).not.toHaveBeenCalled()
  })

  it('does not recover a closed window and reports a failed recovery without exposing navigation input', async () => {
    // Arrange
    const { contents, window, nativeWindow } = fixture()
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    protectRendererNavigation(window, EXPECTED_URL)
    nativeWindow.isDestroyed.mockReturnValue(true)
    contents.emit('did-navigate', {}, 'about:blank')
    expect(nativeWindow.loadURL).not.toHaveBeenCalled()
    nativeWindow.isDestroyed.mockReturnValue(false)
    nativeWindow.loadURL.mockRejectedValue(new Error('untrusted page detail'))
    // Act
    contents.emit('did-navigate', {}, 'about:blank')
    await vi.waitFor(() => expect(log).toHaveBeenCalled())
    // Assert
    expect(log).toHaveBeenCalledExactlyOnceWith(
      'The application document could not be restored.',
    )
  })
})
