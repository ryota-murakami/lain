# Bookmark export validation

Verified locally on 2026-11-09 (JST). This work uses synthetic data only. No live account access, private backup copy, or real-account export was performed by this worker.

## Implemented behavior

`fetchBookmarkSnapshot(collectionId, signal, progress)` and `serializeBookmarkSnapshot(snapshot, format)` retain their existing signatures. Snapshot schema version remains 1.

- Fetch every page with `perpage=50`, `nested=true`, ascending creation order, and no search filter. Exact multiples of 50 request an empty terminal page.
- Reject missing/invalid totals, pages larger than 50, missing/invalid/duplicate IDs, unexpected scope, excess items, premature short pages, changed totals, and HTTP failures. A partial snapshot is never returned as success.
- Compare bookmark change markers before and after retrieval. Missing/invalid markers fail validation rather than silently accepting matching counts.
- Read root collections, nested collections, groups and account identity before and after retrieval. Compare canonicalized metadata; harmless JSON object key or collection response order does not cause failure. Folder changes, group changes and account switches do. Identical collection records overlapping the root and child endpoints are deduplicated; conflicting duplicate IDs fail validation. This accommodates the service's overlapping listings without accepting inconsistent metadata.
- Compare full-library and Unsorted totals with both account-stat responses. Scope 0 excludes Trash; -1 exports Unsorted; positive IDs include the selected collection's descendants. Empty descendants and path ancestors are preserved without including unrelated siblings. Full-library JSON retains empty groups.
- Honor cancellation before starting, between pages, after completed requests and during final validation. Axios cancellation errors propagate. Requests use the existing shared Axios request budget.

## Format preservation and limits

| Data                                | HTML                                                                                    | CSV                                     | JSON                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------ |
| Parent/child collections            | Real nested Netscape DL folders; empty collections included                             | Readable path for each bookmark         | Original collection objects and parent IDs |
| Duplicate folder names              | Separate folders keyed by collection ID                                                 | Paths can be ambiguous when names match | IDs retained                               |
| Unicode, quotes, newlines           | Escaped text and attributes                                                             | Quoted UTF-8 with BOM                   | Native JSON strings                        |
| Tags                                | Conventional TAGS plus exact DATA-TAGS JSON, including commas within a tag              | JSON array in a cell                    | Original array                             |
| Notes / importance                  | DATA-NOTE / DATA-IMPORTANT                                                              | Explicit columns                        | Original fields                            |
| Groups                              | Escaped lain-groups META extension                                                      | Not represented                         | Group metadata, order and empty groups     |
| Dates                               | ADD_DATE / LAST_MODIFIED when parseable and nonnegative; invalid/missing values omitted | Original values                         | Original values                            |
| Highlights / file metadata          | Not represented                                                                         | Not represented                         | API-provided fields retained               |
| Uploaded files / saved web archives | File contents not downloaded                                                            | File contents not downloaded            | Metadata only; no file bodies              |

HTML traverses folders iteratively. Cycles, self-parenting, and missing parents do not hang or drop reachable entries; every known collection is emitted once, and original parent IDs remain in attributes/JSON. Unknown bookmark collection references receive explicit fallback folders when serializing an externally supplied snapshot. Live retrieval rejects unknown/out-of-scope references.

HTML allows clickable absolute HTTP(S) links only. Other schemes, malformed URLs, relative URLs and protocol-relative URLs become `about:blank`, with the original value retained in `DATA-ORIGINAL-URL`. CSV prefixes spreadsheet formula/control prefixes with an apostrophe. JSON retains original values. HTML custom attributes and group metadata are Lain extensions; third-party importers may ignore them. CSV is a flat table and cannot preserve empty collections or groups. JSON is the most complete metadata format, but is not a promise of automatic restoration into Raindrop.io.

The Raindrop API does not provide a transactional snapshot in this implementation. Bracketing revisions, counts and metadata detect observed concurrent changes; they cannot prove that no server-side changes occurred between reads if the service does not expose those changes. Server-side pagination stability for equal creation times is not guaranteed by these checks; duplicate/missing page IDs cause a retryable failure.

