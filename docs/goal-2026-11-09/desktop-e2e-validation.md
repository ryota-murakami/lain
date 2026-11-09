# Desktop feature E2E validation

All data in this report and its screenshots/videos comes from synthetic fixtures. Tests launch the built Electron application with `LAIN_TEST_MODE=1` and a unique temporary user-data directory. No live account, OAuth credential, or private backup is used.

## Coverage and boundaries

- **Export:** renderer scope/format controls → complete API pagination and snapshot checks → preload IPC → sender validation → atomic native file writer. The OS save picker is deterministically stubbed with Electron's documented `dialog.showSaveDialog` replacement. The test observes cancellation, retries with a destination, reads the actual JSON file, asserts 60 unique bookmarks and six collection records (including empty/nested collections), and verifies no temporary write artifacts remain. It does not click or record the operating system's native save sheet.
- **Upload:** two in-memory text files → real browser multipart request → mocked HTTP service → real queue/progress UI. The second file is created successfully, its first metadata write returns HTTP 503, and explicit Retry metadata completes the original bookmark. Assertions require exactly two binary uploads, three metadata writes, identical second-file bookmark IDs before/after retry, preserved Unicode note/tags/importance, and both completed bookmarks in the explicitly selected Development collection. The test also verifies collectionId precedes the binary file in multipart data and every metadata attempt includes collection ID 100.
- **Icons:** bundled catalog/64 candidates and real images → explicit preview → native select-icon IPC → isolated electron-store preference → renderer reload → restore default. This is designed to exercise the real native icon operation, not a stubbed `selectIcon` function. It does not validate the installed signed bundle icon or Linux desktop launcher.

The feature fixture records Electron renderer video via Playwright's `electron.launch({ recordVideo })`. Screenshots are confirmed-state checkpoints; a 450 ms presentation hold makes each checkpoint readable in the video. Assertions, not presentation sleeps, determine success. Playwright CLI executes the interactions.

## Execution history

- Built application checkpoint supplied by the coordinating agent: 2026-11-09 23:42 JST.
- Initial full existing suite: **70 passed / 5 failed**, 75 tests. Four failures selected the new group-actions button using the old ambiguous collection-name locator; one expected visible Directory text instead of its new explicit accessible label. The failures occurred before their intended assertions, and were not counted as passes.
- Fixed observable locators: exact collection button names in `dnd.spec.ts`; `Development collection` accessible name in `view-modes.spec.ts`.
- Targeted recheck: **14/14 existing DnD and view-mode tests passed**. Export feature flow also passed.
- Upload feature flow passed after selecting the Unsorted system button with its dynamic count and the dialog footer's explicit Close button. Request counts and resulting bookmark rows were verified.
- Icon feature flow initially failed because the unpackaged main-file launch resolved the candidate directory under `dist-electron/public`. The renderer gallery loaded correctly, but native application returned an error. The native-process owner corrected the unpackaged resource root. On the rebuilt 23:50 JST application, the complete icon flow passed, including the actual preference file and restore-default operation.

- Combined 78-test run on the 23:50 JST build: **74 passed / 4 failed**. All three new feature flows passed. The four remaining failures were old partial-name selectors matching the new accessible bookmark action buttons; they were changed to exact collection names.
- Follow-up search suite: **6/6 passed**. The two affected keyboard/view-preference tests: **2/2 passed**.
- The 2026-11-10 **00:04:53 JST build passed 80/80 tests in one complete run** (`test-results/combined-20261110`, 1.3 minutes), including two new Grid/List pointer flows. This is an intermediate build, not the final review commit.
- Frame inspection of the new flows exposed a brief false empty state while changing to an uncached collection. A delayed-response unit reproduced the problem; the loading hook was corrected and all 16 bookmark-query/CRUD tests passed. Both pointer E2Es now deliberately hold the destination response and assert the loading state. The rebuilt 00:21:41 JST application passed both delayed-destination E2Es; their new videos show loading before destination rows without a false empty result.
- An additional native navigation probe passed new-window denial (`window.open` returned null), but failed same-window protection: assigning `about:blank` navigated the privileged renderer away from the app. No external service was contacted. This new 81st test was not part of the successful 80-test run; the subsequent correction and passing regression are recorded below. On the 00:21:41 JST guard revision, the same test still failed: the page URL became empty and closing the app timed out. The three independent upload/Grid/List cases in that run passed. This historical failure was resolved by the deferred native navigation recovery included in the 00:36:05 JST build.

