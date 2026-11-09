# Lain website directions — W01–W12

## Deliverable and publishing boundary

The standalone project is `design/lain-website-candidates`. It contains twelve functional landing pages and an owner comparison room. The Sites skill was used to register, synchronize and publish a new owner-private Site. The native deployment result is recorded below.

- Site ID: `appgprj_6af1bed3904c8191bbfeca845196a4a8`
- Verified private origin: `https://lain-design-directions-20261109.raphtalia.chatgpt.site`
- Static directory: `design/lain-website-candidates/dist`
- Comparison page: `/`
- Stable candidate paths: `/W01/` through `/W12/`
- Source briefs and HTML builder: `scripts/directions.mjs`, `scripts/build.mjs`
- Shared browser behavior and authored styles: `dist/assets/site.js`, `dist/assets/site.css`
- Build command: `node scripts/build.mjs`

No production website, domain setting, real bookmark, account credential or private account screenshot is included. All six bookmark examples are synthetic and use `example.com`; the workspace explicitly labels itself an illustrative demo. No candidate has been adopted as the live design.

## Directions

| ID  | Direction             | Structure and visual language                                                        | Audience                                        | Tradeoff                                                                    | Recommendation |
| --- | --------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------- | -------------- |
| W01 | The considered web    | Literary split hero, large serif, lemon bookmark, product preview, editorial columns | Independent makers, thoughtful collectors       | Warm and distinctive; less overtly technical                                | 1              |
| W02 | Command center        | Monospace command-led narrative, dark green working surface, table-first demo        | Developers, keyboard-first users                | Clear technical identity; narrower consumer appeal                          | 4              |
| W03 | Reference room        | Asymmetrical gallery, original geometric reference cards, rose canvas, grid demo     | Designers, visual researchers                   | Memorable, but requires restraint to keep utility prominent                 | 3              |
| W04 | Night signal          | Centered cinematic search metaphor, blue concentric rings, dark product story        | Technology enthusiasts                          | Dramatic brand entrance; the product follows below the hero                 | 7              |
| W05 | Field notes           | Chapter navigation in a margin, paper and olive, numbered field-guide sections       | Researchers, writers                            | Calm and distinctive; less direct than conventional software copy           | 5              |
| W06 | Save / Find           | Oversized typographic poster, red panels, hard borders, verb-led story               | Confident independent brand                     | Strong recognition; deliberately louder than the daily app                  | 9              |
| W07 | A quieter workspace   | Centered lavender product page, generous space, rounded forms                        | Broad desktop productivity audience             | Approachable; less provocative                                              | 2              |
| W08 | A system for saving   | Swiss grid, visible ordinals, orange geometric system, table demonstration           | Design-conscious technical professionals        | Precise; can feel impersonal                                                | 6              |
| W09 | The private library   | Serif reading room, original book-cover shapes, amber catalog styling                | Readers, long-form collectors                   | Literary warmth; less emphasis on technical depth                           | 8              |
| W10 | Connected by design   | Teal blueprint and collection hierarchy illustration                                 | Systems thinkers, researchers                   | Diagram must stay clearly labeled as an illustration, not an app graph view | 10             |
| W11 | Good things, gathered | Lime and pink collectible cards, rounded heavy type, playful stack                   | Creative generalists                            | Friendly; can understate power-user depth                                   | 11             |
| W12 | Simply, Lain          | Restrained monochrome, centered product, compact feature rows                        | People preferring direct software introductions | Straightforward and maintainable; least differentiated                      | 12             |

The comparison room includes category filtering, full-page navigation, each direction's audience/tradeoff/motion notes, recommendation order and a locally persisted shortlist. Shortlisting is browser-local and changes neither the app nor the public website.

## Product claims and platform honesty

Every candidate explains Raindrop.io connectivity, scoped/field-specific search, four application views, collections, tags, notes and keyboard use. The illustrative browser demo offers search, empty results and list/grid/table switching; it does not claim to be the real desktop client.

Export, external-change polling, uploads and updater controls are described as development-preview scope. macOS links and Linux x64 links open the actual GitHub Releases listing, not invented installer URLs. Linux AppImage/deb are labeled preview targets, and every page asks the visitor to inspect the selected release's assets and notes. The installation disclosure distinguishes AppImage/deb update paths and avoids claims of instantaneous synchronization, complete offline editing or measured performance.