## Export dialog behavior

- Defaults to all active bookmarks; valid current collection and Unsorted are selectable. Trash/invalid IDs are not offered as current scope.
- Shows loaded/total progress and distinguishes fully downloaded data from final consistency validation.
- Disables scope/format and duplicate submission while active. Cancel aborts retrieval; a late successful response after cancellation cannot open a save dialog.
- Unmounting during retrieval aborts the operation, preventing a late save dialog after logout/navigation.
- During native save IPC, the UI directs cancellation to the native save dialog and disables its own cancel/close controls. Native save cannot be aborted by the renderer.
- Native save cancellation says that no file was written. Save errors and retrieval errors retain scope/format and expose retry; retry obtains a fresh snapshot.
- Explains excluded file contents and the metadata limitations of browser/spreadsheet importers.

## Executed checks

Working directory: `apps/desktop`.

1. `pnpm exec vitest run src/lib/bookmark-export.test.ts src/components/raindrop/export-dialog.test.tsx`
   - **72 passed, 2 files**, run at 23:30 JST after the overlapping-listing fix; included again in the 152-test, 12-file integration regression at 23:38 JST.
   - 55 core tests: HTML DOM parsing, nesting/empty/duplicate-name folders, Unicode and metadata, cyclic hierarchy, dangerous URL schemes, invalid dates, CSV formula escaping, JSON fields, 0/49/50/51/100 pagination, scoped descendants, Unsorted, malformed/incomplete/repeated pages, same-count edits, metadata/account changes, identical root/child overlap and conflicting duplicates, cancellation boundaries and a later-page HTTP 503.
   - Core retrieval uses MSW and the real Axios HTTP adapter, with only synthetic service responses.
   - 17 component tests: all/scoped/Unsorted export, HTML/CSV/JSON save payloads, progress and verification states, cancellation and late responses, retry preservation, native save cancellation/failure, duplicate-save protection, unmount and empty results.
   - Component tests use happy-dom and mocked fetch/native-save boundaries; serialization is real.
2. `pnpm exec eslint src/lib/bookmark-export.ts src/lib/bookmark-export.test.ts src/components/raindrop/export-dialog.tsx src/components/raindrop/export-dialog.test.tsx --fix --max-warnings 0`
   - **Passed**, including React memo/callback/compiler rules. Import-order fixes applied only to these owned files.
3. `pnpm exec tsc --project tsconfig.app.json --noEmit --pretty false`
   - Passed for the entire desktop app at 23:38 JST after the controller and serializer refactors. Earlier checks during concurrent edits reported their real errors, and were repeated once those edits were complete.

The export controller now lives in `src/hooks/useBookmarkExport.ts`; metadata, page validation and HTML traversal have separate responsibilities, with no suppressed complexity rules or relaxed thresholds. Owned export functions are below the static cognitive/cyclomatic limits; measured coverage remains part of the coordinating agent's final quality check.

No Electron/native save GUI, real-account export/import, browser motion recording, desktop screenshot, full application regression suite, or CI run was performed in this worker's export task. Unit checks are not reported as native/browser/CI coverage. Integration and live-account QA remain with the coordinating agent.

## References checked

- [Raindrop multiple-bookmark API](https://developer.raindrop.io/v1/raindrops/multiple): system scopes, maximum page size 50, page numbering, sort and nested parameters.
- [Raindrop collection API](https://developer.raindrop.io/v1/collections/methods): separate root/child collection endpoints and account stats/change marker.
- [Axios API reference](https://github.com/axios/axios/blob/v1.x/docs/pages/advanced/api-reference.md), consulted through Context7: AbortController signal and CanceledError/isCancel semantics.
- [React Effect lifecycle guidance](https://react.dev/learn/synchronizing-with-effects), consulted through Context7: abort or ignore stale asynchronous responses on cleanup.
