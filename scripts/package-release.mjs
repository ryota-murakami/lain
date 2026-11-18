import { spawnSync, execFileSync } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { verifyReleaseDirectory } from './verify-release.mjs'
import { readFile } from 'node:fs/promises'

const root = fileURLToPath(new URL('../', import.meta.url))
const desktop = join(root, 'apps/desktop')
const { values } = parseArgs({
  options: {
    platform: { type: 'string' },
    signed: { type: 'boolean', default: false },
  },
})
const platform = values.platform
if (!['mac', 'linux'].includes(platform))
  throw new Error('Choose --platform mac or --platform linux.')
if (platform === 'mac' && process.platform !== 'darwin')
  throw new Error('macOS packages must be built on macOS.')
if (platform === 'linux' && process.platform !== 'linux')
  throw new Error('Linux packages must be built on Linux.')
const source = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim()
const dirty = Boolean(
  execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
)
if (dirty && (process.env.CI || values.signed)) {
  throw new Error(
    'CI and signed packages require a clean committed source tree.',
  )
}
if (dirty)
  console.warn(
    'Local QA build includes uncommitted changes. Its checksum manifest is marked sourceDirty and cannot pass release verification.',
  )
const { version } = JSON.parse(
  await readFile(join(desktop, 'package.json'), 'utf8'),
)
// Packaging starts from fresh generated output so old artifacts cannot survive a failed build.
await rm(join(desktop, 'release'), { recursive: true, force: true })
await rm(join(desktop, 'dist'), { recursive: true, force: true })
await rm(join(desktop, 'dist-electron'), { recursive: true, force: true })

/**
 * Execute one build stage and preserve its failure status.
 * The package CLI calls this in order; later stages never run after a failure.
 * @throws When a build stage cannot start or exits unsuccessfully.
 * @example
 * run(['--filter', 'lain', 'build'], root)
 */
function run(args, cwd, env = process.env) {
  const result = spawnSync('pnpm', args, { cwd, env, stdio: 'inherit' })
  if (result.status !== 0)
    throw new Error(
      `Packaging stage failed with exit ${result.status ?? 'spawn error'}.`,
    )
}

run(['--filter', 'lain', 'build'], root)
const args = [
  'exec',
  'electron-builder',
  platform === 'mac' ? '--mac' : '--linux',
  '--publish',
  'never',
  `-c.extraMetadata.lainBuild.sourceCommit=${source}`,
  `-c.extraMetadata.lainBuild.dirty=${dirty}`,
]
const env = { ...process.env }
if (platform === 'mac') {
  args.push('--arm64', '--x64')
  if (!values.signed) {
    env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    args.push(
      '-c.mac.identity=null',
      '-c.mac.notarize=false',
      '-c.dmg.sign=false',
    )
  }
} else args.push('--x64')
run(args, desktop, env)
if (platform === 'mac' && values.signed) run(['electron:finalize:mac'], desktop)
await verifyReleaseDirectory(join(desktop, 'release'), {
  platform,
  version,
  source,
  write: true,
  dirty,
})
