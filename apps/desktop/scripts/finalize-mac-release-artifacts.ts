/**
 * Notarize + staple the macOS DMGs that electron-builder emits, then rewrite the
 * update feed and checksums so they match the stapled bytes.
 *
 * electron-builder notarizes the `.app` (and therefore the `.zip`), but not the
 * `.dmg` container, so a downloaded DMG still trips Gatekeeper until its own
 * ticket is stapled. Last step of `pnpm electron:release:mac`, right after
 * `electron-builder --mac --publish never` (ported from laststance/corelive).
 *
 * @example
 * ```sh
 * # CI: APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID are set
 * pnpm electron:finalize:mac
 * # Local: a notarytool keychain profile works too
 * APPLE_KEYCHAIN_PROFILE=lain pnpm electron:finalize:mac
 * ```
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, join } from 'node:path'

/** Mirrors `productName` in electron-builder.yml — artifact names start with it. */
const PRODUCT_NAME = 'Lain'
/** Mirrors `directories.output` in electron-builder.yml. */
const OUTPUT_DIR = join(process.cwd(), 'release')

/**
 * Read the app version the artifacts were built with.
 *
 * @returns The `version` field of package.json, e.g. `0.1.1`.
 *
 * @example
 * ```ts
 * readPackageVersion() // => '0.1.1'
 * ```
 */
function readPackageVersion(): string {
  const packageJson: unknown = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
  )
  const version =
    typeof packageJson === 'object' && packageJson !== null
      ? Reflect.get(packageJson, 'version')
      : undefined
  if (typeof version !== 'string') {
    throw new Error('package.json has no string "version" field')
  }
  return version
}

/**
 * Build `xcrun notarytool` auth flags so a local keychain profile and CI secrets both work.
 *
 * @returns `--keychain-profile` flags when `APPLE_KEYCHAIN_PROFILE` is set, otherwise Apple ID flags.
 * @throws When neither a keychain profile nor the full Apple ID triple is present.
 *
 * @example
 * ```ts
 * buildNotaryArgs() // => ['--apple-id', 'dev@example.com', '--password', '…', '--team-id', 'ABCDE12345']
 * ```
 */
function buildNotaryArgs(): string[] {
  const keychainProfile = process.env.APPLE_KEYCHAIN_PROFILE
  if (keychainProfile) return ['--keychain-profile', keychainProfile]

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    throw new Error(
      'Missing notarization credentials. Set APPLE_KEYCHAIN_PROFILE or APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID.',
    )
  }
  return [
    '--apple-id',
    APPLE_ID,
    '--password',
    APPLE_APP_SPECIFIC_PASSWORD,
    '--team-id',
    APPLE_TEAM_ID,
  ]
}

/**
 * Whether a DMG already carries a stapled ticket, so re-runs skip the slow notarization.
 *
 * @param dmgPath - Absolute path of the DMG to check.
 * @returns `true` when `xcrun stapler validate` succeeds.
 *
 * @example
 * ```ts
 * hasStapledTicket('/repo/release/Lain-0.1.1.dmg') // => false before the first run
 * ```
 */
