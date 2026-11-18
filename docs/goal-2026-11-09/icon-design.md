# Icon design evidence — 2026-11-09

64 independently generated candidate icons are complete. Each is a 1254×1254 square RGBA PNG, exceeding the requested 1024px minimum. No production default has been selected or replaced.

## Deliverables

| Deliverable                                                | Repository path                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Individual originals                                       | `apps/desktop/public/icon-candidates/I01.png`–`I64.png`           |
| IDs, names, intent, palette, paths, dimensions and SHA-256 | `apps/desktop/public/icon-candidates/manifest.json`               |
| Lightweight 128px gallery thumbnails                       | `apps/desktop/public/icon-candidates/thumbnails/`                 |
| 8×8 comparison sheet                                       | `design/icon-candidates/contact-sheet.png`                        |
| 16/32/64/128px light and dark review sheets                | `design/icon-candidates/small-size/family-01.png`–`family-08.png` |
| Exact generation prompts                                   | `design/icon-candidates/prompts.json`                             |
| Rebuild and native export instructions                     | `design/icon-candidates/README.md`                                |

Generation used the built-in image generation tool once per candidate, with transparent background requested. No CLI/API fallback, image search, existing company logo or character/IP reference was used. The initial Lain violet connected-node icon was inspected for context; each alternative focuses on bookmarks, retrieval, organization or the L initial. A contact sheet was assembled only after the 64 separate assets existed.

## Directions

| IDs     | Direction          | Distinct shapes/materials                                                                          |
| ------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| I01–I08 | Paper Index        | Folded bookmark, open book, index cards, loop, page aperture, accordion, folded corner, compass    |
| I09–I16 | Connected Orbits   | Orbit, triangular nodes, linked loops, hub, shelf, square graph, branching paths, arch             |
| I17–I24 | Search Instruments | Bookmark lens, framed index, beacon, lens stack, arrow, folder scope, glass lens, folded focus     |
| I25–I32 | Archive Objects    | Ceramic pocket, card cabinet, bookends, box, volumes, tray, portal, metallic clip                  |
| I33–I40 | L Monograms        | Ribbon, paired blocks, lens, split steps, stacked planes, loop, carved stone, serif beacon         |
| I41–I48 | Prism Marks        | Glass ribbon, overlapping crystals, diamond, arch, folded prism, faceted ring, light stack, corner |
| I49–I56 | Organic Knowledge  | Leaf, seed, branch, pebble, fern, acorn, sprout lens, grove                                        |
| I57–I64 | Digital Geometry   | Brackets, pixel notch, four view tiles, cursor, directory tree, keycap, interlock, list beacon     |

## Recommended shortlist

| Rank | Candidate            | Reason                                                                           | Tradeoff at small sizes                                             |
| ---- | -------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1    | I17 Bookmark Lens    | Immediately communicates search with a bookmark handle; coherent mint silhouette | At 16px the notch softens, while the magnifier stays clear          |
| 2    | I33 Ribbon L         | Strong Lain identity with a folded bookmark end and restrained material          | Fold lighting disappears at 16px; L remains legible                 |
| 3    | I01 Folded Index     | Direct bookmark meaning, calm paper material, distinctive asymmetric fold        | Small lavender tab is secondary and becomes a small accent          |
| 4    | I57 Command Bookmark | Clear bookmark inside brackets; matches developer-oriented organization          | Brackets remain readable; central notch becomes subtle at 16px      |
| 5    | I41 Prism Ribbon     | Bold standalone bookmark; strongest visual continuity with the violet brand      | Glass reflections merge at 16px but the silhouette remains          |
| 6    | I25 Pocket Library   | Warm, tactile archive metaphor with an obvious saved item                        | Pocket reads well at 32px; bookmark cutout loses definition at 16px |

The shortlist is a design recommendation, not a persisted user choice. I09 is an additional option when continuity with the connected-node visual identity matters more than simplicity. I49/I52 offer a quieter organic direction.

## Visual QA

All eight family sheets were visually inspected at native pixel dimensions, including 16, 32, 64 and 128px on both light and dark backgrounds. The 8×8 sheet was inspected for distinctness, cropping and overall coherence. All 64 have visibly different central silhouettes/compositions; the set is not a collection of color swaps.

At 64/128px all candidates preserve their intended central shape. At 32px most internal structures remain recognizable. At 16px a simple silhouette is the strongest criterion: I17, I33, I01, I57, I41, I18 and I62 retain a clear primary mark. I10/I14 retain their network structure but imply a general graph tool. I13/I29/I42/I47/I59/I64 lose fine internal detail; they remain usable comparison options but are weaker first choices for tiny surfaces. I54 is clear but communicates an acorn more than bookmarks. These observations do not claim user preference testing.

Source corners have alpha 0 except one corner each of I15, I53 and I56 at alpha 1/255, a near-transparent antialiasing residue. No background was destructively removed or repainted. Full-size images occupy 114.50 MiB; gallery thumbnails total 1.43 MiB, so the comparison UI should load thumbnails for its grid and only the focused original for a large preview.

## Machine verification and limits

- Native AppKit decoded all 64 PNGs, verified 1254×1254 dimensions, alpha, ordered IDs and distinct SHA-256 values.
- An independent Python standard-library check confirmed all manifest hashes and all 64 thumbnail dimensions at 128×128.
- Native export was exercised with I17 in a temporary directory. `iconutil` successfully created and round-tripped the ICNS into ten PNG representations. Linux export produced all nine requested raster sizes.
- The script rejects malformed candidate IDs and existing output paths; export is isolated from production icon assets and signed applications.
- This design pass verifies source assets, scale sheets and export structure. It does not by itself establish actual Dock/window rendering, persisted selection, application UI behavior or packaged Linux launcher behavior; those require the app/native QA evidence.

## Settings implementation and regression evidence

The Icon settings tab now provides the 64-candidate thumbnail grid, ID/name/family/intent/palette, a 128px primary preview and 16/32/64px comparisons. Previewing is separate from applying. The current native selection is shown, and explicit apply/reset operations report their outcome. A native service failure leaves the comparison gallery available while disabling apply. Catalog failures expose Retry; runtime validation rejects missing/duplicate IDs and unexpected asset paths.

`src/hooks/useIconCandidates.ts` owns asynchronous catalog/native loading, unmount cancellation, a synchronous native-write lock and retry state. Successful writes update the displayed preference directly from the confirmed operation, avoiding a second failed read that could misreport a successful write. Native API signatures were unchanged.

`src/components/raindrop/icon-settings.test.tsx` passed 11 component regressions against the actual 64-entry manifest: all candidates and four sizes; preview without applying; apply and remount restoration; reset; apply and reset failures preserving the prior ID; pending-write controls; request retry; three invalid-catalog cases; and comparison during native failure. These use a mocked native bridge and do not claim actual Dock behavior or on-disk restart persistence. Strict ESLint passed for the component, hook and tests.
