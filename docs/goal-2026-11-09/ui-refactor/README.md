# Bookmark navigation refactor checkpoint

Measured on 2026-11-09. This checkpoint covers MainContent, GlobalSearchCommand, LeftSidebar, and their extracted responsibilities. Later form refactors are separate. The repository was being edited concurrently, so whole-repository totals cannot be attributed exclusively to this change.

## Behavior and fixes

- Shared literal query highlighting and content-type icons across the palette, cards, list, and table. Reused the existing getTypeIcon mapping and findCollectionInTree traversal.
- Shared Redux search state with MainApp through useSearchState. All loaded command results remain available, with API total and explicit next-page control.
- Split bookmark layout, loading, empty state, toolbar, dialogs, pointer/keyboard interaction, and drag routing by responsibility. Grid/list now share one row adapter and sortable sequence.
- Split sidebar expansion, optimistic mutations, dragging, and presentation. A single typed tree contract replaces repeated callback declarations and forwarding.
- Fixed sortable keyboard listeners overriding folder ArrowLeft/ArrowRight. The row now handles folder navigation first and delegates other keys.
- Moved Clear recent searches out of cmdk's aria-hidden group heading. Named collection search and close controls.
- Kept optimistic rename/color visible until persistence settles; failed rename restores its editable draft. Failed drag move/order shows an error after the underlying operation rejects.
- Synthetic Other collections has no group action menu, cannot receive persisted drops, and collapses locally. Its collections retain their normal actions and can move to real groups.

## Evidence

- Scoped Vitest run: 5 files, 25 tests passed. Includes 25-result pagination, selection/history, deep collection scope, named search controls, nested settings via keyboard expansion, synthetic group restrictions, cached-row retry, multi-selection, failed mutation recovery, and drag routing.
- Full desktop TypeScript check passed at this checkpoint. Strict ESLint passed on owned and extracted sources/tests. These are unit/type/static checks, not native GUI or live account evidence.
- Static cyclomatic >20 or cognitive >15 findings were removed from the three target components and their extracted responsibilities. Remaining reported entries in these paths are estimated CRAP findings; this run did not supply measured coverage and is not evidence of the full health gate passing.
- Seven clone groups touching the original three targets were removed. Whole-repository clone totals changed from 17 groups / 570 lines to 9 groups / 310 lines during concurrent work; after-dupes.json has no clone group touching those targets or their extracted result components.
- Configuration and thresholds were not relaxed. The health breakdown exposed hook density and broad prop contracts; cohesive controllers and grouped interaction contracts addressed those sources of complexity.

Before and after JSON files are retained beside this note. The baseline is this refactor's start, not the initial overnight goal baseline. Main UI/native/live account regression evidence remains with the root agent's QA report.

## Final UI/forms checkpoint — 2026-11-10 00:13 JST

The later forms and item-actions work is complete. This checkpoint supersedes the scoped test and duplication counts above; the original snapshots remain for comparison.

- Extracted form controllers for URL metadata, collection editing, detail synchronization, and tag entry. Reused ColorPicker, IconPicker, TagInput, the shared collection icon registry, and the existing favicon mapping.
- Shared content schema and content-type selector now keep creation/detail validation and options aligned. Collection/bookmark dialogs share pending-safe form actions; grid/list share relative-date formatting and actionable item menus.
- Card/list checkboxes now update MainContent selection. Item menus invoke their real edit, move, tag, important, copy, browser-open, and trash actions. Hover affordances stay mounted so pointer entry into a portal cannot remove a clicked control. Pointer events on the controls do not begin a row drag.
- Preserved user metadata edits (including manually cleared text), stale URL response rejection, remote-detail conflict resolution, save-failure drafts, partial collection creation retry, and detail close/reopen navigation.
- Bulk actions retain the captured selection and input after failure, block dismissal/duplicate submission while pending, reject empty comma-separated tags, and normalize/deduplicate added tags without replacing existing tags.

Validation at this checkpoint:

- 11 owned test files / 71 tests passed. The run covers form failures and metadata races, icon candidate selection, search/sidebar behavior, both grid/list selection and menus, bulk retry/pending states, and drag/optimistic recovery. See `final-scoped-tests.log`.
- Desktop TypeScript and strict ESLint for owned components/hooks/tests passed. No quality rule, threshold, or ignore was relaxed.
- `fallow dupes`: 0 clone groups, 0 duplicated lines across 176 analyzed files. See `final-dupes.json`. This whole-repository result includes concurrent contributions by the other agents.
- `pnpm quality:dead-code`: no issues. See `final-dead-code.log`.
- Static snapshot: no cyclomatic/cognitive findings in this agent's owned sources. The repository snapshot retains one cognitive finding in useKeyboardShortcuts and estimated CRAP findings; it is not a measured health pass. See `final-static-health.json`. The quality owner is re-running measured coverage and provenance checks after the shared source freeze.

Native Electron video, real-account mutation verification, the final measured health gate, packaging, and CI are reported by their respective owners. This document does not treat those checks as covered by the unit test results.
