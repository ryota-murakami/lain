import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { parseArgs } from 'node:util'

import { _electron as electron, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'

import { mockRaindropApi } from '../e2e/api-mock'
import type { DesktopApi } from '../src/lib/desktop-contract'

const desktop = path.resolve(import.meta.dirname, '..')
const root = path.resolve(desktop, '../..')
const { values } = parseArgs({
  options: {
    identity: { type: 'string' },
    notarize: { type: 'boolean', default: false },
    'skip-build': { type: 'boolean', default: false },
  },
})
if (process.platform !== 'darwin' || process.arch !== 'arm64')
  throw new Error(
    'This fixture currently validates native macOS arm64 updates only.',
  )
if (!values.identity)
  throw new Error(
    'Supply --identity with the existing Developer ID Application identity.',
  )
// electron-builder chooses the certificate class; it rejects the display-name prefix.
const signingIdentity = values.identity.replace(
  /^Developer ID Application:\s*/,
  '',
)
const runId = String(Date.now())
const workspace = await mkdtemp(path.join(tmpdir(), 'lain-update-qa-'))
const profile = path.join(workspace, 'profile')
const evidence = path.join(workspace, 'evidence')
const sourceDirectory = path.join(workspace, 'source')
await mkdir(profile)
await mkdir(evidence)
await writeFile(
  path.join(profile, '.lain-update-qa'),
  'isolated-native-update-fixture-v1',
)
const fromVersion = `0.1.2-qa.${runId}.1`
const toVersion = `0.1.2-qa.${runId}.2`
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim()
const sourceDirty = Boolean(
  execFileSync('git', ['status', '--porcelain'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
)
const report: Record<string, unknown> = {
  status: 'running',
  stage: 'build',
  workspace,
  fromVersion,
  toVersion,
  sourceCommit,
  sourceDirty,
  notarizationRequested: values.notarize,
  syntheticAuthentication: true,
  realAccountCredentialsTested: false,
}
console.log(`Isolated update QA evidence: ${evidence}`)

/** Run one native build/verification stage without exposing or modifying credential configuration. @example run('codesign', ['--verify', appPath]) */
function run(command: string, args: string[], cwd = desktop): void {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.status !== 0)
    throw new Error(
      `${command} failed with exit ${result.status ?? 'spawn error'}.`,
    )
}

/**
 * Freeze already bundled runtime inputs so later source builds cannot change either QA version.
 * Called once after Vite completes; the private app manifest needs no node_modules because all runtime dependencies are bundled.
 * @example await captureRuntimeSnapshot()
 */
async function captureRuntimeSnapshot(): Promise<void> {
  await mkdir(sourceDirectory)
  for (const folder of ['dist', 'dist-electron', 'build']) {
    await cp(path.join(desktop, folder), path.join(sourceDirectory, folder), {
      recursive: true,
      verbatimSymlinks: true,
    })
  }
  const manifest = JSON.parse(
    await readFile(path.join(desktop, 'package.json'), 'utf8'),
  ) as Record<string, unknown>
  delete manifest.dependencies
  delete manifest.devDependencies
  await writeFile(
    path.join(sourceDirectory, 'package.json'),
    JSON.stringify(manifest, null, 2),
  )
  report.runtimeSnapshot = sourceDirectory
  report.mainSha256 = createHash('sha256')
    .update(await readFile(path.join(sourceDirectory, String(manifest.main))))
    .digest('hex')
  report.rendererIndexSha256 = createHash('sha256')
    .update(await readFile(path.join(sourceDirectory, 'dist/index.html')))
    .digest('hex')
  report.qaElectronLanguages = ['en', 'ja']
  console.log(
    'Runtime snapshot captured; this fixture no longer reads repository dist output.',
  )
}

/** Build one signed version under a unique app ID/cache namespace, without publishing or tagging. @example await buildVariant(fromVersion, 'old') */
async function buildVariant(version: string, label: string): Promise<string> {
  const output = path.join(workspace, label)
  const config = path.join(workspace, `${label}.json`)
  await writeFile(
    config,
    JSON.stringify(
      {
        extends: path.join(desktop, 'electron-builder.yml'),
        appId: `io.laststance.lain.updateqa.run${runId}`,
        productName: 'Lain Update QA',
        artifactName: 'Lain-Update-QA-${version}-${arch}.${ext}',
        directories: { app: sourceDirectory, output },
        npmRebuild: false,
        // QA retains English/Japanese Chromium resources; production packages retain all locales.
        electronLanguages: ['en', 'ja'],
        extraMetadata: {
          name: `lain-update-qa-${runId}`,
          version,
          lainBuild: { sourceCommit, dirty: sourceDirty, updateFixture: true },
        },
        mac: {
          identity: signingIdentity,
          notarize: values.notarize,
          target: [{ target: 'zip', arch: ['arm64'] }],
        },
        publish: [
          { provider: 'generic', url: 'http://127.0.0.1:1/', channel: 'qa' },
        ],
      },
      null,
      2,
    ),
  )
  run('pnpm', [
    'exec',
    'electron-builder',
    '--config',
    config,
    '--mac',
    'zip',
    '--arm64',
    '--publish',
    'never',
  ])
  const appPath = path.join(output, 'mac-arm64/Lain Update QA.app')
  const updaterConfig = await readFile(
    path.join(appPath, 'Contents/Resources/app-update.yml'),
    'utf8',
  )
  if (
    !updaterConfig.includes(
      `updaterCacheDirName: lain-update-qa-${runId}-updater`,
    )
  )
    throw new Error('QA package did not isolate its updater cache namespace.')
  run('codesign', ['--verify', '--deep', '--strict', appPath])
  if (values.notarize) {
    run('xcrun', ['stapler', 'validate', appPath])
    run('spctl', ['--assess', '--type', 'execute', '-vv', appPath])
  }
  return appPath
}

/** Restrict fixture HTTP requests to exact distributable basenames. Called by the local server before opening files. @example feedFilename('/qa-mac.yml', allowed) */
function feedFilename(
  url: string | undefined,
  allowed: Set<string>,
): string | undefined {
  const name = decodeURIComponent(
    new URL(url ?? '/', 'http://127.0.0.1').pathname.slice(1),
  )
  return allowed.has(name) && path.basename(name) === name ? name : undefined
}

/** Serve only the new fixture's distributable filenames on loopback; a controlled outage proves retry. @example const feed = await startFeed(directory) */
async function startFeed(directory: string) {
  const allowed = new Set(
    (await readdir(directory)).filter((name) =>
      /\.(zip|yml|blockmap)$/.test(name),
    ),
  )
  if (!allowed.has('qa-mac.yml'))
    throw new Error('The QA build did not emit qa-mac.yml.')
  let failManifest = true
  const requests: string[] = []
  const server = createServer((request, response) => {
    const name = feedFilename(request.url, allowed)
    if (!name) {
      response.writeHead(404).end()
      return
    }
    requests.push(name)
    if (name === 'qa-mac.yml' && failManifest) {
      response.writeHead(503).end('fixture outage')
      return
    }
    const stream = createReadStream(path.join(directory, name))
    stream.on('error', () => response.destroy())
    stream.pipe(response)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Loopback fixture did not bind a port.')
  return {
    url: `http://127.0.0.1:${address.port}/`,
    requests,
    recover: (): void => {
      failManifest = false
    },
    close: (): void => {
      server.closeAllConnections()
      server.close()
    },
  }
}

/** Start a packaged fixture with synthetic auth and its validated temporary userData. @example await launchFixture(executable, feed.url) */
async function launchFixture(
  executable: string,
  feed: string,
): Promise<ElectronApplication> {
  return await electron.launch({
    executablePath: executable,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      LAIN_TEST_MODE: '1',
      LAIN_UPDATE_QA: '1',
      LAIN_USER_DATA_DIR: profile,
      LAIN_UPDATE_QA_FEED: feed,
    },
    recordVideo: { dir: evidence, size: { width: 1200, height: 800 } },
  })
}

/** Attach synthetic API data before reloading and opening native update controls. @example const page = await openUpdates(application) */
async function openUpdates(application: ElectronApplication): Promise<Page> {
  const page = await application.firstWindow()
  await mockRaindropApi(page)
  await page.reload()
  await expect(page.getByRole('button', { name: 'View mode' })).toBeVisible()
  await page.keyboard.press('Meta+,')
  await page.getByRole('tab', { name: 'Updates', exact: true }).click()
  return page
}

/** Retry the real feed, persist settings, download once and prove deferring does not replace the app. @example await prepareUpdate(application, feed) */
async function prepareUpdate(
  application: ElectronApplication,
  feed: Awaited<ReturnType<typeof startFeed>>,
) {
  const page = await openUpdates(application)
  await expect(page.getByText(`Current version: ${fromVersion}`)).toBeVisible()
  await page.getByRole('button', { name: 'Check for updates' }).click()
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 60_000 })
  await page.screenshot({
    path: path.join(evidence, 'retry-after-network-error.png'),
  })
  feed.recover()
  await page.getByRole('button', { name: 'Check for updates' }).click()
  await expect(page.getByText(`Available version: ${toVersion}`)).toBeVisible({
    timeout: 60_000,
  })
  await page.keyboard.press('Escape')
  await page.keyboard.press('Meta+4')
  await page.evaluate(async () => {
    localStorage.setItem(
      'lain-update-qa-marker',
      'preserve-native-update-profile',
    )
    await (
      globalThis as typeof globalThis & { desktop: DesktopApi }
    ).desktop.selectIcon('I01')
  })
  await page.keyboard.press('Meta+,')
  await page.getByRole('tab', { name: 'Updates', exact: true }).click()
  await page.getByRole('button', { name: 'Download update' }).click()
  await expect(
    page.getByRole('button', { name: 'Restart and install' }),
  ).toBeVisible({ timeout: 180_000 })
  await application.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({
      response: 1,
      checkboxChecked: false,
    })
  })
  await page.getByRole('button', { name: 'Restart and install' }).click()
  await expect(
    page.getByRole('button', { name: 'Restart and install' }),
  ).toBeVisible()
  expect(await application.evaluate(({ app }) => app.getVersion())).toBe(
    fromVersion,
  )
  await page.screenshot({
    path: path.join(evidence, 'downloaded-and-postponed.png'),
  })
  return page
}

