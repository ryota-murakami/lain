import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { directions } from './directions.mjs'

const output = fileURLToPath(new URL('../dist/', import.meta.url))
const releases = 'https://github.com/ryota-murakami/lain/releases'
const repository = 'https://github.com/ryota-murakami/lain'
const mark =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 5h7v18h12v5H8z" fill="currentColor"/><circle cx="24" cy="9" r="4" fill="currentColor"/></svg>'

/**
 * Escapes authored copy before it enters a generated attribute or text node.
 * Called by the static build, which never consumes personal account data.
 * @returns HTML-safe text.
 * @example
 * escapeText('Search & sort')
 */
function escapeText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Builds the shared semantic document shell around each independent design.
 * @returns A complete, directly deployable HTML page.
 * @example
 * documentPage('Lain', 'minimal', '<main>Welcome</main>')
 */
function documentPage(title, theme, content, prefix = '../') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="description" content="Twelve independent website directions for Lain, a desktop client for Raindrop.io."><title>${escapeText(title)}</title><link rel="icon" href="${prefix}assets/mark.svg" type="image/svg+xml"><link rel="preload" href="${prefix}assets/geist.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="${prefix}assets/site.css"><script src="${prefix}assets/site.js" defer></script></head><body class="${theme}"><a class="skip-link" href="#main">Skip to content</a>${content}</body></html>`
}

/**
 * Provides a safe, interactive illustration used by candidate landing pages.
 * Demo search and view buttons are bound by the browser script after page load.
 * @returns A synthetic bookmark workspace with no remote account connection.
 * @example
 * workspace('grid')
 */
function workspace(initialView = 'list') {
  return `<div class="workspace reveal" data-workspace data-view="${initialView}"><div class="window-bar"><span class="traffic"><i></i><i></i><i></i></span><span>Research / Design systems</span><span class="demo-label">Illustrative demo</span></div><div class="workspace-body"><aside class="demo-sidebar"><strong>${mark} Lain</strong><span class="sidebar-active">▧ &nbsp; All bookmarks <small>6</small></span><span>☆ &nbsp; Important</span><span>▱ &nbsp; Unsorted</span><p>COLLECTIONS</p><span class="folder blue">Design systems</span><span class="folder green">Reading room</span><span class="folder rose">Next project</span><span class="folder yellow">Field notes</span><div class="sidebar-bottom">Your Raindrop.io library<br><small>Made for your desktop</small></div></aside><div class="demo-main"><div class="demo-heading"><div><small>YOUR COLLECTION</small><h3>Good things, saved.</h3></div><span class="demo-count" aria-live="polite">6 bookmarks</span></div><div class="demo-toolbar"><label class="demo-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Try “design” or “type”" aria-label="Search illustrative bookmarks"></label><div class="demo-views" role="group" aria-label="Demo view"><button type="button" data-view-button="list" aria-pressed="${initialView === 'list'}">List</button><button type="button" data-view-button="grid" aria-pressed="${initialView === 'grid'}">Grid</button><button type="button" data-view-button="table" aria-pressed="${initialView === 'table'}">Table</button></div></div><div class="demo-bookmarks">${[
    [
      'A',
      'A thoughtful design system',
      'Design',
      'A collection of useful interface principles.',
      'shape-one',
    ],
    [
      'T',
      'The shape of good typography',
      'Type',
      'Notes on rhythm, scale and reading.',
      'shape-two',
    ],
    [
      'F',
      'A field guide to the web',
      'Reading',
      'A little structure for a wide world.',
      'shape-three',
    ],
    [
      'C',
      'Color, considered',
      'Design',
      'Finding a palette with a purpose.',
      'shape-four',
    ],
    [
      'W',
      'Working with the open web',
      'Development',
      'References for the next good project.',
      'shape-five',
    ],
    [
      'N',
      'Notes for what comes next',
      'Research',
      'Questions, connections and new directions.',
      'shape-six',
    ],
  ]
    .map(
      ([letter, title, tag, description, shape]) =>
        `<article class="demo-bookmark" data-search="${escapeText(`${title} ${tag} ${description}`.toLowerCase())}"><div class="bookmark-art ${shape}" aria-hidden="true"><span>${letter}</span></div><div class="bookmark-copy"><h4>${title}</h4><p>${description}</p><span>example.com · ${tag}</span></div><span class="bookmark-tag">${tag}</span><span class="bookmark-star" aria-hidden="true">☆</span></article>`,
    )
    .join(
      '',
    )}</div><p class="demo-empty" hidden>No matching examples. Try “design”.</p></div></div><div class="demo-footer"><span>Sample content only · no account connection</span><span>Search and switch views ↑</span></div></div>`
}

