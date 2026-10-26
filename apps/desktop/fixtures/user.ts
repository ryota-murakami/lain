/**
 * Mock user fixture matching Raindrop.io GET /user response.
 *
 * @example
 *   import { mockUser } from '@fixtures'
 *   // mockUser.groups contains sidebar collection groupings
 */

export const mockUser = {
  _id: 1,
  fullName: 'Test User',
  email: 'test@lain.app',
  avatar: '',
  pro: false,
  groups: [
    {
      title: 'Development',
      hidden: false,
      sort: 0,
      collections: [100, 102],
    },
    {
      title: 'Creative',
      hidden: false,
      sort: 1,
      collections: [101, 103],
    },
  ],
}
