import { setupServer } from 'msw/node'

import { handlers } from './handlers'

/**
 * MSW server instance for unit tests.
 * Intercepts HTTP requests and returns mock responses.
 *
 * @example
 *   // Override handler for specific test
 *   server.use(
 *     http.get('https://api.raindrop.io/rest/v1/user', () => {
 *       return HttpResponse.json({ result: false }, { status: 401 })
 *     })
 *   )
 */
export const server = setupServer(...handlers)