/**
 * Store an encrypted synthetic credential before installation without reading any real account token.
 * Called by the isolated update runner; native safeStorage must be available for this assertion.
 * @example await seedEncryptedCredentialFixture(application)
 */
async function seedEncryptedCredentialFixture(
  application: ElectronApplication,
): Promise<void> {
  const encrypted = await application.evaluate(({ safeStorage }) => {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error(
        'Native encryption is unavailable for the update credential fixture.',
      )
    return Array.from(
      safeStorage.encryptString('lain-synthetic-update-credential'),
    )
  })
  await writeFile(
    path.join(profile, 'update-qa-credential.bin'),
    Buffer.from(encrypted),
    { mode: 0o600, flag: 'wx' },
  )
}

/**
 * Prove the replacement app can decrypt the old version's persisted native-encryption fixture.
 * This verifies encrypted profile continuity independently from real-account authentication.
 * @example await verifyEncryptedCredentialFixture(application)
 */
async function verifyEncryptedCredentialFixture(
  application: ElectronApplication,
): Promise<void> {
  const encrypted = Array.from(
    await readFile(path.join(profile, 'update-qa-credential.bin')),
  )
  const preserved = await application.evaluate(({ safeStorage }, bytes) => {
    return (
      safeStorage.isEncryptionAvailable() &&
      safeStorage.decryptString(Buffer.from(bytes)) ===
        'lain-synthetic-update-credential'
    )
  }, encrypted)
  expect(preserved).toBe(true)
}

