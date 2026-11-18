# Lain

[![CI](https://github.com/ryota-murakami/lain/actions/workflows/ci.yml/badge.svg)](https://github.com/ryota-murakami/lain/actions/workflows/ci.yml)

**Lain** is an Electron desktop client for [Raindrop.io](https://raindrop.io), focused on keyboard-driven search and organization for large bookmark libraries. Development targets macOS (Apple silicon and Intel) and Linux x64.

> Status: **Alpha**. The existing [v0.1.1 release](https://github.com/ryota-murakami/lain/releases/tag/v0.1.1) targets macOS 12+. This development branch uses Electron 45 and requires macOS 13+; Linux packages and the new features below are under verification. See the [current acceptance evidence](docs/goal-2026-11-09/PROGRESS.md) before treating development work as a released capability.

Landing page: [lain-web.vercel.app](https://lain-web.vercel.app) ([source](apps/website)).

## Features

|     | Feature                   | What it does                                                                      |
| --- | ------------------------- | --------------------------------------------------------------------------------- |
| F1  | Scoped search             | Search inside the current collection, one click to go global                      |
| F2  | Field-specific search     | Restrict a query to URL, title, or description; matches are highlighted           |
| F3  | Multiple view modes       | Grid, List, Table, Directory (⌘1–⌘4), remembered across restarts                  |
| F4  | Auto icons                | Favicons resolved automatically, with Google Favicon and letter-avatar fallbacks  |
| F5  | Fuzzy collection search   | Type `rct` to jump to "React Resources"                                           |
| F6  | Drag & drop organization  | Move and reorder collections between groups; drag bookmarks into collections      |
| F7  | Readability               | Color-coded collections, breadcrumbs, item counts, content-type icons             |
| F8  | Custom keyboard shortcuts | Rebind application actions in Settings; reserved Escape behavior is explained     |
| F9  | Full-library export       | Retrieve every page and save HTML, CSV or JSON with a native save dialog          |
| F10 | Live synchronization      | Poll change markers, refresh on focus/reconnect and preserve unsaved edits        |
| F11 | File uploads              | Pick or drop files, edit metadata, monitor progress and retry individual failures |
| F12 | Application updates       | Check, choose download, view progress and explicitly restart when ready           |
| F13 | Icon comparison           | Compare 64 candidates, apply the Dock/window icon and restore the default         |

Export offers the complete library or the current collection, includes nested and empty collections, and checks page counts and duplicate records before saving. Table sorting applies to the loaded rows; the initial order follows the server. Directory view includes nested collections and selection controls. Collection colors and Lucide icons are display preferences for the current Lain account on this device; API refreshes retain those choices. Remote cover-derived colors remain the fallback. Icon application changes the runtime Dock/window icon and keeps the chosen preference; it does not replace the installed application bundle or Linux launcher icon.

The current behavior and verification boundaries are documented in the [updated Japanese specification](docs/functional-spec-ja.md). [SPEC.md](apps/desktop/SPEC.md) retains the original product and technical design. The generated [E2E requirement coverage report](apps/desktop/docs/e2e-coverage.md) maps test declarations to requirements; it is not a substitute for execution evidence.

Local execution evidence is tracked in the [acceptance matrix](docs/goal-2026-11-09/qa-matrix.md), [export validation](docs/goal-2026-11-09/export-validation.md), and [recorded desktop flows](docs/goal-2026-11-09/desktop-e2e-validation.md). The recordings use synthetic data and cover export cancellation/save, partial upload failure/retry, and icon apply/reset. A scripted native save-picker result exercises real IPC and file writes, but does not establish the operating system save sheet’s visual behavior. Current intermediate results are not final-commit or release acceptance.

## Tech stack

Electron 45 · React 19 (React Compiler) · Vite 8 · Redux Toolkit + RTK Query · Tailwind CSS v4 + shadcn/ui · React Hook Form + Zod · Vitest + happy-dom + MSW · Playwright (Electron). See [dependency versions and justified exceptions](docs/goal-2026-11-09/dependencies.md).

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

Desktop development requires macOS 13+ or Linux x64, Node.js 26.13.x and pnpm 12.18.0. The website has its own deployment runtime configuration.

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

| Command                  | Purpose                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| `pnpm dev`               | Vite dev server + Electron                                            |
| `pnpm build`             | Type-check and build renderer + main/preload bundles                  |
| `pnpm lint`              | ESLint (flat config)                                                  |
| `pnpm typecheck`         | `tsc -b --noEmit`                                                     |
| `pnpm test`              | Unit tests (Vitest)                                                   |
| `pnpm test:coverage`     | Measured Istanbul coverage with source provenance for the health gate |
| `pnpm test:e2e`          | Playwright Electron E2E (headless; `LAIN_E2E_HEADED=1` to watch)      |
| `pnpm knip`              | Dead code / unused dependency detection                               |
| `pnpm coverage:e2e-spec` | SPEC.md requirement coverage report for the E2E suite                 |
| `pnpm electron:build`    | Package the macOS app (`.dmg` + `.zip`) into `apps/desktop/release/`  |
| `pnpm quality`           | Strict dead-code, duplication, architecture and measured health gates |
| `pnpm package:mac`       | Build and verify macOS arm64/x64 packages and matching metadata       |
| `pnpm package:linux`     | Build and verify Linux x64 AppImage/deb packages on Linux             |
| `pnpm verify:release`    | Verify artifact hashes, versions, package contents and source mapping |

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

Every push to `main` and every pull request runs the existing desktop checks and website validation. Dedicated fallow jobs add dead-code, duplication, architecture, measured health and change auditing. Package checks build macOS and Linux artifacts and exercise isolated packaged applications. No CI test requires a personal Raindrop account. Workflow definitions are not proof of a successful run: execution URLs and source commits belong in the [release evidence](docs/goal-2026-11-09/release.md).

## Release

`pnpm package:mac` and `pnpm package:linux` use [electron-builder.yml](apps/desktop/electron-builder.yml). macOS produces DMG/ZIP packages for arm64 and x64; Linux produces x64 AppImage/deb packages. Update feeds, blockmaps, checksums and source provenance are checked against the actual artifacts.

The [build-and-release workflow](.github/workflows/build-and-release.yml) supports signed tag releases and manually dispatched QA drafts. A QA draft is excluded from the production update feed. Signed builds require the configured OAuth, signing and notarization credentials; an unsigned packaging run does not establish authentication, Gatekeeper or notarization success.

Updates never install merely because the user quits. Settings → Updates offers a check, explicit download, progress, Later, and Restart and install. Pending edits/transfers block restart. AppImage supports the update flow; deb installations show the package-management/download route. See the [release runbook and current limitations](docs/goal-2026-11-09/release.md).

Local signed release preparation remains available through `pnpm electron:release:mac`. Use existing secret references or the documented CI secret configuration; keep credentials out of logs, repository files and PR attachments.

## Website deployment

The landing page is deployed by the `lain-web` Vercel project in the `laststance` team, which is Git-connected to this repository with its Root Directory set to `apps/website`. Every pull request gets a preview deployment. See [website deployment instructions](apps/website/README.md#vercel-deployment) for the complete settings and preview verification steps.

## Security model

- OAuth tokens use Electron `safeStorage` and never use `localStorage`. When secure encryption is unavailable, including Linux's `basic_text` backend, credentials remain in memory and the UI explains that sign-in lasts only for the current session.
- The renderer runs with `contextIsolation` and `sandbox` enabled and no Node integration; privileged calls go through a sender-validated IPC bridge.
- The renderer receives the current access token through the narrow auth IPC to authorize API requests. It is not accurate to claim that tokens never reach the renderer.
- OAuth callbacks verify the redirect and state value. Concurrent token refreshes share one request; temporary authentication-service failures preserve credentials for retry.

---

Built by [Laststance.io](https://laststance.io).
