# lain-web

Landing page for [Lain](https://github.com/ryota-murakami/lain), the macOS-native Raindrop.io desktop client. This package lives in `apps/website` alongside `apps/desktop` in the Lain pnpm workspace.

Next.js (App Router) + Tailwind CSS v4, deployed on Vercel (Laststance).

Run these commands from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm dev:web      # http://localhost:3000
pnpm validate:web # lint, generated route types, TypeScript, production build
pnpm start:web   # serve the production build
```

Inside this directory, `pnpm dev`, `pnpm build`, `pnpm lint`, and `pnpm typecheck` also work. The pnpm version and lockfile are managed at the repository root.

Screenshots in `public/screenshots/` are captured from the app's headless E2E harness with mock data.

## Vercel deployment

Keep the existing `lain-web` project in the **Laststance** team so its domain and deployment history remain intact. These settings are already applied; re-apply them if the project is ever recreated:

1. Connect the project to the Lain repository (`ryota-murakami/lain`, the current Git remote) instead of the separate `lain-web` repository.
2. Set **Root Directory** to `apps/website` and enable **Include source files outside of the Root Directory** so Vercel can read the workspace manifest, shared lockfile, and dependencies.
3. Keep the **Next.js** framework preset, automatic install command, default `next build` command, and `.next` output directory. Clear any override that runs the desktop build from the repository root.
4. Keep Node.js **24.x**, enable Corepack with `ENABLE_EXPERIMENTAL_COREPACK=1`, and use the repository's pinned pnpm version. Verify a preview deployment before promoting to production.

Use `--scope laststance` for every Vercel CLI command. See [Vercel's monorepo documentation](https://vercel.com/docs/monorepos) and [package manager configuration](https://vercel.com/docs/package-managers).

Imported from `ryota-murakami/lain-web` commit `ce98fba436f18985427d51f752b62ec64222248a`. UI behavior and image assets are preserved; UI source changes are limited to JSX formatting. The original repository remains available for its history.
