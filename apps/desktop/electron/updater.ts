import { autoUpdater } from 'electron-updater'

/** Background update checks while the app stays open. */
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

/**
 * Background auto-update from GitHub Releases via electron-updater: checks at startup
 * and every {@link UPDATE_CHECK_INTERVAL_MS}, downloads silently, installs on quit and
 * shows a system notification once a build is ready. Call only from packaged,
 * non-test builds — dev/E2E have no update feed (`app-update.yml`).
 * @returns Stop function that cancels the periodic checks
 * @example
 *   if (app.isPackaged && !isTestMode) startAutoUpdater()
 */
export function startAutoUpdater(): () => void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  // Update failures (offline, no release yet) must never surface as crashes
  autoUpdater.on('error', (error) => {
    console.error('[updater] update check failed:', error.message)
  })

  const checkForUpdates = () => {
    void autoUpdater.checkForUpdatesAndNotify().catch(() => {})
  }
  checkForUpdates()
  const timer = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS)
  return () => clearInterval(timer)
}
