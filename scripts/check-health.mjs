import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { coverageFingerprint } from './measure-coverage.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const coveragePath = 'apps/desktop/coverage/coverage-final.json'
const provenance = JSON.parse(
  readFileSync(
    new URL('../apps/desktop/coverage/provenance.json', import.meta.url),
    'utf8',
  ),
)
const coverage = readFileSync(new URL(`../${coveragePath}`, import.meta.url))
// Refuse missing, stale or tampered measurement instead of silently using static estimates.
if (
  provenance.mode !== 'measured-istanbul' ||
  provenance.sourceFingerprint !== coverageFingerprint() ||
  provenance.coverageSha256 !==
    createHash('sha256').update(coverage).digest('hex')
) {
  throw new Error(
    'Coverage does not match the source. Run pnpm test:coverage before health.',
  )
}
const result = spawnSync(
  'pnpm',
  [
    'exec',
    'fallow',
    'health',
    '--coverage',
    coveragePath,
    '--fail-on-issues',
    '--baseline-mode',
    'identity',
    ...process.argv.slice(2),
  ],
  { cwd: root, stdio: 'inherit' },
)
process.exit(result.status ?? 2)
