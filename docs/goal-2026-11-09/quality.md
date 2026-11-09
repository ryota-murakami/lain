# Quality measurement and gates

Initial revision: 89f5078e7e15a72d7e48dace9ca5ad82f5f57f27 plus the recorded preexisting dependency changes. Fallow 3.41.0. Raw initial reports are in quality-before/. The 171 existing tests passed before the application edits. New tests added by other work are intentionally outside that initial measurement.

The source request permits local work while account backup is pending; measurements/dependency work started during official export generation. Quality measurements did not mutate the account; the separately owned real-account QA is recorded in [real-account validation](real-account-qa.md).

| Metric                                      |      Initial |        Frozen source result |
| ------------------------------------------- | -----------: | --------------------------: |
| Dead-code findings                          |          135 |                           0 |
| Duplicate clone groups                      |           21 |                           0 |
| Duplicated lines                            | 726 (3.336%) |                      0 (0%) |
| Static complexity findings                  |           20 |                           0 |
| Health with original renderer-only coverage |           48 | 3 estimated native findings |
| Health with expanded measured coverage      | Not measured |                           0 |
| Architecture/cycles                         |            0 |                           0 |
| Unit tests                                  |  171 passing |                 531 passing |

The frozen source was measured on 2026-11-10 at 01:18 JST after formatting, with 58 passing test files. Raw final reports and provenance are in `quality-after/`. The source fingerprint is `b86be5eca77be06035e4300329c6dacf7304bf19e197350f0a4b36bb66223965`; this identifies the tested pre-commit source, while clean-commit CI and package evidence are recorded separately.

### Comparable renderer coverage

| Metric     | Initial | Frozen source |
| ---------- | ------: | ------------: |
| Statements |  56.08% |        86.30% |
| Branches   |  43.72% |        79.18% |
| Functions  |  43.26% |        80.13% |
| Lines      |  57.49% |        88.85% |

Both columns aggregate only `apps/desktop/src/**`, excluding test files and the generated API. The expanded run additionally measures native Electron and three support scripts: 83.95% statements, 78.39% branches, 78.55% functions and 86.14% lines. These expanded percentages are not compared with the narrower baseline.

For the health comparison, the final Istanbul report was projected back to the original renderer-only scope. This reproduces the initial measurement method, including fallow's estimates outside that scope. Its three remaining findings are all explicitly marked `coverage_source: estimated`: `readUpdateQAFixture`, the updater's `getController`, and `desktop:save-export`. Their real native coverage is included in the expanded report, whose strict health gate has zero findings. No estimated result is reported as a measured failure or silently discarded from the comparable column.

## Scope and exclusions

Both workspace applications and build scripts are analyzed. Build output, coverage, reports and standalone design deliverables are excluded from production-code measurement. The generated RTK Query API is excluded from findings/complexity/duplication; its dependency graph remains visible. Tests/fixtures remain reachable for dead-code analysis but are excluded from complexity/duplication because descriptive independent test procedures are intentional. No production component directory is ignored. The RTK code-generation configuration was subsequently identified as a CLI entry point; this corrects a false positive rather than suppressing code.

No accepted baseline has been added. All strict gates pass on this frozen source. CI does not create or rewrite baselines. Coverage provenance hashes source, test/config inputs and coverage output; measured health rejects stale/mixed evidence. Functions outside the supplied coverage scope may retain fallow static estimates, clearly distinguished by the report. Existing coverage floors are unchanged. Native Electron and support-script coverage is reported separately as expanded measurement. The required dependency migration changed Vitest 4.0.18 to 5.1.0 (both V8/Istanbul output), so the percentages are observed results on the same source scope, not a fixed-compiler benchmark.

## Initial static complexity targets