/**
 * Supplies the product story and platform caveats shared by every direction.
 * Called once per landing page to keep factual claims consistent across styles.
 * @example
 * details(directions[0])
 */
function details(direction) {
  return `<section class="features section" id="explore"><div class="section-heading"><span class="eyebrow">01 / A clearer way to work</span><h2>${direction.feature}</h2><p>Connected to the collection you already keep in Raindrop.io. Shaped for the work you do on your desktop.</p></div><div class="feature-grid"><article><span class="feature-number">01</span><h3>Find the right thing.</h3><p>Search a collection or widen your scope. Look in the title, URL or description when you know what you remember.</p><div class="feature-example"><span>Search in</span><b>Design systems</b><span>Title / URL / Description</span></div></article><article><span class="feature-number">02</span><h3>Choose your perspective.</h3><p>Grid for visual references. List for scanning. Table for detail. Directory for seeing where everything belongs.</p><div class="feature-example views-example"><b>▦ Grid</b><b>☷ List</b><b>▤ Table</b><b>⌘ Directory</b></div></article><article><span class="feature-number">03</span><h3>Make it your own.</h3><p>Bring order with collections, tags and notes. Keep important references close and work with keyboard shortcuts.</p><div class="feature-example"><span class="keycap">⌘ K</span><span class="keycap">Ctrl K</span><span>Find your way back.</span></div></article></div></section><section class="preview-scope section"><div><span class="eyebrow">02 / The next chapter</span><h2>A more complete<br>desktop workspace.</h2><p>The current development preview brings export, external-change sync, file uploads and in-app update controls into the same place.</p></div><div class="scope-list"><p><strong>Take a copy.</strong><span>HTML, CSV and JSON export are part of this preview’s scope.</span></p><p><strong>Keep in step.</strong><span>External-change polling, a manual refresh and visible sync state.</span></p><p><strong>Bring your files.</strong><span>File uploads use your Raindrop.io account and its plan limits.</span></p><p><strong>Stay in control.</strong><span>Check for app updates and choose when to apply them.</span></p><p class="scope-note">Preview scope, not a release announcement. Check the release notes for verified availability.</p></div></section><section class="download-section section" id="download"><span class="eyebrow">03 / Make yourself at home</span><h2>Your collection.<br>Your next chapter.</h2><p>Lain is an independent desktop client for Raindrop.io.<br>A Raindrop.io account and an internet connection are required.</p><div class="platforms"><a class="platform-card" href="${releases}"><span class="platform-symbol" aria-hidden="true">⌘</span><span><strong>macOS</strong><small>Apple Silicon & Intel · check release assets</small></span><span aria-hidden="true">↗</span></a><a class="platform-card" href="${releases}"><span class="platform-symbol" aria-hidden="true">⌃</span><span><strong>Linux x64</strong><small>AppImage & deb · preview target</small></span><span aria-hidden="true">↗</span></a></div><p class="release-note">Alpha software. These links open GitHub Releases, not an unverified installer. Linux packages and update support must be confirmed in the selected release.</p><details class="release-details"><summary>Before you install</summary><p>Check your operating system, CPU and the release’s notes. Linux AppImage updates and deb package updates follow different paths. This design preview does not claim a published Linux release, instant sync, offline editing or verified performance.</p><p><a href="${repository}">Read the project documentation ↗</a> · <a href="https://raindrop.io">About Raindrop.io ↗</a></p></details></section>`
}

/**
 * Renders a direction-specific hero instead of recoloring one shared template.
 * @returns A composition with its own reading order, imagery and product emphasis.
 * @example
 * hero(directions[0])
 */
