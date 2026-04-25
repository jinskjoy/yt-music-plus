import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig(({ command }) => {
  const manifestConfig = { ...manifest }

  // Only add the HMR CSP during development
  if (command === 'serve') {
    manifestConfig.content_security_policy = {
      extension_pages: "script-src 'self' http://localhost:5173; object-src 'self'; connect-src http://localhost:5173 ws://localhost:5173",
    }
  }

  return {
    plugins: [crx({ manifest: manifestConfig })],
    server: {
      port: 5173,
      strictPort: true,
      hmr: {
        port: 5173,
      },
    },
    clearScreen: false,
  }
})
