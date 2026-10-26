/**
 * Canonical list of all testable requirements from SPEC.md.
 * Used by the E2E coverage report script to track which
 * requirements are covered by @spec: tags in test files.
 *
 * ID scheme:
 *   F{n}.{m}  — Feature acceptance criteria (§5)
 *   API.{n}   — Endpoint coverage (§4.2)
 *   KB.{n}    — Keyboard shortcuts (§6.1)
 *
 * @example
 *   pnpm coverage:e2e-spec  // generates docs/e2e-coverage.md
 */

export interface SpecRequirement {
  /** Unique identifier: F1.1, API.14, KB.3 */
  id: string
  /** Source section in SPEC.md */
  section: string
  /** Human-readable description */
  description: string
  /** Implementation phase */
  phase: 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7'
  /** Category for grouping in reports */
  category: 'feature' | 'api' | 'keyboard'
}

export const specRequirements: SpecRequirement[] = [
  // ═══════════════════════════════════════════════════════
  // F1: Scoped Search (4 criteria) — §5.F1
  // ═══════════════════════════════════════════════════════
  {
    id: 'F1.1',
    section: '5.F1',
    description:
      'Search only returns results from current collection when scoped',
    phase: 'P3',
    category: 'feature',
  },
  {
    id: 'F1.2',
    section: '5.F1',
    description: 'Scope badge shows current collection name',
    phase: 'P3',
    category: 'feature',
  },
  {
    id: 'F1.3',
    section: '5.F1',
    description: 'Toggle to global search is one click away',
    phase: 'P3',
    category: 'feature',
  },
  {
    id: 'F1.4',
    section: '5.F1',
    description:
      'Empty state shows "No results in [collection]" with option to search globally',
    phase: 'P3',
    category: 'feature',
  },

  // ═══════════════════════════════════════════════════════
  // F2: Field-Specific Search (5 criteria) — §5.F2
  // ═══════════════════════════════════════════════════════
  {
    id: 'F2.1',
    section: '5.F2',
    description: 'URL-only search finds bookmarks by domain or URL substring',
    phase: 'P3',
    category: 'feature',
  },
  {
    id: 'F2.2',
    section: '5.F2',
    description: 'Title-only search matches against bookmark titles',
    phase: 'P3',
    category: 'feature',
  },
  {
    id: 'F2.3',
    section: '5.F2',
    description: 'Description-only search matches against excerpts',
    phase: 'P3',
    category: 'feature',
  },
  {
    id: 'F2.4',
    section: '5.F2',
    description: 'Matched field is highlighted in search results',
    phase: 'P3',
    category: 'feature',
  },
  {
    id: 'F2.5',
    section: '5.F2',
    description: 'Scope persists across searches (stored in searchSlice)',
    phase: 'P3',
    category: 'feature',
  },

  // ═══════════════════════════════════════════════════════
  // F3: Multiple View Modes (5 criteria) — §5.F3
  // ═══════════════════════════════════════════════════════
  {
    id: 'F3.1',
    section: '5.F3',
    description: 'All 4 view modes render correctly with real data',
    phase: 'P5',
    category: 'feature',
  },
  {
    id: 'F3.2',
    section: '5.F3',
    description: 'View mode persists across app restarts',
    phase: 'P5',
    category: 'feature',
  },
  {
    id: 'F3.3',
    section: '5.F3',
    description: 'Per-collection view mode overrides global default',
    phase: 'P5',
    category: 'feature',
  },
  {
    id: 'F3.4',
    section: '5.F3',
    description: 'Cmd+1-4 shortcuts switch view mode',
    phase: 'P5',
    category: 'feature',
  },
  {
    id: 'F3.5',
    section: '5.F3',
    description: 'Smooth transition between modes (no layout flash)',
    phase: 'P5',
    category: 'feature',
  },

  // ═══════════════════════════════════════════════════════
  // F4: Auto-Icon Assignment (4 criteria) — §5.F4
  // ═══════════════════════════════════════════════════════
  {
    id: 'F4.1',
    section: '5.F4',
    description: 'New bookmarks auto-fetch icon from suggest API',
    phase: 'P4',
    category: 'feature',
  },
  {
    id: 'F4.2',
    section: '5.F4',
    description: 'Fallback to Google Favicon API when suggest returns no icon',
    phase: 'P4',
    category: 'feature',
  },
  {
    id: 'F4.3',
    section: '5.F4',
    description: 'Display domain first letter when no icon available',
    phase: 'P4',
    category: 'feature',
  },
  {
    id: 'F4.4',
    section: '5.F4',
    description: "Background icon resolution doesn't block UI",
    phase: 'P4',
    category: 'feature',
  },

  // ═══════════════════════════════════════════════════════
  // F5: Fuzzy Collection Search (5 criteria) — §5.F5
  // ═══════════════════════════════════════════════════════
  {
    id: 'F5.1',
    section: '5.F5',
    description: 'Typing "rct" finds "React Resources" collection',
    phase: 'P3',
    category: 'feature',
  },
  {
    id: 'F5.2',
    section: '5.F5',
    description: 'Match highlights show which characters matched',
    phase: 'P3',
    category: 'feature',
  },
  {
    id: 'F5.3',
    section: '5.F5',
    description: 'Performance: <10ms for 100 collections',
    phase: 'P3',
    category: 'feature',
  },
  {
    id: 'F5.4',
    section: '5.F5',
    description: 'Works in sidebar filter AND collection selector dropdowns',
    phase: 'P3',
    category: 'feature',
  },
  {
    id: 'F5.5',
    section: '5.F5',
    description: 'Empty query shows all collections',
    phase: 'P3',
    category: 'feature',
  },

  // ═══════════════════════════════════════════════════════
  // F6: Easy Group ↔ Collection Editing (7 criteria) — §5.F6
  // ═══════════════════════════════════════════════════════
  {
    id: 'F6.1',
    section: '5.F6',
    description: 'Drag collection between groups updates API',
    phase: 'P4',
    category: 'feature',
  },
  {
    id: 'F6.2',
    section: '5.F6',
    description: 'Reorder within group works and persists',
    phase: 'P4',
    category: 'feature',
  },
  {
    id: 'F6.3',
    section: '5.F6',
    description: 'Double-click enables inline rename',
    phase: 'P4',
    category: 'feature',
  },
  {
    id: 'F6.4',
    section: '5.F6',
    description: 'Right-click context menu with all options',
    phase: 'P4',
    category: 'feature',
  },
  {
    id: 'F6.5',
    section: '5.F6',
    description: 'Drag preview shows collection icon + name',
    phase: 'P4',
    category: 'feature',
  },
  {
    id: 'F6.6',
    section: '5.F6',
    description: 'Drop indicator shows insertion point',
    phase: 'P4',
    category: 'feature',
  },
  {
    id: 'F6.7',
    section: '5.F6',
    description: 'Optimistic updates: UI updates immediately, reverts on error',
    phase: 'P4',
    category: 'feature',
  },

  // ═══════════════════════════════════════════════════════
  // F7: Enhanced Readability (6 criteria) — §5.F7
  // ═══════════════════════════════════════════════════════
  {
    id: 'F7.1',
    section: '5.F7',
    description: 'Collection icons use synced Raindrop.io colors',
    phase: 'P5',
    category: 'feature',
  },
  {
    id: 'F7.2',
    section: '5.F7',
    description: 'Groups expand/collapse with persistent state',
    phase: 'P5',
    category: 'feature',
  },
  {
    id: 'F7.3',
    section: '5.F7',
    description: 'Breadcrumb shows full path: Group > Collection',
    phase: 'P5',
    category: 'feature',
  },
  {
    id: 'F7.4',
    section: '5.F7',
    description: 'Bookmark counts visible on collections',
    phase: 'P5',
    category: 'feature',
  },
  {
    id: 'F7.5',
    section: '5.F7',
    description: 'Content type has distinct icon per type',
    phase: 'P5',
    category: 'feature',
  },
  {
    id: 'F7.6',
    section: '5.F7',
    description: 'Arrow key navigation works in all view modes',
    phase: 'P5',
    category: 'feature',
  },

  // ═══════════════════════════════════════════════════════
  // F8: Keyboard Shortcut Editor (7 criteria) — §5.F8
  // ═══════════════════════════════════════════════════════
  {
    id: 'F8.1',
    section: '5.F8',
    description:
      'Settings dialog has "Keyboard Shortcuts" tab listing all actions',
    phase: 'P5',
    category: 'feature',
  },
  {
    id: 'F8.2',
    section: '5.F8',
    description:
      'Click "Edit" on any shortcut → captures next key combo → saves',
    phase: 'P5',
    category: 'feature',
  },
  {
    id: 'F8.3',
    section: '5.F8',
    description:
      'Conflict detection warns when binding already assigned, offers swap',
    phase: 'P5',
    category: 'feature',
  },
  {
    id: 'F8.4',
    section: '5.F8',
    description: '"Reset to Defaults" restores all shortcuts to defaults',
    phase: 'P5',
    category: 'feature',
  },
  {
    id: 'F8.5',
    section: '5.F8',
    description: 'Search filter finds actions by name',
    phase: 'P5',
    category: 'feature',
  },
  {
    id: 'F8.6',
    section: '5.F8',
    description: 'Custom shortcuts persist across app restarts (localStorage)',
    phase: 'P5',
    category: 'feature',
  },
  {
    id: 'F8.7',
    section: '5.F8',
    description: 'Cmd+Shift+K opens shortcut editor from anywhere',
    phase: 'P5',
    category: 'feature',
  },

  // ═══════════════════════════════════════════════════════
  // API Endpoints (36 entries) — §4.2
  // ═══════════════════════════════════════════════════════
  {
    id: 'API.1',
    section: '4.2',
    description:
      'GET /raindrops/{collectionId} — Browse bookmarks in collection',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.2',
    section: '4.2',
    description: 'GET /raindrop/{id} — View bookmark details',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.3',
    section: '4.2',
    description: 'POST /raindrop — Create new bookmark',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.4',
    section: '4.2',
    description: 'PUT /raindrop/{id} — Edit bookmark (title, tags, notes)',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.5',
    section: '4.2',
    description: 'DELETE /raindrop/{id} — Delete bookmark',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.6',
    section: '4.2',
    description: 'PUT /raindrop/{id}/cover — Upload cover image',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.7',
    section: '4.2',
    description: 'GET /raindrop/{id}/cache — Open permanent copy',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.8',
    section: '4.2',
    description: 'GET /raindrop/suggest — Auto-fill URL metadata',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.9',
    section: '4.2',
    description: 'GET /raindrop/{id}/suggest — Re-fetch metadata for existing',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.10',
    section: '4.2',
    description: 'PUT /raindrop/file — Upload file as bookmark',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.11',
    section: '4.2',
    description: 'POST /raindrops — Batch create (≤100)',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.12',
    section: '4.2',
    description:
      'PUT /raindrops/{collectionId} — Batch update (move, tag, important)',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.13',
    section: '4.2',
    description:
      'DELETE /raindrops/{collectionId} — Batch delete to Trash / purge',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.14',
    section: '4.2',
    description: 'GET /collections — Load root collection tree',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.15',
    section: '4.2',
    description: 'GET /collections/childrens — Load nested collections',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.16',
    section: '4.2',
    description: 'POST /collection — Create collection',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.17',
    section: '4.2',
    description: 'GET /collection/{id} — Load collection for editing',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.18',
    section: '4.2',
    description:
      'PUT /collection/{id} — Update collection (name, icon, color, parent)',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.19',
    section: '4.2',
    description: 'DELETE /collection/{id} — Delete collection',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.20',
    section: '4.2',
    description: 'PUT /collection/{id}/cover — Upload collection cover',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.21',
    section: '4.2',
    description: 'PUT /collections — Reorder / expand / collapse',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.22',
    section: '4.2',
    description: 'PUT /collections/merge — Merge collections',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.23',
    section: '4.2',
    description: 'PUT /collections/clean — Remove empty collections',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.24',
    section: '4.2',
    description: 'DELETE /collections/trash — Empty trash',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.25',
    section: '4.2',
    description: 'GET /tags/{collectionId} — List tags',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.26',
    section: '4.2',
    description: 'GET /tags/0 — List all tags',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.27',
    section: '4.2',
    description: 'PUT /tags — Rename tag',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.28',
    section: '4.2',
    description: 'DELETE /tags — Delete tag(s)',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.29',
    section: '4.2',
    description: 'GET /user — Current user profile',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.30',
    section: '4.2',
    description: 'PUT /user — Update user preferences',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.31',
    section: '4.2',
    description: 'GET /user/{id} — Public user profile',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.32',
    section: '4.2',
    description: 'GET /filters/{collectionId} — Type/tag filter counts',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.33',
    section: '4.2',
    description: 'POST /import/url — Parse URL metadata',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.34',
    section: '4.2',
    description: 'GET /raindrops/{collectionId}/export — Export as HTML/CSV',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.35',
    section: '4.2',
    description: 'GET /backups — List backups',
    phase: 'P2',
    category: 'api',
  },
  {
    id: 'API.36',
    section: '4.2',
    description: 'POST /backup — Generate backup',
    phase: 'P2',
    category: 'api',
  },

  // ═══════════════════════════════════════════════════════
  // Keyboard Shortcuts (20 entries) — §6.1
  // ═══════════════════════════════════════════════════════
  {
    id: 'KB.1',
    section: '6.1',
    description: 'Cmd+K opens global search',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.2',
    section: '6.1',
    description: 'Cmd+N opens new bookmark dialog',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.3',
    section: '6.1',
    description: 'Cmd+Shift+N opens new collection dialog',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.4',
    section: '6.1',
    description: 'Cmd+1 switches to grid view',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.5',
    section: '6.1',
    description: 'Cmd+2 switches to list view',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.6',
    section: '6.1',
    description: 'Cmd+3 switches to table view',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.7',
    section: '6.1',
    description: 'Cmd+4 switches to directory view',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.8',
    section: '6.1',
    description: 'Cmd+, opens settings',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.9',
    section: '6.1',
    description: 'Cmd+Backspace deletes selected bookmark(s)',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.10',
    section: '6.1',
    description: 'Cmd+A selects all bookmarks in view',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.11',
    section: '6.1',
    description: 'Arrow Up moves selection up',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.12',
    section: '6.1',
    description: 'Arrow Down moves selection down',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.13',
    section: '6.1',
    description: 'Enter opens selected bookmark in browser',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.14',
    section: '6.1',
    description: 'Space toggles detail panel for selected',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.15',
    section: '6.1',
    description: 'Escape closes active panel/dialog',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.16',
    section: '6.1',
    description: 'Cmd+Shift+K opens shortcut editor',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.17',
    section: '6.1',
    description: 'Cmd+F focuses search bar (scoped to current collection)',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.18',
    section: '6.1',
    description: 'Cmd+Shift+F opens global search across all collections',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.19',
    section: '6.1',
    description: 'Cmd+D toggles important flag on selected',
    phase: 'P5',
    category: 'keyboard',
  },
  {
    id: 'KB.20',
    section: '6.1',
    description: 'Cmd+Shift+T opens tag management',
    phase: 'P5',
    category: 'keyboard',
  },
]

