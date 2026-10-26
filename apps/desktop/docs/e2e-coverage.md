# E2E SPEC.md Coverage Report

Generated: 2026-09-22

## Summary

| Category           | Total  | Covered | Coverage  |
| ------------------ | ------ | ------- | --------- |
| Feature (F1-F8)    | 43     | 39      | 90.7%     |
| API Endpoints      | 36     | 8       | 22.2%     |
| Keyboard Shortcuts | 20     | 20      | 100.0%    |
| **Total**          | **99** | **67**  | **67.7%** |

## Coverage Details

### F1: Scoped Search (4/4)

- [x] **F1.1** — Search only returns results from current collection when scoped — `e2e/specs/search.spec.ts:67`, `e2e/specs/search.spec.ts:111`
- [x] **F1.2** — Scope badge shows current collection name — `e2e/specs/search.spec.ts:68`
- [x] **F1.3** — Toggle to global search is one click away — `e2e/specs/search.spec.ts:69`, `e2e/specs/search.spec.ts:112`
- [x] **F1.4** — Empty state shows "No results in [collection]" with option to search globally — `e2e/specs/search.spec.ts:70`

### F2: Field-Specific Search (5/5)

- [x] **F2.1** — URL-only search finds bookmarks by domain or URL substring — `e2e/specs/search.spec.ts:152`
- [x] **F2.2** — Title-only search matches against bookmark titles — `e2e/specs/search.spec.ts:153`
- [x] **F2.3** — Description-only search matches against excerpts — `e2e/specs/search.spec.ts:154`
- [x] **F2.4** — Matched field is highlighted in search results — `e2e/specs/search.spec.ts:155`
- [x] **F2.5** — Scope persists across searches (stored in searchSlice) — `e2e/specs/search.spec.ts:156`

### F3: Multiple View Modes (4/5)

- [x] **F3.1** — All 4 view modes render correctly with real data — `e2e/specs/crud.spec.ts:390`, `e2e/specs/crud.spec.ts:406`, `e2e/specs/crud.spec.ts:436`, `e2e/specs/view-modes.spec.ts:34`, `e2e/specs/view-modes.spec.ts:47`
- [x] **F3.2** — View mode persists across app restarts — `e2e/specs/view-modes.spec.ts:119`
- [x] **F3.3** — Per-collection view mode overrides global default — `e2e/specs/view-modes.spec.ts:85`
- [x] **F3.4** — Cmd+1-4 shortcuts switch view mode — `e2e/specs/view-modes.spec.ts:66`
- [ ] **F3.5** — Smooth transition between modes (no layout flash)

### F4: Auto-Icon Assignment (4/4)

- [x] **F4.1** — New bookmarks auto-fetch icon from suggest API — `e2e/specs/crud.spec.ts:128`
- [x] **F4.2** — Fallback to Google Favicon API when suggest returns no icon — `e2e/specs/crud.spec.ts:154`
- [x] **F4.3** — Display domain first letter when no icon available — `e2e/specs/crud.spec.ts:193`
- [x] **F4.4** — Background icon resolution doesn't block UI — `e2e/specs/crud.spec.ts:226`

### F5: Fuzzy Collection Search (5/5)

- [x] **F5.1** — Typing "rct" finds "React Resources" collection — `e2e/specs/search.spec.ts:218`
- [x] **F5.2** — Match highlights show which characters matched — `e2e/specs/search.spec.ts:219`
- [x] **F5.3** — Performance: <10ms for 100 collections — `e2e/specs/search.spec.ts:285`
- [x] **F5.4** — Works in sidebar filter AND collection selector dropdowns — `e2e/specs/search.spec.ts:220`, `e2e/specs/search.spec.ts:255`
- [x] **F5.5** — Empty query shows all collections — `e2e/specs/search.spec.ts:221`

### F6: Group ↔ Collection Editing (7/7)

- [x] **F6.1** — Drag collection between groups updates API — `e2e/specs/dnd.spec.ts:71`, `e2e/specs/dnd.spec.ts:298`, `e2e/specs/dnd.spec.ts:325`
- [x] **F6.2** — Reorder within group works and persists — `e2e/specs/dnd.spec.ts:106`, `e2e/specs/dnd.spec.ts:385`
- [x] **F6.3** — Double-click enables inline rename — `e2e/specs/dnd.spec.ts:133`
- [x] **F6.4** — Right-click context menu with all options — `e2e/specs/dnd.spec.ts:148`
- [x] **F6.5** — Drag preview shows collection icon + name — `e2e/specs/dnd.spec.ts:72`, `e2e/specs/dnd.spec.ts:299`
- [x] **F6.6** — Drop indicator shows insertion point — `e2e/specs/dnd.spec.ts:73`
- [x] **F6.7** — Optimistic updates: UI updates immediately, reverts on error — `e2e/specs/dnd.spec.ts:183`, `e2e/specs/dnd.spec.ts:349`

### F7: Enhanced Readability (3/6)

