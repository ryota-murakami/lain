import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildNotaryArgs,
  finalizeMacArtifacts,
  notarizeAndStapleDmg,
} from '../../scripts/finalize-mac-release-artifacts'

const { execFile } = vi.hoisted(() => ({ execFile: vi.fn() }))
vi.mock('node:child_process', () => ({ execFileSync: execFile }))

let directory: string
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'lain-finalize-test-'))
  execFile.mockReset()
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
})
afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('macOS notarization credentials', () => {
  it('prefers an existing Keychain profile over explicit Apple credentials', () => {
    // Arrange / Act
    const args = buildNotaryArgs({
      APPLE_KEYCHAIN_PROFILE: 'qa-profile',
      APPLE_ID: 'test@example.invalid',
      APPLE_APP_SPECIFIC_PASSWORD: 'synthetic-password',
      APPLE_TEAM_ID: 'TESTTEAM',
    })
    // Assert
    expect(args).toEqual(['--keychain-profile', 'qa-profile'])
  })

  it('passes the complete authorized Apple ID triple to notarytool', () => {
    // Arrange / Act
    const args = buildNotaryArgs({
      APPLE_ID: 'test@example.invalid',
      APPLE_APP_SPECIFIC_PASSWORD: 'synthetic-password',
      APPLE_TEAM_ID: 'TESTTEAM',
    })
    // Assert
    expect(args).toEqual([
      '--apple-id',
      'test@example.invalid',
      '--password',
      'synthetic-password',
      '--team-id',
      'TESTTEAM',
    ])
  })

  it.each([
    {},
    { APPLE_ID: 'test@example.invalid' },
    {
      APPLE_ID: 'test@example.invalid',
      APPLE_APP_SPECIFIC_PASSWORD: 'synthetic-password',
    },
  ])(
    'rejects incomplete credentials before invoking any native command',
    (environment) => {
      // Arrange / Act / Assert
      expect(() => buildNotaryArgs(environment)).toThrow(
        'Missing notarization credentials.',
      )
      expect(execFile).not.toHaveBeenCalled()
    },
  )
})

