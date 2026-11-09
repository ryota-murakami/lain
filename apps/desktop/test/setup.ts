import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import axios from 'axios'
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

// happy-dom XHR drops DELETE request bodies; exercise Axios' real Node transport under MSW.
axios.defaults.adapter = 'http'

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
    onAuthStateChanged: () => (): void => {},
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

// MSW 3 names HTTP requests and WebSocket connections network frames.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  mockStore.reset()
})
afterAll(() => server.close())