/**
 * Group requirements by feature/category for report sections.
 * @param reqs - Requirements array
 * @returns Map of group label to requirements
 * @example
 *   groupRequirements(specRequirements)
 *   // => Map { 'F1: Scoped Search' => [...], 'API Endpoints' => [...], ... }
 */
export function groupRequirements(
  reqs: SpecRequirement[],
): Map<string, SpecRequirement[]> {
  const groups = new Map<string, SpecRequirement[]>()

  const featureLabels: Record<string, string> = {
    F1: 'F1: Scoped Search',
    F2: 'F2: Field-Specific Search',
    F3: 'F3: Multiple View Modes',
    F4: 'F4: Auto-Icon Assignment',
    F5: 'F5: Fuzzy Collection Search',
    F6: 'F6: Group ↔ Collection Editing',
    F7: 'F7: Enhanced Readability',
    F8: 'F8: Keyboard Shortcut Editor',
  }

  for (const req of reqs) {
    let groupKey: string
    if (req.category === 'feature') {
      const prefix = req.id.split('.')[0]
      groupKey = featureLabels[prefix] ?? prefix
    } else if (req.category === 'api') {
      groupKey = 'API Endpoints'
    } else {
      groupKey = 'Keyboard Shortcuts'
    }

    const group = groups.get(groupKey)
    if (group) {
      group.push(req)
    } else {
      groups.set(groupKey, [req])
    }
  }

  return groups
}
