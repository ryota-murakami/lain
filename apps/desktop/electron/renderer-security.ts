import type { BrowserWindow, IpcMainInvokeEvent, WebContents } from 'electron'

const rendererLocations = new WeakMap<WebContents, string>()

/**
 * Compare the actual document with the renderer chosen by the main process.
 * Hash navigation is harmless; another path, query, scheme or origin is not the application document.
 * @example isRendererLocation('file:///app/index.html#section', 'file:///app/index.html')
 */
export function isRendererLocation(actual: string, expected: string): boolean {
  try {
    const candidate = new URL(actual)
    const trusted = new URL(expected)
    candidate.hash = ''
    trusted.hash = ''
    return candidate.href === trusted.href
  } catch {
    return false
  }
}

/**
 * Record the main process's renderer URL before the initial document starts loading.
 * {@link protectRendererNavigation} calls this; IPC never derives trust from the current page URL.
 * @example rememberRendererLocation(window.webContents, rendererURL)
 */
export function rememberRendererLocation(
  contents: WebContents,
  expected: string,
): void {
  rendererLocations.set(contents, expected)
}

/**
 * Refuse privileged calls from foreign windows, child frames, or a replaced main document.
 * Auth, external-link, export, appearance and updater handlers call this before native work.
 * @returns The current authorized application window.
 * @throws When the sender is not the exact trusted renderer document.
 * @example assertTrustedRenderer(event, mainWindow)
 */
export function assertTrustedRenderer(
  event: IpcMainInvokeEvent,
  window: BrowserWindow | null,
): BrowserWindow {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame
  )
    throw new Error('Unauthorized IPC sender')
  const expected = rendererLocations.get(window.webContents)
  if (!expected || !isRendererLocation(event.senderFrame.url, expected))
    throw new Error('Unauthorized IPC sender')
  return window
}

/**
 * Block renderer-driven navigation and recover exceptional document replacements.
 * Electron can omit cancellable navigation events for about:blank; committed documents are checked again.
 * IPC remains denied during an unexpected document and recovery never trusts its requested URL.
 * @param expected - Exact file/dev-server URL selected by the main process.
 * @example protectRendererNavigation(window, rendererURL)
 */
export function protectRendererNavigation(
  window: BrowserWindow,
  expected: string,
): void {
  rememberRendererLocation(window.webContents, expected)
  const contents = window.webContents
  let recovering = false
  const recover = (url: string): void => {
    if (recovering || isRendererLocation(url, expected) || window.isDestroyed())
      return
    recovering = true
    // Electron's about:blank path can stall if stopped/reloaded from inside its navigation event.
    // Wait one main-process turn before replacing it with the recorded application document.
    setImmediate(() => {
      if (window.isDestroyed()) {
        recovering = false
        return
      }
      void window
        .loadURL(expected)
        .catch(() => {
          console.error('The application document could not be restored.')
        })
        .finally(() => {
          recovering = false
        })
    })
  }
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event) => event.preventDefault())
  contents.on('will-frame-navigate', (event) => event.preventDefault())
  contents.on('did-navigate', (_event, url) => recover(url))
  // Same-document history changes must not grant trust to another path on the dev-server origin.
  contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (isMainFrame) recover(url)
  })
  contents.on('dom-ready', () => recover(contents.getURL()))
}
