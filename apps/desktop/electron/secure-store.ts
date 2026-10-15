import { safeStorage } from 'electron'
import Store from 'electron-store'

const store = new Store<Record<string, string>>({
  name: 'lain-auth',
})

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
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available on this platform')
    }
    const encrypted = safeStorage.encryptString(value)
    store.set(key, encrypted.toString('latin1'))
  },

  /**
   * Retrieve and decrypt a stored value.
   * @param key - Storage key
   * @returns Decrypted value or null if not found / decryption fails
   */
  get(key: string): string | null {
    const encrypted = store.get(key)
    if (!encrypted) return null

    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'latin1'))
    } catch {
      store.delete(key)
      return null
    }
  },

  /**
   * Remove a single stored value.
   * @param key - Storage key to delete
   */
  delete(key: string): void {
    store.delete(key)
  },

  /** Remove all stored tokens and auth data. */
  clear(): void {
    store.clear()
  },
}
