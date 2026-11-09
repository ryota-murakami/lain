import { describe, expect, test, vi } from 'vitest'

import { createUpdateController } from './update-controller'

describe('User-controlled app updates', () => {
  test('coalesces simultaneous checks into one feed request', async () => {
    // Arrange
    let finish: () => void = () => {}
    const check = vi.fn(
      async () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const updates = createUpdateController({
      version: '0.1.1',
      mode: 'in-app',
      backend: { check, download: vi.fn(), install: vi.fn() },
      publish: vi.fn(),
    })
    // Act
    const first = updates.check()
    const second = updates.check()
    // Assert
    expect(check).toHaveBeenCalledTimes(1)
    expect(updates.getState().phase).toBe('checking')
    finish()
    await Promise.all([first, second])
    expect(updates.getState().phase).toBe('current')
  })

  test('never downloads or restarts merely because an update is available', () => {
    // Arrange
    const download = vi.fn()
    const install = vi.fn()
    const updates = createUpdateController({
      version: '0.1.1',
      mode: 'in-app',
      backend: { check: vi.fn(), download, install },
      publish: vi.fn(),
    })
    // Act
    updates.receive({ type: 'available', version: '0.2.0' })
    // Assert
    expect(updates.getState().availableVersion).toBe('0.2.0')
    expect(download).not.toHaveBeenCalled()
    expect(install).not.toHaveBeenCalled()
  })

  test('coalesces download requests and permits retry after a network failure', async () => {
    // Arrange
    let finish: () => void = () => {}
    const download = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(
        async () =>
          new Promise<void>((resolve) => {
            finish = resolve
          }),
      )
    const updates = createUpdateController({
      version: '0.1.1',
      mode: 'in-app',
      backend: { check: vi.fn(), download, install: vi.fn() },
      publish: vi.fn(),
    })
    updates.receive({ type: 'available', version: '0.2.0' })
    // Act
    await updates.download()
    const retry = updates.download()
    const duplicate = updates.download()
    // Assert
    expect(download).toHaveBeenCalledTimes(2)
    expect(updates.getState().phase).toBe('downloading')
    finish()
    updates.receive({ type: 'ready', version: '0.2.0' })
    await Promise.all([retry, duplicate])
    expect(updates.getState().phase).toBe('ready')
  })

  test('keeps a downloaded update ready after postponement or a late feed error', async () => {
    // Arrange
    const check = vi.fn()
    const updates = createUpdateController({
      version: '0.1.1',
      mode: 'in-app',
      backend: {
        check,
        download: vi.fn(),
        install: vi.fn().mockResolvedValue(false),
      },
      publish: vi.fn(),
    })
    updates.receive({ type: 'ready', version: '0.2.0' })
    // Act
    await updates.install()
    updates.receive({ type: 'error' })
    await updates.check()
    // Assert
    expect(updates.getState().phase).toBe('ready')
    expect(updates.getState().availableVersion).toBe('0.2.0')
    expect(check).not.toHaveBeenCalled()
  })

  test('bounds invalid native progress before exposing it to the UI', () => {
    // Arrange
    const updates = createUpdateController({
      version: '0.1.1',
      mode: 'in-app',
      backend: { check: vi.fn(), download: vi.fn(), install: vi.fn() },
      publish: vi.fn(),
    })
    // Act
    updates.receive({
      type: 'progress',
      percent: 125,
      transferred: Number.NaN,
      total: -1,
    })
    // Assert
    expect(updates.getState().progress).toEqual({
      percent: 100,
      transferred: 0,
      total: 0,
    })
  })

  test('development builds never contact an update feed', async () => {
    // Arrange
    const check = vi.fn()
    const updates = createUpdateController({
      version: '0.1.1',
      mode: 'development',
      backend: { check, download: vi.fn(), install: vi.fn() },
      publish: vi.fn(),
    })
    // Act
    await updates.check()
    // Assert
    expect(check).not.toHaveBeenCalled()
    expect(updates.getState().phase).toBe('unavailable')
  })

  test('manual Linux packages cannot invoke in-app replacement', async () => {
    // Arrange
    const install = vi.fn()
    const download = vi.fn().mockResolvedValue(undefined)
    const updates = createUpdateController({
      version: '0.1.1',
      mode: 'manual',
      backend: { check: vi.fn(), download, install },
      publish: vi.fn(),
    })
    // Act
    await updates.download()
    updates.receive({ type: 'ready', version: '0.2.0' })
    await updates.install()
    // Assert
    expect(download).toHaveBeenCalledTimes(1)
    expect(install).not.toHaveBeenCalled()
  })
})
