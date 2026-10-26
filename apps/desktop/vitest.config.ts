import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['test/**', 'src/**/*.test.*', 'src/store/api/raindropApi.ts'],
      // Gate: fail `pnpm test:coverage` when coverage regresses below these floors.
      // Baseline 2026-09-22: 50.0% stmts / 35.0% branches / 38.0% funcs / 51.1% lines.
      // Raise the floors as coverage grows — never lower them.
      thresholds: {
        statements: 45,
        branches: 30,
        functions: 33,
        lines: 45,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './test'),
      '@fixtures': path.resolve(__dirname, './fixtures'),
    },
  },
})
