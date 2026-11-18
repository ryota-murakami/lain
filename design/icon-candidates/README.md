# Lain icon candidates

64 independent PNG generations, I01–I64, organized into eight directions with eight distinct silhouettes each. All source images are 1254×1254 RGBA PNGs. No production default has been selected.

- Originals: `apps/desktop/public/icon-candidates/I01.png` through `I64.png`.
- Runtime catalog: `apps/desktop/public/icon-candidates/manifest.json`.
- 128px gallery images: `apps/desktop/public/icon-candidates/thumbnails/`.
- Comparison: `contact-sheet.png` (8×8, 1600×1760).
- Actual-size reviews: `small-size/family-01.png` through `family-08.png`, each showing 16, 32, 64 and 128px on light and dark surfaces.
- Exact individual generation prompts: `prompts.json`. Each entry used one built-in `image_gen.imagegen` call with `transparent_background: true`. These are independent originals, not crops from a generated contact sheet. The original generated files remain in Codex's generated-images directory.

## Rebuild derived assets

On macOS with Xcode command-line tools:

```sh
swift design/icon-candidates/build-assets.swift
```

The script uses native AppKit, Foundation and CryptoKit, with no third-party package install. It validates 64 ordered IDs, distinct SHA-256 hashes, square dimensions ≥1024px and near-transparent outer corners. It rewrites thumbnails, the manifest, the contact sheet and review sheets from the existing originals. Generating the same prompt again is not pixel-deterministic; rebuilding derivatives from the committed original PNGs is the reproducible path.

The manifest has `schemaVersion: 1`, `recommendedIds`, and `candidates` with `id`, `name`, `family`, `intent`, `palette`, `src`, `thumbnail`, `width`, `height`, `sha256`. Asset paths are public-root paths. `palette` records the intended design palette, not a claim that every generated pixel matches those swatches.

## Export a chosen candidate

After choosing an ID, use a new absolute output directory:

```sh
bash design/icon-candidates/export-selected-icon.sh I17 /tmp/lain-I17-review
```

This creates a macOS `icon.icns`, ten iconset representations, and Linux PNGs at 16, 24, 32, 48, 64, 128, 256, 512 and 1024px. It includes the unchanged source and its SHA-256. Existing output directories are rejected. The command does not write into `build/icons`, change application preferences or alter an installed/signed application.

For an approved future release, copy the reviewed output into the repository's platform icon inputs and rebuild/sign through the normal release workflow. Runtime selection uses the app's own reversible preference; it does not require this export or a bundle rewrite.
