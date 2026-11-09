# Dependency migration (2026-11-09)

Registry latest stable versions were queried with pnpm and installed with pnpm 12.18.0. Node is pinned to 26.13.0 in `.node-version` and CI; the supported workspace engine is Node 26. The inherited happy-dom/security changes were preserved and advanced where compatible.

## Deliberate exceptions

- Vite 8.3.6 is pinned: 8.3.7 requires rolldown ~1.2.18, published 2026-11-09 10:07 UTC, inside the existing 24-hour release-age protection. No age exception was added. Recheck after 2026-11-10 10:08 UTC.
- TypeScript 6.0.3 is pinned to its supported minor: latest 7.0.2 is outside the declared peer ranges of eslint-config-ts-prefixer 5.1.0 and @laststance/react-next-eslint-plugin 2.4.0. Neither type safety nor lint rules were relaxed.
- The website keeps ESLint 9.39.5: eslint-config-next 16.4.5 includes react/import/jsx-a11y plugins whose supported peer range ends at ESLint 9. Desktop uses ESLint 10.14.0. The registry marks ESLint 9 deprecated; this is a toolchain compatibility hold.
- follow-redirects 1.16.2 retains the inherited security floor: 1.16.3 was published 2026-11-08 16:53 UTC and was still inside the 24-hour hold during installation. Recheck after 2026-11-09 16:54 UTC.
- Removed the MCP SDK override after verifying no dependency requires the package anymore.
- The canonical Tailwind formatting plugin's upstream language-service declares CSStools parser 2 with tokenizer/parser-algorithms 3. The same peer mismatch exists in its latest upstream language-service. It is reported by `pnpm peers check`, not suppressed. The frozen-source lint-staged formatting run passed.

## Migrations

