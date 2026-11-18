import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createPackage } from '@electron/asar'
import { stringify } from 'yaml'
import { verifyReleaseDirectory } from './verify-release.mjs'

const source = '1234567890123456789012345678901234567890'

/**
 * Build a harmless Linux release fixture including a real ASAR identity.
 * Shared by integrity tests so failures exercise the same release gate as CI.
 * @returns Temporary directory removed automatically after the test.
 * @example
 * const directory = await linuxFixture(t)
 */
async function linuxFixture(t, dirty = false) {
  const directory = await mkdtemp(join(tmpdir(), 'lain-release-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const input = join(directory, 'source')
  const resources = join(directory, 'linux-unpacked/resources')
  await mkdir(input)
  await mkdir(resources, { recursive: true })
  await writeFile(
    join(input, 'package.json'),
    JSON.stringify({
      version: '0.1.1',
      lainBuild: { sourceCommit: source, dirty },
    }),
  )
  await createPackage(input, join(resources, 'app.asar'))
  await writeFile(
    join(directory, 'Lain-0.1.1-x86_64.AppImage'),
    'fixture appimage',
  )
  await writeFile(join(directory, 'Lain-0.1.1-amd64.deb'), 'fixture deb')
  await writeFile(
    join(directory, 'latest-linux.yml'),
    stringify({
      version: '0.1.1',
      files: [
        {
          url: 'Lain-0.1.1-x86_64.AppImage',
          size: 16,
          sha512: createHash('sha512')
            .update('fixture appimage')
            .digest('base64'),
        },
      ],
    }),
  )
  return directory
}

test('Linux release validation accepts native format architecture names and preserves source identity', async (t) => {
  // Arrange
  const directory = await linuxFixture(t)
  // Act
  const result = await verifyReleaseDirectory(directory, {
    platform: 'linux',
    version: '0.1.1',
    source,
    write: true,
  })
  // Assert
  assert.equal(result.sourceCommit, '1234567890123456789012345678901234567890')
  assert.deepEqual(Object.keys(result.artifacts), [
    'Lain-0.1.1-amd64.deb',
    'Lain-0.1.1-x86_64.AppImage',
    'latest-linux.yml',
  ])
  assert.equal(
    JSON.parse(await readFile(join(directory, 'checksums-linux.json'), 'utf8'))
      .version,
    '0.1.1',
  )
})

test('release publication rejects an update whose downloaded bytes changed', async (t) => {
  // Arrange
  const directory = await linuxFixture(t)
  await writeFile(
    join(directory, 'Lain-0.1.1-x86_64.AppImage'),
    'tampered appimage',
  )
  // Act / Assert
  await assert.rejects(
    verifyReleaseDirectory(directory, {
      platform: 'linux',
      version: '0.1.1',
      source,
      write: true,
    }),
    /Update feed integrity mismatch/,
  )
})

test('release publication rejects a package built from a different commit', async (t) => {
  // Arrange
  const directory = await linuxFixture(t)
  // Act / Assert
  await assert.rejects(
    verifyReleaseDirectory(directory, {
      platform: 'linux',
      version: '0.1.1',
      source: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      write: true,
    }),
    /Packaged source\/version mismatch/,
  )
})

test('release publication rejects stale packages from an earlier version', async (t) => {
  // Arrange
  const directory = await linuxFixture(t)
  await writeFile(join(directory, 'Lain-0.0.9-amd64.deb'), 'stale package')
  // Act / Assert
  await assert.rejects(
    verifyReleaseDirectory(directory, {
      platform: 'linux',
      version: '0.1.1',
      source,
      write: true,
    }),
    /Unexpected stale artifact/,
  )
})

test('release publication rejects update metadata path traversal', async (t) => {
  // Arrange
  const directory = await linuxFixture(t)
  await writeFile(
    join(directory, 'latest-linux.yml'),
    stringify({
      version: '0.1.1',
      files: [{ url: '../secret', size: 1, sha512: 'invalid' }],
    }),
  )
  // Act / Assert
  await assert.rejects(
    verifyReleaseDirectory(directory, {
      platform: 'linux',
      version: '0.1.1',
      source,
      write: true,
    }),
    /unexpected artifact path/,
  )
})

test('release publication rejects a local QA manifest containing uncommitted source', async (t) => {
  // Arrange
  const directory = await linuxFixture(t, true)
  await verifyReleaseDirectory(directory, {
    platform: 'linux',
    version: '0.1.1',
    source,
    dirty: true,
    write: true,
  })
  // Act / Assert
  await assert.rejects(
    verifyReleaseDirectory(directory, {
      platform: 'linux',
      version: '0.1.1',
      source,
      packagedIdentity: false,
    }),
    /Release manifest does not match/,
  )
})