## Pagination regression discovered during real-service QA

The coordinating agent observed that only the first 50 bookmarks remained available after scrolling. The synthetic unit reproduction confirmed that `useInfiniteScroll` attached its observer only on the initial render, when `hasMore` was false and no sentinel existed. A second regression covered a sentinel that remains visible after a page finishes. Both new tests failed before the change. The hook now reconnects on paging/fetch-state changes, submits at most once per observer attachment, ignores notifications after cleanup, and waits for explicit recovery after a fetch error. MainContent passes its existing error state into the hook.

The resulting seven scrolling tests, sixteen bookmark-query/CRUD tests and twenty-three MainContent tests passed together (**46 tests**); application TypeScript and scoped strict lint also passed. A recorded E2E deliberately holds the first page, observes loading, releases 50 rows, wheels the actual viewport, then requires exactly pages `[0, 1]`, 60 unique rows and no remaining Load more button. The 00:36:05 JST build passed this new 82nd test and the native navigation recovery test, then passed **82/82 in a single full run** (1.4 minutes, `test-results/acceptance-20261110`). Native recovery passed without relaxing the original URL/UI assertions. This supersedes the earlier unresolved-navigation state, while preserving its failure history above.

## Successful motion and screenshot evidence

Evidence directory: `docs/goal-2026-11-09/evidence/desktop-flows/`.

| Flow                    | MP4 attachment                | Original recording             | Duration | Extracted frames |
| ----------------------- | ----------------------------- | ------------------------------ | -------- | ---------------- |
| export cancel save      | `export-cancel-save.mp4`      | `export-cancel-save.webm`      | 2.84 s   | 11               |
| upload partial retry    | `upload-partial-retry.mp4`    | `upload-partial-retry.webm`    | 3.92 s   | 16               |
| icon apply reset        | `icon-apply-reset.mp4`        | `icon-apply-reset.webm`        | 3.72 s   | 15               |
| grid hover menu actions | `grid-hover-menu-actions.mp4` | `grid-hover-menu-actions.webm` | 8.04 s   | 32               |
| list hover menu actions | `list-hover-menu-actions.mp4` | `list-hover-menu-actions.webm` | 6.52 s   | 26               |
| pagination              | `pagination.mp4`              | `pagination.webm`              | 3.12 s   | 12               |
| collection color group  | `collection-color-group.mp4`  | `collection-color-group.webm`  | 4.64 s   | 19               |
| large group menu        | `large-group-menu.mp4`        | `large-group-menu.webm`        | 3.76 s   | 15               |
| large collection picker | `large-collection-picker.mp4` | `large-collection-picker.webm` | 4.64 s   | 19               |
| collection drag         | `collection-drag.mp4`         | `collection-drag.webm`         | 2.68 s   | 11               |
| bookmark drag           | `bookmark-drag.mp4`           | `bookmark-drag.webm`           | 2.76 s   | 11               |
| nested collection merge | `nested-collection-merge.mp4` | `nested-collection-merge.webm` | 4.24 s   | 17               |

Each MP4 was transcoded from a successful Playwright WebM using H.264, yuv420p and faststart, without timeline cuts. FFmpeg sampled each recording at four frames per second; the corresponding `*-frames/` directories contain **204 frames**. All **twelve** contact sheets were visually inspected. Unused final contact-sheet cells are padding. `latest-motion.json` records each original test-output path, build time, duration and frame count. Eleven flows use the 00:58:36 JST build; nested merge uses the 01:09:57 JST build.

