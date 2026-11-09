import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { extractFile } from '@electron/asar'
import { parse } from 'yaml'

/**
 * Hash a distributable without loading a large package into memory.
 * Used by {@link verifyReleaseDirectory} for update-feed and manifest validation.
 * @returns Digest in the requested encoding.
 * @example
 * await hashFile('release/Lain.AppImage', 'sha512', 'base64')
 */
async function hashFile(path, algorithm, encoding) {
  const hash = createHash(algorithm)
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest(encoding)
}

/**
 * Select the distributables for one supported platform and app version.
 * Called by the verifier so filename checks and update feed checks share one contract.
 * @example expectedArtifacts('linux', '0.1.1')
 */
function expectedArtifacts(platform, version) {
  return platform === 'mac'
    ? [
        `Lain-${version}.dmg`,
        `Lain-${version}-arm64.dmg`,
        `Lain-${version}-mac.zip`,
        `Lain-${version}-arm64-mac.zip`,
      ]
    : [`Lain-${version}-x64.AppImage`, `Lain-${version}-x64.deb`]
}

/**
 * Reject missing, empty and stale files before inspecting their metadata.
 * Called for fresh package output and again for downloaded CI artifacts.
 * @returns Sorted artifact filenames, including differential blockmaps.
 * @example await inspectArtifactNames(directory, expected)
 */
async function inspectArtifactNames(directory, expected) {
  const names = (await readdir(directory))
    .filter((name) => /\.(dmg|zip|AppImage|deb|blockmap)$/.test(name))
    .sort()
  const allowed = new Set(
    expected.flatMap((name) => [name, `${name}.blockmap`]),
  )
  // Require every architecture and reject leftovers from an earlier build.
  for (const name of expected) {
    if (!names.includes(name)) throw new Error(`Missing artifact: ${name}`)
  }
  for (const name of names) {
    if (!allowed.has(name))
      throw new Error(`Unexpected stale artifact: ${name}`)
    if ((await stat(join(directory, name))).size === 0)
      throw new Error(`Empty artifact: ${name}`)
  }
  return names
}

/**
 * Validate one feed entry against its local package bytes.
 * Called from feed verification after its schema has been checked.
 * @example await verifyFeedEntry(directory, entry, expected, new Set())
 */
async function verifyFeedEntry(directory, file, expected, names) {
  // An update feed can only refer to the exact packages built in this directory.
  if (
    typeof file?.url !== 'string' ||
    basename(file.url) !== file.url ||
    !expected.includes(file.url)
  ) {
    throw new Error('Update feed contains an unexpected artifact path.')
  }
  if (names.has(file.url))
    throw new Error('Update feed contains duplicate artifacts.')
  names.add(file.url)
  const path = join(directory, file.url)
  if (
    file.sha512 !== (await hashFile(path, 'sha512', 'base64')) ||
    file.size !== (await stat(path)).size
  ) {
    throw new Error(`Update feed integrity mismatch: ${file.url}`)
  }
}

/**
 * Require the native updater's packages and differential-download sidecars.
 * Called after feed entries have been checked against their bytes.
 * @example verifyUpdaterArtifacts('mac', expected, artifactNames, names)
 */
function verifyUpdaterArtifacts(platform, expected, artifactNames, names) {
  const suffix = platform === 'mac' ? '.zip' : '.AppImage'
  for (const name of expected.filter((name) => name.endsWith(suffix))) {
    if (!names.has(name)) throw new Error(`Missing update artifact: ${name}`)
    // AppImage embeds its differential metadata; macOS uses a ZIP sidecar.
    if (platform === 'mac' && !artifactNames.includes(`${name}.blockmap`)) {
      throw new Error(`Missing blockmap: ${name}`)
    }
  }
}

/**
 * Verify feed hashes and the packages needed by each native updater.
 * Called after the distributable inventory has passed validation.
 * @example await verifyFeed(directory, { platform, version, expected, artifactNames, feedName })
 */
async function verifyFeed(
  directory,
  { platform, version, expected, artifactNames, feedName },
) {
  const feed = parse(await readFile(join(directory, feedName), 'utf8'))
  if (
    feed?.version !== version ||
    !Array.isArray(feed.files) ||
    feed.files.length === 0
  ) {
    throw new Error('Update feed version/files are invalid.')
  }
  const names = new Set()
  for (const entry of feed.files)
    await verifyFeedEntry(directory, entry, expected, names)
  verifyUpdaterArtifacts(platform, expected, artifactNames, names)
  if (
    feed.path &&
    (!names.has(feed.path) ||
      feed.sha512 !==
        (await hashFile(join(directory, feed.path), 'sha512', 'base64')))
  ) {
    throw new Error('Legacy update feed hash/path mismatch.')
  }
}