- [ ] **F7.1** — Collection icons use synced Raindrop.io colors
- [ ] **F7.2** — Groups expand/collapse with persistent state
- [x] **F7.3** — Breadcrumb shows full path: Group > Collection — `e2e/specs/crud.spec.ts:27`
- [x] **F7.4** — Bookmark counts visible on collections — `e2e/specs/crud.spec.ts:288`
- [ ] **F7.5** — Content type has distinct icon per type
- [x] **F7.6** — Arrow key navigation works in all view modes — `e2e/specs/keyboard.spec.ts:351`

### F8: Keyboard Shortcut Editor (7/7)

- [x] **F8.1** — Settings dialog has "Keyboard Shortcuts" tab listing all actions — `e2e/specs/keyboard.spec.ts:163`
- [x] **F8.2** — Click "Edit" on any shortcut → captures next key combo → saves — `e2e/specs/keyboard.spec.ts:172`
- [x] **F8.3** — Conflict detection warns when binding already assigned, offers swap — `e2e/specs/keyboard.spec.ts:191`
- [x] **F8.4** — "Reset to Defaults" restores all shortcuts to defaults — `e2e/specs/keyboard.spec.ts:211`
- [x] **F8.5** — Search filter finds actions by name — `e2e/specs/keyboard.spec.ts:234`
- [x] **F8.6** — Custom shortcuts persist across app restarts (localStorage) — `e2e/specs/keyboard.spec.ts:242`
- [x] **F8.7** — Cmd+Shift+K opens shortcut editor from anywhere — `e2e/specs/keyboard.spec.ts:114`

### API Endpoints (8/36)

- [x] **API.1** — GET /raindrops/{collectionId} — Browse bookmarks in collection — `e2e/specs/crud.spec.ts:28`, `e2e/specs/crud.spec.ts:268`, `e2e/specs/crud.spec.ts:366`, `e2e/specs/crud.spec.ts:463`, `e2e/specs/crud.spec.ts:481`, `e2e/specs/smoke.spec.ts:26`
- [x] **API.2** — GET /raindrop/{id} — View bookmark details — `e2e/specs/crud.spec.ts:572`, `e2e/specs/crud.spec.ts:612`, `e2e/specs/crud.spec.ts:644`
- [x] **API.3** — POST /raindrop — Create new bookmark — `e2e/specs/crud.spec.ts:50`
- [ ] **API.4** — PUT /raindrop/{id} — Edit bookmark (title, tags, notes)
- [ ] **API.5** — DELETE /raindrop/{id} — Delete bookmark
- [ ] **API.6** — PUT /raindrop/{id}/cover — Upload cover image
- [ ] **API.7** — GET /raindrop/{id}/cache — Open permanent copy
- [ ] **API.8** — GET /raindrop/suggest — Auto-fill URL metadata
- [ ] **API.9** — GET /raindrop/{id}/suggest — Re-fetch metadata for existing
- [ ] **API.10** — PUT /raindrop/file — Upload file as bookmark
- [ ] **API.11** — POST /raindrops — Batch create (≤100)
- [x] **API.12** — PUT /raindrops/{collectionId} — Batch update (move, tag, important) — `e2e/specs/crud.spec.ts:309`, `e2e/specs/crud.spec.ts:336`, `e2e/specs/crud.spec.ts:689`
- [x] **API.13** — DELETE /raindrops/{collectionId} — Batch delete to Trash / purge — `e2e/specs/crud.spec.ts:506`, `e2e/specs/crud.spec.ts:543`
- [x] **API.14** — GET /collections — Load root collection tree — `e2e/specs/crud.spec.ts:13`, `e2e/specs/smoke.spec.ts:40`
- [x] **API.15** — GET /collections/childrens — Load nested collections — `e2e/specs/crud.spec.ts:14`, `e2e/specs/smoke.spec.ts:41`
- [ ] **API.16** — POST /collection — Create collection
- [ ] **API.17** — GET /collection/{id} — Load collection for editing
- [ ] **API.18** — PUT /collection/{id} — Update collection (name, icon, color, parent)
- [ ] **API.19** — DELETE /collection/{id} — Delete collection
- [ ] **API.20** — PUT /collection/{id}/cover — Upload collection cover
- [ ] **API.21** — PUT /collections — Reorder / expand / collapse
- [ ] **API.22** — PUT /collections/merge — Merge collections
- [ ] **API.23** — PUT /collections/clean — Remove empty collections
- [ ] **API.24** — DELETE /collections/trash — Empty trash
- [ ] **API.25** — GET /tags/{collectionId} — List tags
- [ ] **API.26** — GET /tags/0 — List all tags
- [ ] **API.27** — PUT /tags — Rename tag
- [ ] **API.28** — DELETE /tags — Delete tag(s)
- [x] **API.29** — GET /user — Current user profile — `e2e/specs/smoke.spec.ts:13`
- [ ] **API.30** — PUT /user — Update user preferences
- [ ] **API.31** — GET /user/{id} — Public user profile
- [ ] **API.32** — GET /filters/{collectionId} — Type/tag filter counts
- [ ] **API.33** — POST /import/url — Parse URL metadata
- [ ] **API.34** — GET /raindrops/{collectionId}/export — Export as HTML/CSV
- [ ] **API.35** — GET /backups — List backups
- [ ] **API.36** — POST /backup — Generate backup