Observed transitions include canceled export then confirmed write, upload partial failure then successful retry, native icon apply/reload/reset, Grid/List controls and loading during collection changes, delayed first-page loading followed by automatic second-page loading, local color persistence, group-specific creation, scrolling to the last of 40 groups and 400 extra collections, both drag previews/drop indicators, and nested merge confirmation/readback. Controls remained reachable through normal scrolling; no horizontal clipping was observed. The generic HTTP 503 toast briefly remains after upload retry until its normal auto-dismiss, while per-file results correctly report success. This feedback observation was reported to the coordinating agent.

Screenshots capture confirmed checkpoints for every flow. All public artifacts contain only synthetic data. `pr-media.md` and newline-terminated `attachments.txt` list the twelve videos for PR upload. Native save-sheet visuals, installed bundle icons, Linux launcher visuals and external-service behavior are outside these recordings. The native navigation regression is asserted by the suite but is not included as a PR animation attachment.

## Validation commands and limitations

- `pnpm exec playwright test --reporter=line --output=test-results/baseline-20261109`
- `pnpm exec playwright test e2e/specs/dnd.spec.ts e2e/specs/view-modes.spec.ts e2e/specs/export-upload-icon.spec.ts --reporter=line --output=test-results/feature-recheck-20261109`
- `pnpm exec playwright test e2e/specs/export-upload-icon.spec.ts --grep 'multi-file upload' --retries=0 --reporter=line --output=test-results/upload-flow-20261109`
- Scoped strict TypeScript check passed: `pnpm exec tsc --ignoreConfig --noEmit --strict --target ES2023 --module ESNext --moduleResolution Bundler --skipLibCheck --allowImportingTsExtensions --types node --lib ES2023,DOM e2e/electron.ts e2e/api-mock.ts e2e/specs/export-upload-icon.spec.ts e2e/specs/dnd.spec.ts e2e/specs/view-modes.spec.ts e2e/specs/search.spec.ts e2e/specs/keyboard.spec.ts`. The existing fuzzy-performance fixture’s readonly keys tuple was changed to the library’s accepted mutable string array; behavior is unchanged.
- Repository ESLint intentionally excludes `e2e`. Invoking it on these files reported ignored-file warnings; attempting `--no-ignore` failed because these files are outside its TypeScript project service. Neither invocation is claimed as a successful E2E lint check. Application source strict lint was independently verified before this E2E work.
- The application-level source regression before E2E passed 162 tests, then 16 MainApp/detail tests passed after adding one reopen regression case. These are separate unit results, not added to the E2E count.
- Two additional Grid/List pointer-flow tests passed in the 80-test checkpoint. Their delayed-destination assertions also passed on the subsequent 00:21:41 JST build. The mock now preserves active bookmarks in Trash instead of immediately removing them, and batch deletions enforce the source collection.
- No CI run or installed package test is implied by these local built-Electron checks.

Playwright's official Electron dialog-mocking and video-saving documentation was consulted through Context7 (`/microsoft/playwright`).

## Collection appearance and large-library follow-up

Raindrop's [collection fields](https://developer.raindrop.io/v1/collections) describe color as derived from the cover. Its [create/update request fields](https://developer.raindrop.io/v1/collections/methods) include cover, but not an arbitrary color input. The coordinating agent also observed that a color-only request did not persist. Lain now stores the explicit color in the existing account-reset UI preferences, overlays it on refreshed root/child collections, and excludes it from collection requests. API response color remains available as a fallback. The unsupported request-schema addition was removed and the API bindings regenerated from the current tag configuration.

The same follow-up preserves the invoking group when Group actions → Add Collection opens the form; closing it or editing an existing collection clears that creation context. Seven relevant files passed **51 unit tests**, strict lint and app TypeScript. These checks cover local colors across refresh/account reset, hydration, metadata failure and group-context lifetime.

Three additional recorded E2Es pass on the 00:58:36 JST build: local-color reload plus group-context creation; selecting the last of 40 group destinations; and selecting the last of 400 extra collections in both the Move picker and the unfiltered sidebar finder. The old 00:36 build reproduced the group-menu failure after a real wheel action (`Synthetic group 40` had viewport ratio zero). Their targeted run passed 3/3, then the complete suite passed **85/85** (1.6 minutes, `test-results/final-desktop-20261110`). After adding opt-in recording to the existing fixture, both drag flows passed with recording enabled (2/2), and the ordinary full suite with recording disabled passed **85/85** again (2.3 minutes, `test-results/final-freeze-20261110`). No application rebuild occurred between these checks.