describe('macOS release metadata finalization', () => {
  it('hashes the stapled DMG bytes, preserves ZIP blockmaps, and skips repeat notarization', () => {
    // Arrange
    const artifacts = [
      ['Lain-1.2.3.dmg', 'x64 dmg'],
      ['Lain-1.2.3-arm64.dmg', 'arm64 dmg'],
      ['Lain-1.2.3-mac.zip', 'x64 zip'],
      ['Lain-1.2.3-arm64-mac.zip', 'arm64 zip'],
    ]
    for (const [name, content] of artifacts) {
      writeFileSync(join(directory, name), content)
      writeFileSync(join(directory, `${name}.blockmap`), 'blockmap')
    }
    const stapled = new Set<string>()
    execFile.mockImplementation((_command: string, args: string[]) => {
      if (args[0] === 'notarytool') return '{"status":"Accepted"}'
      if (args[1] === 'staple') {
        appendFileSync(args[2], ' stapled')
        stapled.add(args[2])
      }
      if (args[1] === 'validate' && !stapled.has(args[2]))
        throw new Error('No ticket yet')
      return ''
    })
    // Act
    finalizeMacArtifacts(directory, '1.2.3', [
      '--keychain-profile',
      'qa-profile',
    ])
    finalizeMacArtifacts(directory, '1.2.3', [
      '--keychain-profile',
      'qa-profile',
    ])
    const feed = readFileSync(join(directory, 'latest-mac.yml'), 'utf8')
    const checksums: unknown = JSON.parse(
      readFileSync(join(directory, 'checksums.json'), 'utf8'),
    )
    // Assert
    expect(readFileSync(join(directory, 'Lain-1.2.3.dmg'), 'utf8')).toBe(
      'x64 dmg stapled',
    )
    expect(checksums).toEqual({
      'Lain-1.2.3.dmg': {
        sha256:
          'cba7d4299363f2d97e54aa921637a147951bb421aeb6d8f1bcf911e62a77bef6',
        size: 15,
      },
      'Lain-1.2.3-arm64.dmg': {
        sha256:
          '70e30c09a6a2f63d7a543fe58d1420133d8567779c6cf00b40b9b1e442836b4a',
        size: 17,
      },
      'Lain-1.2.3-mac.zip': {
        sha256:
          'c004bf41e623e6218d421c412239a92bc9f3cf8deafd365b6592d9237aa5c98b',
        size: 7,
      },
      'Lain-1.2.3-arm64-mac.zip': {
        sha256:
          'faaaf1fff9c3cbfd6d797214b6a562740e479a3d0bede2482b867b6568d44258',
        size: 9,
      },
    })
    expect(feed).toContain('version: 1.2.3')
    expect(feed).toContain('path: Lain-1.2.3-mac.zip')
    expect(feed).toContain(
      'sha512: shIDRx68UIfibBsuOsPlDbJ/lCOuhtlCacLsCJsosz+qxPkwKj2olezGQ2wAnaaGFuSWMHe4P9Ab+6fSmfOIcQ==',
    )
    expect(feed).toContain(
      'sha512: e+hegd7qYQNzjvUZJZQ3LY4TA+hCTWjw5++He+VhIdLGswXd+uAWrwbHiWX2vroF8WhEpgfSTbCNApY9JYiBFQ==',
    )
    expect(existsSync(join(directory, 'Lain-1.2.3.dmg.blockmap'))).toBe(false)
    expect(existsSync(join(directory, 'Lain-1.2.3-arm64.dmg.blockmap'))).toBe(
      false,
    )
    expect(
      readFileSync(join(directory, 'Lain-1.2.3-mac.zip.blockmap'), 'utf8'),
    ).toBe('blockmap')
    expect(
      readFileSync(
        join(directory, 'Lain-1.2.3-arm64-mac.zip.blockmap'),
        'utf8',
      ),
    ).toBe('blockmap')
    expect(
      execFile.mock.calls.filter(([, args]) => args[0] === 'notarytool'),
    ).toHaveLength(2)
  })

  it('refuses incomplete architecture artifacts before starting notarization', () => {
    // Arrange
    writeFileSync(join(directory, 'Lain-1.2.3-mac.zip'), 'x64 zip')
    // Act / Assert
    expect(() =>
      finalizeMacArtifacts(directory, '1.2.3', [
        '--keychain-profile',
        'qa-profile',
      ]),
    ).toThrow('Expected artifact does not exist:')
    expect(execFile).not.toHaveBeenCalled()
    expect(existsSync(join(directory, 'latest-mac.yml'))).toBe(false)
  })

  it.each(['{"status":"Rejected"}', 'invalid JSON', 'null'])(
    'never staples a DMG without an accepted Apple verdict: %s',
    (verdict) => {
      // Arrange
      execFile.mockImplementation((_command: string, args: string[]) => {
        if (args[0] === 'notarytool') return verdict
        throw new Error('No ticket yet')
      })
      // Act / Assert
      expect(() =>
        notarizeAndStapleDmg(join(directory, 'Lain-1.2.3.dmg'), [
          '--keychain-profile',
          'qa-profile',
        ]),
      ).toThrow('No ticket was stapled;')
      expect(execFile.mock.calls.some(([, args]) => args[1] === 'staple')).toBe(
        false,
      )
    },
  )

  it('removes credential-bearing native error details from the reported failure', () => {
    // Arrange
    execFile.mockImplementation(() => {
      throw new Error('Command failed: --password synthetic-secret')
    })
    // Act / Assert
    expect(() =>
      notarizeAndStapleDmg(join(directory, 'Lain-1.2.3.dmg'), [
        '--password',
        'synthetic-secret',
      ]),
    ).toThrow(
      'Notarization failed for Lain-1.2.3.dmg. No ticket was stapled; inspect the submission through the authorized Apple credential route.',
    )
    expect(execFile.mock.calls.some(([, args]) => args[1] === 'staple')).toBe(
      false,
    )
  })
})
