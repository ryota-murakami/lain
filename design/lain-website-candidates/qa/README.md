# Website direction QA

Run these commands from `design/lain-website-candidates` inside the Lain checkout. The suite intentionally uses the workspace's existing Playwright installation rather than installing a second browser/test runtime.

```sh
node scripts/build.mjs
python3 -m http.server 4317 --directory dist --bind 127.0.0.1
# In another shell:
node ../../apps/desktop/node_modules/@playwright/test/cli.js test --config playwright.config.mjs
node qa/contrast.mjs
node scripts/collect-evidence.mjs
```

The build and deployed Site have no runtime dependencies. To run the QA suite outside the Lain checkout, install `@playwright/test` 1.65.0 in the surrounding workspace and adjust the four explicit imports of the Lain test package. Google Chrome is selected through Playwright's `chrome` channel.

## Evidence

- `results-full.json`: final complete 38-case success (26 functional/responsive cases + 12 recorded walkthroughs).
- `results.json`: repeated 12-case motion success after setting the initial recording viewport explicitly to 1280 × 900.
- `screenshots/W01-desktop.png` … `W12-mobile.png`: 24 full-page candidate captures at 1440 × 1000 and 390 × 844 viewports.
- `screenshots/comparison-desktop.png`, `comparison-mobile.png`: full comparison-page captures.
- `desktop-contact.png`, `mobile-contact.png`: initial screen comparisons for all twelve directions.
- `videos/W01-walkthrough.mp4` … `W12-walkthrough.mp4`: paced interaction recordings, encoded as H.264 for review.
- `frames/W01-motion.png` … `W12-motion.png`: extracted video frame sheets used for visual inspection. Frames run left to right, then top to bottom.
- `video-manifest.json`: file mapping, duration and sampling details.
- `contrast-results.json`: 48 base text/background token ratios, minimum 4.52:1. This is a focused token audit, not complete WCAG certification.

The screenshots are captured with finite animation settled. Motion evidence comes from separate default-motion recordings and extracted frames, not from the still images. All examples are synthetic, and no Raindrop.io user account is accessed by these tests.

## Observed and fixed

1. W08's mobile hero grid initially overflowed by about 1.4 px. `min-width: 0` on the grid child prevents intrinsic content width from expanding the column. The viewport-width assertion covers the regression.
2. W01's decorative bookmark overlapped the headline on small phones; it is hidden at that width after visual review.
3. The original secondary colors in W05/W07/W09 and the W06 download panel fell below the 4.5:1 base-text target. Revised colors pass the same audit.
4. Dark-theme platform cards were lightened for legibility.

Browser scope: headless Chrome on macOS. Physical mobile hardware, assistive-technology user testing and hosted-owner authentication are outside these local checks. The parent agent verifies private Sites publication.
