import { safeStorage } from 'electron'
import Store from 'electron-store'

let store: Store<Record<string, string>> | undefined

/** Open credential storage only after the main process configures its userData directory. */
function getStore() {
  return (store ??= new Store<Record<string, string>>({ name: 'lain-auth' }))
}

const sessionValues = new Map<string, string>()

/**
 * Decide whether credentials can persist securely on this desktop session.
 * Linux basic_text uses a fixed key and therefore falls back to memory only.
 * @example credentialStorageMode() // 'encrypted' or 'session'
 */
export function credentialStorageMode(): 'encrypted' | 'session' {
  if (!safeStorage.isEncryptionAvailable()) return 'session'
  if (
    process.platform === 'linux' &&
    ['basic_text', 'unknown'].includes(safeStorage.getSelectedStorageBackend())
  )
    return 'session'
  return 'encrypted'
}

/**
 * Encrypted token storage using Electron safeStorage + electron-store.
 * safeStorage encrypts via OS keychain (macOS Keychain / Windows DPAPI / Linux kwallet).
 * electron-store persists the encrypted data to disk as JSON.
 *
 * @example
 *   secureStore.set("access_token", "ae261404-...")
 *   const token = secureStore.get("access_token") // => "ae261404-..."
 *   secureStore.delete("access_token")
 *   secureStore.clear() // Remove all stored tokens
 */
export const secureStore = {
  /**
   * Encrypt and persist a value.
   * @param key - Storage key (e.g., "access_token", "refresh_token")
   * @param value - Plain text value to encrypt
   */
  set(key: string, value: string): void {
    if (credentialStorageMode() === 'session') {
      sessionValues.set(key, value)
      return
    }
    const encrypted = safeStorage.encryptString(value)
    getStore().set(key, encrypted.toString('latin1'))
  },

  /**
   * Retrieve and decrypt a stored value.
   * @param key - Storage key
   * @returns Decrypted value or null if not found / decryption fails
   */
  get(key: string): string | null {
    if (credentialStorageMode() === 'session')
      return sessionValues.get(key) ?? null
    const encrypted = getStore().get(key)
    if (!encrypted) return null

    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'latin1'))
    } catch {
      getStore().delete(key)
      return null
    }
  },

  /**
   * Remove a single stored value.
   * @param key - Storage key to delete
   */
  delete(key: string): void {
    sessionValues.delete(key)
    getStore().delete(key)
  },

  /** Remove all stored tokens and auth data. */
  clear(): void {
    sessionValues.clear()
    getStore().clear()
  },
}
