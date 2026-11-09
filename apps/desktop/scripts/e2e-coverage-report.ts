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
import { fileURLToPath } from 'node:url'

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
export function buildCoverage(tags: TagMatch[]): {
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

/** Format a coverage percentage without producing NaN for an empty category. Called by summary rendering. @example percentage(1, 4) // '25.0' */
function percentage(covered: number, total: number): string {
  return total > 0 ? ((covered / total) * 100).toFixed(1) : '0.0'
}

/** Count requirements with declared E2E tags; this does not claim that tests passed. @example coveredCount(results) */
function coveredCount(results: CoverageResult[]): number {
  return results.filter((result) => result.tags.length > 0).length
}

/** Render category totals and their aggregate for the CLI report. @example summaryLines(results) */
function summaryLines(results: CoverageResult[]): string[] {
  const categories = [
    { label: 'Feature (F1-F8)', category: 'feature' },
    { label: 'API Endpoints', category: 'api' },
    { label: 'Keyboard Shortcuts', category: 'keyboard' },
  ]
  const rows = categories.map(({ label, category }) => {
    const filtered = results.filter(
      (result) => result.requirement.category === category,
    )
    const covered = coveredCount(filtered)
    return `| ${label} | ${filtered.length} | ${covered} | ${percentage(covered, filtered.length)}% |`
  })
  const covered = coveredCount(results)
  return [
    '## Summary',
    '',
    '| Category | Total | Covered | Coverage |',
    '|----------|-------|---------|----------|',
    ...rows,
    `| **Total** | **${results.length}** | **${covered}** | **${percentage(covered, results.length)}%** |`,
    '',
  ]
}

/** Link one declared requirement to its exact test locations, or mark it uncovered. @example requirementLine(result) */
function requirementLine(result: CoverageResult): string {
  const label = `**${result.requirement.id}** — ${result.requirement.description}`
  if (result.tags.length === 0) return `- [ ] ${label}`
  const locations = result.tags
    .map((tag) => `\`${tag.file}:${tag.line}\``)
    .join(', ')
  return `- [x] ${label} — ${locations}`
}

/** Render feature/API/keyboard groups from the supplied coverage data. @example detailLines(results) */
function detailLines(results: CoverageResult[]): string[] {
  const byId = new Map(results.map((result) => [result.requirement.id, result]))
  const groups = groupRequirements(results.map((result) => result.requirement))
  const lines = ['## Coverage Details', '']
  for (const [label, requirements] of groups) {
    const group = requirements.map((requirement) => byId.get(requirement.id)!)
    lines.push(
      `### ${label} (${coveredCount(group)}/${group.length})`,
      '',
      ...group.map(requirementLine),
      '',
    )
  }
  return lines
}

/** Render one nonempty implementation phase; empty phases do not imply missing tests. @example phaseLines('P1', uncovered) */
function phaseLines(
  phase: SpecRequirement['phase'],
  uncovered: CoverageResult[],
): string[] {
  const results = uncovered.filter(
    (result) => result.requirement.phase === phase,
  )
  if (results.length === 0) return []
  return [
    `### ${phase} (${results.length} uncovered)`,
    '',
    ...results.map(
      (result) =>
        `- ${result.requirement.id} — ${result.requirement.description}`,
    ),
    '',
  ]
}

/** List uncovered requirements by their planned implementation phase. @example uncoveredLines(results) */
function uncoveredLines(results: CoverageResult[]): string[] {
  const uncovered = results.filter((result) => result.tags.length === 0)
  if (uncovered.length === 0) return []
  const phases = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'] as const
  return [
    '## Uncovered Requirements by Phase',
    '',
    ...phases.flatMap((phase) => phaseLines(phase, uncovered)),
  ]
}

/** Keep invalid requirement tags visible so the CLI can fail instead of inflating coverage. @example orphanLines(orphans) */
function orphanLines(orphans: TagMatch[]): string[] {
  if (orphans.length === 0) return []
  return [
    '## Orphan Tags (invalid requirement IDs)',
    '',
    ...orphans.map(
      (tag) =>
        `- \`@spec:${tag.id}\` at \`${tag.file}:${tag.line}\` — ID not found in spec-requirements.ts`,
    ),
    '',
  ]
}

/**
 * Generate a declared E2E traceability report, independently from test execution results.
 * The CLI calls this after scanning source tags; sections share the same supplied coverage data.
 * @returns Markdown with totals, exact test locations, gaps and invalid tags.
 * @example generateReport(results, orphans)
 */
export function generateReport(
  results: CoverageResult[],
  orphans: TagMatch[],
): string {
  return [
    '# E2E SPEC.md Coverage Report',
    '',
    `Generated: ${new Date().toISOString().split('T')[0]}`,
    '',
    ...summaryLines(results),
    ...detailLines(results),
    ...uncoveredLines(results),
    ...orphanLines(orphans),
  ].join('\n')
}

// ── Main ────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
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
}
