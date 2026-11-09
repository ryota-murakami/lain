# Quality measurement and gates

Initial revision: 89f5078e7e15a72d7e48dace9ca5ad82f5f57f27 plus the recorded preexisting dependency changes. Fallow 3.41.0. Raw initial reports are in quality-before/. The 171 existing tests passed before the application edits. New tests added by other work are intentionally outside that initial measurement.

The source request permits local work while account backup is pending; measurements/dependency work started during official export generation. Quality measurements did not mutate the account; the separately owned real-account QA is recorded in [real-account validation](real-account-qa.md).

| Metric                                      |      Initial |  First frozen source result |
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

## First frozen-source verification

Desktop lint, TypeScript, Knip, all 531 unit tests, six release-integrity tests, all strict fallow gates and workflow actionlint passed. The changed-code audit returned `pass`, with zero introduced dead-code, complexity, duplication, styling or diff-risk findings. Its two inherited styling advisories remain visible. Website lint, TypeScript and production build passed; Next.js still reports the preexisting unset `metadataBase` warning, which does not affect desktop code.

The final dependency audit records zero critical/high, two moderate and one low advisory. It exits nonzero because those advisories remain; they are documented in `dependencies.md` rather than called a clean audit. Clean-commit GitHub Actions and signed/native package verification follow this snapshot and are not claimed by these local results.

## Hosted Linux regression

The first hosted Ubuntu measured-health run exposed 14 Mac-only assumptions across two keyboard test suites. A local Linux platform fixture reproduced all 14 failures. The corrected tests explicitly execute both macOS and Linux cases for labels, modifiers, capture, conflict exchange, cancellation and reset. Keyboard guards now also include a valid platform-specific event that fires outside an input/dialog/IME context, preventing an invalid modifier from making negative checks pass accidentally. The focused suite passed 80 tests, 35 more than the previous 45, with strict lint and app type checking. Product keyboard behavior and global test setup are unchanged. Final coverage must be regenerated after these test and native-QA harness corrections; the earlier frozen-source measurements remain historical checkpoints.

The combined CI corrections were formatted and remeasured on 2026-11-10 at 02:07 JST: **569 tests in 58 files**, full desktop lint/typecheck/Knip, strict dead code/duplicates/architecture/static complexity/measured health and changed-code audit all pass. A new seven-line duplicated QA assertion was first rejected by the strict gate, then extracted into one reusable Directory verification without relaxing the gate. Temporary diagnostic scripts were moved outside the workspace rather than ignored by lint. The [CI-fix checkpoint](quality-after/ci-fix-checkpoint.json) records fingerprint `bb1056b057b05f4230de9b9cb5e5a897166d7b8a2d81a9b8e079c90c4ba8ce2d`, fresh coverage hashes and zero findings. Renderer coverage is now **86.30 / 79.22 / 80.13 / 88.85%** (statements/branches/functions/lines); expanded coverage is **83.96 / 78.46 / 78.55 / 86.14%**. The earlier table remains the first frozen checkpoint, not a claim that later CI corrections were already included.

## Final visual-correction checkpoint

The complete visual corrections were formatted and remeasured on 2026-11-10: **581 unit tests in 59 files**, desktop lint/typecheck/Knip, six release-integrity regressions, and all strict dead-code/duplication/architecture/static-complexity/measured-health gates pass. The changed-code audit passes with the same two inherited CVA advisories and no introduced findings. No baseline, rule weakening or new production exclusion was added.

The [visual-fix checkpoint](quality-after/visual-fix-checkpoint.json) binds the measurement to source fingerprint `a791af8d9de41f176a49996b333f89d0f14c75d518a064f6b4462b8ca74b1241` and its coverage hash. Same-scope renderer coverage is **86.82 / 79.78 / 80.87 / 89.26%** (statements/branches/functions/lines), against **56.08 / 43.72 / 43.26 / 57.49%** initially. Expanded native/support coverage is **84.41 / 78.96 / 79.20 / 86.50%**. Repeating the original renderer-only health projection still reports exactly three estimated native findings (48 initially); measured expanded health reports zero. The comparable command consequently exits nonzero and is not described as a passing strict gate.

The corrected behavior includes List intrinsic overflow and focus scrolling, readable titles beside long tags in a narrow detail layout, wrapped toolbar/bulk controls, platform-aware customized shortcut hints and upload-owned inline errors without duplicate global notifications. Upload authentication expiry, rate-limit scheduling and promise rejection retain their existing contracts. Regression tests reproduced the prior failures before the fixes. Controlled Electron metadata/sync/recovery recordings and the complete suite are recorded separately from unit coverage.

These are local frozen-source results. Final clean-commit CI, downloaded artifacts and signed update records are linked from the PR and external verification report after execution, avoiding a documentation-only commit that would invalidate the packaged SHA.

## Picker-edge follow-up and final local quality

Hosted Electron QA on `982cb8b` reported 89 passed plus one retry success. Repeated settled-position measurement then reproduced a real half-pixel collection-picker overflow in all 20 trials at 1024×642: bottom 642.5, viewport 642. The earlier immediate assertion could pass during the opening scale animation. The selector now reserves eight pixels of collision padding; all 20 repeated measurements end at bottom 634.5. The regression waits for actual animations and stable consecutive animation frames, retaining strict viewport boundaries and real final-item selection through both picker entry points.

