# lain-web

Landing page for [Lain](https://github.com/laststance/lain), the macOS-native Raindrop.io desktop client.

Next.js (App Router) + Tailwind CSS v4. Deployed on Vercel as project `lain-web` (Laststance team). The Vercel Root Directory is `apps/website`. Install runs from the workspace root via [`vercel.json`](vercel.json):

```json
pnpm install --frozen-lockfile --filter lain-web...
```

From the repository root:

```bash
pnpm install
pnpm dev:web    # http://localhost:3000
pnpm build:web
```

Screenshots in `public/screenshots/` are captured from the app's headless E2E harness with mock data.
