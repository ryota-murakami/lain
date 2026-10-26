import tsPrefixer from 'eslint-config-ts-prefixer'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import laststanceReact from '@laststance/react-next-eslint-plugin'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'dist-electron',
    'coverage',
    'src/store/api/raindropApi.ts',
    'eslint.config.js',
    'vitest.config.ts',
    'playwright.config.ts',
    'rtk-codegen.config.ts',
    'e2e/**',
  ]),
  ...tsPrefixer,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    plugins: {
      '@laststance/react-next': laststanceReact,
    },
    rules: {
      '@laststance/react-next/no-jsx-without-return': 'error',
      '@laststance/react-next/all-memo': 'error',
      '@laststance/react-next/no-use-reducer': 'error',
      '@laststance/react-next/no-set-state-prop-drilling': [
        'error',
        { depth: 1 },
      ],
      '@laststance/react-next/no-deopt-use-callback': 'error',
      '@laststance/react-next/no-deopt-use-memo': 'error',
      '@laststance/react-next/no-direct-use-effect': 'error',
      '@laststance/react-next/no-forward-ref': 'error',
      '@laststance/react-next/no-context-provider': 'error',
      '@laststance/react-next/no-missing-key': 'error',
      '@laststance/react-next/no-duplicate-key': 'error',
      '@laststance/react-next/no-missing-component-display-name': 'error',
      '@laststance/react-next/no-nested-component-definitions': 'error',
      '@laststance/react-next/no-missing-button-type': 'error',
      '@laststance/react-next/prefer-stable-context-value': 'error',
      '@laststance/react-next/prefer-usecallback-might-work': 'error',
      '@laststance/react-next/prefer-usecallback-for-memoized-component':
        'error',
      '@laststance/react-next/prefer-usememo-for-memoized-component': 'error',
      '@laststance/react-next/prefer-usememo-might-work': 'error',
    },
  },
])
