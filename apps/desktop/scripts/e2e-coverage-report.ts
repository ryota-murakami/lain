/**
 * E2E SPEC.md coverage report generator.
 *
 * Scans `e2e/specs/*.spec.ts` for `@spec:` comment tags,
 * cross-references against the canonical requirements list,
 * and generates a markdown report.
 *
 * @example
 *   pnpm coverage:e2e-spec                          // stdout
 *   pnpm coverage:e2e-spec > docs/e2e-coverage.md   // file
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import {
  specRequirements,
  groupRequirements,
  type SpecRequirement,
} from './spec-requirements'

// ── Config ──────────────────────────────────────────────

const ROOT = join(import.meta.dirname, '..')
const E2E_SPECS_DIR = join(ROOT, 'e2e', 'specs')
const TAG_REGEX = /\/\/\s*@spec:([\w.]+)/g

// ── Types ───────────────────────────────────────────────

interface TagMatch {
  /** Requirement ID found in test file */
  id: string
  /** Relative file path */
  file: string
  /** 1-indexed line number */
  line: number
}

interface CoverageResult {
  requirement: SpecRequirement
  tags: TagMatch[]
}

// ── Scan ────────────────────────────────────────────────

/**
 * Find all @spec: tags in E2E spec files.
 * @returns Array of tag matches with file/line info
 */
function scanSpecTags(): TagMatch[] {
  const matches: TagMatch[] = []

  const files = readdirSync(E2E_SPECS_DIR).filter((f) => f.endsWith('.spec.ts'))

  for (const file of files) {
    const fullPath = join(E2E_SPECS_DIR, file)
    const content = readFileSync(fullPath, 'utf-8')
    const lines = content.split('\n')
    const relPath = relative(ROOT, fullPath)

    for (let i = 0; i < lines.length; i++) {
      let match: RegExpExecArray | null
      TAG_REGEX.lastIndex = 0
      while ((match = TAG_REGEX.exec(lines[i])) !== null) {
        matches.push({ id: match[1], file: relPath, line: i + 1 })
      }
    }
  }

  return matches
}

// ── Cross-reference ─────────────────────────────────────

/**
 * Map tags to canonical requirements.
 * @param tags - All @spec: tags found in test files
 * @returns Coverage results for each requirement + orphan tags
 */
function buildCoverage(tags: TagMatch[]): {
  results: CoverageResult[]
  orphans: TagMatch[]
} {
  const validIds = new Set(specRequirements.map((r) => r.id))
  const tagMap = new Map<string, TagMatch[]>()

  const orphans: TagMatch[] = []
  for (const tag of tags) {
    if (!validIds.has(tag.id)) {
      orphans.push(tag)
      continue
    }
    const existing = tagMap.get(tag.id)
    if (existing) {
      existing.push(tag)
    } else {
      tagMap.set(tag.id, [tag])
    }
  }

  const results: CoverageResult[] = specRequirements.map((req) => ({
    requirement: req,
    tags: tagMap.get(req.id) ?? [],
  }))

  return { results, orphans }
}

// ── Report ──────────────────────────────────────────────

/**
 * Generate the markdown coverage report.
 * @param results - Coverage results
 * @param orphans - Tags referencing non-existent requirements
 * @returns Markdown string
 */
function generateReport(
  results: CoverageResult[],
  orphans: TagMatch[],
): string {
  const lines: string[] = []
  const w = (s: string) => lines.push(s)

  // Header
  w('# E2E SPEC.md Coverage Report')
  w('')
  w(`Generated: ${new Date().toISOString().split('T')[0]}`)
  w('')

  // Summary table
  const categories = [
    {
      label: 'Feature (F1-F8)',
      filter: (r: CoverageResult) => r.requirement.category === 'feature',
    },
    {
      label: 'API Endpoints',
      filter: (r: CoverageResult) => r.requirement.category === 'api',
    },
    {
      label: 'Keyboard Shortcuts',
      filter: (r: CoverageResult) => r.requirement.category === 'keyboard',
    },
  ]

  w('## Summary')
  w('')
  w('| Category | Total | Covered | Coverage |')
  w('|----------|-------|---------|----------|')

  let totalAll = 0
  let coveredAll = 0

  for (const cat of categories) {
    const filtered = results.filter(cat.filter)
    const total = filtered.length
    const covered = filtered.filter((r) => r.tags.length > 0).length
    const pct = total > 0 ? ((covered / total) * 100).toFixed(1) : '0.0'
    w(`| ${cat.label} | ${total} | ${covered} | ${pct}% |`)
    totalAll += total
    coveredAll += covered
  }

  const totalPct =
    totalAll > 0 ? ((coveredAll / totalAll) * 100).toFixed(1) : '0.0'
  w(`| **Total** | **${totalAll}** | **${coveredAll}** | **${totalPct}%** |`)
  w('')

  // Grouped coverage details
  const groups = groupRequirements(specRequirements)

  w('## Coverage Details')
  w('')

  for (const [groupLabel, reqs] of groups) {
    const groupResults = reqs.map(
      (req) => results.find((r) => r.requirement.id === req.id)!,
    )
    const covered = groupResults.filter((r) => r.tags.length > 0).length
    const total = groupResults.length

    w(`### ${groupLabel} (${covered}/${total})`)
    w('')

    for (const r of groupResults) {
      if (r.tags.length > 0) {
        const locations = r.tags
          .map((t) => `\`${t.file}:${t.line}\``)
          .join(', ')
        w(
          `- [x] **${r.requirement.id}** — ${r.requirement.description} — ${locations}`,
        )
      } else {
        w(`- [ ] **${r.requirement.id}** — ${r.requirement.description}`)
      }
    }
    w('')
  }

  // Uncovered by phase (priority)
  const uncovered = results.filter((r) => r.tags.length === 0)
  if (uncovered.length > 0) {
    w('## Uncovered Requirements by Phase')
    w('')

    const phases = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'] as const
    for (const phase of phases) {
      const phaseUncovered = uncovered.filter(
        (r) => r.requirement.phase === phase,
      )
      if (phaseUncovered.length === 0) continue

      w(`### ${phase} (${phaseUncovered.length} uncovered)`)
      w('')
      for (const r of phaseUncovered) {
        w(`- ${r.requirement.id} — ${r.requirement.description}`)
      }
      w('')
    }
  }

  // Orphan tags (referencing non-existent IDs)
  if (orphans.length > 0) {
    w('## Orphan Tags (invalid requirement IDs)')
    w('')
    for (const o of orphans) {
      w(
        `- \`@spec:${o.id}\` at \`${o.file}:${o.line}\` — ID not found in spec-requirements.ts`,
      )
    }
    w('')
  }

  return lines.join('\n')
}

// ── Main ────────────────────────────────────────────────

const tags = scanSpecTags()
const { results, orphans } = buildCoverage(tags)
const report = generateReport(results, orphans)

// Write to stdout
process.stdout.write(report)

// Exit with appropriate code
if (orphans.length > 0) {
  console.error(
    `\n⚠ ${orphans.length} orphan tag(s) found — IDs not in spec-requirements.ts`,
  )
  process.exit(1)
}
