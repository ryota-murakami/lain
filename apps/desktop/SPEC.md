# Lain — Product & Technical Specification

> Raindrop.io Desktop Client for macOS

**Version:** 0.1.0
**Date:** 2026-09-23
**Status:** Alpha (v0.1.0 released 2026-09-23 — phases P1–P7 delivered)

Desktop file paths in this specification are relative to `apps/desktop/` unless stated otherwise. See the [repository README](../../README.md) for current workspace commands and CI configuration.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [State Management — Redux Toolkit + RTK Query](#3-state-management)
4. [API ↔ UI Mapping](#4-api--ui-mapping)
5. [Feature Specifications](#5-feature-specifications)
6. [Keyboard Shortcuts & Shortcut Editor](#6-keyboard-shortcuts--shortcut-editor)
7. [Development Infrastructure](#7-development-infrastructure)
8. [App Icons & Assets](#8-app-icons--assets)
9. [Landing Page](#9-landing-page)
10. [Implementation Phases](#10-implementation-phases)

---

## 1. Product Overview

### 1.1 Vision

Lain is a **macOS-native** Raindrop.io desktop client built for power users who manage 1,000+ bookmarks. It provides superior search, organization, and browsing experiences beyond what the Raindrop.io web app offers.

### 1.2 Target Users

| Persona                | Description                                  | Key Need                                            |
| ---------------------- | -------------------------------------------- | --------------------------------------------------- |
| **Power Organizer**    | 2,000+ bookmarks, 50+ collections, daily use | Fast navigation, bulk operations, keyboard-driven   |
| **Research Collector** | Saves articles/papers, tags extensively      | Field-specific search, scoped search, auto-icons    |
| **Developer**          | Bookmarks docs/repos/tools, values structure | Directory view, URL-only search, keyboard shortcuts |

### 1.3 Core Value Propositions

1. **Scoped & Field-Specific Search** — Search within current collection, filter by URL/title/description
2. **Multiple View Modes** — Grid, List, Table, Directory (Unix-style tree)
3. **Keyboard-First UX** — Customizable shortcuts, full navigation without mouse
4. **Drag & Drop Organization** — Move collections between groups, reorder freely
5. **Auto-Icon Detection** — Automatically fetch and assign favicons
6. **Fuzzy Collection Search** — Find collections by approximate name
7. **Native macOS Experience** — Electron with Apple HIG design principles

### 1.4 Tech Stack

| Layer            | Technology                                                     |
| ---------------- | -------------------------------------------------------------- |
| Runtime          | Electron 40+ (macOS only)                                      |
| Renderer         | React 19 + Vite 7                                              |
| UI               | shadcn/ui + Tailwind CSS v4 (OKLCH)                            |
| State            | Redux Toolkit + RTK Query (axios baseQuery)                    |
| HTTP             | Axios (interceptor-based error handling)                       |
| Forms            | React Hook Form + Zod 4                                        |
| DnD              | @dnd-kit (React 19 compatible)                                 |
| Pattern Matching | ts-pattern                                                     |
| Testing          | Vitest + happy-dom + MSW (unit), Playwright (E2E)              |
| Persistence      | @laststance/redux-storage-middleware + electron-store (secure) |

---

## 2. Architecture Overview

### 2.1 Process Model

```
┌─────────────────────────────────────────────────────┐
│  Main Process (Node.js)                             │
│  ├── RaindropAuth (OAuth, token management)         │
│  ├── SecureStore (electron safeStorage)             │
│  ├── IPC Handlers (auth, shell, token)              │
│  └── System Integration (tray, auto-update, menus)  │
└──────────────────────┬──────────────────────────────┘
                       │ IPC (contextBridge)
┌──────────────────────┴──────────────────────────────┐
│  Renderer Process (Chromium)                        │
│  ├── React 19 App                                   │
│  │   ├── Redux Store                                │
│  │   │   ├── RTK Query (raindropApi)                │
│  │   │   ├── uiSlice, searchSlice, dialogSlice      │
│  │   │   └── settingsSlice                          │
│  │   ├── Axios Instance (interceptors)              │
│  │   └── Component Tree                             │
│  │       ├── ThemeProvider                           │
│  │       ├── AuthProvider                            │
│  │       ├── LoginScreen | MainApp                   │
│  │       └── 3-Panel Layout                          │
│  └── Tailwind CSS v4 + shadcn/ui                    │
└─────────────────────────────────────────────────────┘
```

### 2.2 File Structure (Current + Planned)

```
lain/
├── electron/
│   ├── main.ts                    # App lifecycle, IPC handlers
│   ├── preload.ts                 # contextBridge (auth, shell, token)
│   ├── raindrop-auth.ts           # OAuth 2.0 service
│   └── secure-store.ts            # safeStorage wrapper
├── src/
│   ├── App.tsx                    # Root: ThemeProvider → AuthProvider → MainApp
│   ├── components/
│   │   ├── main-app.tsx           # 3-panel layout coordinator
│   │   ├── theme-provider.tsx     # Light/Dark/System theme
│   │   ├── LoginScreen.tsx        # OAuth login UI
│   │   ├── raindrop/              # 22 feature components
│   │   │   ├── left-sidebar.tsx
│   │   │   ├── main-content.tsx
│   │   │   ├── right-detail-panel.tsx
│   │   │   ├── table-view.tsx
│   │   │   ├── directory-view.tsx
│   │   │   ├── raindrop-card.tsx
│   │   │   ├── raindrop-list-item.tsx
│   │   │   ├── global-search-command.tsx
│   │   │   ├── add-bookmark-dialog.tsx
│   │   │   ├── collection-dialog.tsx
│   │   │   ├── collection-selector.tsx
│   │   │   ├── collection-search.tsx
│   │   │   ├── group-dialog.tsx
│   │   │   ├── tag-management.tsx
│   │   │   ├── tag-input.tsx
│   │   │   ├── color-picker.tsx
│   │   │   ├── icon-picker.tsx
│   │   │   ├── merge-dialog.tsx
│   │   │   ├── drag-preview.tsx
│   │   │   ├── drop-indicator.tsx
│   │   │   ├── favicon-icon.tsx
│   │   │   ├── theme-toggle.tsx
│   │   │   └── shortcut-editor.tsx    # NEW: P5
│   │   └── ui/                    # shadcn/ui primitives (~40 components)
│   ├── contexts/
│   │   └── AuthContext.tsx         # React context for auth state
│   ├── store/                     # NEW: P1
│   │   ├── index.ts               # configureStore
│   │   ├── hooks.ts               # useAppDispatch, useAppSelector
│   │   ├── api/
│   │   │   └── raindropApi.ts     # RTK Query (generated from OpenAPI)
│   │   └── slices/
│   │       ├── uiSlice.ts         # viewMode, selectedCollection, panels
│   │       ├── searchSlice.ts     # query, scope, filters, recent
│   │       ├── dialogSlice.ts     # dialog open/close states
│   │       └── settingsSlice.ts   # shortcuts, preferences
│   ├── lib/
│   │   ├── types.ts               # All type definitions
│   │   ├── axios.ts               # NEW: Axios instance + interceptors
│   │   ├── axiosBaseQuery.ts      # NEW: RTK Query ← axios adapter
│   │   └── utils.ts               # cn() helper
│   ├── hooks/                     # NEW: P5
│   │   └── useKeyboardShortcuts.ts
│   ├── utils/
│   │   ├── favicon.ts             # Favicon URL helpers
│   │   └── dnd-types.ts           # @dnd-kit type helpers
│   ├── data/
│   │   └── mock-data.ts           # TO BE REMOVED in P2
│   ├── test/                      # NEW: P1
│   │   ├── setup.ts               # happy-dom, MSW server
│   │   └── mocks/
│   │       ├── handlers.ts        # MSW request handlers
│   │       └── server.ts          # MSW setupServer
│   └── index.css                  # Tailwind v4 + theme tokens
├── e2e/                           # NEW: P1
│   ├── fixtures/
│   │   └── electron.ts
│   ├── pages/
│   │   ├── login.page.ts
│   │   ├── sidebar.page.ts
│   │   └── main-content.page.ts
│   └── specs/
│       ├── auth.spec.ts
│       ├── crud.spec.ts
│       ├── search.spec.ts
│       ├── dnd.spec.ts
│       └── keyboard.spec.ts
├── build/                         # NEW: P7
│   └── icons/
│       ├── icon.icns
│       └── trayTemplate@2x.png
├── raindrop-openapi-3.0.3.json    # API spec source
├── rtk-codegen.config.ts          # NEW: P1
├── vitest.config.ts               # NEW: P1
├── playwright.config.ts           # NEW: P1
├── SPEC.md                        # This file
└── package.json
```

### 2.3 Security Model

| Concern            | Approach                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| Token storage      | `electron safeStorage` → OS keychain (not localStorage)                          |
| Renderer isolation | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`              |
| IPC validation     | `validateSender()` checks `BrowserWindow.fromWebContents()`                      |
| External URLs      | Protocol validation (`https://` or `http://` only) before `shell.openExternal()` |
| API auth           | Token injected via axios interceptor, never exposed to renderer globals          |

---

## 3. State Management

### 3.1 RTK Query Codegen

**Tool:** `@rtk-query/codegen-openapi`
**Source:** `raindrop-openapi-3.0.3.json`
**Output:** `src/store/api/raindropApi.ts` (generated, gitignored)

**Config** (`rtk-codegen.config.ts`):

```ts
import type { ConfigFile } from '@rtk-query/codegen-openapi'

const config: ConfigFile = {
  schemaFile: './raindrop-openapi-3.0.3.json',
  apiFile: './src/store/api/emptyApi.ts',
  outputFile: './src/store/api/raindropApi.ts',
  exportName: 'raindropApi',
  hooks: true,
  tag: true,
}

export default config
```

**Generated Endpoints:**

| Category    | Endpoints                                                                                                              | Hooks Generated                                                                                                                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raindrops   | GET list, GET single, POST create, PUT update, DELETE remove, PUT batch update, POST batch create, DELETE batch delete | `useGetRaindropsQuery`, `useGetRaindropQuery`, `useCreateRaindropMutation`, `useUpdateRaindropMutation`, `useDeleteRaindropMutation`, `useBatchUpdateRaindropsMutation`, `useBatchCreateRaindropsMutation`, `useBatchDeleteRaindropsMutation`             |
| Collections | GET root, GET children, POST create, PUT update, DELETE remove, PUT reorder, PUT merge, DELETE remove empty            | `useGetCollectionsQuery`, `useGetChildCollectionsQuery`, `useCreateCollectionMutation`, `useUpdateCollectionMutation`, `useDeleteCollectionMutation`, `useReorderCollectionsMutation`, `useMergeCollectionsMutation`, `useRemoveEmptyCollectionsMutation` |
| Tags        | GET all, GET by collection, PUT rename, DELETE remove                                                                  | `useGetTagsQuery`, `useGetTagsByCollectionQuery`, `useRenameTagMutation`, `useDeleteTagMutation`                                                                                                                                                          |
| User        | GET profile, PUT update                                                                                                | `useGetUserQuery`, `useUpdateUserMutation`                                                                                                                                                                                                                |
| Filters     | GET by collection                                                                                                      | `useGetFiltersQuery`                                                                                                                                                                                                                                      |
| Suggest     | GET for new, GET for existing                                                                                          | `useSuggestNewQuery`, `useSuggestExistingQuery`                                                                                                                                                                                                           |
| Import      | POST parse URL                                                                                                         | `useParseUrlMutation`                                                                                                                                                                                                                                     |
| Export      | GET export                                                                                                             | `useExportRaindropsQuery`                                                                                                                                                                                                                                 |
| Backups     | GET list, POST generate                                                                                                | `useGetBackupsQuery`, `useGenerateBackupMutation`                                                                                                                                                                                                         |

**Cache Invalidation Tags:**

```ts
// Tag types for automatic cache invalidation
tagTypes: ['Raindrop', 'Collection', 'Tag', 'User', 'Filter', 'Backup']

// Example: creating a raindrop invalidates the list
createRaindrop: build.mutation({
  invalidatesTags: [{ type: 'Raindrop', id: 'LIST' }],
})
```

### 3.2 Axios-based BaseQuery (Error Handling 集約)

**Design Philosophy:** Centralize all error handling, toast notifications, and error reporting in axios interceptors. Application code only handles success paths.

**Reference:** [`laststance/utils` — `browserAxios.ts`](https://github.com/laststance/utils/blob/main/packages/next-react/lib/axios/browserAxios.ts)

#### `src/lib/axios.ts` — Lain Axios Instance

```ts
import originalAxios from 'axios'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'

/**
 * Lain axios instance with centralized error handling via interceptors.
 * All Raindrop.io API calls go through this instance.
 * Error toasts and error reporting are handled here — application code
 * only needs to handle the success path.
 *
 * @example
 *   // Direct usage (rare — prefer RTK Query hooks)
 *   const { data } = await lainAxios.get('/user')
 *
 *   // Via RTK Query (primary usage)
 *   const { data: user } = useGetUserQuery()
 *   // Errors are automatically toasted by interceptor
 */
export const lainAxios = originalAxios.create({
  baseURL: 'https://api.raindrop.io/rest/v1',
  timeout: 10_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

// Error type classification
const NETWORK_ERROR = 'NETWORK_ERROR'
const TIMEOUT_ERROR = 'TIMEOUT_ERROR'
const SERVER_ERROR = 'SERVER_ERROR'
const UNAUTHORIZED_ERROR = 'UNAUTHORIZED_ERROR'
const RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR'
const UNKNOWN_ERROR = 'UNKNOWN_ERROR'

type ProblemType =
  | typeof NETWORK_ERROR
  | typeof TIMEOUT_ERROR
  | typeof SERVER_ERROR
  | typeof UNAUTHORIZED_ERROR
  | typeof RATE_LIMIT_ERROR
  | typeof UNKNOWN_ERROR

const in500s = (n: number): boolean => n >= 500 && n <= 599

/**
 * Classify an axios error into a problem type.
 * @param error - AxiosError instance
 * @returns Problem type string for switch-case handling
 */
function getProblemFromError(error: AxiosError): ProblemType {
  if (error.message === 'Network Error') return NETWORK_ERROR
  if (error.code === 'ECONNABORTED') return TIMEOUT_ERROR

  const status = error.response?.status
  if (status === undefined) return UNKNOWN_ERROR
  if (status === 401) return UNAUTHORIZED_ERROR
  if (status === 429) return RATE_LIMIT_ERROR
  if (in500s(status)) return SERVER_ERROR
  return UNKNOWN_ERROR
}

// --- Request Interceptor ---
// Inject Bearer token from Electron main process on every request
lainAxios.interceptors.request.use(async (config) => {
  const token = await window.auth.getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// --- Response Interceptor ---
// Centralized error handling with toast notifications
lainAxios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    switch (getProblemFromError(error)) {
      case NETWORK_ERROR:
        toast.error('Network error. Please check your connection.')
        break
      case TIMEOUT_ERROR:
        toast.error('Request timed out. Please try again.')
        break
      case SERVER_ERROR:
        toast.error('Server error. Please try again later.')
        break
      case UNAUTHORIZED_ERROR:
        // Attempt token refresh once, then logout
        // (Handled by retry logic below)
        break
      case RATE_LIMIT_ERROR:
        toast.error('Too many requests. Please wait a moment.')
        break
      case UNKNOWN_ERROR:
      default:
        toast.error('An unexpected error occurred.')
        // Future: Sentry.captureException(error)
        break
    }
    return Promise.reject(error)
  },
)
```

#### `src/lib/axiosBaseQuery.ts` — RTK Query Adapter

```ts
import type { BaseQueryFn } from '@reduxjs/toolkit/query'
import type { AxiosRequestConfig, Method } from 'axios'
import { lainAxios } from './axios'

/**
 * Custom baseQuery for RTK Query that uses the Lain axios instance.
 * Error handling (toasts, reporting) is managed by axios interceptors,
 * so this adapter only needs to propagate errors for RTK Query state.
 *
 * @example
 *   // In RTK Query API definition
 *   export const raindropApi = createApi({
 *     baseQuery: axiosBaseQuery(),
 *     endpoints: (build) => ({ ... })
 *   })
 *
 * @returns BaseQueryFn compatible with RTK Query
 */
export function axiosBaseQuery(): BaseQueryFn<
  { url: string; method?: Method; data?: unknown; params?: unknown },
  unknown,
  unknown
> {
  return async ({ url, method = 'GET', data, params }) => {
    try {
      const result = await lainAxios({
        url,
        method,
        data,
        params,
      } satisfies AxiosRequestConfig)
      return { data: result.data }
    } catch (error) {
      // Error toast already displayed by interceptor
      // Propagate to RTK Query for isError state
      return { error }
    }
  }
}
```

**Application Code Simplification:**

```tsx
// ❌ BEFORE: Manual error handling in every component
const handleSave = async () => {
  try {
    await updateRaindrop(data).unwrap()
    toast.success('Saved successfully')
  } catch (e) {
    toast.error('Failed to save')
    console.error(e)
    // Sentry.captureException(e)
  }
}

// ✅ AFTER: Interceptor handles errors, component handles success only
const [updateRaindrop] = useUpdateRaindropMutation()
const handleSave = async () => {
  const result = await updateRaindrop(data)
  if ('data' in result) {
    toast.success('Saved successfully')
  }
  // Error toast is automatically shown by axios interceptor
}
```

### 3.3 Electron IPC Token Bridge

**Current State:** `window.auth` exposes `login`, `logout`, `getUser`, `getState`, `onAuthStateChanged`.

**Addition:** `window.auth.getToken()` — Returns a valid access token (auto-refreshes if expired).

**`electron/main.ts`** — New IPC handler:

```ts
ipcMain.handle('auth:get-token', async (event) => {
  validateSender(event)
  return auth.getValidToken() // RaindropAuth already handles refresh
})
```

**`electron/preload.ts`** — New bridge:

```ts
getToken: (): Promise<string> => ipcRenderer.invoke("auth:get-token"),
```

**`src/lib/types.ts`** — Updated AuthAPI:

```ts
export interface AuthAPI {
  login: () => Promise<void>
  logout: () => Promise<void>
  getUser: () => Promise<RaindropUser | null>
  getState: () => Promise<AuthState>
  getToken: () => Promise<string> // NEW
  onAuthStateChanged: (callback: (state: AuthState) => void) => () => void
}
```

**Flow:**

```
Component → RTK Query hook → axiosBaseQuery → lainAxios
  → request interceptor → window.auth.getToken()
    → IPC → main process → RaindropAuth.getValidToken()
      → (token valid? return : refresh → return)
    → Bearer token injected into request header
  → Raindrop.io API
  → response interceptor → (error? toast + propagate : return data)
→ RTK Query cache → Component re-render
```

### 3.4 Store Architecture

```ts
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit'
import { raindropApi } from './api/raindropApi'
import { uiSlice } from './slices/uiSlice'
import { searchSlice } from './slices/searchSlice'
import { dialogSlice } from './slices/dialogSlice'
import { settingsSlice } from './slices/settingsSlice'
import { createStorageMiddleware } from '@laststance/redux-storage-middleware'

const storageMiddleware = createStorageMiddleware({
  key: 'lain-state',
  whitelist: ['ui', 'search.recentSearches', 'settings'],
})

export const store = configureStore({
  reducer: {
    [raindropApi.reducerPath]: raindropApi.reducer,
    ui: uiSlice.reducer,
    search: searchSlice.reducer,
    dialog: dialogSlice.reducer,
    settings: settingsSlice.reducer,
  },
  middleware: (getDefault) =>
    getDefault().concat(raindropApi.middleware, storageMiddleware),
})
```

#### Slices

**uiSlice:**

```ts
{
  viewMode: ViewMode        // 'grid' | 'list' | 'table' | 'directory'
  selectedCollectionId: string  // 'all' | 'unsorted' | 'trash' | collection._id
  isDetailPanelOpen: boolean
  sidebarWidth: number      // persisted
  selectedRaindropIds: string[]
  collectionViewModes: Record<string, ViewMode>  // per-collection preference
}
```

**searchSlice:**

```ts
{
  query: string
  scope: SearchScope        // 'all' | 'url' | 'title' | 'description'
  isSearchOpen: boolean
  recentSearches: string[]  // persisted, max 20
}
```

**dialogSlice:**

```ts
{
  addBookmark: { open: boolean; defaultCollectionId?: string }
  collectionDialog: { open: boolean; editingId?: string }
  groupDialog: { open: boolean; editingId?: string }
  tagManagement: { open: boolean }
  mergeDialog: { open: boolean }
  settings: { open: boolean; tab?: string }
}
```

**settingsSlice:**

```ts
{
  shortcuts: ShortcutMap // persisted
  theme: 'light' | 'dark' | 'system' // persisted
  defaultViewMode: ViewMode // persisted
}
```

### 3.5 Persistence — @laststance/redux-storage-middleware

**What is persisted:**

- `uiSlice`: viewMode, sidebarWidth, collectionViewModes
- `searchSlice`: recentSearches
- `settingsSlice`: shortcuts, theme, defaultViewMode

**What is NOT persisted:**

- RTK Query cache (managed by RTK Query itself)
- Dialog open/close states (always start closed)
- selectedCollectionId (always start at 'all')
- selectedRaindropIds (selection is ephemeral)

**Storage key:** `lain-state` in localStorage

### 3.6 ts-pattern Integration

**Install:** `pnpm add ts-pattern`

**Usage Patterns:**

```tsx
import { match } from 'ts-pattern'

// API state handling — exhaustive match prevents forgotten states
match(raindropsQuery)
  .with({ status: 'pending' }, () => <RaindropSkeleton />)
  .with({ status: 'fulfilled' }, ({ data }) => (
    <RaindropGrid items={data.items} />
  ))
  .with({ status: 'rejected' }, ({ error }) => <ErrorState error={error} />)
  .exhaustive()

// View mode rendering — compile-time safety for all modes
match(viewMode)
  .with('grid', () => <RaindropGrid items={raindrops} />)
  .with('list', () => <RaindropList items={raindrops} />)
  .with('table', () => <TableView items={raindrops} />)
  .with('directory', () => <DirectoryView items={raindrops} />)
  .exhaustive()

// Content type icons — every type mapped
match(raindrop.type)
  .with('link', () => <LinkIcon />)
  .with('article', () => <FileTextIcon />)
  .with('image', () => <ImageIcon />)
  .with('video', () => <VideoIcon />)
  .with('document', () => <FileIcon />)
  .with('audio', () => <MusicIcon />)
  .exhaustive()

// Error classification in axios interceptor
match(getProblemFromError(error))
  .with('NETWORK_ERROR', () => toast.error('Network error...'))
  .with('TIMEOUT_ERROR', () => toast.error('Timed out...'))
  .with('SERVER_ERROR', () => toast.error('Server error...'))
  .with('UNAUTHORIZED_ERROR', () => handleTokenRefresh())
  .with('RATE_LIMIT_ERROR', () => toast.error('Rate limited...'))
  .with('UNKNOWN_ERROR', () => toast.error('Unexpected error...'))
  .exhaustive()
```

---

## 4. API ↔ UI Mapping

### 4.1 Raindrop.io API Overview

| Property               | Value                                                 |
| ---------------------- | ----------------------------------------------------- |
| Base URL               | `https://api.raindrop.io/rest/v1`                     |
| Auth                   | OAuth 2.0 Bearer Token                                |
| Rate Limit             | Not officially documented; handle 429 gracefully      |
| Pagination             | Offset-based: `page` (0-indexed) + `perpage` (max 50) |
| Special Collection IDs | `0` = All, `-1` = Unsorted, `-99` = Trash             |

### 4.2 Endpoint → Component Matrix

| #   | API Endpoint                       | Method | UI Component(s)                              | User Action                                   |
| --- | ---------------------------------- | ------ | -------------------------------------------- | --------------------------------------------- |
| 1   | `/raindrops/{collectionId}`        | GET    | `main-content.tsx`                           | Browse bookmarks in collection                |
| 2   | `/raindrop/{id}`                   | GET    | `right-detail-panel.tsx`                     | View bookmark details                         |
| 3   | `/raindrop`                        | POST   | `add-bookmark-dialog.tsx`                    | Create new bookmark                           |
| 4   | `/raindrop/{id}`                   | PUT    | `right-detail-panel.tsx`                     | Edit bookmark (title, tags, notes)            |
| 5   | `/raindrop/{id}`                   | DELETE | `right-detail-panel.tsx`, `main-content.tsx` | Delete bookmark                               |
| 6   | `/raindrop/{id}/cover`             | PUT    | `right-detail-panel.tsx`                     | Upload cover image                            |
| 7   | `/raindrop/{id}/cache`             | GET    | — (redirect)                                 | Open permanent copy                           |
| 8   | `/raindrop/suggest`                | GET    | `add-bookmark-dialog.tsx`                    | Auto-fill URL metadata                        |
| 9   | `/raindrop/{id}/suggest`           | GET    | `right-detail-panel.tsx`                     | Re-fetch metadata for existing                |
| 10  | `/raindrop/file`                   | PUT    | `add-bookmark-dialog.tsx`                    | Upload file as bookmark                       |
| 11  | `/raindrops`                       | POST   | — (bulk import)                              | Batch create (≤100)                           |
| 12  | `/raindrops/{collectionId}`        | PUT    | `main-content.tsx` (bulk bar)                | Batch update (move, tag, important)           |
| 13  | `/raindrops/{collectionId}`        | DELETE | `main-content.tsx` (bulk bar)                | Batch delete to Trash / purge                 |
| 14  | `/collections`                     | GET    | `left-sidebar.tsx`                           | Load root collection tree                     |
| 15  | `/collections/childrens`           | GET    | `left-sidebar.tsx`                           | Load nested collections                       |
| 16  | `/collection`                      | POST   | `collection-dialog.tsx`                      | Create collection                             |
| 17  | `/collection/{id}`                 | GET    | `collection-dialog.tsx`                      | Load collection for editing                   |
| 18  | `/collection/{id}`                 | PUT    | `collection-dialog.tsx`, `left-sidebar.tsx`  | Update collection (name, icon, color, parent) |
| 19  | `/collection/{id}`                 | DELETE | `left-sidebar.tsx` (context menu)            | Delete collection                             |
| 20  | `/collection/{id}/cover`           | PUT    | `collection-dialog.tsx`                      | Upload collection cover                       |
| 21  | `/collections`                     | PUT    | `left-sidebar.tsx` (DnD)                     | Reorder / expand / collapse                   |
| 22  | `/collections/merge`               | PUT    | `merge-dialog.tsx`                           | Merge collections                             |
| 23  | `/collections/clean`               | PUT    | — (settings)                                 | Remove empty collections                      |
| 24  | `/collections/trash`               | DELETE | `left-sidebar.tsx` (Trash)                   | Empty trash                                   |
| 25  | `/tags/{collectionId}`             | GET    | `tag-management.tsx`, `left-sidebar.tsx`     | List tags                                     |
| 26  | `/tags/0`                          | GET    | `tag-management.tsx`                         | List all tags                                 |
| 27  | `/tags`                            | PUT    | `tag-management.tsx`                         | Rename tag                                    |
| 28  | `/tags`                            | DELETE | `tag-management.tsx`                         | Delete tag(s)                                 |
| 29  | `/user`                            | GET    | Auth context, settings                       | Current user profile                          |
| 30  | `/user`                            | PUT    | — (settings)                                 | Update user preferences                       |
| 31  | `/user/{id}`                       | GET    | —                                            | Public user profile                           |
| 32  | `/filters/{collectionId}`          | GET    | `left-sidebar.tsx`                           | Type/tag filter counts                        |
| 33  | `/import/url`                      | POST   | `add-bookmark-dialog.tsx`                    | Parse URL metadata                            |
| 34  | `/raindrops/{collectionId}/export` | GET    | — (settings/export)                          | Export as HTML/CSV                            |
| 35  | `/backups`                         | GET    | — (settings)                                 | List backups                                  |
| 36  | `/backup`                          | POST   | — (settings)                                 | Generate backup                               |

> **Note:** OAuth endpoints (`/oauth/authorize`, `/oauth/access_token`) are handled by `electron/raindrop-auth.ts` in the main process and are not mapped to UI components.

### 4.3 Raindrop.io Data Models (API Response Shapes)

```ts
// Raindrop (API response)
interface RaindropApiResponse {
  _id: number
  title: string
  excerpt: string // description
  link: string // URL
  type: 'link' | 'article' | 'image' | 'video' | 'document' | 'audio'
  cover: string // cover image URL
  tags: string[]
  important: boolean
  domain: string
  created: string // ISO date
  lastUpdate: string // ISO date
  collection: { $id: number } // collection reference
  media: Array<{ link: string; type: string }>
  note: string // user notes (Markdown)
  highlights: string[]
  removed: boolean
  sort: number
}

// Collection (API response)
interface CollectionApiResponse {
  _id: number
  title: string
  parent: { $id: number } | null
  color: string | null
  cover: string[]
  count: number
  expanded: boolean
  sort: number
  view: 'list' | 'simple' | 'grid' | 'masonry'
  access: { level: number; draggable: boolean }
  creatorRef: { _id: number }
}

// Pagination wrapper
interface PaginatedResponse<T> {
  result: boolean
  items: T[]
  count: number // total items
  collectionId: number
}
```

### 4.4 Pagination Strategy

Raindrop.io uses offset pagination: `page` (0-indexed) + `perpage` (max 50).

**Approach:** RTK Query with infinite scroll:

- Initial load: `page=0, perpage=50`
- Scroll to bottom: trigger next page fetch
- RTK Query `serializeQueryArgs` to merge pages into single cache entry
- `forceRefetch` to append new pages

```ts
getRaindrops: build.query({
  query: ({ collectionId, page = 0, perpage = 50, search, sort }) => ({
    url: `/raindrops/${collectionId}`,
    params: { page, perpage, search, sort },
  }),
  serializeQueryArgs: ({ queryArgs }) => queryArgs.collectionId,
  merge: (currentCache, newItems) => {
    currentCache.items.push(...newItems.items)
  },
  forceRefetch: ({ currentArg, previousArg }) =>
    currentArg?.page !== previousArg?.page,
  providesTags: (result) =>
    result
      ? [
          ...result.items.map(({ _id }) => ({
            type: 'Raindrop' as const,
            id: _id,
          })),
          { type: 'Raindrop', id: 'LIST' },
        ]
      : [{ type: 'Raindrop', id: 'LIST' }],
})
```

### 4.5 Type Mapping (API → UI)

The current UI types in `src/lib/types.ts` use string IDs. The API uses numeric `_id`. Mapping layer:

```ts
/**
 * Convert API raindrop response to UI Raindrop type.
 * @param api - Raw API response
 * @returns UI-compatible Raindrop object
 * @example
 *   toUiRaindrop({ _id: 123, link: 'https://...', ... })
 *   // => { id: '123', url: 'https://...', ... }
 */
function toUiRaindrop(api: RaindropApiResponse): Raindrop {
  return {
    id: String(api._id),
    title: api.title,
    url: api.link,
    type: api.type,
    description: api.excerpt,
    coverImage: api.cover || undefined,
    domain: api.domain,
    tags: api.tags,
    createdAt: api.created,
    updatedAt: api.lastUpdate,
    collectionId: String(api.collection.$id),
    isImportant: api.important,
    notes: api.note || undefined,
    highlights: api.highlights,
  }
}
```

---

## 5. Feature Specifications

### F1: Scoped Search — Search Range Fixed to Current Folder

**User Story:** As a user browsing a specific collection, I want to search only within that collection so I can find bookmarks without noise from other collections.

**Behavior:**

1. When in a collection (e.g., "React Resources"), the search bar shows a scope badge: "🔍 in React Resources"
2. Search queries are sent to `GET /raindrops/{collectionId}?search=query`
3. When in "All Bookmarks" (id=0), search spans all collections
4. User can toggle scope via a button: "Search in [collection]" ↔ "Search everywhere"

**API Mapping:**

- `GET /raindrops/{collectionId}?search={query}` — Collection-scoped
- `GET /raindrops/0?search={query}` — Global search

**UI Changes:**

- `main-content.tsx`: Search input in header toolbar, scope badge
- `global-search-command.tsx`: ⌘K command palette also respects current scope

**Acceptance Criteria:**

- [ ] Search only returns results from current collection when scoped
- [ ] Scope badge shows current collection name
- [ ] Toggle to global search is one click away
- [ ] Empty state shows "No results in [collection]" with option to search globally

### F2: Field-Specific Search

**User Story:** As a developer, I want to search only by URL to find bookmarks for a specific domain, or only by title to find a remembered page name.

**Behavior:**

1. Search bar has a dropdown to select scope: All Fields / URL Only / Title Only / Description Only
2. Raindrop.io API `search` param supports limited operators:
   - `#tag` — search by tag
   - `link:domain.com` — search by domain
   - Free text — searches title + excerpt
3. For field-specific search beyond API capabilities, use client-side post-filtering

**Implementation:**

```ts
type SearchScope = 'all' | 'url' | 'title' | 'description'

// API search with operators
const buildSearchQuery = (query: string, scope: SearchScope): string => {
  switch (scope) {
    case 'url':
      // Use link: operator for domain, post-filter for full URL match
      const domain = extractDomain(query)
      return domain ? `link:${domain}` : query
    case 'title':
    case 'description':
      // API doesn't support field restriction — use full search + client filter
      return query
    case 'all':
    default:
      return query
  }
}

// Client-side post-filter for precise field matching
const filterByScope = (
  items: Raindrop[],
  query: string,
  scope: SearchScope,
): Raindrop[] =>
  match(scope)
    .with('url', () =>
      items.filter((r) => r.url.toLowerCase().includes(query.toLowerCase())),
    )
    .with('title', () =>
      items.filter((r) => r.title.toLowerCase().includes(query.toLowerCase())),
    )
    .with('description', () =>
      items.filter((r) =>
        r.description?.toLowerCase().includes(query.toLowerCase()),
      ),
    )
    .with('all', () => items)
    .exhaustive()
```

**UI Changes:**

- `global-search-command.tsx`: SearchScope selector dropdown
- `main-content.tsx`: Scope selector in search toolbar
- Search results highlight matched field

**Acceptance Criteria:**

- [ ] URL-only search finds bookmarks by domain or URL substring
- [ ] Title-only search matches against bookmark titles
- [ ] Description-only search matches against excerpts
- [ ] Matched field is highlighted in search results
- [ ] Scope persists across searches (stored in `searchSlice`)

### F3: Multiple View Modes

**User Story:** As a user, I want to switch between Grid, List, Table, and Directory views to browse my bookmarks in the most effective way for my current task.

**Existing UI Components:**

- `raindrop-card.tsx` — Grid view card
- `raindrop-list-item.tsx` — List view row
- `table-view.tsx` — Table with sortable columns
- `directory-view.tsx` — Unix-style tree view

**Behavior:**

1. View mode toggle in the toolbar (icons for each mode)
2. Default view mode set in settings (persisted)
3. Per-collection view mode override (optional)
4. Keyboard shortcuts: ⌘1 (Grid), ⌘2 (List), ⌘3 (Table), ⌘4 (Directory)

**Data Model:**

```ts
// In uiSlice
viewMode: ViewMode // global default
collectionViewModes: Record<string, ViewMode> // per-collection overrides

// Selector
const getEffectiveViewMode = (state: RootState) =>
  state.ui.collectionViewModes[state.ui.selectedCollectionId] ??
  state.ui.viewMode
```

**Acceptance Criteria:**

- [ ] All 4 view modes render correctly with real data
- [ ] View mode persists across app restarts
- [ ] Per-collection view mode overrides global default
- [ ] ⌘1-4 shortcuts switch view mode
- [ ] Smooth transition between modes (no layout flash)

### F4: Auto-Icon Assignment

**User Story:** As a user, I want bookmarks to automatically have appropriate icons so my collection is visually organized without manual effort.

**Behavior:**

1. When creating a bookmark: `GET /raindrop/suggest?url={url}` → extract `meta.icon`
2. Fallback chain: API icon → Google Favicon API → Domain first letter avatar
3. Background scan: Check existing bookmarks for missing/broken icons, auto-fix

**Implementation:**

```ts
/**
 * Get the best available icon URL for a bookmark.
 * @param url - The bookmark URL
 * @param existingFavicon - Currently stored favicon URL (may be broken)
 * @returns Best available icon URL
 * @example
 *   resolveIcon('https://react.dev') // => 'https://react.dev/favicon.ico'
 *   resolveIcon('https://unknown.site') // => null (use letter avatar)
 */
async function resolveIcon(
  url: string,
  existingFavicon?: string,
): Promise<string | null> {
  // 1. Try suggest API
  const suggest = await lainAxios.get(`/raindrop/suggest`, { params: { url } })
  if (suggest.data?.item?.meta?.icon) return suggest.data.item.meta.icon

  // 2. Try Google Favicon API
  const domain = new URL(url).hostname
  const googleFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  // Verify it's not a generic globe icon (check response size)

  // 3. Fallback to null → component renders domain first letter
  return null
}
```

**UI:** `favicon-icon.tsx` already handles the display with fallback. Enhance to trigger auto-resolution.

**Acceptance Criteria:**

- [ ] New bookmarks auto-fetch icon from suggest API
- [ ] Fallback to Google Favicon API when suggest returns no icon
- [ ] Display domain first letter when no icon available
- [ ] Background icon resolution doesn't block UI

### F5: Fuzzy Collection Search

**User Story:** As a user with 50+ collections, I want to quickly find a collection by typing an approximate name.

**Behavior:**

1. Sidebar has a filter input at the top
2. As user types, collections are filtered using Fuse.js fuzzy matching
3. Results show match score/highlight
4. Also used in collection selector dropdowns (add-bookmark, move-to)

**Implementation:**

```ts
import Fuse from 'fuse.js'

const fuse = new Fuse(collections, {
  keys: ['name'],
  threshold: 0.4, // 0 = perfect match, 1 = match anything
  includeScore: true,
  includeMatches: true, // For highlighting
})

// Usage
const results = fuse.search(query)
// => [{ item: Collection, score: 0.12, matches: [...] }]
```

**Dependencies:** `pnpm add fuse.js`

**UI:** `collection-search.tsx` already exists. Connect to Fuse.js with live filtering.

**Acceptance Criteria:**

- [ ] Typing "rct" finds "React Resources" collection
- [ ] Match highlights show which characters matched
- [ ] Performance: <10ms for 100 collections
- [ ] Works in sidebar filter AND collection selector dropdowns
- [ ] Empty query shows all collections

### F6: Easy Group ↔ Collection Editing

**User Story:** As a user, I want to easily reorganize my collections between groups using drag-and-drop and inline editing.

**Existing UI:** `drag-preview.tsx`, `drop-indicator.tsx` already exist. `@dnd-kit` installed.

**Behavior:**

1. Drag a collection from one group to another
2. Drop position determines sort order within target group
3. Double-click collection name to inline rename
4. Right-click for context menu (Rename, Delete, Move to Group, Change Color)
5. Drag to reorder collections within a group

**API Calls:**

- Move collection: `PUT /collection/{id}` with `{ parent: { $id: newGroupId } }`
- Reorder: `PUT /collections` with `{ ids: [ordered_ids] }`
- Rename: `PUT /collection/{id}` with `{ title: newName }`
- Delete: `DELETE /collection/{id}`

**@dnd-kit Implementation:**

```tsx
<DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
  <SortableContext items={collectionIds} strategy={verticalListSortingStrategy}>
    {collections.map((c) => (
      <SortableCollection key={c.id} collection={c} />
    ))}
  </SortableContext>
</DndContext>
```

**Acceptance Criteria:**

- [ ] Drag collection between groups updates API
- [ ] Reorder within group works and persists
- [ ] Double-click enables inline rename
- [ ] Right-click context menu with all options
- [ ] Drag preview shows collection icon + name
- [ ] Drop indicator shows insertion point
- [ ] Optimistic updates: UI updates immediately, reverts on error

### F7: Enhanced Readability & Structural Recognition

**User Story:** As a user, I want my bookmark interface to be highly readable with clear visual hierarchy so I can quickly scan and find what I need.

**Features:**

1. **Color-coded collection icons** — Synced with Raindrop.io `color` field, custom color picker
2. **Collapsible groups** — Persistent expand/collapse state (via `PUT /collections` with `expanded: boolean`)
3. **Breadcrumb navigation** — Already in `main-content.tsx`, show group > collection path
4. **Item count badges** — Collection shows bookmark count, group shows total
5. **Content type indicators** — Icon/color per type (link, article, image, video, etc.)
6. **Keyboard navigation** — Arrow keys navigate, Enter opens, Escape closes panels
7. **Visual density control** — Compact/comfortable/spacious modes (future)

**Existing Components Used:**

- `left-sidebar.tsx` — Collection tree with groups
- `main-content.tsx` — Breadcrumbs, toolbar
- `color-picker.tsx` — Collection color selection
- All view components — `raindrop-card.tsx`, etc.

**Acceptance Criteria:**

- [ ] Collection icons use synced Raindrop.io colors
- [ ] Groups expand/collapse with persistent state
- [ ] Breadcrumb shows full path: Group > Collection
- [ ] Bookmark counts visible on collections
- [ ] Content type has distinct icon per type
- [ ] Arrow key navigation works in all view modes

### F8: Keyboard Shortcut Editor

**User Story:** As a power user, I want to customize keyboard shortcuts to match my workflow.

**See [Section 6.2](#62-shortcut-editor-feature) for detailed design.**

**Acceptance Criteria:**

- [ ] Settings dialog has "Keyboard Shortcuts" tab listing all actions
- [ ] Click "Edit" on any shortcut → captures next key combo → saves
- [ ] Conflict detection warns when binding already assigned, offers swap
- [ ] "Reset to Defaults" restores all shortcuts to defaults
- [ ] Search filter finds actions by name
- [ ] Custom shortcuts persist across app restarts (localStorage)
- [ ] `⌘⇧K` opens shortcut editor from anywhere

---

## 6. Keyboard Shortcuts & Shortcut Editor

### 6.1 Default Shortcuts

| Shortcut | Action ID          | Description                                     |
| -------- | ------------------ | ----------------------------------------------- |
| `⌘K`     | `global-search`    | Open global search (already implemented)        |
| `⌘N`     | `new-bookmark`     | Open new bookmark dialog                        |
| `⌘⇧N`    | `new-collection`   | Open new collection dialog                      |
| `⌘1`     | `view-grid`        | Switch to grid view                             |
| `⌘2`     | `view-list`        | Switch to list view                             |
| `⌘3`     | `view-table`       | Switch to table view                            |
| `⌘4`     | `view-directory`   | Switch to directory view                        |
| `⌘,`     | `settings`         | Open settings                                   |
| `⌘⌫`     | `delete-selected`  | Delete selected bookmark(s)                     |
| `⌘A`     | `select-all`       | Select all bookmarks in view                    |
| `↑`      | `navigate-up`      | Move selection up                               |
| `↓`      | `navigate-down`    | Move selection down                             |
| `Enter`  | `open-selected`    | Open selected bookmark in browser               |
| `Space`  | `preview-toggle`   | Toggle detail panel for selected                |
| `Escape` | `close-panel`      | Close active panel/dialog                       |
| `⌘⇧K`    | `edit-shortcuts`   | Open shortcut editor                            |
| `⌘F`     | `search-in-view`   | Focus search bar (scoped to current collection) |
| `⌘⇧F`    | `search-global`    | Global search across all collections            |
| `⌘D`     | `toggle-important` | Toggle important flag on selected               |
| `⌘⇧T`    | `manage-tags`      | Open tag management                             |

### 6.2 Shortcut Editor Feature

**Data Model:**

```ts
type ShortcutAction =
  | 'global-search'
  | 'new-bookmark'
  | 'new-collection'
  | 'view-grid'
  | 'view-list'
  | 'view-table'
  | 'view-directory'
  | 'settings'
  | 'delete-selected'
  | 'select-all'
  | 'navigate-up'
  | 'navigate-down'
  | 'open-selected'
  | 'preview-toggle'
  | 'close-panel'
  | 'edit-shortcuts'
  | 'search-in-view'
  | 'search-global'
  | 'toggle-important'
  | 'manage-tags'

interface KeyBinding {
  key: string // e.g., 'k', 'n', '1', 'Backspace', 'ArrowUp'
  metaKey?: boolean // ⌘
  shiftKey?: boolean // ⇧
  ctrlKey?: boolean
  altKey?: boolean // ⌥
}

type ShortcutMap = Record<ShortcutAction, KeyBinding>

interface ShortcutDefinition {
  action: ShortcutAction
  label: string // Human-readable: "Global Search"
  category: 'navigation' | 'editing' | 'view' | 'system'
  binding: KeyBinding
  isCustom: boolean // true if user has overridden default
}
```

**Editor UI (`shortcut-editor.tsx`):**

- Located in Settings dialog → "Keyboard Shortcuts" tab
- Table layout: Category | Action Name | Current Shortcut | Edit Button
- Click "Edit" → input captures next key combo → validates → saves
- Conflict detection: if key combo already assigned, show warning with option to swap
- "Reset to Defaults" button → confirms → resets entire `ShortcutMap`
- Search filter to find specific actions

**Hook (`useKeyboardShortcuts.ts`):**

```ts
/**
 * Global keyboard shortcut listener that reads bindings from Redux store.
 * Registers/unregisters on shortcut map changes.
 *
 * @example
 *   // In MainApp component
 *   useKeyboardShortcuts({
 *     'global-search': () => dispatch(openSearch()),
 *     'new-bookmark': () => dispatch(openAddBookmark()),
 *     // ... all action handlers
 *   })
 */
function useKeyboardShortcuts(
  handlers: Record<ShortcutAction, () => void>,
): void {
  const shortcuts = useAppSelector((state) => state.settings.shortcuts)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      if (isEditableTarget(e.target)) return

      for (const [action, binding] of Object.entries(shortcuts)) {
        if (matchesBinding(e, binding)) {
          e.preventDefault()
          handlers[action as ShortcutAction]?.()
          return
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, handlers])
}
```

**Persistence:** `settingsSlice.shortcuts` → `@laststance/redux-storage-middleware` → localStorage

---

## 7. Development Infrastructure

### 7.1 Linting & Formatting

**ESLint (Flat Config):**

```ts
// eslint.config.ts
import tsPrexifer from '@laststance/eslint-config-ts-prefixer'
import reactPlugin from '@laststance/react-next-eslint-plugin'

export default [
  ...tsPrexifer,
  ...reactPlugin,
  {
    rules: {
      // Project-specific overrides
    },
  },
]
```

**Prettier + Husky + lint-staged:**

```bash
pnpm dlx @laststance/prettier-husky-lint-staged-installer
```

This sets up:

- `.prettierrc` — Formatting rules
- `.husky/pre-commit` — Runs lint-staged on commit
- `lint-staged` config in `package.json` — Format + lint staged files

### 7.2 Testing Strategy

Testing infrastructure is introduced in P1 alongside Redux store setup, ensuring all features are testable from day one.

#### Unit Tests: Vitest + happy-dom

**Configuration (`vitest.config.ts`):**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.test.*',
        'src/store/api/raindropApi.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Test Setup (`src/test/setup.ts`):**

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, afterAll } from 'vitest'
import { server } from './mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
```

**MSW Server (`src/test/mocks/server.ts`):**

```ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

**MSW Handlers (`src/test/mocks/handlers.ts`):**

```ts
import { http, HttpResponse } from 'msw'

const API_BASE = 'https://api.raindrop.io/rest/v1'

// Mock data (shared with E2E)
const mockRaindrops = [
  { _id: 1, title: 'React Documentation', link: 'https://react.dev', type: 'link', ... },
  { _id: 2, title: 'TypeScript Handbook', link: 'https://typescriptlang.org', type: 'article', ... },
]

const mockCollections = [
  { _id: 100, title: 'Development', count: 45, ... },
  { _id: 101, title: 'Design', count: 23, ... },
]

export const handlers = [
  // Raindrops
  http.get(`${API_BASE}/raindrops/:collectionId`, ({ params }) => {
    const collectionId = Number(params.collectionId)
    const filtered = collectionId === 0
      ? mockRaindrops
      : mockRaindrops.filter(r => r.collection.$id === collectionId)
    return HttpResponse.json({ result: true, items: filtered, count: filtered.length })
  }),

  http.get(`${API_BASE}/raindrop/:id`, ({ params }) => {
    const item = mockRaindrops.find(r => r._id === Number(params.id))
    return item
      ? HttpResponse.json({ result: true, item })
      : new HttpResponse(null, { status: 404 })
  }),

  http.post(`${API_BASE}/raindrop`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      result: true,
      item: { _id: Date.now(), ...body, created: new Date().toISOString() },
    })
  }),

  http.put(`${API_BASE}/raindrop/:id`, async ({ request, params }) => {
    const body = await request.json()
    const existing = mockRaindrops.find(r => r._id === Number(params.id))
    return HttpResponse.json({ result: true, item: { ...existing, ...body } })
  }),

  http.delete(`${API_BASE}/raindrop/:id`, () => {
    return HttpResponse.json({ result: true })
  }),

  // Batch operations
  http.put(`${API_BASE}/raindrops/:collectionId`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ result: true, modified: body.ids?.length ?? 0 })
  }),

  http.delete(`${API_BASE}/raindrops/:collectionId`, () => {
    return HttpResponse.json({ result: true, modified: 0 })
  }),

  // Collections
  http.get(`${API_BASE}/collections`, () => {
    return HttpResponse.json({ result: true, items: mockCollections })
  }),

  http.get(`${API_BASE}/collections/childrens`, () => {
    return HttpResponse.json({ result: true, items: [] })
  }),

  http.post(`${API_BASE}/collection`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      result: true,
      item: { _id: Date.now(), ...body, count: 0 },
    })
  }),

  http.put(`${API_BASE}/collection/:id`, async ({ request, params }) => {
    const body = await request.json()
    const existing = mockCollections.find(c => c._id === Number(params.id))
    return HttpResponse.json({ result: true, item: { ...existing, ...body } })
  }),

  http.delete(`${API_BASE}/collection/:id`, () => {
    return HttpResponse.json({ result: true })
  }),

  // Tags
  http.get(`${API_BASE}/tags/:collectionId`, () => {
    return HttpResponse.json({
      result: true,
      items: [
        { _id: 'react', count: 15 },
        { _id: 'typescript', count: 12 },
        { _id: 'design', count: 8 },
      ],
    })
  }),

  http.put(`${API_BASE}/tags`, () => {
    return HttpResponse.json({ result: true })
  }),

  http.delete(`${API_BASE}/tags`, () => {
    return HttpResponse.json({ result: true })
  }),

  // User
  http.get(`${API_BASE}/user`, () => {
    return HttpResponse.json({
      result: true,
      user: { _id: 1, fullName: 'Test User', email: 'test@example.com', avatar: '', pro: false },
    })
  }),

  // Filters
  http.get(`${API_BASE}/filters/:collectionId`, () => {
    return HttpResponse.json({
      result: true,
      items: {
        type: [{ _id: 'link', count: 30 }, { _id: 'article', count: 15 }],
        tag: [{ _id: 'react', count: 15 }],
      },
    })
  }),

  // Suggest
  http.get(`${API_BASE}/raindrop/suggest`, ({ request }) => {
    const url = new URL(request.url)
    return HttpResponse.json({
      result: true,
      item: {
        title: 'Suggested Title',
        excerpt: 'Suggested description',
        media: [{ link: 'https://example.com/favicon.ico', type: 'image' }],
        meta: { icon: 'https://example.com/favicon.ico' },
      },
    })
  }),

  // Import
  http.post(`${API_BASE}/import/url`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      result: true,
      item: { title: 'Parsed Title', excerpt: 'Parsed excerpt', link: body.url },
    })
  }),
]
```

**Test Helper (`src/test/render-with-providers.tsx`):**

```tsx
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { raindropApi } from '@/store/api/raindropApi'
import { uiSlice } from '@/store/slices/uiSlice'
import { searchSlice } from '@/store/slices/searchSlice'
import { dialogSlice } from '@/store/slices/dialogSlice'
import { settingsSlice } from '@/store/slices/settingsSlice'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'

export function renderWithProviders(
  ui: React.ReactElement,
  { preloadedState = {}, ...renderOptions } = {},
) {
  const store = configureStore({
    reducer: {
      [raindropApi.reducerPath]: raindropApi.reducer,
      ui: uiSlice.reducer,
      search: searchSlice.reducer,
      dialog: dialogSlice.reducer,
      settings: settingsSlice.reducer,
    },
    middleware: (getDefault) => getDefault().concat(raindropApi.middleware),
    preloadedState,
  })

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </Provider>
    )
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) }
}
```

#### E2E Tests: Playwright (Electron Mode)

**Configuration (`playwright.config.ts`):**

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/specs',
  timeout: 30_000,
  retries: 1,
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts',
    },
  ],
})
```

**Electron Fixture (`e2e/fixtures/electron.ts`):**

```ts
import { test as base, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import path from 'path'

type ElectronFixtures = {
  electronApp: ElectronApplication
  page: Page
}

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [path.join(__dirname, '../../dist-electron/main.js')],
      env: { ...process.env, NODE_ENV: 'test' },
    })
    await use(app)
    await app.close()
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await use(page)
  },
})

export { expect } from '@playwright/test'
```

**Test Scenario Coverage:**

| Suite              | Scenarios                                                          |
| ------------------ | ------------------------------------------------------------------ |
| `auth.spec.ts`     | Login screen render, OAuth flow, logout, token persistence         |
| `crud.spec.ts`     | Create bookmark, view detail, edit fields, delete, bulk operations |
| `search.spec.ts`   | Scoped search, field-specific, ⌘K command palette, recent searches |
| `dnd.spec.ts`      | Drag collection to group, reorder, drop indicator visibility       |
| `keyboard.spec.ts` | All default shortcuts, custom shortcut binding, conflict detection |

### 7.3 CI/CD — GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type Check
        run: pnpm typecheck

      - name: Unit Tests
        run: pnpm test:coverage

      - name: Build
        run: pnpm build

      - name: E2E Tests
        run: pnpm test:e2e
```

### 7.4 Package Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "typecheck": "tsc -b --noEmit",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "codegen:api": "rtk-query-codegen-openapi rtk-codegen.config.ts",
    "electron:dev": "vite & sleep 2 && electron .",
    "electron:build": "electron-builder --mac",
    "prepare": "husky"
  }
}
```

### 7.5 New Dependencies to Install

```bash
# Runtime
pnpm add @reduxjs/toolkit react-redux axios fuse.js ts-pattern

