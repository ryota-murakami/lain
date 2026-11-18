import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))

/**
 * Fingerprint tested source and configuration so health cannot consume stale coverage.
 * Called before and after the coverage command and by the health gate.
 * @returns Stable SHA-256 of paths and bytes that affect the measured suite.
 * @example
 * const fingerprint = coverageFingerprint()
 */
export function coverageFingerprint() {
  const hash = createHash('sha256')
  const visit = (directory) => {
    // Sorting keeps the fingerprint independent of filesystem enumeration order.
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (/\.[cm]?[jt]sx?$/.test(entry.name))
        hash.update(relative(root, path)).update(readFileSync(path))
    }
  }
  for (const folder of ['src', 'electron', 'scripts', 'test', 'fixtures'])
    visit(join(root, 'apps/desktop', folder))
  for (const path of [
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.node-version',
    '.fallowrc.json',
    'package.json',
    'apps/desktop/package.json',
    'apps/desktop/vitest.config.ts',
    'apps/desktop/tsconfig.app.json',
    'apps/desktop/tsconfig.electron.json',
    'apps/desktop/tsconfig.node.json',
    'scripts/measure-coverage.mjs',
    'scripts/check-health.mjs',
  ])
    hash.update(readFileSync(join(root, path)))
  return hash.digest('hex')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // A failed rerun must not leave a previous successful measurement certificate.
  rmSync(join(root, 'apps/desktop/coverage/provenance.json'), { force: true })
  const before = coverageFingerprint()
  const result = spawnSync('pnpm', ['--filter', 'lain', 'test:coverage'], {
    cwd: root,
    stdio: 'inherit',
  })
  // A failed or concurrently changed suite must never establish coverage provenance.
  if (result.status !== 0) process.exit(result.status ?? 2)
  if (coverageFingerprint() !== before)
    throw new Error('Source changed during coverage; rerun the suite.')
  const coveragePath = join(root, 'apps/desktop/coverage/coverage-final.json')
  const report = {
    mode: 'measured-istanbul',
    sourceFingerprint: before,
    coverageSha256: createHash('sha256')
      .update(readFileSync(coveragePath))
      .digest('hex'),
    node: process.version,
    completedAt: new Date().toISOString(),
  }
  writeFileSync(
    join(root, 'apps/desktop/coverage/provenance.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )
}