The owner should update these cautious claims only after final app/release verification, then rerun the site checks if the copy changes.

## Verification

Environment: macOS host, installed Google Chrome driven by the Playwright test CLI in headless mode. Desktop viewport: 1440 × 1000. Mobile viewport: 390 × 844. These are browser checks, not a physical-phone or native application test.

- The first 26-case run found a mobile grid overflow in W08. The hero grid item's automatic minimum width caused approximately 1.4 px of horizontal overflow. An explicit minimum width fixed it; the regression check now compares document width with the viewport.
- Visual review removed W01's small-screen decorative bookmark because it overlapped the headline.
- Dark-theme download cards were lightened to maintain clear text contrast.
- The focused theme audit initially found insufficient secondary-text contrast in W05, W07 and W09, plus W06's download panel. Colors were adjusted without changing the directions. All 48 audited base text/background pairs now meet 4.5:1; the lowest measured ratio is 4.52:1. This focused token audit is not a complete WCAG conformance claim.
- Static validation found zero broken local asset/page/anchor references across all thirteen HTML pages.
- The corrected 26-case run passed search result counts, zero results, view changes, download caveats/links, horizontal overflow, JavaScript errors, reduced-motion behavior, all twelve route responses, category filtering and keyboard-created shortlist persistence.
- The final 38-case run passed, including twelve deliberately paced video walkthroughs. A second 12-case motion run passed after setting the recorder's initial viewport explicitly. Both JSON result files are retained.

Evidence is safe for private review or PR attachment. Full-page desktop/mobile screenshots are in `qa/screenshots/`; the comparison page has its own captures. Twelve named MP4 recordings are in `qa/videos/`, and twelve extracted frame sheets are in `qa/frames/`. All twelve designs' desktop/mobile captures and interaction frame sequences were visually inspected. Search typing, result changes, view switching and scroll-to-product navigation remain coherent. Some recordings include the browser's initial blank navigation frame; this precedes the rendered Site. The automated audit scripts and test cases are checked in for reproducibility.

| Requirement                                         | Evidence                                                                              | Result                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| WEB-01: twelve distinct usable pages and comparison | `dist/W01/index.html` through `W12/index.html`, comparison page, 12 HTTP route checks | PASS locally                                                   |
| WEB-02: responsive desktop/mobile layout            | 24 full-page screenshots and viewport-overflow assertions                             | PASS at 1440 × 1000 and 390 × 844                              |
| WEB-03: keyboard comparison and state persistence   | Enter-activated shortlist, reload, filtering and clear tests                          | PASS in Chrome                                                 |
| WEB-04: readable base colors                        | `qa/contrast-results.json`, 48 ratios, minimum 4.52:1                                 | PASS for audited pairs; not a full accessibility certification |
| WEB-05: honest platform/download statements         | Release-link and preview-caveat assertions on all pages                               | PASS; package availability is not asserted                     |
| WEB-06: motion/reduced motion                       | 12 MP4s, extracted frame sheets, reduced-motion assertions                            | PASS within recorded browser interactions                      |
| WEB-07: safe demonstration content                  | Synthetic six-bookmark fixture, no account access or external API requests            | PASS                                                           |
| WEB-08: owner-private Sites publication             | Parent-owned native Sites workflow                                                    | PASS; native deployment succeeded                              |

## External limitations

- Local browser checks and the native private-deployment result are recorded separately.
- The synthetic demo cannot establish desktop app correctness, real-account behavior, Linux package availability or updater installation success.
- No real user data or private screenshots were used, and no production design choice was made.

## Private deployment verified

- URL: https://lain-design-directions-20261109.raphtalia.chatgpt.site
- Audience: owner-private (unchanged from creation).
- Source commit: `d8cf9ba575cc93606e1cc59ba79a0b1efa83d0ca` in the dedicated Sites repository.
- Version: `appgprj_6af1bed3904c8191bbfeca845196a4a8~appgver_e6ea700f69d48191bef0a557a6abe87e`.
- Deployment: `appgdep_6af1c8e2a9988191bb5ca13396b7b354`, native status `succeeded`, 2026-11-09T13:21:50Z.
- The Sites helper initialized a nested source checkout. Its Git metadata was preserved outside the main checkout at `/Users/ryotamurakami/laststance/backup/lain/sites-source-git-20261109`; the main Lain PR includes ordinary source files rather than an unregistered submodule. The independent Sites source commit remains recorded above.