# Development / Testing
pnpm add -D @rtk-query/codegen-openapi \
  vitest @vitest/coverage-v8 happy-dom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  msw \
  @playwright/test \
  @laststance/eslint-config-ts-prefixer @laststance/react-next-eslint-plugin

# Formatting + Git hooks
pnpm dlx @laststance/prettier-husky-lint-staged-installer

# Persistence
pnpm add @laststance/redux-storage-middleware
```

---

## 8. App Icons & Assets (macOS)

### 8.1 App Icon

| Asset          | Size                 | Format            | Location                          |
| -------------- | -------------------- | ----------------- | --------------------------------- |
| Source         | 1024×1024            | PNG (transparent) | `build/icons/icon.png`            |
| macOS icon     | All sizes            | `.icns`           | `build/icons/icon.icns`           |
| Tray icon      | 22×22 @1x, 44×44 @2x | PNG (template)    | `build/icons/trayTemplate@2x.png` |
| DMG background | 540×380              | PNG               | `build/dmg-background.png`        |

**Icon Design Brief:**

- Theme: Cyberpunk / Neural network motif (inspired by Serial Experiments Lain)
- Primary color: Purple accent matching `--primary` (OKLCH `0.723 0.219 292.572`)
- Style: Minimal, macOS Big Sur icon shape (squircle)
- Must be recognizable at 16×16 in the Dock/menu bar

**Generation:**

```bash
# From 1024×1024 source PNG
iconutil --convert icns build/icons/icon.iconset
```

### 8.2 electron-builder Configuration

```json
{
  "appId": "io.laststance.lain",
  "productName": "Lain",
  "mac": {
    "category": "public.app-category.productivity",
    "icon": "build/icons/icon.icns",
    "target": ["dmg", "zip"],
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.inherit.plist",
    "notarize": {
      "teamId": "TEAM_ID"
    }
  },
  "dmg": {
    "background": "build/dmg-background.png",
    "icon": "build/icons/icon.icns",
    "contents": [
      { "x": 130, "y": 220 },
      { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
    ]
  }
}
```

---

## 9. Landing Page

### 9.1 Overview

| Property   | Value                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| Repository | [`ryota-murakami/lain`](https://github.com/ryota-murakami/lain), [`apps/website`](../website/README.md) |
| Framework  | Next.js (App Router) + Tailwind CSS v4                                                                  |
| Hosting    | Vercel (Laststance org)                                                                                 |
| Domain     | [lain-web.vercel.app](https://lain-web.vercel.app) — custom domain TBD (`lain.app` or similar)          |

### 9.2 Page Structure

```
Landing Page
├── Hero Section
│   ├── App screenshot (3-panel layout, dark mode)
│   ├── Headline: "Your Raindrop.io bookmarks, reimagined."
│   ├── Subtitle: "A native macOS client for power users."
│   └── Download CTA button (links to GitHub Releases)
├── Features Grid (2×4 or 3×3)
│   ├── F1: Scoped Search — "Find bookmarks in context"
│   ├── F2: Field-Specific Search — "Search by URL, title, or description"
│   ├── F3: Multiple Views — "Grid, List, Table, Directory"
│   ├── F4: Auto Icons — "Beautiful, automatic favicons"
│   ├── F5: Fuzzy Search — "Find collections by approximate name"
│   ├── F6: Drag & Drop — "Organize collections effortlessly"
│   ├── F7: Visual Clarity — "Color-coded, keyboard-first"
│   └── F8: Custom Shortcuts — "Your keyboard, your rules"
├── Screenshot Gallery
│   ├── Light mode screenshot
│   ├── Dark mode screenshot
│   └── Feature-specific screenshots
├── Requirements
│   └── "macOS 12+ • Raindrop.io account required"
└── Footer
    ├── GitHub link
    ├── Laststance.io
    └── License
```

---

## 10. Implementation Phases

| Phase                           | Deliverable                                                                                                                                                                                                 | Dependencies | Estimated Scope    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------ |
| **P1: Foundation + Test Infra** | Redux store, RTK Query codegen (`axiosBaseQuery`), IPC token bridge (`auth:get-token`), axios interceptors, ts-pattern, laststance ESLint/Prettier/Husky, Vitest + happy-dom + MSW setup, Playwright config | None         | ~30 files          |
| **P2: Core CRUD + Tests**       | Connect all 22 UI components to real API, replace `mock-data.ts` with RTK Query cache. Unit tests for each CRUD operation, Playwright E2E for auth + basic flows                                            | P1           | ~25 files modified |
| **P3: Search + Tests**          | Scoped search (F1), field-specific search (F2), fuzzy collection search (F5) with Fuse.js. Search unit tests, E2E search scenarios                                                                          | P2           | ~8 files           |
| **P4: Organization + Tests**    | DnD group/collection editing (F6), auto-icons (F4). DnD interaction tests, icon fallback tests                                                                                                              | P2           | ~10 files          |
| **P5: Polish + Tests**          | View modes persistence (F3), readability enhancements (F7), keyboard shortcuts + shortcut editor (F8), settings UI. Keyboard E2E tests                                                                      | P2           | ~12 files          |
| **P6: CI/CD**                   | GitHub Actions pipeline (lint → typecheck → test → build), coverage gates, badge                                                                                                                            | P1-P5        | ~3 files           |
| **P7: Release**                 | electron-builder (macOS `.dmg`), app icon (`.icns`), code signing + notarization, auto-update, landing page (now in `apps/website`)                                                                         | P6           | ~10 files          |

**Testing Principle:** Each phase includes tests for its features. P6 is CI integration only, not new tests.

**Parallel Opportunities:**

- P3, P4, P5 can run in parallel after P2 completes
- Landing page (P7) can start independently

---

## Appendix A: Raindrop.io API Quick Reference

### Authentication

- OAuth 2.0 Authorization Code flow
- Token endpoint: `https://raindrop.io/oauth/access_token`
- Access token lifetime: ~14 days (`expires_in: 1209599`)
- Both tokens rotate on refresh

### Special Collection IDs

| ID    | Collection    |
| ----- | ------------- |
| `0`   | All Bookmarks |
| `-1`  | Unsorted      |
| `-99` | Trash         |

### Search Operators

| Operator      | Example           | Matches         |
| ------------- | ----------------- | --------------- |
| Free text     | `react hooks`     | Title + excerpt |
| `#tag`        | `#typescript`     | Tag exact match |
| `link:domain` | `link:github.com` | Domain match    |
| `type:`       | `type:article`    | Content type    |
| `-word`       | `-deprecated`     | Exclude word    |

### Pagination

| Param     | Type   | Default    | Max                                                                             |
| --------- | ------ | ---------- | ------------------------------------------------------------------------------- |
| `page`    | number | 0          | —                                                                               |
| `perpage` | number | 25         | 50                                                                              |
| `sort`    | string | `-created` | `-created`, `created`, `score`, `-sort`, `title`, `-title`, `domain`, `-domain` |

---

## Appendix B: Environment Variables

| Variable                  | Used By                  | Description                                            |
| ------------------------- | ------------------------ | ------------------------------------------------------ |
| `VITE_RAINDROP_CLIENT_ID` | Electron main + Renderer | OAuth client ID (public)                               |
| `RAINDROP_CLIENT_SECRET`  | Electron main only       | OAuth client secret (never exposed to renderer)        |
| `VITE_DEV_SERVER_URL`     | Electron main            | Vite dev server URL (auto-set by vite-plugin-electron) |