function hero(direction) {
  const heading = `<div class="hero-copy"><span class="eyebrow">${direction.kicker}</span><h1>${direction.title}</h1><p class="intro">${direction.intro}</p><div class="hero-actions"><a class="button primary" href="#download">Explore Lain <span aria-hidden="true">↗</span></a><a class="text-link" href="#product">See how it feels <span aria-hidden="true">↓</span></a></div><span class="availability">macOS · Linux x64 preview · Raindrop.io account required</span></div>`
  // Each direction changes composition, story emphasis and visual metaphor.
  switch (direction.theme) {
    case 'editorial':
      return `<section class="hero editorial-hero">${heading}<div class="editorial-side"><div class="abstract-bookmark" aria-hidden="true"><span></span><i></i><b>↗</b></div><p>A collection of possibilities.<br>A place to begin again.</p></div></section><section class="product-section" id="product"><div class="product-caption"><span>THE WORKSPACE</span><span>A familiar collection, a fresh perspective</span></div>${workspace()}</section>`
    case 'terminal':
      return `<section class="hero terminal-hero">${heading}<div class="terminal-card"><div><i></i> lain — workspace</div><pre><span>$</span> open collection "Design systems"
<span>›</span> scope: current collection

<span>$</span> search --title "design"
<span>›</span> Find what you remember.

<span>$</span> view --mode table
<span>›</span> See the details that matter.</pre><p>Illustrative commands, not a Lain CLI.</p></div></section><section class="product-section" id="product"><div class="product-caption"><span>TRY THE WORKSPACE</span><span>Type a query. Switch a view.</span></div>${workspace('table')}</section>`
    case 'gallery':
      return `<section class="hero gallery-hero">${heading}<div class="reference-wall" aria-label="Original geometric illustrations of saved references"><div class="reference-card reference-a"><div></div><span>01 / FORM</span></div><div class="reference-card reference-b"><div></div><span>02 / COLOR</span></div><div class="reference-card reference-c"><div></div><span>03 / TYPE</span></div><div class="wall-label">A few things<br>worth keeping. ↗</div></div></section><section class="product-section" id="product"><h2>The reference room.</h2>${workspace('grid')}</section>`
    case 'signal':
      return `<section class="hero signal-hero"><div class="signal-art" aria-hidden="true"><i></i><i></i><i></i><span>↗</span></div>${heading}<div class="signal-coordinates">SAVED → SORTED → FOUND</div></section><section class="product-section" id="product"><div class="product-caption"><span>YOUR SIGNAL, IN FOCUS</span><span>The workspace behind the idea</span></div>${workspace()}</section>`
    case 'field':
      return `<section class="hero field-hero"><aside><span>FIELD GUIDE<br>VOL. 01</span><nav aria-label="Page chapters"><a href="#product">I. Find</a><a href="#explore">II. Arrange</a><a href="#download">III. Begin</a></nav><div class="field-flower" aria-hidden="true">✳</div></aside>${heading}</section><section class="product-section" id="product"><div class="product-caption"><span>PLATE 01</span><span>A working collection</span></div>${workspace()}<p class="margin-note">Keep the useful. Follow the curious.</p></section>`
    case 'brutal':
      return `<section class="hero brutal-hero"><span class="giant-arrow" aria-hidden="true">↙</span>${heading}<div class="brutal-stamp">YOUR WEB.<br>WITH ORDER.</div></section><section class="product-section" id="product"><div class="product-caption"><span>THIS IS THE TOOL.</span><span>Try it. It’s a demo.</span></div>${workspace('table')}</section>`
    case 'quiet':
      return `<section class="hero quiet-hero">${heading}<div class="quiet-orbits" aria-hidden="true"><span>read</span><span>save</span><span>return</span></div></section><section class="product-section quiet-product" id="product">${workspace()}<p class="product-footnote">A little space for everything you want to come back to.</p></section>`
    case 'swiss':
      return `<section class="hero swiss-hero"><div class="swiss-label">DESKTOP<br>BOOKMARK<br>WORKSPACE<br><span>01—04</span></div>${heading}<div class="swiss-symbol" aria-hidden="true"><i></i><i></i><i></i><i></i></div></section><section class="product-section" id="product"><div class="product-caption"><span>01. THE INTERFACE</span><span>Clarity in every view.</span></div>${workspace('table')}</section>`
    case 'library':
      return `<section class="hero library-hero"><div class="library-rule">THE CAREFULLY COLLECTED WEB · AN INDEPENDENT DESKTOP CLIENT</div>${heading}<div class="book-shelf" aria-hidden="true"><div><span>Collected<br>references</span><small>01 / DESIGN</small></div><div><span>The reading<br>room</span><small>02 / READING</small></div><div><span>Notes<br>for later</span><small>03 / IDEAS</small></div></div></section><section class="product-section" id="product"><div class="product-caption"><span>OPEN THE CATALOG</span><span>Everything in its place.</span></div>${workspace()}</section>`
    case 'blueprint':
      return `<section class="hero blueprint-hero">${heading}<div class="collection-map" role="img" aria-label="Illustration of collections, tags and notes; not an app graph view"><div class="map-root">Your saved web</div><div class="map-branches"><span>Design</span><span>Research</span><span>Reading</span></div><div class="map-leaves"><span>#reference</span><span>+ Notes</span><span>☆ Important</span></div><p>STRUCTURE ILLUSTRATION · NOT AN APP GRAPH VIEW</p></div></section><section class="product-section" id="product"><div class="product-caption"><span>FIG. 01 / WORKSPACE</span><span>A structure you can navigate.</span></div>${workspace('table')}</section>`
    case 'play':
      return `<section class="hero play-hero">${heading}<div class="play-pile" aria-hidden="true"><div>That article.<b>↗</b></div><div>That reference.<b>✳</b></div><div>That good idea.<b>☆</b></div></div><span class="play-aside">Oh, there it is!</span></section><section class="product-section" id="product"><h2>All the good stuff.</h2>${workspace('grid')}</section>`
    default:
      return `<section class="hero minimal-hero">${heading}</section><section class="product-section" id="product">${workspace()}<p class="product-footnote">One collection. Four perspectives. Your choice.</p></section>`
  }
}