/**
 * Confirm the version and source embedded inside every architecture's app archive.
 * Called before uploading packages; downloaded artifacts use the previously verified manifest.
 * @example verifyPackagedIdentity(directory, 'mac', '0.1.1', source)
 */
function verifyPackagedIdentity(directory, platform, version, source, dirty) {
  const archives =
    platform === 'mac'
      ? [
          'mac/Lain.app/Contents/Resources/app.asar',
          'mac-arm64/Lain.app/Contents/Resources/app.asar',
        ]
      : ['linux-unpacked/resources/app.asar']
  for (const archive of archives) {
    const manifest = JSON.parse(
      extractFile(join(directory, archive), 'package.json').toString('utf8'),
    )
    if (
      manifest.version !== version ||
      manifest.lainBuild?.sourceCommit !== source ||
      Boolean(manifest.lainBuild?.dirty) !== dirty
    ) {
      throw new Error(`Packaged source/version mismatch: ${archive}`)
    }
  }
}

/**
 * Measure the bytes to be uploaded without trusting their filenames or previous hash values.
 * Called once all platform-specific checks pass.
 * @returns SHA256 digest and byte size keyed by artifact name.
 * @example await artifactDigests(directory, names)
 */
async function artifactDigests(directory, names) {
  const artifacts = {}
  for (const name of names) {
    artifacts[name] = {
      size: (await stat(join(directory, name))).size,
      sha256: await hashFile(join(directory, name), 'sha256', 'hex'),
    }
  }
  return artifacts
}

/**
 * Refuse incomplete, stale or inconsistent release packages before CI can publish them.
 * Called after packaging and macOS stapling, then again after artifact download.
 * @param options - Expected platform, package version, source SHA and optional manifest creation.
 * @returns Verified artifact hashes and the identity of the build.
 * @throws When an artifact, feed entry, hash, version or source identity differs.
 * @example
 * await verifyReleaseDirectory('apps/desktop/release', { platform: 'linux', version: '0.1.1', source: commit, write: true })
 */
export async function verifyReleaseDirectory(directory, options) {
  const {
    platform,
    version,
    source,
    write = false,
    packagedIdentity = true,
    dirty = false,
  } = options
  if (!['mac', 'linux'].includes(platform) || !/^[a-f0-9]{40}$/.test(source)) {
    throw new Error('Expected mac/linux and a full source commit SHA.')
  }
  const expected = expectedArtifacts(platform, version)
  const feedName = platform === 'mac' ? 'latest-mac.yml' : 'latest-linux.yml'
  const artifactNames = await inspectArtifactNames(directory, expected)
  await verifyFeed(directory, {
    platform,
    version,
    expected,
    artifactNames,
    feedName,
  })
  if (packagedIdentity)
    verifyPackagedIdentity(directory, platform, version, source, dirty)
  const result = {
    schema: 1,
    platform,
    version,
    sourceCommit: source,
    sourceDirty: dirty,
    artifacts: await artifactDigests(directory, [...artifactNames, feedName]),
  }
  const manifestPath = join(directory, `checksums-${platform}.json`)
  // A downloaded CI artifact must match the earlier measurement byte-for-byte.
  if (write)
    await writeFile(manifestPath, `${JSON.stringify(result, null, 2)}\n`)
  else if (
    JSON.stringify(JSON.parse(await readFile(manifestPath, 'utf8'))) !==
    JSON.stringify(result)
  ) {
    throw new Error('Release manifest does not match downloaded artifacts.')
  }
  return result
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      platform: { type: 'string' },
      source: { type: 'string' },
      directory: { type: 'string', default: 'apps/desktop/release' },
      write: { type: 'boolean', default: false },
      'local-dirty': { type: 'boolean', default: false },
      'downloaded-artifacts': { type: 'boolean', default: false },
    },
  })
  const { version } = JSON.parse(
    await readFile(
      new URL('../apps/desktop/package.json', import.meta.url),
      'utf8',
    ),
  )
  const result = await verifyReleaseDirectory(resolve(values.directory), {
    platform: values.platform,
    source: values.source,
    version,
    write: values.write,
    dirty: values['local-dirty'],
    packagedIdentity: !values['downloaded-artifacts'],
  })
  console.log(
    `Verified ${Object.keys(result.artifacts).length} ${result.platform} artifacts for ${result.version} at ${result.sourceCommit}.`,
  )
}
