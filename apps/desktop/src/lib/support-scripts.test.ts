import { describe, expect, it } from 'vitest'

import {
  buildCoverage,
  generateReport,
} from '../../scripts/e2e-coverage-report'
import { groupRequirements } from '../../scripts/spec-requirements'

describe('E2E requirement traceability report', () => {
  it('keeps unknown tags out of coverage while preserving all valid test locations', () => {
    // Arrange
    const tags = [
      { id: 'F1.1', file: 'e2e/specs/search.spec.ts', line: 10 },
      { id: 'F1.1', file: 'e2e/specs/search.spec.ts', line: 30 },
      { id: 'F999.1', file: 'e2e/specs/search.spec.ts', line: 50 },
    ]
    // Act
    const { results, orphans } = buildCoverage(tags)
    // Assert
    expect(
      results.find((result) => result.requirement.id === 'F1.1')?.tags,
    ).toEqual([
      { id: 'F1.1', file: 'e2e/specs/search.spec.ts', line: 10 },
      { id: 'F1.1', file: 'e2e/specs/search.spec.ts', line: 30 },
    ])
    expect(results.filter((result) => result.tags.length > 0)).toHaveLength(1)
    expect(orphans).toEqual([
      { id: 'F999.1', file: 'e2e/specs/search.spec.ts', line: 50 },
    ])
  })

  it('reports accurate category totals, uncovered phases and invalid IDs together', () => {
    // Arrange
    const results: Parameters<typeof generateReport>[0] = [
      {
        requirement: {
          id: 'F1.1',
          section: '5.F1',
          description: 'Scoped results',
          category: 'feature',
          phase: 'P3',
        },
        tags: [{ id: 'F1.1', file: 'search.spec.ts', line: 10 }],
      },
      {
        requirement: {
          id: 'F1.2',
          section: '5.F1',
          description: 'Scope badge',
          category: 'feature',
          phase: 'P3',
        },
        tags: [],
      },
      {
        requirement: {
          id: 'API.1',
          section: '4.2',
          description: 'Collection endpoint',
          category: 'api',
          phase: 'P2',
        },
        tags: [],
      },
      {
        requirement: {
          id: 'KB.1',
          section: '6.1',
          description: 'Open search',
          category: 'keyboard',
          phase: 'P5',
        },
        tags: [{ id: 'KB.1', file: 'keyboard.spec.ts', line: 20 }],
      },
    ]
    // Act
    const report = generateReport(results, [
      { id: 'BAD.1', file: 'unknown.spec.ts', line: 4 },
    ])
    // Assert
    expect(report).toContain('| Feature (F1-F8) | 2 | 1 | 50.0% |')
    expect(report).toContain('| API Endpoints | 1 | 0 | 0.0% |')
    expect(report).toContain('| Keyboard Shortcuts | 1 | 1 | 100.0% |')
    expect(report).toContain('| **Total** | **4** | **2** | **50.0%** |')
    expect(report).toContain('### F1: Scoped Search (1/2)')
    expect(report).toContain(
      '- [x] **F1.1** — Scoped results — `search.spec.ts:10`',
    )
    expect(report).toContain('- [ ] **F1.2** — Scope badge')
    expect(report).toContain('### P2 (1 uncovered)')
    expect(report).toContain('### P3 (1 uncovered)')
    expect(report).not.toContain('### P5')
    expect(report).toContain(
      '`@spec:BAD.1` at `unknown.spec.ts:4` — ID not found',
    )
  })

  it('renders an empty report without invalid percentages or misleading gap sections', () => {
    // Arrange / Act
    const report = generateReport([], [])
    // Assert
    expect(report).toContain('| **Total** | **0** | **0** | **0.0%** |')
    expect(report).not.toContain('NaN')
    expect(report).not.toContain('## Uncovered Requirements')
    expect(report).not.toContain('## Orphan Tags')
  })

  it('groups future feature prefixes without dropping requirements', () => {
    // Arrange
    const requirements: Parameters<typeof groupRequirements>[0] = [
      {
        id: 'F99.1',
        section: '5.F99',
        description: 'Future feature',
        category: 'feature',
        phase: 'P7',
      },
      {
        id: 'F99.2',
        section: '5.F99',
        description: 'Second criterion',
        category: 'feature',
        phase: 'P7',
      },
      {
        id: 'API.1',
        section: '4.2',
        description: 'API',
        category: 'api',
        phase: 'P2',
      },
      {
        id: 'KB.1',
        section: '6.1',
        description: 'Keyboard',
        category: 'keyboard',
        phase: 'P5',
      },
    ]
    // Act
    const groups = groupRequirements(requirements)
    // Assert
    expect([...groups.keys()]).toEqual([
      'F99',
      'API Endpoints',
      'Keyboard Shortcuts',
    ])
    expect(groups.get('F99')?.map((requirement) => requirement.id)).toEqual([
      'F99.1',
      'F99.2',
    ])
  })
})