- Electron 45 requires macOS 13 or later. The minimum package OS version was raised from 12 to 13 to match Electron 44’s platform change, confirmed in the [official breaking changes](https://github.com/electron/electron/blob/main/docs/breaking-changes.md#removed-macos-12-support). Intel and Apple Silicon artifacts remain supported.

- pnpm 12 moves the previous explicit build script allowlist from package.json to `allowBuilds` in pnpm-workspace.yaml. Release age and store integrity remain enabled. The v11 content-addressed store required a clean dependency relink.
- TypeScript aliases retain relative `paths` and drop deprecated `baseUrl`.
- Vite/Vitest configs use `import.meta.dirname`; Vite 8 and plugin-react 6 use Rolldown/Oxc.
- Vitest 5 removes the old experimental-webstorage workaround; JSON coverage is emitted for measured fallow health.
- MSW 3 uses `onUnhandledFrame: error`. happy-dom 21 CORS preflights are answered only for the mocked Raindrop API; unhandled API requests stay errors. Test setup selects the real Axios Node HTTP adapter because happy-dom XHR drops DELETE bodies. Production transport is unchanged; CRUD/tag regressions pass with request bodies intact.
- Removed five verified unused dependencies: date-fns, motion, react-day-picker, @faker-js/faker, esbuild-runner.

## Version changes

| Manifest                    | Package                                         | Before   | After    |
| --------------------------- | ----------------------------------------------- | -------- | -------- |
| `package.json`              | `@electron/asar`                                | —        | 4.3.1    |
| `package.json`              | `fallow`                                        | —        | 3.41.0   |
| `package.json`              | `lint-staged`                                   | ^16.2.7  | ^17.6.0  |
| `package.json`              | `prettier`                                      | ^3.8.1   | ^3.9.10  |
| `package.json`              | `prettier-plugin-tailwindcss`                   | ^0.7.2   | ^0.8.1   |
| `package.json`              | `prettier-plugin-tailwindcss-canonical-classes` | ^0.1.3   | ^0.1.6   |
| `package.json`              | `yaml`                                          | —        | 2.9.1    |
| `apps/desktop/package.json` | `@base-ui/react`                                | ^1.2.0   | removed  |
| `apps/desktop/package.json` | `@fontsource-variable/geist`                    | ^5.2.8   | ^5.3.0   |
| `apps/desktop/package.json` | `@hookform/resolvers`                           | ^5.2.2   | ^7.0.3   |
| `apps/desktop/package.json` | `@laststance/redux-storage-middleware`          | ^0.2.1   | ^0.5.1   |
| `apps/desktop/package.json` | `@reduxjs/toolkit`                              | ^2.11.2  | ^2.14.0  |
| `apps/desktop/package.json` | `@tailwindcss/vite`                             | ^4.1.18  | ^4.3.5   |
| `apps/desktop/package.json` | `axios`                                         | ^1.13.5  | ^1.21.0  |
| `apps/desktop/package.json` | `date-fns`                                      | ^4.1.0   | removed  |
| `apps/desktop/package.json` | `electron-store`                                | ^11.0.2  | ^12.0.0  |
| `apps/desktop/package.json` | `electron-updater`                              | ^6.8.9   | ^6.8.11  |
| `apps/desktop/package.json` | `fuse.js`                                       | ^7.1.0   | ^7.5.0   |
| `apps/desktop/package.json` | `lucide-react`                                  | ^0.564.0 | ^1.70.0  |
| `apps/desktop/package.json` | `motion`                                        | ^12.34.0 | removed  |
| `apps/desktop/package.json` | `radix-ui`                                      | ^1.4.3   | ^1.8.1   |
| `apps/desktop/package.json` | `react`                                         | ^19.2.4  | ^19.3.1  |
| `apps/desktop/package.json` | `react-day-picker`                              | ^9.13.2  | removed  |
| `apps/desktop/package.json` | `react-dom`                                     | ^19.2.4  | ^19.3.1  |
| `apps/desktop/package.json` | `react-hook-form`                               | ^7.71.1  | ^7.91.0  |
| `apps/desktop/package.json` | `react-redux`                                   | ^9.2.0   | ^9.3.1   |
| `apps/desktop/package.json` | `react-resizable-panels`                        | ^4.6.3   | removed  |
| `apps/desktop/package.json` | `sonner`                                        | ^2.0.7   | ^2.0.8   |
| `apps/desktop/package.json` | `tailwind-merge`                                | ^3.4.0   | ^3.7.0   |
| `apps/desktop/package.json` | `tailwindcss`                                   | ^4.1.18  | ^4.3.5   |
| `apps/desktop/package.json` | `ts-pattern`                                    | ^5.9.0   | ^5.9.2   |
| `apps/desktop/package.json` | `zod`                                           | ^4.3.6   | ^4.6.7   |
| `apps/desktop/package.json` | `@faker-js/faker`                               | ^10.3.0  | removed  |
| `apps/desktop/package.json` | `@laststance/react-next-eslint-plugin`          | ^2.0.0   | ^2.4.0   |
| `apps/desktop/package.json` | `@playwright/test`                              | ^1.58.2  | ^1.65.0  |
| `apps/desktop/package.json` | `@testing-library/jest-dom`                     | ^6.9.1   | ^7.0.1   |
| `apps/desktop/package.json` | `@testing-library/react`                        | ^16.3.2  | ^16.3.3  |
| `apps/desktop/package.json` | `@testing-library/user-event`                   | ^14.6.1  | ^14.6.8  |
| `apps/desktop/package.json` | `@types/node`                                   | ^25.2.3  | ^26.6.6  |
| `apps/desktop/package.json` | `@types/react`                                  | ^19.2.14 | ^19.3.0  |
| `apps/desktop/package.json` | `@types/react-dom`                              | ^19.2.3  | ^19.3.0  |
| `apps/desktop/package.json` | `@vitejs/plugin-react`                          | ^5.1.4   | ^6.3.0   |
| `apps/desktop/package.json` | `@vitest/coverage-v8`                           | ^4.0.18  | ^5.1.0   |
| `apps/desktop/package.json` | `electron`                                      | ^40.10.6 | ^45.2.3  |
| `apps/desktop/package.json` | `electron-builder`                              | ^26.7.0  | ^26.18.0 |
| `apps/desktop/package.json` | `esbuild-runner`                                | ^2.2.2   | removed  |
| `apps/desktop/package.json` | `eslint`                                        | ^9.39.2  | ^10.14.0 |
| `apps/desktop/package.json` | `eslint-config-ts-prefixer`                     | ^4.1.3   | ^5.1.0   |
| `apps/desktop/package.json` | `eslint-plugin-react-hooks`                     | ^7.0.1   | ^7.1.1   |
| `apps/desktop/package.json` | `eslint-plugin-react-refresh`                   | ^0.5.0   | ^0.5.7   |
| `apps/desktop/package.json` | `globals`                                       | ^17.3.0  | ^17.14.0 |
| `apps/desktop/package.json` | `happy-dom`                                     | ^21.0.0  | ^21.0.4  |
| `apps/desktop/package.json` | `knip`                                          | ^5.83.1  | ^6.44.2  |
| `apps/desktop/package.json` | `msw`                                           | ^2.12.10 | ^3.0.4   |
| `apps/desktop/package.json` | `shadcn`                                        | ^3.8.4   | ^4.23.0  |
| `apps/desktop/package.json` | `tsx`                                           | ^4.21.0  | ^4.23.15 |
| `apps/desktop/package.json` | `typescript`                                    | ~5.9.3   | ~6.0.3   |
| `apps/desktop/package.json` | `typescript-eslint`                             | ^8.55.0  | ^8.72.1  |
| `apps/desktop/package.json` | `vite`                                          | ^7.3.1   | 8.3.6    |
| `apps/desktop/package.json` | `vite-plugin-electron`                          | ^0.29.0  | ^1.2.0   |
| `apps/desktop/package.json` | `vite-plugin-electron-renderer`                 | ^0.14.6  | ^1.0.0   |
| `apps/desktop/package.json` | `vitest`                                        | ^4.0.18  | ^5.1.0   |
| `apps/website/package.json` | `next`                                          | 16.3.5   | 16.4.5   |
| `apps/website/package.json` | `react`                                         | 19.2.8   | 19.3.1   |
| `apps/website/package.json` | `react-dom`                                     | 19.2.8   | 19.3.1   |
| `apps/website/package.json` | `@tailwindcss/postcss`                          | ^4       | ^4.3.5   |
| `apps/website/package.json` | `@types/node`                                   | ^20      | ^26.6.6  |
| `apps/website/package.json` | `@types/react`                                  | ^19      | ^19.3.0  |
| `apps/website/package.json` | `@types/react-dom`                              | ^19      | ^19.3.0  |
| `apps/website/package.json` | `eslint`                                        | ^9       | ^9.39.5  |
| `apps/website/package.json` | `eslint-config-next`                            | 16.3.5   | 16.4.5   |
| `apps/website/package.json` | `tailwindcss`                                   | ^4       | ^4.3.5   |
| `apps/website/package.json` | `typescript`                                    | ^5       | ~6.0.3   |

After unused UI primitives were removed, `@base-ui/react` and `react-resizable-panels` also had no consumers and were removed. The table records their final removal; they are no longer direct dependencies.

## Transitive dependency audit

After the direct upgrade, `pnpm audit --json` reported 8 advisory matches (2 high, 5 moderate, 1 low, 0 critical), all under development/build tooling. The canonical Tailwind formatter pinned PostCSS 8.5.4 and selector-parser 6.0.2. Scoped, same-major overrides now select mature releases PostCSS 8.5.32 and selector-parser 6.1.5, retaining the release-age guard. These fixes follow the [PostCSS source-map advisory](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) and [selector-parser advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).

A second audit reports 3 residual advisory matches: 0 high/critical, 2 moderate (`glob` through ASAR and `minimatch` through ASAR/lint/build tools), and 1 low (`deepmerge` through the shadcn CLI). The current compatible upstream ranges still select glob 13 and minimatch 9/10, whereas fixes require major upgrades to glob 14/minimatch 11. No untested cross-major override was forced into the release/lint toolchain. deepmerge has no patched version listed. These are recorded exceptions, not suppressed audit findings or proof of exploitability in Lain. Production runtime exposure has not been established.

The final direct-version registry recheck still lists only the documented Vite, TypeScript and website ESLint exceptions. The ESLint 9 compatibility hold is explicitly deprecated by the registry even though pnpm's `outdated` display reports `isDeprecated: false` for the entry.
