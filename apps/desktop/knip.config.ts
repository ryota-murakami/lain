import type { KnipConfig } from 'knip'

/**
 * Check desktop files/dependencies while Fallow enforces exports, types and architectural rules.
 * Electron and CI-invoked TypeScript CLIs need explicit entries because Knip cannot infer their launchers.
 * @example pnpm knip
 */
const config: KnipConfig = {
  entry: [
    'electron/main.ts',
    'electron/preload.ts',
    'electron/test-auth.ts',
    'scripts/smoke-package.ts',
    'scripts/update-qa.ts',
  ],
  project: ['src/**/*.{ts,tsx,css}', 'electron/**/*.ts', 'scripts/**/*.ts'],
  // Generated API findings are excluded consistently with the strict Fallow graph.
  ignore: ['src/store/api/raindropApi.ts'],
  // Preserve the original Knip responsibilities; Fallow separately gates these categories without baselines.
  exclude: ['exports', 'types', 'nsExports', 'nsTypes'],
  ignoreDependencies: [
    // Required peer dependencies of eslint-config-ts-prefixer.
    'globals',
    'typescript-eslint',
  ],
}

export default config
