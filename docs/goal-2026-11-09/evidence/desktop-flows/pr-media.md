Synthetic Electron QA recordings. Each launch uses an isolated temporary profile and a mocked Raindrop API; no private account data appears. Eleven flows use the 00:58:36 JST build; nested merge uses the 01:09:57 JST build. All 204 extracted frames were inspected across twelve contact sheets. These are local runtime checks; CI and native distribution evidence are reported separately.

Export cancellation followed by a verified 60-bookmark JSON save. The OS picker result is deterministic; preload IPC, sender validation and atomic native file writing are real.

![export cancel save](./docs/goal-2026-11-09/evidence/desktop-flows/export-cancel-save.mp4)

Two-file upload to Development with one metadata failure. Explicit retry reuses the created bookmark ID; exactly two binary uploads and three metadata writes complete both rows in the selected collection.

![upload partial retry](./docs/goal-2026-11-09/evidence/desktop-flows/upload-partial-retry.mp4)

Icon preview, explicit native application, persistence after renderer reload and restoration of the release default.

![icon apply reset](./docs/goal-2026-11-09/evidence/desktop-flows/icon-apply-reset.mp4)

Grid pointer controls: two-checkbox selection, menu edit, saved detail reopening, importance, collection movement with a loading state, and Trash readback.

![grid hover menu actions](./docs/goal-2026-11-09/evidence/desktop-flows/grid-hover-menu-actions.mp4)

List pointer controls exercise selection, menu edit, importance, collection movement with a loading state, and Trash readback.

![list hover menu actions](./docs/goal-2026-11-09/evidence/desktop-flows/list-hover-menu-actions.mp4)

A deliberately delayed first response mounts the scroll sentinel. Actual viewport scrolling loads page two and all 60 unique bookmarks beyond the 50-item boundary.

![pagination](./docs/goal-2026-11-09/evidence/desktop-flows/pagination.mp4)

Local collection color survives remote refresh. Add Collection from Creative keeps that invoking group through creation and reload.

![collection color group](./docs/goal-2026-11-09/evidence/desktop-flows/collection-color-group.mp4)

Forty groups: real wheel scrolling reaches the last Move to Group destination, and the moved collection stays there after reload.

![large group menu](./docs/goal-2026-11-09/evidence/desktop-flows/large-group-menu.mp4)

Four hundred extra collections: Move picker and unfiltered sidebar finder both scroll to their last entry within the viewport, select it and show the moved bookmark.

![large collection picker](./docs/goal-2026-11-09/evidence/desktop-flows/large-collection-picker.mp4)

Collection drag preview and drop indicator are visible before a cross-group drop; the collection stays in its destination after reload.

![collection drag](./docs/goal-2026-11-09/evidence/desktop-flows/collection-drag.mp4)

Bookmark drag highlights the destination collection; dropping moves the bookmark and navigation reads it back there.

![bookmark drag](./docs/goal-2026-11-09/evidence/desktop-flows/bookmark-drag.mp4)

A nested source with three bookmarks merges into a separate root. All three IDs remain among 18 unique destination rows after reload; the deleted child is absent from the next merge choices.

![nested collection merge](./docs/goal-2026-11-09/evidence/desktop-flows/nested-collection-merge.mp4)