/**
 * Renders a complete candidate with consistent navigation and private-review links.
 * @example
 * candidate(directions[0])
 */
function candidate(direction) {
  return documentPage(
    `${direction.id} · ${direction.name} — Lain`,
    direction.theme,
    `<div class="candidate-banner"><a href="../">← All 12 directions</a><span>${direction.id} / ${direction.name}</span><button data-shortlist="${direction.id}" type="button" aria-pressed="false">☆ Shortlist</button></div><header class="site-header"><a class="wordmark" href="#main" aria-label="Lain home">${mark}<span>lain</span></a><nav aria-label="Main navigation"><a href="#explore">The workspace</a><a href="${repository}">Open source ↗</a><a class="nav-cta" href="#download">Get Lain ↗</a></nav></header><main id="main">${hero(direction)}${details(direction)}</main><footer class="site-footer"><a class="wordmark" href="#main">${mark}<span>lain</span></a><p>Made by Laststance.<br>An independent client for Raindrop.io.</p><a href="../">Back to the design room ↗</a><span>${direction.id} · Design preview</span></footer><aside class="design-note"><span>ABOUT THIS DIRECTION</span><h2>${direction.name}</h2><p>${direction.idea}</p><dl><div><dt>Best for</dt><dd>${direction.audience}</dd></div><div><dt>Tradeoff</dt><dd>${direction.tradeoff}</dd></div></dl></aside>`,
  )
}

/**
 * Builds the owner’s comparison board with local-only shortlisting.
 * @example
 * comparison()
 */
