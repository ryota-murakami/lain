import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

import type { UpdateApi, UpdateState } from '@/lib/update-contract'

import { UpdateSettings } from './update-settings'

const ready: UpdateState = {
  phase: 'ready',
  mode: 'in-app',
  currentVersion: '0.1.1',
  availableVersion: '0.2.0',
  progress: null,
  checkedAt: null,
  error: null,
}

/** Create isolated preload operations for observable update controls. @example const api = updateApi(ready) */
function updateApi(state: UpdateState): UpdateApi {
  return {
    getState: vi.fn().mockResolvedValue(state),
    check: vi.fn().mockResolvedValue(state),
    download: vi.fn().mockResolvedValue(state),
    install: vi.fn().mockResolvedValue(state),
    onStateChanged: vi.fn(() => (): void => {}),
  }
}

test('prevents restart until unsaved edits and uploads are finished', async () => {
  // Arrange
  const api = updateApi(ready)
  const user = userEvent.setup()
  const view = render(<UpdateSettings api={api} hasPendingWork />)
  // Act
  const restart = await screen.findByRole('button', {
    name: 'Restart and install',
  })
  await user.click(restart)
  // Assert
  expect(restart).toBeDisabled()
  expect(api.install).not.toHaveBeenCalled()
  expect(
    screen.getByText(
      'Finish uploads and save or discard your edits before restarting.',
    ),
  ).toBeVisible()
  // Act
  view.rerender(<UpdateSettings api={api} hasPendingWork={false} />)
  await user.click(restart)
  // Assert
  expect(api.install).toHaveBeenCalledTimes(1)
})

test('shows manual package instructions and download controls for deb users', async () => {
  // Arrange
  const api = updateApi({ ...ready, phase: 'available', mode: 'manual' })
  const user = userEvent.setup()
  render(<UpdateSettings api={api} />)
  // Act
  await user.click(
    await screen.findByRole('button', { name: 'Open package download' }),
  )
  // Assert
  expect(api.download).toHaveBeenCalledTimes(1)
  expect(
    screen.getByText(
      /Linux deb installations update through a downloaded package/,
    ),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Restart and install' }),
  ).toBeNull()
})

test('keeps a ready update visible when an older initial status arrives later', async () => {
  // Arrange
  let resolveInitial: (state: UpdateState) => void = () => {}
  let notify: (state: UpdateState) => void = () => {}
  const api = updateApi(ready)
  api.getState = async () =>
    new Promise((resolve) => {
      resolveInitial = resolve
    })
  api.onStateChanged = (listener) => {
    notify = listener
    return (): void => {}
  }
  render(<UpdateSettings api={api} />)
  // Act
  await act(async () => {
    notify(ready)
    resolveInitial({ ...ready, phase: 'idle', availableVersion: null })
  })
  // Assert
  expect(
    screen.getByRole('button', { name: 'Restart and install' }),
  ).toBeVisible()
  expect(screen.getByText('Available version: 0.2.0')).toBeVisible()
})

test('exposes downloaded percentage to assistive technology', async () => {
  // Arrange
  const api = updateApi({
    ...ready,
    phase: 'downloading',
    progress: { percent: 42, transferred: 42, total: 100 },
  })
  // Act
  render(<UpdateSettings api={api} />)
  // Assert
  expect(
    await screen.findByRole('progressbar', {
      name: 'Update download progress',
    }),
  ).toHaveAttribute('aria-valuenow', '42')
  expect(screen.getByText('42%')).toBeVisible()
})