### Keyboard Shortcuts (20/20)

- [x] **KB.1** — Cmd+K opens global search — `e2e/specs/keyboard.spec.ts:62`
- [x] **KB.2** — Cmd+N opens new bookmark dialog — `e2e/specs/keyboard.spec.ts:69`
- [x] **KB.3** — Cmd+Shift+N opens new collection dialog — `e2e/specs/keyboard.spec.ts:78`
- [x] **KB.4** — Cmd+1 switches to grid view — `e2e/specs/keyboard.spec.ts:87`
- [x] **KB.5** — Cmd+2 switches to list view — `e2e/specs/keyboard.spec.ts:95`
- [x] **KB.6** — Cmd+3 switches to table view — `e2e/specs/view-modes.spec.ts:35`
- [x] **KB.7** — Cmd+4 switches to directory view — `e2e/specs/view-modes.spec.ts:48`
- [x] **KB.8** — Cmd+, opens settings — `e2e/specs/keyboard.spec.ts:106`
- [x] **KB.9** — Cmd+Backspace deletes selected bookmark(s) — `e2e/specs/keyboard.spec.ts:385`
- [x] **KB.10** — Cmd+A selects all bookmarks in view — `e2e/specs/keyboard.spec.ts:124`
- [x] **KB.11** — Arrow Up moves selection up — `e2e/specs/keyboard.spec.ts:303`
- [x] **KB.12** — Arrow Down moves selection down — `e2e/specs/keyboard.spec.ts:292`
- [x] **KB.13** — Enter opens selected bookmark in browser — `e2e/specs/keyboard.spec.ts:313`
- [x] **KB.14** — Space toggles detail panel for selected — `e2e/specs/keyboard.spec.ts:328`
- [x] **KB.15** — Escape closes active panel/dialog — `e2e/specs/crud.spec.ts:73`, `e2e/specs/crud.spec.ts:100`
- [x] **KB.16** — Cmd+Shift+K opens shortcut editor — `e2e/specs/keyboard.spec.ts:113`
- [x] **KB.17** — Cmd+F focuses search bar (scoped to current collection) — `e2e/specs/keyboard.spec.ts:398`
- [x] **KB.18** — Cmd+Shift+F opens global search across all collections — `e2e/specs/keyboard.spec.ts:407`
- [x] **KB.19** — Cmd+D toggles important flag on selected — `e2e/specs/keyboard.spec.ts:373`
- [x] **KB.20** — Cmd+Shift+T opens tag management — `e2e/specs/keyboard.spec.ts:132`

## Uncovered Requirements by Phase

### P2 (28 uncovered)

- API.4 — PUT /raindrop/{id} — Edit bookmark (title, tags, notes)
- API.5 — DELETE /raindrop/{id} — Delete bookmark
- API.6 — PUT /raindrop/{id}/cover — Upload cover image
- API.7 — GET /raindrop/{id}/cache — Open permanent copy
- API.8 — GET /raindrop/suggest — Auto-fill URL metadata
- API.9 — GET /raindrop/{id}/suggest — Re-fetch metadata for existing
- API.10 — PUT /raindrop/file — Upload file as bookmark
- API.11 — POST /raindrops — Batch create (≤100)
- API.16 — POST /collection — Create collection
- API.17 — GET /collection/{id} — Load collection for editing
- API.18 — PUT /collection/{id} — Update collection (name, icon, color, parent)
- API.19 — DELETE /collection/{id} — Delete collection
- API.20 — PUT /collection/{id}/cover — Upload collection cover
- API.21 — PUT /collections — Reorder / expand / collapse
- API.22 — PUT /collections/merge — Merge collections
- API.23 — PUT /collections/clean — Remove empty collections
- API.24 — DELETE /collections/trash — Empty trash
- API.25 — GET /tags/{collectionId} — List tags
- API.26 — GET /tags/0 — List all tags
- API.27 — PUT /tags — Rename tag
- API.28 — DELETE /tags — Delete tag(s)
- API.30 — PUT /user — Update user preferences
- API.31 — GET /user/{id} — Public user profile
- API.32 — GET /filters/{collectionId} — Type/tag filter counts
- API.33 — POST /import/url — Parse URL metadata
- API.34 — GET /raindrops/{collectionId}/export — Export as HTML/CSV
- API.35 — GET /backups — List backups
- API.36 — POST /backup — Generate backup

### P5 (4 uncovered)

- F3.5 — Smooth transition between modes (no layout flash)
- F7.1 — Collection icons use synced Raindrop.io colors
- F7.2 — Groups expand/collapse with persistent state
- F7.5 — Content type has distinct icon per type