| File                                                             | Function                    | Cyclomatic | Cognitive |
| ---------------------------------------------------------------- | --------------------------- | ---------: | --------: |
| `apps/desktop/src/components/raindrop/main-content.tsx`          | `MainContent`               |         31 |        97 |
| `apps/desktop/src/components/raindrop/left-sidebar.tsx`          | `CollectionRow`             |         27 |        42 |
| `apps/desktop/src/components/raindrop/raindrop-card.tsx`         | `RaindropCard`              |         27 |        36 |
| `apps/desktop/src/components/raindrop/right-detail-panel.tsx`    | `RightDetailPanel`          |         24 |        40 |
| `apps/desktop/src/components/raindrop/raindrop-list-item.tsx`    | `RaindropListItem`          |         21 |        28 |
| `apps/desktop/src/components/raindrop/global-search-command.tsx` | `GlobalSearchCommand`       |         16 |        25 |
| `apps/desktop/src/components/raindrop/table-view.tsx`            | `TableRowItem`              |         16 |        30 |
| `apps/desktop/src/hooks/useRaindropsCrud.ts`                     | `useRaindropsCrud`          |         15 |        38 |
| `apps/desktop/src/components/raindrop/table-view.tsx`            | `TableView`                 |         14 |        35 |
| `apps/desktop/scripts/e2e-coverage-report.ts`                    | `generateReport`            |         13 |        23 |
| `apps/desktop/src/components/raindrop/directory-view.tsx`        | `CollectionTreeNode`        |         11 |        18 |
| `apps/desktop/src/components/raindrop/add-bookmark-dialog.tsx`   | `AddBookmarkDialog`         |         10 |        28 |
| `apps/desktop/src/components/main-app.tsx`                       | `MainApp`                   |          9 |        78 |
| `apps/desktop/src/components/raindrop/tag-input.tsx`             | `TagInput`                  |          9 |        19 |
| `apps/desktop/src/components/raindrop/collection-dialog.tsx`     | `CollectionDialog`          |          8 |        23 |
| `apps/desktop/src/components/raindrop/right-detail-panel.tsx`    | `collectionName`            |          8 |        19 |
| `apps/desktop/src/components/raindrop/tag-management.tsx`        | `TagManagement`             |          7 |        35 |
| `apps/desktop/src/components/raindrop/left-sidebar.tsx`          | `GroupSection`              |          5 |        22 |
| `apps/desktop/src/components/raindrop/left-sidebar.tsx`          | `LeftSidebar`               |          2 |        45 |
| `apps/desktop/src/components/raindrop/left-sidebar.tsx`          | `SortableRootCollectionRow` |          1 |        16 |

## Initial unused files

- `apps/desktop/rtk-codegen.config.ts`
- `apps/desktop/src/components/raindrop/color-picker.tsx`
- `apps/desktop/src/components/raindrop/icon-picker.tsx`
- `apps/desktop/src/components/raindrop/tag-input.tsx`
- `apps/desktop/src/components/ui/accordion.tsx`
- `apps/desktop/src/components/ui/avatar.tsx`
- `apps/desktop/src/components/ui/combobox.tsx`
- `apps/desktop/src/components/ui/field.tsx`
- `apps/desktop/src/components/ui/hover-card.tsx`
- `apps/desktop/src/components/ui/progress.tsx`
- `apps/desktop/src/components/ui/radio-group.tsx`
- `apps/desktop/src/components/ui/resizable.tsx`
- `apps/desktop/src/components/ui/slider.tsx`
- `apps/desktop/src/components/ui/toggle-group.tsx`
- `apps/desktop/src/components/ui/toggle.tsx`
- `apps/desktop/src/utils/dnd-types.ts`

## Intermediate cleanup and measured support scripts

UI-only cleanup removed unused primitive files, local declarations and exports after TypeScript reference analysis. Progress and Tabs are retained; the updater uses Progress. Application refactors and regression tests resolved the initial source findings; the table above reports the frozen-source measurement.

The E2E coverage report now separates totals, grouped detail, phase gaps and orphan tags; its CLI output was byte-for-byte identical before and after refactoring. Fifteen support-script regression tests exercise report accounting and release finalization failure modes. The three support scripts are included in V8 coverage and coverage-provenance fingerprinting. Targeted measured coverage found no health findings in those scripts (report/finalizer aggregate 81.43% statements, 78.68% branches, 90.9% functions); this targeted measurement does not establish whole-workspace quality success.

No accepted baseline, handwritten production exclusion or threshold reduction was introduced. The final measurement followed all parallel source/test edits and formatting.

The provenance rejection was exercised after subsequent source edits: `pnpm quality:health` exited with status 1 and instructed the caller to rerun coverage. It did not reuse the earlier successful health report. The changed-code audit also reports two inherited styling advisories for identical short CVA variant strings in Badge and Button. These are retained, visible advisory findings, separate from the strict source-duplication gate; no suppression was added for them.

## Generated API export scope correction

The initial generated API exclusion (`ignoreFindings`) did not suppress duplicate-export group findings spanning generated and handwritten files. `ignoreExports` now names only that same generated `raindropApi.ts`, preserving its graph participation. This removes two analyzer-scope false positives (`Collection` and `Raindrop`, distinct API/domain models); count these as a scope correction, not a source cleanup improvement. No handwritten production path, rule or threshold was excluded or weakened.

## Frozen-source verification

Desktop lint, TypeScript, Knip, all 531 unit tests, six release-integrity tests, all strict fallow gates and workflow actionlint passed. The changed-code audit returned `pass`, with zero introduced dead-code, complexity, duplication, styling or diff-risk findings. Its two inherited styling advisories remain visible. Website lint, TypeScript and production build passed; Next.js still reports the preexisting unset `metadataBase` warning, which does not affect desktop code.

The final dependency audit records zero critical/high, two moderate and one low advisory. It exits nonzero because those advisories remain; they are documented in `dependencies.md` rather than called a clean audit. Clean-commit GitHub Actions and signed/native package verification follow this snapshot and are not claimed by these local results.