/** Read the app version from the installed bundle while Squirrel replaces it after process exit. @example await waitForInstalledVersion(bundle, toVersion) */
async function waitForInstalledVersion(
  bundle: string,
  version: string,
): Promise<void> {
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    try {
      const current = execFileSync(
        '/usr/libexec/PlistBuddy',
        [
          '-c',
          'Print CFBundleShortVersionString',
          path.join(bundle, 'Contents/Info.plist'),
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      ).trim()
      if (current === version) return
    } catch {
      /* The bundle can be temporarily absent during its atomic replacement. */
    }
    await delay(250)
  }
  throw new Error(
    'Native installer did not replace the fixture within three minutes.',
  )
}

/** Confirm the new signed process retained real profile files and app settings. @example await verifyPreservedProfile(application) */
async function verifyPreservedProfile(
  application: ElectronApplication,
): Promise<void> {
  const page = await openUpdates(application)
  await expect(page.getByText(`Current version: ${toVersion}`)).toBeVisible()
  expect(
    await page.evaluate(() => localStorage.getItem('lain-update-qa-marker')),
  ).toBe('preserve-native-update-profile')
  expect(
    await page.evaluate(
      async () =>
        (
          await (
            globalThis as typeof globalThis & { desktop: DesktopApi }
          ).desktop.getCapabilities()
        ).selectedIcon,
    ),
  ).toBe('I01')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'View mode' }).click()
  await expect(
    page.getByRole('menuitemradio', { name: 'Directory', exact: true }),
  ).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Escape')
  await page.screenshot({
    path: path.join(evidence, 'updated-profile-preserved.png'),
  })
}