function hasStapledTicket(dmgPath: string): boolean {
  try {
    execFileSync('xcrun', ['stapler', 'validate', dmgPath], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Submit one DMG to Apple, wait for the verdict, then staple and validate the ticket.
 *
 * @param dmgPath - Absolute path of the DMG.
 * @param notaryArgs - Auth flags from {@link buildNotaryArgs}.
 * @throws When notarization is rejected or stapling fails (execFileSync rethrows the exit code).
 *
 * @example
 * ```ts
 * notarizeAndStapleDmg('/repo/release/Lain-0.1.1-arm64.dmg', buildNotaryArgs())
 * ```
 */
function notarizeAndStapleDmg(dmgPath: string, notaryArgs: string[]): void {
  const dmgName = basename(dmgPath)
  // Idempotent re-runs: an already stapled DMG is final
  if (hasStapledTicket(dmgPath)) {
    console.log(`[finalize-mac] ${dmgName} is already stapled, skipping`)
    return
  }
  console.log(`[finalize-mac] Notarizing ${dmgName}…`)
  execFileSync(
    'xcrun',
    ['notarytool', 'submit', dmgPath, ...notaryArgs, '--wait'],
    { stdio: 'inherit' },
  )
  console.log(`[finalize-mac] Stapling ${dmgName}…`)
  execFileSync('xcrun', ['stapler', 'staple', dmgPath], { stdio: 'inherit' })
  execFileSync('xcrun', ['stapler', 'validate', dmgPath], { stdio: 'inherit' })
}

/**
 * Digest a file for the update feed (`sha512`, base64) or checksums.json (`sha256`, hex).
 *
 * @param filePath - File to hash.
 * @param algorithm - `sha512` for latest-mac.yml, `sha256` for checksums.json.
 * @returns The digest in the encoding each consumer expects.
 *
 * @example
 * ```ts
 * hashFile('/repo/release/Lain-0.1.1-mac.zip', 'sha512') // => 'LvMViVx…=='
 * ```
 */
function hashFile(filePath: string, algorithm: 'sha512' | 'sha256'): string {
  return createHash(algorithm)
    .update(readFileSync(filePath))
    .digest(algorithm === 'sha512' ? 'base64' : 'hex')
}

/**
 * Rewrite `latest-mac.yml` because stapling changed the DMG bytes electron-builder hashed.
 *
 * @param artifactPaths - ZIP + DMG paths shipped in the release.
 * @param version - App version written into the feed.
 *
 * @example
 * ```ts
 * rewriteLatestMacYaml(['/repo/release/Lain-0.1.1-mac.zip'], '0.1.1')
 * ```
 */
function rewriteLatestMacYaml(artifactPaths: string[], version: string): void {
  const files = artifactPaths.map((artifactPath) => ({
    name: basename(artifactPath),
    sha512: hashFile(artifactPath, 'sha512'),
    size: statSync(artifactPath).size,
  }))
  // electron-updater reads `files`; the top-level path/sha512 are legacy fields
  const primaryZip =
    files.find((file) => file.name === `${PRODUCT_NAME}-${version}-mac.zip`) ??
    files[0]
  const yaml = [
    `version: ${version}`,
    'files:',
    ...files.flatMap((file) => [
      `  - url: ${file.name}`,
      `    sha512: ${file.sha512}`,
      `    size: ${file.size}`,
    ]),
    `path: ${primaryZip.name}`,
    `sha512: ${primaryZip.sha512}`,
    `releaseDate: '${new Date().toISOString()}'`,
    '',
  ].join('\n')
  writeFileSync(join(OUTPUT_DIR, 'latest-mac.yml'), yaml)
}

/**
 * Write `checksums.json` (sha256 + size per artifact) for users verifying manual downloads.
 *
 * @param artifactPaths - ZIP + DMG paths shipped in the release.
 *
 * @example
 * ```ts
 * writeChecksumsJson(['/repo/release/Lain-0.1.1.dmg'])
 * // release/checksums.json => { "Lain-0.1.1.dmg": { "sha256": "…", "size": 120861576 } }
 * ```
 */
function writeChecksumsJson(artifactPaths: string[]): void {
  const checksums = Object.fromEntries(
    artifactPaths.map((artifactPath) => [
      basename(artifactPath),
      {
        sha256: hashFile(artifactPath, 'sha256'),
        size: statSync(artifactPath).size,
      },
    ]),
  )
  writeFileSync(
    join(OUTPUT_DIR, 'checksums.json'),
    `${JSON.stringify(checksums, null, 2)}\n`,
  )
}

function main(): void {
  // DMG notarization only exists on macOS
  if (process.platform !== 'darwin') {
    console.log('[finalize-mac] Skipping: not running on macOS')
    return
  }
  const version = readPackageVersion()
  const notaryArgs = buildNotaryArgs()
  const artifact = (fileName: string) => join(OUTPUT_DIR, fileName)
  const dmgPaths = [
    artifact(`${PRODUCT_NAME}-${version}.dmg`),
    artifact(`${PRODUCT_NAME}-${version}-arm64.dmg`),
  ]
  const releaseArtifactPaths = [
    artifact(`${PRODUCT_NAME}-${version}-mac.zip`),
    artifact(`${PRODUCT_NAME}-${version}-arm64-mac.zip`),
    ...dmgPaths,
  ]

  // Fail fast when electron-builder did not emit an expected artifact
  for (const artifactPath of releaseArtifactPaths) {
    if (!existsSync(artifactPath)) {
      throw new Error(`Expected artifact does not exist: ${artifactPath}`)
    }
  }
  for (const dmgPath of dmgPaths) notarizeAndStapleDmg(dmgPath, notaryArgs)

  // Stapling rewrites the DMG, so its blockmap no longer matches — drop it
  for (const dmgPath of dmgPaths) {
    if (existsSync(`${dmgPath}.blockmap`)) unlinkSync(`${dmgPath}.blockmap`)
  }
  rewriteLatestMacYaml(releaseArtifactPaths, version)
  writeChecksumsJson(releaseArtifactPaths)
  console.log('[finalize-mac] Finalized signed + notarized macOS artifacts.')
}

main()
