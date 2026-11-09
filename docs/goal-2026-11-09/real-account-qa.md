# Real-account validation record

This record separates service readback from synthetic tests and packaged/native validation. Real-account application checks and owned-fixture cleanup are complete with the numeric-sort qualification below. Clean-commit CI/package acceptance remains separate.

## Authorization and isolation

The initial official backup was verified before any account mutation. The QA owner then used the existing authorized Raindrop integration in memory with an isolated Electron profile. All writes are restricted to generated QA names and recorded bookmark/collection IDs. The original desktop profile is untouched. Private scripts, ledger, raw service snapshots, exports, screenshots and recordings are outside the repository under the owner-only backup directory. Public PR media uses synthetic fixtures instead.

This verifies real service APIs and the application's renderer/native operations. It does not verify a fresh OAuth authorization, production-identity credential restoration or real credentials surviving an application update. Those require configured OAuth build inputs and the corresponding interactive authorization.

## Confirmed application and service results

- Bookmark creation through the UI persisted title, description, multiline Unicode note, tags and importance, with independent API readback.
- Three independent external edits appeared in the active collection in 966, 2,599 and 3,101 ms. The locator included the exact bookmark ID and a unique title. An earlier rerun with non-unique fixture titles produced an invalid latency sample and was discarded. These are limited ordinary-load observations, not an unconditional five-second guarantee.
- All-library JSON, HTML and CSV exports each contained 4,975 bookmarks at the same QA checkpoint. Independent parsers verified 4,975 unique JSON IDs, identical CSV ID sets and identical URL multisets across all three formats. Native atomic writes were real; the OS destination-picker result was scripted.
- The 4,975-record JSON export contained all 4,917 original active bookmark IDs with unchanged URL, title, description, note, tags, importance, collection and type. All 58 additional IDs belonged to the QA ledger.
- Native Dock icon I17 selection and reset succeeded in the isolated profile. Signing out returned to the login screen.
- A 45-byte text upload now persists the chosen positive collection during binary creation and the subsequent metadata update, along with its tags and note. Independent readback found the earlier implementation had put the file in Unsorted. The fix orders collectionId before the multipart file and includes the collection in the metadata update; service/UI regressions cover this case.
- Actual detail editing and closing/reopening preserve title, description and multiline note. Bulk tagging two owned bookmarks retains their original tags. Scoped search, clearing the search and all four views work with real account data.
- Group creation, rename and deletion persisted. Collection create/edit/group movement, public=false, default Table, bulk bookmark movement and single-item Trash operations passed independent readback. All original group membership was retained.
- Group-context creation selects the invoking group. Account-local color and icon survive reload. Actual wheel interactions reach the last group and collection in the large real account; the destination persists. Automatic pagination loads records beyond the initial page.
- Nested collection merge moves all three owned source IDs into the target and removes the source. Collection rename/delete and empty temporary-group deletion pass.
- Owned tag rename, delete and merge pass; deletion showed service-side eventual consistency, and a subsequent independent read confirmed removal. Existing unrelated fixture tags remain.
- Shortcut reassignment, execution, conflict exchange, reset and input-local Select All pass. Theme/default view, palette zero/results/history clear and pointer-driven bookmark drag pass.
- Explicit article type persists. Bulk Mark Important leaves an already-important bookmark important while marking the other. Table selection retains 51 selected rows across two pages; Shift range selects three and Select All selects 51.

## Findings corrected and repeated

Real-account data exposed overlapping collection endpoints and collections without group membership. Export now deduplicates identical endpoint copies while rejecting conflicting copies; the sidebar preserves ungrouped collections in a synthetic container that is never written back as an account group.

Initial asynchronous loading also exposed an unobserved infinite-scroll sentinel. Manual pagination worked, but automatic next-page loading failed. The hook now observes a sentinel after it mounts, advances again after a successful page when still visible, and stops automatic retries after an error. Synthetic native Electron verification passes delayed first-page loading followed by a real wheel interaction and 60 unique rows; real-account repetition also passed.

The service's collection color field describes the primary cover color and is not a writable color setting. Sending a chosen color did not persist it. Lain now retains color choices in account-scoped local preferences, with explicit UI wording. The group-specific Add Collection menu passes its group into the dialog. Both behaviors passed recorded synthetic and real-account checks.

## Download verification limit

Both the stored preview link and the official web client's `/v1/raindrop/{id}/file?download` route returned the web application HTML through this OAuth API session, rather than the 45-byte fixture. The latter response redirected to the web application origin and was `text/html`. This does not establish corrupt storage, and no byte-preservation success is claimed. An authenticated web download remains unverified; no authorization was bypassed. The persisted file size, selected collection and metadata were verified independently.

## Cleanup and final evidence

Cleanup removed only ledger-owned bookmarks, files and collections, including owned items already in Trash. No account-wide Empty Trash operation ran. Complete post-cleanup snapshots contain **4,917 active bookmarks, 182 Trash entries, 407 collections and 37 groups**, with no remaining owned fixtures, missing original IDs or changed original bookmark core metadata. Collection titles, descriptions, hierarchy, public flags, views, expanded state and covers match the backup. Group order, visibility and membership match.

The initial strict comparison stopped because **376 numeric collection `sort` values were renumbered** during the organization operations. Ordered collection IDs within each of the five parent scopes are unchanged. The original strict failure and snapshots are retained; cleanup is recorded as `verified-with-sort-renumbering`, not byte-identical account restoration. No writes were applied to original collections to restore unused numeric gaps.

Six private contact sheets were visually inspected from recorded real-account flows: organization, preferences/palette/drag, completed merge/delete, appearance, large menus, and Table/tags. Earlier failed attempts remain recorded and are not counted as successful complete runs. The coarse frame review verifies visible transitions and results, not frame-time smoothness. Public PR media contains synthetic data only.

Final clean-commit CI, packages and signed-update evidence are recorded in the PR and external final report so documenting their results does not alter the packaged source. Fresh OAuth, production credential restoration, actual OS picker/confirmation-sheet visual interaction and uploaded-file byte download remain explicitly unverified.