let application: ElectronApplication | undefined
let feed: Awaited<ReturnType<typeof startFeed>> | undefined
try {
  if (!values['skip-build']) run('pnpm', ['build'], root)
  await captureRuntimeSnapshot()
  const oldApp = await buildVariant(fromVersion, 'old')
  await buildVariant(toVersion, 'new')
  const installed = path.join(workspace, 'installed/Lain Update QA.app')
  await mkdir(path.dirname(installed))
  await cp(oldApp, installed, { recursive: true, verbatimSymlinks: true })
  const executable = path.join(installed, 'Contents/MacOS/Lain Update QA')
  feed = await startFeed(path.join(workspace, 'new'))
  report.stage = 'download-and-postpone'
  application = await launchFixture(executable, feed.url)
  const page = await prepareUpdate(application, feed)
  report.stage = 'encrypted-credential-fixture'
  await seedEncryptedCredentialFixture(application)
  report.stage = 'native-install'
  await application.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({
      response: 0,
      checkboxChecked: false,
    })
  })
  await Promise.all([
    application.waitForEvent('close', { timeout: 180_000 }),
    page.getByRole('button', { name: 'Restart and install' }).click(),
  ])
  application = undefined
  await waitForInstalledVersion(installed, toVersion)
  run('codesign', ['--verify', '--deep', '--strict', installed])
  report.stage = 'preserved-profile'
  application = await launchFixture(executable, feed.url)
  await verifyPreservedProfile(application)
  await verifyEncryptedCredentialFixture(application)
  const hashes: Record<string, { size: number; sha256: string }> = {}
  for (const name of await readdir(path.join(workspace, 'new'))) {
    if (!/\.(zip|yml|blockmap)$/.test(name)) continue
    const filename = path.join(workspace, 'new', name)
    hashes[name] = {
      size: (await stat(filename)).size,
      sha256: createHash('sha256')
        .update(await readFile(filename))
        .digest('hex'),
    }
  }
  Object.assign(report, {
    status: 'passed',
    stage: 'complete',
    installedVersion: await application.evaluate(({ app }) => app.getVersion()),
    encryptedSyntheticCredentialTested: true,
    profilePreserved: [
      'localStorage marker',
      'Directory view',
      'Dock icon I01',
      'encrypted synthetic credential',
    ],
    feedRequests: feed.requests,
    artifacts: hashes,
  })
} catch (error) {
  Object.assign(report, {
    status: 'failed',
    error: error instanceof Error ? error.message : String(error),
  })
  const page = application?.windows()[0]
  if (page)
    await page
      .screenshot({ path: path.join(evidence, 'failure.png') })
      .catch(() => undefined)
  process.exitCode = 1
} finally {
  await application?.close().catch(() => undefined)
  feed?.close()
  await writeFile(
    path.join(evidence, 'result.json'),
    JSON.stringify(report, null, 2),
  )
  console.log(
    `Update QA ${report.status}: ${path.join(evidence, 'result.json')}`,
  )
}
