import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  disk: new Map<string, string>(),
  available: vi.fn(() => true),
  backend: vi.fn(() => 'gnome_libsecret'),
  encrypt: vi.fn((value: string) => Buffer.from(`encrypted:${value}`)),
  decrypt: vi.fn((value: Buffer) => value.toString().replace('encrypted:', '')),
}))
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: mocks.available,
    getSelectedStorageBackend: mocks.backend,
    encryptString: mocks.encrypt,
    decryptString: mocks.decrypt,
  },
}))
vi.mock('electron-store', () => ({
  default: class {
    get(key: string) {
      return mocks.disk.get(key)
    }
    set(key: string, value: string): void {
      mocks.disk.set(key, value)
    }
    delete(key: string): void {
      mocks.disk.delete(key)
    }
    clear(): void {
      mocks.disk.clear()
    }
  },
}))

const originalPlatform = process.platform
beforeEach(() => {
  vi.resetModules()
  mocks.disk.clear()
  vi.clearAllMocks()
  mocks.available.mockReturnValue(true)
  mocks.backend.mockReturnValue('gnome_libsecret')
})
afterEach(() =>
  Object.defineProperty(process, 'platform', { value: originalPlatform }),
)

test('a Linux keyring encrypts persisted credentials and restores their value', async () => {
  // Arrange
  Object.defineProperty(process, 'platform', { value: 'linux' })
  const { secureStore, credentialStorageMode } =
    await import('../../electron/secure-store')
  // Act
  secureStore.set('access_token', 'synthetic-access')
  // Assert
  expect(credentialStorageMode()).toBe('encrypted')
  expect(mocks.disk.get('access_token')).toBe('encrypted:synthetic-access')
  expect(secureStore.get('access_token')).toBe('synthetic-access')
})

test('Linux basic_text credentials stay in memory and disappear after a process restart', async () => {
  // Arrange
  Object.defineProperty(process, 'platform', { value: 'linux' })
  mocks.backend.mockReturnValue('basic_text')
  const { secureStore, credentialStorageMode } =
    await import('../../electron/secure-store')
  // Act
  secureStore.set('access_token', 'synthetic-session')
  const currentSession = secureStore.get('access_token')
  vi.resetModules()
  const nextProcess = await import('../../electron/secure-store')
  // Assert
  expect(credentialStorageMode()).toBe('session')
  expect(currentSession).toBe('synthetic-session')
  expect(nextProcess.secureStore.get('access_token')).toBe(null)
  expect(mocks.disk.size).toBe(0)
  expect(mocks.encrypt).not.toHaveBeenCalled()
})

test('unavailable OS encryption never writes a plaintext refresh token to disk', async () => {
  // Arrange
  mocks.available.mockReturnValue(false)
  const { secureStore } = await import('../../electron/secure-store')
  // Act
  secureStore.set('refresh_token', 'synthetic-refresh')
  // Assert
  expect(secureStore.get('refresh_token')).toBe('synthetic-refresh')
  expect(mocks.disk.size).toBe(0)
  expect(mocks.encrypt).not.toHaveBeenCalled()
})

test('an unreadable encrypted credential requires sign-in without crashing startup', async () => {
  // Arrange
  mocks.disk.set('access_token', 'unreadable-encrypted-data')
  mocks.decrypt.mockImplementationOnce(() => {
    throw new Error('Key unavailable')
  })
  const { secureStore } = await import('../../electron/secure-store')
  // Act
  const token = secureStore.get('access_token')
  // Assert
  expect(token).toBe(null)
  expect(mocks.disk.has('access_token')).toBe(false)
})