## Nested collection merge follow-up

Real-service QA exposed that merge choices only listed roots. The dialog now flattens existing collection trees into path-labelled choices, includes child counts, and disables selecting the source or its descendants as the destination. Eight targeted dialog unit tests, strict lint and app TypeScript passed under the UI owner's checks.

The recorded Electron regression moves three existing bookmark IDs from `Development / React` into `Design`, verifies the exact `{to:101, ids:[200]}` request, reads 18 unique destination rows, reloads, and confirms all three IDs remain while the child source no longer appears in merge choices. The stateful API fixture now applies the merge to subsequent reads. The first attempt failed only because the test assumed selected navigation survives reload; the application starts at All Bookmarks. After explicitly reopening Design for readback, the targeted test passed **1/1** (6.6 seconds, `test-results/nested-merge-recheck-20261110`). Its 17 extracted frames were inspected.

The final combined run against the **01:09:57 JST build passed 86/86 tests** (2.2 minutes, `test-results/final-merge-freeze-20261110`, log `/tmp/lain-final-86-e2e.log`). The scoped strict E2E TypeScript check passed after the merge fixture and assertion changes. `checkpoint-20261110-010957.json` records build artifact hashes and the passing local run. Final review-commit CI remains a separate gate.

## Controlled Empty Trash follow-up

The isolated C07 check exercised the actual Trash menu on the compiled `ebd3d8d579511c65853b5ffa38bba76d49a7bd03` application. Each scenario used a fresh synthetic profile and two mock Trash bookmarks; no live-account Trash was read or emptied. HTTP 503 and HTTP-200 `result:false` both retained the two bookmark IDs without a success toast, while success refreshed the empty list. Every click sent exactly one DELETE `/collection/-99`, and the 58 active mock bookmarks remained unchanged. However, both refusal paths emitted an unhandled Promise rejection, and `result:false` provided no visible explanation. Those three narrow endpoint/data checks therefore did **not** establish overall acceptance.

The new tracked `e2e/specs/empty-trash.spec.ts` adds visible failure feedback, exactly one toast, and no renderer `pageerror` assertions to all three real-menu flows. Against the old build it reproduced **2 failures / 1 pass**, retries 0: HTTP 503 failed the unhandled-error assertion; `result:false` failed the visible-error assertion. The production correction consumes the menu-click rejection and reports semantic HTTP-200 refusal, leaving existing Axios transport notifications and hook rejection semantics intact. The focused sidebar and collection-hook suite passes **27/27**, with strict production lint and application/E2E TypeScript passing. The rebuilt complete local suite passed **93/93** with retries 0 (2.1 minutes, `/tmp/lain-c07-final-e2e.log`). The targeted three cases then passed **3/3** with recording enabled and retries 0 (6.9 seconds, external `tracked-after/`), including exact single-toast feedback and no renderer `pageerror`. Final clean-commit CI remains a separate gate.

External evidence lives under `outputs/lain-empty-trash-qa-ebd3d8d/`. The initial harness incorrectly expected Trash navigation to survive renderer reload; that failure is preserved separately, and readback now explicitly reopens Trash from All Bookmarks. The original three recordings fully decode; all 31 consecutive 4fps frames in three contact sheets were visually inspected. They document the failure-feedback defect, not a clean release result. The stricter red run is preserved separately in `tracked-before/` with three unique videos, 52 sampled frames and four reviewed contact sheets. The corrected run in `tracked-after/` contains three unique videos (7.80 seconds); full FFmpeg decoding passed, and all 31 consecutive 4fps frames in three contact sheets were reviewed. Both refusal flows retain two rows, show exactly one appropriate failure notification, and survive reload; success shows the empty state and success notification. `tracked-after-runtime.json` pins the 143 compiled files used for this local run; `verification.json` separates the original failure, local correction and pending final CI.
