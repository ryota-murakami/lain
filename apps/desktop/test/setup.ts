import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, afterAll } from 'vitest'

import { mockStore } from './mocks/mock-store'
import { server } from './mocks/server'

/**
 * Global test setup for Vitest + happy-dom.
 *
 * - Starts MSW server before all tests
 * - Cleans up DOM and resets handlers after each test
 * - Shuts down MSW after all tests complete
 *
 * Also mocks `window.auth` since tests run outside Electron context.
 */

// Mock window.auth for tests (no Electron IPC in test environment)
Object.defineProperty(window, 'auth', {
  value: {
    login: async () => {},
    logout: async () => {},
    getUser: async () => ({
      _id: 1,
      fullName: 'Test User',
      email: 'test@example.com',
      avatar: '',
      pro: false,
    }),
    getState: async () => ({
      isAuthenticated: true,
      user: {
        _id: 1,
        fullName: 'Test User',
        email: 'test@example.com',
        avatar: '',
        pro: false,
      },
    }),
    getToken: async () => 'test-access-token',
    onAuthStateChanged: () => () => {},
  },
  writable: true,
})

// Mock window.shell
Object.defineProperty(window, 'shell', {
  value: {
    openExternal: async () => {},
  },
  writable: true,
})

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  mockStore.reset()
})
afterAll(() => server.close())
