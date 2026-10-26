import { beforeEach, describe, expect, test, vi } from 'vitest'

import { resolveIcon } from './favicon'

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}))

vi.mock('@/lib/axios', () => ({
  lainAxios: {
    get: mockGet,
  },
}))

describe('resolveIcon', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  test('returns suggest API icon when available', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        item: {
          meta: { icon: 'https://react.dev/favicon.ico' },
        },
      },
    })

    await expect(resolveIcon('https://react.dev')).resolves.toBe(
      'https://react.dev/favicon.ico',
    )
  })

  test('falls back to Google favicon when suggest has no icon', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        item: {
          meta: {},
        },
      },
    })

    await expect(resolveIcon('https://react.dev')).resolves.toBe(
      'https://www.google.com/s2/favicons?domain=react.dev&sz=64',
    )
  })

  test('falls back to Google favicon when suggest request fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('network'))

    await expect(resolveIcon('https://react.dev')).resolves.toBe(
      'https://www.google.com/s2/favicons?domain=react.dev&sz=64',
    )
  })

  test('returns null for invalid URL input', async () => {
    await expect(resolveIcon('invalid-url')).resolves.toBeNull()
    expect(mockGet).not.toHaveBeenCalled()
  })
})
