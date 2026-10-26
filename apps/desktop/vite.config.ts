import path from 'path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import electron from 'vite-plugin-electron/simple'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (empty prefix = load ALL, not just VITE_*)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      electron({
        main: {
          entry: 'electron/main.ts',
          vite: {
            define: {
              'process.env.VITE_RAINDROP_CLIENT_ID': JSON.stringify(
                env.VITE_RAINDROP_CLIENT_ID,
              ),
              'process.env.RAINDROP_CLIENT_SECRET': JSON.stringify(
                env.RAINDROP_CLIENT_SECRET,
              ),
            },
          },
        },
        preload: {
          input: 'electron/preload.ts',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