The completed follow-up passed **90/90 Electron E2E with retries disabled**, **581 unit tests in 59 files**, lint/typecheck/Knip and every strict quality gate. All coverage percentages above remain unchanged. Original-scope health remains three estimated native findings; expanded measured health remains zero. The [picker checkpoint](quality-after/picker-fix-checkpoint.json) records source fingerprint `065c076cd8f034b43d09a793b6b66be4ed94be58a1a0e2d472a80c10e68eb658`. No assertion tolerance, quality threshold or baseline was relaxed.

GitHub's [Actions and Checks API incident](https://www.githubstatus.com/incidents/tp8cghg7tlc4) prevented some hosted jobs from being created on the preceding commit. Successfully executed jobs and absent jobs are recorded separately. Local macOS/Linux package verification is independent evidence, not a replacement claim for a green hosted workflow. Final immutable outcomes are recorded in PR #36 and the external report.

## Empty Trash failure-feedback checkpoint

Additional controlled native Electron QA exposed an unhandled menu-click rejection for HTTP 503 and HTTP-200 `result:false`; the latter also lacked a visible error. The new tracked UI regression first reproduced **2 failures / 1 pass** on the previous `ebd3d8d` compiled application. The narrow sidebar catch preserves the hook rejection contract and the existing single transport notification, and adds feedback for semantic refusal. No real-account Trash was emptied.

The corrected formatted source passes **584 unit tests in 59 files**, **93 Electron E2E cases with retries disabled** (2.1 minutes), six release-integrity regressions, desktop lint/typecheck/Knip and all strict quality gates. Same-scope renderer coverage is **86.88 / 79.83 / 81.05 / 89.33%** (statements/branches/functions/lines); expanded native/support coverage is **84.47 / 79.01 / 79.37 / 86.56%**. Original-scope measured health still exposes three estimated native findings, while expanded measured health and static complexity have zero strict findings. The existing two CVA advisories remain visible; no baseline, exclusion or threshold changed.

[Checkpoint metadata](quality-after/empty-trash-fix-checkpoint.json) records source fingerprint `7ff1c5789f90c2e219512f7b65b168002c287294bd4cbb5c048f9f173f3213f0`. Hosted CI, packaging and signed native updater evidence must correspond to the next clean review commit; their final outcomes are recorded in the PR and external acceptance addendum rather than inferred from this local checkpoint.

## Add Bookmark viewport checkpoint (VIS-04)

Final-frame review of the clean `2546534` CI recordings and raw PNG exposed Add Bookmark clipping at a 1024×645 viewport despite all 17 checks passing. A strict regression reproduced dialog top −30.5 / bottom 672.5 at 1024×642, with title/Close outside the top and footer buttons ending at 656.5. The correction caps only this dialog's viewport height, scrolls the form body, and keeps the heading, error and actions outside that scrolling region.

The formatted correction passes **584 unit tests in 59 files**, **94 Electron E2E cases with retries disabled** (2.3 minutes), six release-integrity regressions, lint/typecheck/Knip and all strict quality gates. A separate recorded one-case regression passed in 7.3 seconds; all 30 frames from 7.44 seconds of video were inspected. Across 7 stable states, the dialog remains at 16–626 px and action buttons at 578–610 px in a 642 px viewport; all essential control centers receive pointer input. Notes, validation, 503 retry, real wheel scroll, keyboard save, pointer/keyboard cancellation and Close were exercised without losing input.

Coverage percentages and findings remain at the preceding C07 values, without scope, baseline or threshold changes. [Checkpoint metadata](quality-after/bookmark-viewport-fix-checkpoint.json) binds fresh coverage to fingerprint `6088f2e9a665e8c088565eec48adce8eec91df52d5f4a0840e65863c8cb902a0`. The prior 2546534 CI/package/update successes remain intermediate; clean-source hosted, package, signed-update and visual acceptance must be established again and recorded in the PR/external final report.

## Final dependency and horizontal-scroll checkpoint

The final residual dependency check updated the inherited `follow-redirects` override and lock resolution from 1.16.2 to 1.16.3 after the existing 24-hour publication hold elapsed. The release-age and store-integrity protections remain enabled. Vite, TypeScript and website ESLint holds are supported by fresh registry/installed-peer evidence in [dependency recheck](quality-after/dependency-final-recheck.json).

The short-window form follow-up preserves its input width and Switch hit targets while removing the 7 px horizontal scroll range. The regression checks seven stable states, all visible horizontal control bounds and an actual horizontal wheel event. A 7.56-second focused recording was decoded and its 30 sampled frames inspected. The existing transient toast overlap remains disclosed separately.

On this formatted source, **584 unit tests / 59 files, 94 Electron E2E cases with retries disabled (2.2 minutes), six release-integrity regressions, desktop and website lint/typecheck, and both builds pass**. All strict source/health gates pass. The explicit whole-PR audit against `origin/main` passes with zero introduced findings and two inherited styling advisories. Same-scope and expanded coverage remain at the preceding C07/VIS-04 percentages, with three estimated original-scope native findings and zero expanded measured health findings.

[Final local checkpoint](quality-after/final-review-checkpoint.json) records fingerprint `7c37a9d7a71051ac14b6dbcc08aefa36fd9d7e23006c871744bed33f3b81ac8b` and fresh coverage output. Clean-source CI, downloaded packages, signed update, recorded review and unpublished Draft readback are established separately in PR #36 and the external final report. Earlier checkpoint artifacts keep their original source identities.
