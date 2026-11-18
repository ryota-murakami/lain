import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { DesktopApi, DesktopCapabilities } from '@/lib/desktop-contract'

import manifestText from '../../../public/icon-candidates/manifest.json?raw'

import { IconSettings } from './icon-settings'

const manifest: unknown = JSON.parse(manifestText)
const native: DesktopCapabilities = {
  platform: 'darwin',
  credentialStorage: 'encrypted',
  selectedIcon: null,
  iconTarget: 'Dock',
}
const getCapabilities = vi.fn<DesktopApi['getCapabilities']>()
const selectIcon = vi.fn<DesktopApi['selectIcon']>()
const fetchCatalog = vi.fn<typeof fetch>()

beforeEach(() => {
  getCapabilities.mockReset().mockResolvedValue(native)
  selectIcon.mockReset().mockResolvedValue(undefined)
  fetchCatalog
    .mockReset()
    .mockImplementation(async () => new Response(JSON.stringify(manifest)))
  vi.stubGlobal('fetch', fetchCatalog)
  vi.stubGlobal('desktop', { getCapabilities, selectIcon })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows all 64 real candidates and previews four sizes without applying a choice', async () => {
  // Arrange
  const user = userEvent.setup()
  render(<IconSettings />)
  const grid = await screen.findByRole('group', { name: '64 icon candidates' })
  // Act
  await user.click(screen.getByRole('button', { name: 'I64 Index Beacon' }))
  // Assert
  expect(within(grid).getAllByRole('button')).toHaveLength(64)
  expect(
    screen.getByRole('heading', { name: 'I64 · Index Beacon' }),
  ).toBeVisible()
  expect(
    screen.getByRole('img', { name: 'I64 16 pixel preview' }),
  ).toHaveAttribute('width', '16')
  expect(
    screen.getByRole('img', { name: 'I64 32 pixel preview' }),
  ).toHaveAttribute('width', '32')
  expect(
    screen.getByRole('img', { name: 'I64 64 pixel preview' }),
  ).toHaveAttribute('width', '64')
  expect(
    screen.getByRole('img', { name: 'I64 128 pixel preview' }),
  ).toHaveAttribute('width', '128')
  expect(
    within(grid).getByRole('button', { name: 'I64 Index Beacon' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Current icon: Release default')).toBeVisible()
  expect(selectIcon).not.toHaveBeenCalled()
})

test('applies only the previewed ID and restores the native choice on remount', async () => {
  // Arrange
  const user = userEvent.setup()
  const view = render(<IconSettings />)
  await user.click(
    await screen.findByRole('button', { name: 'I17 Bookmark Lens' }),
  )
  // Act
  await user.click(screen.getByRole('button', { name: 'Apply previewed icon' }))
  // Assert
  expect(selectIcon).toHaveBeenCalledExactlyOnceWith('I17')
  expect(await screen.findByText('I17 applied to the Dock.')).toBeVisible()
  expect(screen.getByText('Current icon: I17')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Apply previewed icon' }),
  ).toBeDisabled()
  // Arrange
  getCapabilities.mockResolvedValue({ ...native, selectedIcon: 'I17' })
  // Act
  view.unmount()
  render(<IconSettings />)
  // Assert
  expect(
    await screen.findByRole('heading', { name: 'I17 · Bookmark Lens' }),
  ).toBeVisible()
  expect(screen.getByText('Current icon: I17')).toBeVisible()
  expect(selectIcon).toHaveBeenCalledTimes(1)
})

test('restores the release default without discarding the candidate being compared', async () => {
  // Arrange
  getCapabilities.mockResolvedValue({ ...native, selectedIcon: 'I33' })
  const user = userEvent.setup()
  render(<IconSettings />)
  await screen.findByRole('heading', { name: 'I33 · Ribbon L' })
  await user.click(screen.getByRole('button', { name: 'I57 Command Bookmark' }))
  // Act
  await user.click(screen.getByRole('button', { name: 'Restore default' }))
  // Assert
  expect(selectIcon).toHaveBeenCalledExactlyOnceWith(null)
  expect(await screen.findByText('Default icon restored.')).toBeVisible()
  expect(screen.getByText('Current icon: Release default')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Restore default' })).toBeDisabled()
  expect(
    screen.getByRole('heading', { name: 'I57 · Command Bookmark' }),
  ).toBeVisible()
})

test('keeps the prior applied ID when native selection fails and permits another attempt', async () => {
  // Arrange
  getCapabilities.mockResolvedValue({ ...native, selectedIcon: 'I01' })
  selectIcon.mockRejectedValueOnce(new Error('Native icon rejected'))
  const user = userEvent.setup()
  render(<IconSettings />)
  await user.click(
    await screen.findByRole('button', { name: 'I17 Bookmark Lens' }),
  )
  // Act
  await user.click(screen.getByRole('button', { name: 'Apply previewed icon' }))
  // Assert
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The icon could not be changed. Try again.',
  )
  expect(screen.getByText('Current icon: I01')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Apply previewed icon' }),
  ).toBeEnabled()
  // Act
  await user.click(screen.getByRole('button', { name: 'Apply previewed icon' }))
  // Assert
  expect(await screen.findByText('I17 applied to the Dock.')).toBeVisible()
  expect(selectIcon).toHaveBeenCalledTimes(2)
})

test('preserves the applied ID when restoring the default fails', async () => {
  // Arrange
  getCapabilities.mockResolvedValue({ ...native, selectedIcon: 'I41' })
  selectIcon.mockRejectedValue(new Error('Native reset rejected'))
  const user = userEvent.setup()
  render(<IconSettings />)
  await screen.findByText('Current icon: I41')
  // Act
  await user.click(screen.getByRole('button', { name: 'Restore default' }))
  // Assert
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.getByText('Current icon: I41')).toBeVisible()
  expect(screen.queryByText('Default icon restored.')).toBeNull()
  expect(selectIcon).toHaveBeenCalledExactlyOnceWith(null)
})

test('disables competing native writes while an apply operation is pending', async () => {
  // Arrange
  let finishApply = (): void => {}
  selectIcon.mockImplementation(
    async () =>
      new Promise<void>((resolve) => {
        finishApply = resolve
      }),
  )
  getCapabilities.mockResolvedValue({ ...native, selectedIcon: 'I01' })
  const user = userEvent.setup()
  render(<IconSettings />)
  await user.click(
    await screen.findByRole('button', { name: 'I17 Bookmark Lens' }),
  )
  // Act
  await user.dblClick(
    screen.getByRole('button', { name: 'Apply previewed icon' }),
  )
  await user.click(screen.getByRole('button', { name: 'Restore default' }))
  // Assert
  expect(selectIcon).toHaveBeenCalledExactlyOnceWith('I17')
  expect(screen.getByRole('button', { name: 'Applying…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Restore default' })).toBeDisabled()
  // Act
  await act(async () => {
    finishApply()
  })
  // Assert
  expect(screen.getByText('I17 applied to the Dock.')).toBeVisible()
})

test('retries a failed catalog request without reporting empty candidates as success', async () => {
  // Arrange
  fetchCatalog.mockResolvedValueOnce(new Response('', { status: 404 }))
  const user = userEvent.setup()
  render(<IconSettings />)
  // Act
  await screen.findByRole('alert')
  // Assert
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Icon candidates could not be loaded.',
  )
  expect(
    screen.getByRole('button', { name: 'Apply previewed icon' }),
  ).toBeDisabled()
  // Act
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  // Assert
  expect(
    await screen.findByRole('group', { name: '64 icon candidates' }),
  ).toBeVisible()
  expect(screen.queryByRole('alert')).toBeNull()
})

test.each([
  { schemaVersion: 1, candidates: [] },
  {
    ...JSON.parse(manifestText),
    candidates: Array.from(
      { length: 64 },
      () => JSON.parse(manifestText).candidates[0],
    ),
  },
  {
    ...JSON.parse(manifestText),
    candidates: JSON.parse(manifestText).candidates.map(
      (candidate: { src: string }) => ({
        ...candidate,
        src: 'https://untrusted.example/icon.png',
      }),
    ),
  },
])(
  'rejects an incomplete, duplicated or external-path catalog before showing apply controls',
  async (invalidManifest) => {
    // Arrange
    fetchCatalog.mockResolvedValueOnce(
      new Response(JSON.stringify(invalidManifest)),
    )
    // Act
    render(<IconSettings />)
    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Icon candidates could not be loaded.',
    )
    expect(
      screen.queryByRole('group', { name: '64 icon candidates' }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Apply previewed icon' }),
    ).toBeDisabled()
    expect(selectIcon).not.toHaveBeenCalled()
  },
)

test('keeps comparison available when the native service cannot provide its preference', async () => {
  // Arrange
  getCapabilities.mockRejectedValueOnce(new Error('IPC unavailable'))
  const user = userEvent.setup()
  render(<IconSettings />)
  // Act
  await user.click(await screen.findByRole('button', { name: 'I33 Ribbon L' }))
  // Assert
  expect(screen.getByRole('heading', { name: 'I33 · Ribbon L' })).toBeVisible()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'You can still compare candidates.',
  )
  expect(
    screen.getByRole('button', { name: 'Apply previewed icon' }),
  ).toBeDisabled()
  expect(selectIcon).not.toHaveBeenCalled()
})
