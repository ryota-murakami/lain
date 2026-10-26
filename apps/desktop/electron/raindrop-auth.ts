import { BrowserWindow } from 'electron'

import type { RaindropTokens, RaindropUser } from '../src/lib/types.ts'

import { secureStore } from './secure-store.ts'

const RAINDROP_AUTH_URL = 'https://raindrop.io/oauth/authorize'
const RAINDROP_TOKEN_URL = 'https://raindrop.io/oauth/access_token'
const RAINDROP_API_BASE = 'https://api.raindrop.io/rest/v1'
const REDIRECT_URI = 'http://localhost/callback'

/** 5-minute buffer before token expiry to trigger refresh */
const REFRESH_BUFFER_MS = 5 * 60 * 1000

/**
 * Raindrop.io OAuth service for Electron main process.
 * Handles the full OAuth 2.0 Authorization Code flow:
 * 1. Opens BrowserWindow with Raindrop login page
 * 2. Intercepts redirect to capture authorization code
 * 3. Exchanges code for access/refresh tokens
 * 4. Stores tokens securely via safeStorage
 * 5. Auto-refreshes tokens before expiry
 *
 * @example
 *   const auth = new RaindropAuth("client_id", "client_secret")
 *   await auth.login()           // Opens OAuth window
 *   const user = await auth.getUser()  // Fetch user profile
 *   const token = await auth.getValidToken() // Auto-refreshes if needed
 *   await auth.logout()          // Clear all tokens
 */
export class RaindropAuth {
  #clientId: string
  #clientSecret: string
  #expiresAt = 0

  constructor(clientId: string, clientSecret: string) {
    this.#clientId = clientId
    this.#clientSecret = clientSecret
    this.#loadExpiresAt()
  }

  /**
   * Open a BrowserWindow with Raindrop.io OAuth login page.
   * Intercepts the redirect to capture the authorization code,
   * then exchanges it for tokens.
   * @returns Resolves when authentication is complete
   */
  async login(): Promise<void> {
    const code = await this.#getAuthorizationCode()
    await this.#exchangeCode(code)
  }

  /**
   * Refresh the access token using the stored refresh token.
   * Both tokens rotate on every refresh — the new pair is stored.
   * @returns New token set
   */
  async refreshTokens(): Promise<RaindropTokens> {
    const refreshToken = secureStore.get('refresh_token')
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await fetch(RAINDROP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.#clientId,
        client_secret: this.#clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      secureStore.clear()
      this.#expiresAt = 0
      throw new Error('Token refresh failed — re-authentication required')
    }

    const tokens = (await response.json()) as RaindropTokens
    this.#storeTokens(tokens)
    return tokens
  }

  /**
   * Get a valid access token, auto-refreshing if expired or about to expire.
   * @returns Valid access token string
   * @throws If not authenticated or refresh fails
   */
  async getValidToken(): Promise<string> {
    const token = secureStore.get('access_token')
    if (!token) {
      throw new Error('Not authenticated')
    }

    if (Date.now() >= this.#expiresAt - REFRESH_BUFFER_MS) {
      await this.refreshTokens()
      return secureStore.get('access_token')!
    }

    return token
  }

  /**
   * Fetch the authenticated user's profile from Raindrop.io.
   * @returns User profile or null if not authenticated
   * @example
   *   const user = await auth.getUser()
   *   console.log(user?.fullName) // => "John Doe"
   */
  async getUser(): Promise<RaindropUser | null> {
    try {
      const token = await this.getValidToken()
      const response = await fetch(`${RAINDROP_API_BASE}/user`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) return null

      const data = (await response.json()) as { user: RaindropUser }
      return data.user
    } catch {
      return null
    }
  }

  /** Clear all stored tokens and reset auth state. */
  async logout(): Promise<void> {
    secureStore.clear()
    this.#expiresAt = 0
  }

  /**
   * Check if tokens exist in secure storage.
   * @returns true if access_token is stored
   */
  isAuthenticated(): boolean {
    return secureStore.get('access_token') !== null
  }

  /**
   * Exchange authorization code for access and refresh tokens.
   * @param code - Authorization code from OAuth redirect
   * @returns Token set from Raindrop.io
   */
  async #exchangeCode(code: string): Promise<RaindropTokens> {
    const response = await fetch(RAINDROP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: this.#clientId,
        client_secret: this.#clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Token exchange failed: ${error}`)
    }

    const tokens = (await response.json()) as RaindropTokens
    this.#storeTokens(tokens)
    return tokens
  }

  /**
   * Open a BrowserWindow for Raindrop OAuth and capture the authorization code.
   * Uses webRequest.onBeforeRequest to intercept the redirect before it navigates,
   * so the redirect URI doesn't need to resolve to a real server.
   */
  async #getAuthorizationCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      const authUrl = new URL(RAINDROP_AUTH_URL)
      authUrl.searchParams.set('client_id', this.#clientId)
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
      authUrl.searchParams.set('response_type', 'code')

      const authWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: 'Login to Raindrop.io',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      })

      const filter = { urls: [`${REDIRECT_URI}*`] }

      authWindow.webContents.session.webRequest.onBeforeRequest(
        filter,
        (details, callback) => {
          const url = new URL(details.url)
          const code = url.searchParams.get('code')
          const error = url.searchParams.get('error')

          // Cancel the request — we don't need it to actually navigate
          callback({ cancel: true })

          authWindow.close()

          if (error) {
            reject(new Error(`Authorization denied: ${error}`))
          } else if (code) {
            resolve(code)
          } else {
            reject(new Error('No authorization code received'))
          }
        },
      )

      authWindow.on('closed', () => {
        reject(new Error('Authentication window was closed'))
      })

      authWindow.loadURL(authUrl.toString())
    })
  }

  /**
   * Store tokens securely and update in-memory expiration timestamp.
   * @param tokens - Token set from Raindrop.io
   */
  #storeTokens(tokens: RaindropTokens): void {
    this.#expiresAt = Date.now() + tokens.expires_in * 1000
    secureStore.set('access_token', tokens.access_token)
    secureStore.set('refresh_token', tokens.refresh_token)
    secureStore.set('expires_at', String(this.#expiresAt))
  }

  /** Load expiration timestamp from storage on startup. */
  #loadExpiresAt(): void {
    const expiresAt = secureStore.get('expires_at')
    if (expiresAt) {
      this.#expiresAt = Number(expiresAt)
    }
  }
}
