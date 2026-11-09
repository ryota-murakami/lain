import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { RaindropAuth } from '../../electron/raindrop-auth'

const mocks = vi.hoisted(() => ({
  values: new Map<string, string>(),
  open: vi.fn(),
}))
vi.mock('../../electron/secure-store', () => ({
  secureStore: {
    get: (key: string) => mocks.values.get(key) ?? null,
    set: (key: string, value: string) => mocks.values.set(key, value),
    clear: (): void => mocks.values.clear(),
  },
}))
vi.mock('electron', () => ({ BrowserWindow: mocks.open }))

beforeEach(() => {
  mocks.values.clear()
  vi.clearAllMocks()
})
afterEach(() => vi.unstubAllGlobals())

test('concurrent requests share one rotating-token refresh', async () => {
  // Arrange
  mocks.values.set('access_token', 'expired-test-access')
  mocks.values.set('refresh_token', 'test-refresh')
  mocks.values.set('expires_at', '0')
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        access_token: 'fresh-test-access',
        refresh_token: 'rotated-test-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
      { status: 200 },
    ),
  )
  vi.stubGlobal('fetch', fetch)
  const auth = new RaindropAuth('test-client', 'test-secret')
  // Act
  const tokens = await Promise.all([
    auth.getValidToken(),
    auth.getValidToken(),
    auth.getValidToken(),
  ])
  // Assert
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(tokens).toEqual([
    'fresh-test-access',
    'fresh-test-access',
    'fresh-test-access',
  ])
  expect(mocks.values.get('refresh_token')).toBe('rotated-test-refresh')
})

test('a temporary authentication outage preserves credentials for a retry', async () => {
  // Arrange
  mocks.values.set('access_token', 'existing-test-access')
  mocks.values.set('refresh_token', 'existing-test-refresh')
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('', { status: 503 })),
  )
  const auth = new RaindropAuth('test-client', 'test-secret')
  // Act / Assert
  await expect(auth.getValidToken()).rejects.toThrow(
    'The authentication service is unavailable. Please retry.',
  )
  expect(mocks.values.get('access_token')).toBe('existing-test-access')
  expect(mocks.values.get('refresh_token')).toBe('existing-test-refresh')
})

test('a revoked refresh token requires sign-in again', async () => {
  // Arrange
  mocks.values.set('access_token', 'existing-test-access')
  mocks.values.set('refresh_token', 'revoked-test-refresh')
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('', { status: 401 })),
  )
  const auth = new RaindropAuth('test-client', 'test-secret')
  // Act / Assert
  await expect(auth.getValidToken()).rejects.toThrow(
    'Session expired. Please sign in again.',
  )
  expect(auth.isAuthenticated()).toBe(false)
})

test('a restored unexpired token is used without refreshing it', async () => {
  // Arrange
  mocks.values.set('access_token', 'restored-test-access')
  mocks.values.set('expires_at', String(Date.now() + 3_600_000))
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const auth = new RaindropAuth('test-client', 'test-secret')
  // Act / Assert
  expect(await auth.getValidToken()).toBe('restored-test-access')
  expect(fetch).not.toHaveBeenCalled()
})

test('an unconfigured build reports a useful error before opening an OAuth window', async () => {
  // Arrange
  const auth = new RaindropAuth('', '')
  // Act / Assert
  await expect(auth.login()).rejects.toThrow(
    'This build is missing Raindrop.io OAuth configuration.',
  )
  expect(mocks.open).not.toHaveBeenCalled()
})

/** Provide an isolated OAuth window so callback validation can be tested without contacting the service. */
function oauthWindowFixture() {
  let callback:
    | ((
        details: { url: string },
        done: (result: { cancel: boolean }) => void,
      ) => void)
    | undefined
  let closed: (() => void) | undefined
  const intercept = vi.fn((_filter: unknown, listener?: typeof callback) => {
    callback = listener
  })
  const window = {
    webContents: { session: { webRequest: { onBeforeRequest: intercept } } },
    close: vi.fn(() => closed?.()),
    on: vi.fn((_event: string, listener: () => void) => {
      closed = listener
    }),
    loadURL: vi.fn().mockResolvedValue(undefined),
  }
  mocks.open.mockImplementation(function () {
    return window
  })
  return {
    window,
    intercept,
    receive: (url: string) => callback?.({ url }, vi.fn()),
  }
}

test('an OAuth callback with another state never exchanges its code', async () => {
  // Arrange
  const fixture = oauthWindowFixture()
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const auth = new RaindropAuth('synthetic-client', 'synthetic-secret')
  // Act
  const login = auth.login()
  const result = expect(login).rejects.toThrow(
    'The authorization response could not be verified.',
  )
  fixture.receive(
    'http://localhost/callback?code=synthetic-code&state=unexpected-state',
  )
  // Assert
  await result
  expect(fetch).not.toHaveBeenCalled()
  expect(fixture.intercept).toHaveBeenLastCalledWith(null)
  expect(fixture.window.close).toHaveBeenCalledTimes(1)
})

test('the verified OAuth callback exchanges once and stores the returned token pair', async () => {
  // Arrange
  const fixture = oauthWindowFixture()
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        access_token: 'synthetic-access',
        refresh_token: 'synthetic-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    ),
  )
  vi.stubGlobal('fetch', fetch)
  const auth = new RaindropAuth('synthetic-client', 'synthetic-secret')
  // Act
  const login = auth.login()
  const state = new URL(
    fixture.window.loadURL.mock.calls[0][0],
  ).searchParams.get('state')
  fixture.receive(
    `http://localhost/callback?code=synthetic-code&state=${state}`,
  )
  await login
  // Assert
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(mocks.values.get('access_token')).toBe('synthetic-access')
  expect(mocks.values.get('refresh_token')).toBe('synthetic-refresh')
  expect(fixture.intercept).toHaveBeenLastCalledWith(null)
})

test('an unavailable sign-in page releases the callback listener and allows a retry', async () => {
  // Arrange
  const fixture = oauthWindowFixture()
  fixture.window.loadURL.mockRejectedValueOnce(new Error('Network unavailable'))
  const auth = new RaindropAuth('synthetic-client', 'synthetic-secret')
  // Act / Assert
  await expect(auth.login()).rejects.toThrow(
    'The sign-in page could not be loaded.',
  )
  expect(fixture.intercept).toHaveBeenLastCalledWith(null)
  expect(fixture.window.close).toHaveBeenCalledTimes(1)
})
