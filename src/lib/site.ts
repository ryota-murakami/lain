/** Links and facts shared by every section of the landing page. */
export const SITE = {
  name: 'Lain',
  tagline: 'Your Raindrop.io bookmarks, reimagined.',
  description:
    'Lain is a native macOS client for Raindrop.io built for power users: scoped and field-specific search, four view modes, drag & drop organization and fully customizable keyboard shortcuts.',
  repositoryUrl: 'https://github.com/laststance/lain',
  downloadUrl: 'https://github.com/laststance/lain/releases/latest',
  raindropUrl: 'https://raindrop.io',
  laststanceUrl: 'https://laststance.io',
  requirements: 'macOS 12+ · Raindrop.io account required',
} as const

/** Feature card content, in SPEC.md F1–F8 order. */
export const FEATURES = [
  {
    id: 'F1',
    title: 'Scoped search',
    description:
      'Search inside the collection you are looking at. One click widens the query to everything.',
  },
  {
    id: 'F2',
    title: 'Field-specific search',
    description:
      'Restrict a query to URL, title or description, with the matched field highlighted in the results.',
  },
  {
    id: 'F3',
    title: 'Multiple views',
    description:
      'Grid, list, table or a Unix-style directory tree — ⌘1 to ⌘4, remembered per collection.',
  },
  {
    id: 'F4',
    title: 'Auto icons',
    description:
      'Favicons resolved automatically with a Google Favicon fallback and letter avatars when nothing exists.',
  },
  {
    id: 'F5',
    title: 'Fuzzy collection search',
    description:
      'Type "rct" to jump to "React Resources". Works in the sidebar and in every collection picker.',
  },
  {
    id: 'F6',
    title: 'Drag & drop',
    description:
      'Move collections between groups, drop bookmarks onto collections and reorder them by hand.',
  },
  {
    id: 'F7',
    title: 'Visual clarity',
    description:
      'Color-coded collections, breadcrumbs, item counts, content-type icons and arrow-key navigation.',
  },
  {
    id: 'F8',
    title: 'Custom shortcuts',
    description:
      'Every action is rebindable from Settings (⌘⇧K), with conflict detection and one-click reset.',
  },
] as const
