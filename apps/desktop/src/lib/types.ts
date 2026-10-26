/**
 * Raindrop.io user profile returned from /rest/v1/user endpoint.
 * @example
 *   const user: RaindropUser = {
 *     _id: 12345,
 *     fullName: "John Doe",
 *     email: "john@example.com",
 *     avatar: "https://example.com/avatar.jpg",
 *     pro: false
 *   }
 */
export interface RaindropUser {
  _id: number
  fullName: string
  email: string
  avatar: string
  pro: boolean
}

/**
 * Authentication state shared between main and renderer processes via IPC.
 * @example
 *   // Unauthenticated
 *   const state: AuthState = { isAuthenticated: false, user: null }
 *   // Authenticated
 *   const state: AuthState = { isAuthenticated: true, user: { _id: 1, fullName: "John", ... } }
 */
export interface AuthState {
  isAuthenticated: boolean
  user: RaindropUser | null
}

/**
 * OAuth token set returned from Raindrop.io token endpoint.
 * Both access_token and refresh_token rotate on every refresh.
 * @example
 *   const tokens: RaindropTokens = {
 *     access_token: "ae261404-11r4-47c0-bce3-e18a423da828",
 *     refresh_token: "c8080368-fad2-4a3f-b2c9-71d3z85011vb",
 *     expires_in: 1209599,
 *     token_type: "Bearer"
 *   }
 */
export interface RaindropTokens {
  access_token: string
  refresh_token: string
  /** Token lifetime in seconds (~2 weeks) */
  expires_in: number
  token_type: 'Bearer'
}

/**
 * Stored token data with computed expiration timestamp.
 */
export interface StoredTokens {
  access_token: string
  refresh_token: string
  /** Epoch milliseconds when the access token expires */
  expires_at: number
}

/**
 * Auth API exposed to renderer via contextBridge.
 * All operations delegate to main process via IPC.
 */
export interface AuthAPI {
  login: () => Promise<void>
  logout: () => Promise<void>
  getUser: () => Promise<RaindropUser | null>
  getState: () => Promise<AuthState>
  /** Get a valid access token, auto-refreshing if expired. */
  getToken: () => Promise<string>
  onAuthStateChanged: (callback: (state: AuthState) => void) => () => void
}

/**
 * Shell API exposed to renderer via contextBridge for safe external URL opening.
 */
export interface ShellAPI {
  openExternal: (url: string) => Promise<void>
}

// --- Figma Make UI Types ---

export type ContentType =
  | 'link'
  | 'article'
  | 'image'
  | 'video'
  | 'document'
  | 'audio'

export type ViewMode = 'grid' | 'list' | 'table' | 'directory'

export type SortOption =
  | 'newest'
  | 'oldest'
  | 'title-asc'
  | 'title-desc'
  | 'domain'
  | 'relevance'
  | 'manual'

export type SearchScope = 'all' | 'url' | 'title' | 'description'
export type SearchMode = 'scoped' | 'global'

/**
 * Raindrop bookmark entity from the UI prototype.
 * @example
 *   const r: Raindrop = {
 *     id: "1", title: "React Docs", url: "https://react.dev",
 *     type: "link", tags: ["react"], createdAt: "2024-01-15",
 *     updatedAt: "2024-01-15", collectionId: "dev"
 *   }
 */
export type Raindrop = {
  id: string
  title: string
  url: string
  type: ContentType
  description?: string
  coverImage?: string
  favicon?: string
  domain?: string
  tags: string[]
  createdAt: string
  updatedAt: string
  collectionId: string
  isImportant?: boolean
  notes?: string
  highlights?: string[]
}

/**
 * Collection within a group, supporting nested children.
 */
export type Collection = {
  id: string
  name: string
  icon: string
  color?: string
  faviconUrl?: string
  count: number
  groupId: string
  parentId?: string
  children?: Collection[]
}

/**
 * Top-level group containing collections.
 */
export type Group = {
  id: string
  name: string
  collections: Collection[]
}

/**
 * System-level collection (All Bookmarks, Unsorted, Trash).
 */
export type SystemCollection = {
  id: string
  name: string
  icon: string
  count: number
}

declare global {
  interface Window {
    auth: AuthAPI
    shell: ShellAPI
  }
}