function comparison() {
  return documentPage(
    'Lain — The design room',
    'comparison',
    `<header class="comparison-header"><a class="wordmark" href="#main">${mark}<span>lain <small>/ the design room</small></span></a><span>PRIVATE EXPLORATION · 2026.11</span><a href="#directions">Explore the directions ↓</a></header><main id="main"><section class="comparison-hero"><div><span class="eyebrow">ONE PRODUCT. TWELVE PERSPECTIVES.</span><h1>A new home<br>for your <em>saved web.</em></h1><p>Twelve directions for Lain’s next website. Different voices, different structures, the same thoughtful desktop workspace.</p></div><div class="comparison-intro"><span class="big-twelve">12<span>↗</span></span><p>Open a direction. Try its workspace demo.<br>Shortlist the ones that feel like Lain.</p><a href="#recommendations">Start with our top three ↓</a></div></section><section class="recommendations" id="recommendations"><span class="eyebrow">A PLACE TO START</span><div><h2>Three different<br>kinds of right.</h2><p>Recommended for brand character, product clarity and distinctiveness. The final choice is yours; no direction has been adopted.</p></div><div class="recommendation-grid">${directions
      .filter((d) => d.rank <= 3)
      .sort((a, b) => a.rank - b.rank)
      .map(
        (d) =>
          `<a href="${d.id}/"><span>0${d.rank} / ${d.id}</span><h3>${d.name}</h3><p>${d.rank === 1 ? 'Best balance of warmth, character and a clear product story.' : d.rank === 2 ? 'The most approachable route for a broad desktop audience.' : 'A memorable visual identity for creative collectors.'}</p><b>Open direction ↗</b></a>`,
      )
      .join(
        '',
      )}</div></section><section class="directions-section" id="directions"><div class="directions-heading"><h2>Find your direction.</h2><span id="shown-count" aria-live="polite">12 directions</span></div><div class="comparison-controls"><div class="filters" role="group" aria-label="Filter design directions">${['All', 'Editorial', 'Product', 'Technical', 'Visual', 'Expressive', 'Shortlisted'].map((v, i) => `<button type="button" data-filter="${v}" aria-pressed="${i === 0}">${v}</button>`).join('')}</div><button class="clear-shortlist" type="button" data-clear-shortlist>Clear shortlist</button></div><div class="direction-grid">${directions.map((d) => `<article class="direction-card" data-category="${d.category}" data-direction="${d.id}"><a class="direction-thumbnail thumb-${d.theme}" href="${d.id}/" aria-label="Open ${d.id}: ${d.name}"><span class="thumbnail-id">${d.id}</span><div class="thumbnail-content"><span>lain</span><h3>${d.title}</h3><div class="thumb-line"></div><div class="thumb-shape" aria-hidden="true"></div></div><span class="thumbnail-open">Explore full page ↗</span></a><div class="direction-card-copy"><div class="card-title"><h3><span>${d.id}</span> ${d.name}</h3><button type="button" data-shortlist="${d.id}" aria-pressed="false" aria-label="Shortlist ${d.id}: ${d.name}">☆</button></div><p>${d.idea}</p><ul class="direction-tags">${d.tags.map((t) => `<li>${t}</li>`).join('')}</ul><details><summary>Audience & tradeoff</summary><p><strong>Best for:</strong> ${d.audience}</p><p><strong>Tradeoff:</strong> ${d.tradeoff}</p><p><strong>Motion:</strong> ${d.motion}</p><p><strong>Recommendation:</strong> ${d.rank} of 12</p></details></div></article>`).join('')}</div><p class="shortlist-empty" hidden>No directions shortlisted yet. Use the ☆ button on any card.</p></section><section class="review-guide"><span class="eyebrow">HOW TO CHOOSE</span><h2>A few useful questions.</h2><div><p><b>Does it feel like Lain?</b>Consider the tone before the color. Warm and thoughtful, precise and technical, or playful and inviting?</p><p><b>Does it explain the product?</b>Each page has a working sample search and view switcher. These are synthetic demonstrations, not account access.</p><p><b>Does it work on your screen?</b>Try the mobile width and the keyboard. Every direction supports reduced motion and offers the same release caveats.</p></div><p class="local-note">Your shortlist stays in this browser. Nothing here changes the live website, application or account.</p></section></main><footer class="comparison-footer"><span>Lain / The design room</span><p>12 directions · W01–W12 · All content uses synthetic examples.</p><a href="${repository}">Project on GitHub ↗</a></footer><div class="status-toast" role="status" aria-live="polite"></div>`,
    './',
  )
}

await mkdir(output, { recursive: true })
await mkdir(`${output}/assets`, { recursive: true })
await writeFile(
  `${output}/assets/mark.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#21251f"/><path d="M7 5h6v18h12v5H7z" fill="#e5f3a3"/><circle cx="23" cy="9" r="4" fill="#e5f3a3"/></svg>`,
)
await writeFile(`${output}/index.html`, comparison())
// Stable URLs allow review notes to survive later visual refinements.
for (const direction of directions) {
  await mkdir(`${output}/${direction.id}`, { recursive: true })
  await writeFile(`${output}/${direction.id}/index.html`, candidate(direction))
}
await writeFile(
  `${output}/directions.json`,
  JSON.stringify(directions, null, 2),
)
console.log('Built comparison page and 12 independent candidate pages.')
