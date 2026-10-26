# Lain

[![CI](https://github.com/laststance/lain/actions/workflows/ci.yml/badge.svg)](https://github.com/laststance/lain/actions/workflows/ci.yml)

**Lain** is a macOS-native [Raindrop.io](https://raindrop.io) desktop client for power users who manage 1,000+ bookmarks. It focuses on fast, keyboard-driven search and organization that goes beyond the Raindrop.io web app.

> Status: **Alpha** — [v0.1.0](https://github.com/laststance/lain/releases/tag/v0.1.0) is available for macOS 12+ (Developer ID signed, not yet notarized); under active development.

Landing page: [lain-web.vercel.app](https://lain-web.vercel.app) ([source](apps/website)).

## Features

|     | Feature                   | What it does                                                                     |
| --- | ------------------------- | -------------------------------------------------------------------------------- |
| F1  | Scoped search             | Search inside the current collection, one click to go global                     |
| F2  | Field-specific search     | Restrict a query to URL, title, or description; matches are highlighted          |
| F3  | Multiple view modes       | Grid, List, Table, Directory (⌘1–⌘4), remembered across restarts                 |
| F4  | Auto icons                | Favicons resolved automatically, with Google Favicon and letter-avatar fallbacks |
| F5  | Fuzzy collection search   | Type `rct` to jump to "React Resources"                                          |
| F6  | Drag & drop organization  | Move and reorder collections between groups; drag bookmarks into collections     |
| F7  | Readability               | Color-coded collections, breadcrumbs, item counts, content-type icons            |
| F8  | Custom keyboard shortcuts | Every action is rebindable from Settings (⌘⇧K)                                   |

The full product and technical specification lives in [SPEC.md](apps/desktop/SPEC.md). The generated [E2E requirement coverage report](apps/desktop/docs/e2e-coverage.md) maps the specification to desktop tests.

## Tech stack

Electron 40 · React 19 (React Compiler) · Vite 7 · Redux Toolkit + RTK Query · Tailwind CSS v4 + shadcn/ui · React Hook Form + Zod · Vitest + happy-dom + MSW · Playwright (Electron)

## Repository layout

This pnpm monorepo follows the same layout as [skills-desktop](https://github.com/laststance/skills-desktop):

```text
apps/
  desktop/   # Electron app, tests, packaging assets, and product specification
  website/   # Next.js landing page and screenshots
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
```

Install dependencies once at the root. Each app owns its build configuration and dependencies; the root package owns shared development commands, formatting, and Git hooks.

## Getting started

Requirements: macOS, Node.js 22+ (24.x on Vercel), [pnpm](https://pnpm.io).

1. Create a Raindrop.io integration at <https://app.raindrop.io/settings/integrations> and copy its client ID and secret.
2. Copy `apps/desktop/.env.example` to `apps/desktop/.env` and fill in the values:

   ```bash
   cp apps/desktop/.env.example apps/desktop/.env
   ```

3. Install and run:

   ```bash
   pnpm install --frozen-lockfile
   pnpm dev
   ```

`pnpm dev` starts Vite and launches the Electron app against the dev server. Run `pnpm dev:web` to start the landing page at http://localhost:3000. Both commands run from the repository root. Existing local desktop `.env` files belong in `apps/desktop/`.

## Scripts

| Command                  | Purpose                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `pnpm dev`               | Vite dev server + Electron                                           |
| `pnpm build`             | Type-check and build renderer + main/preload bundles                 |
| `pnpm lint`              | ESLint (flat config)                                                 |
| `pnpm typecheck`         | `tsc -b --noEmit`                                                    |
| `pnpm test`              | Unit tests (Vitest)                                                  |
| `pnpm test:coverage`     | Unit tests with the V8 coverage gate                                 |
| `pnpm test:e2e`          | Playwright Electron E2E (headless; `LAIN_E2E_HEADED=1` to watch)     |
| `pnpm knip`              | Dead code / unused dependency detection                              |
| `pnpm coverage:e2e-spec` | SPEC.md requirement coverage report for the E2E suite                |
| `pnpm electron:build`    | Package the macOS app (`.dmg` + `.zip`) into `apps/desktop/release/` |

Additional website commands:

| Command              | Purpose                                           |
| -------------------- | ------------------------------------------------- |
| `pnpm dev:web`       | Start the landing page development server         |
| `pnpm build:web`     | Build the landing page for production             |
| `pnpm start:web`     | Serve the built landing page                      |
| `pnpm lint:web`      | Lint the landing page                             |
| `pnpm typecheck:web` | Generate Next.js route types and check TypeScript |
| `pnpm validate:web`  | Run all website checks and a production build     |

The desktop package keeps the name `lain`, its version, and its release identity. Use `pnpm --filter lain <command>` or `pnpm --filter lain-web <command>` to target a package directly.

## Continuous integration

Every push to `main` and every pull request runs `knip`, `lint`, `typecheck`, `test` (with coverage thresholds), `build`, `e2e`, and `e2e-coverage` for the desktop app on macOS runners. The `website` job runs lint, type checking, and a production build on Ubuntu. Coverage artifacts are collected from `apps/desktop/coverage/` and `apps/desktop/docs/`. See [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Release

`pnpm electron:build` packages the app with [electron-builder](https://www.electron.build) using [electron-builder.yml](apps/desktop/electron-builder.yml): a `.dmg` and a `.zip` per architecture land in `apps/desktop/release/`, together with `latest-mac.yml`, the feed that packaged builds poll through electron-updater (checked at startup and every 4 hours, installed on quit).

Releases are built on a Mac, not in CI:

1. Bump `version` in `apps/desktop/package.json` (via a PR, `main` is protected) and pull `main`.
2. Export the notarization credentials (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, or `APPLE_KEYCHAIN_PROFILE`) and keep the Raindrop.io OAuth app in `apps/desktop/.env`.
3. Run `pnpm electron:release:mac`: it builds arm64 + x64, signs with the Developer ID Application identity from your keychain, lets electron-builder notarize the app, then [finalize-mac-release-artifacts.ts](apps/desktop/scripts/finalize-mac-release-artifacts.ts) notarizes + staples both DMGs and rewrites `latest-mac.yml` / `checksums.json`.
4. Upload `apps/desktop/release/*.dmg`, `apps/desktop/release/*.zip`, `apps/desktop/release/*-mac.zip.blockmap`, `apps/desktop/release/latest-mac.yml` and `apps/desktop/release/checksums.json` with `gh release create vX.Y.Z --target <main sha>`.

CI runs an unsigned `--dir` package check on pull requests to `main` that touch `apps/desktop/**`, the root package or workspace manifests, the shared lockfile, the prepare action, or the package-check workflow ([.github/workflows/package-check.yml](.github/workflows/package-check.yml)).

## Website deployment

The landing page is deployed by the existing `lain-web` Vercel project in the `laststance` team. After merging this migration, change its Git connection to the Lain repository and its Root Directory to `apps/website`. See [website deployment instructions](apps/website/README.md#vercel-deployment) for the complete settings and preview verification steps.

## Security model

- OAuth tokens are stored with Electron `safeStorage` (macOS Keychain), never in `localStorage`.
- The renderer runs with `contextIsolation` and `sandbox` enabled and no Node integration; privileged calls go through a sender-validated IPC bridge.

---

Built by [Laststance.io](https://laststance.io).
